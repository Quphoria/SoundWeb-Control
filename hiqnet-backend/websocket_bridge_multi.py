import asyncio, os, sys, threading
from janus import Queue
import json, hmac, hashlib, time
from config import load_config
from concurrent.futures import ThreadPoolExecutor
from functools import partial
import socket, uuid

from websocket_server import WebsocketServer
from hiqnet_proto import *
from hiqnet_client import HiQnetThread, HiQnetUDPListenerThread

token_time_range = 10 * 60 * 1000 # +-10 minutes

HIQNET_PORT = 3804

subscribed_params = {}

ws_server = None
WS_DATA_LOCK = threading.Lock()
WEBSOCKET_LIST = []
WS_USER_DATA = {}
RUN_SERVER = True

param_cache_lock = threading.Lock()
param_cache = {}
param_rebroadcast_time = 5 # 5 seconds

client_thread_status = {}

VERSION = ""
try:
    with open(os.path.join(sys.path[0], 'VERSION'), "r") as f:
        VERSION = f.read().strip()
except:
    pass
if VERSION == "":
    VERSION = "Unknown"

def should_send(client, msg=None):
    if msg is None:
        return True
    if not "parameter" in msg:
        return True
    addr = client.get("address", "")
    if not addr:
        return True
    if not addr in WS_USER_DATA:
        return False
    _, _, user_sub = WS_USER_DATA[addr]
    return msg["parameter"] in user_sub

async def resp_broadcast(node: str):
    global param_cache, param_cache_lock, ws_server, WEBSOCKET_LIST
    while True:
        # Get a "work item" out of the queue.
        msg = await resp_queues[node].async_q.get()
        data = json.dumps(msg)
        if msg["type"] == "SET":
            with param_cache_lock:
                t = time.time()
                # check if value has stayed the same in the cache
                if msg["parameter"] in param_cache and param_cache[msg["parameter"]][1] == data:
                    # if it has not been the minimum rebroadcast time, don't bother resending the data
                    if t - param_cache[msg["parameter"]][0] < param_rebroadcast_time:
                        continue
                param_cache[msg["parameter"]] = (t, data)
        SEND_LIST = filter(partial(should_send, msg=msg), WEBSOCKET_LIST)
        if SEND_LIST:
            ws_server.send_message_to_list(SEND_LIST, data)

def get_packet_node_handler(p: Packet) -> str:
    global config
    if hex(p.node) in config["nodes"]:
        return hex(p.node)
    return "default"

previous_tokens = {}

def check_auth_token_hmac(message: str):
    global previous_tokens
    t = round(time.time() * 1000)
    # remove tokens older than the oldest allowed time (+1 second for safe overlap)
    for tkn_time in list(previous_tokens.keys()):
        if tkn_time + 1000 + token_time_range < t:
            previous_tokens.pop(tkn_time, None)

    try:
        token = json.loads(message)
        h = hmac.new(config["authTokenSecret"].encode("ascii"), token["data"].encode(), hashlib.sha256).hexdigest()
        if hmac.compare_digest(h, token["hash"]):
            # hmac valid
            data = json.loads(token["data"])
            username = data["username"]
            token_time = data["time"]
            assert type(username) == str, "Username not a string"
            assert type(token_time) == int, "Token time not an int"
            if abs(t - token_time) < token_time_range:
                print(f"HMAC verified for {username}", flush=True)
                previous_tokens[t] = h
                return True, data
    except Exception as ex:
        # print(ex, flush=True)
        # hmac failed
        # ignore error
        pass
    return False, None

def ws_on_connection_open(client, server):
    print("Websocket Connection:", client["address"], flush=True)

def close_ws_client(client, server):
    client["handler"].send_close(1000, b'')
    server._terminate_client_handler(client["handler"])

def ws_on_data_receive(client, server, message):
    global WEBSOCKET_LIST, WS_USER_DATA, WS_DATA_LOCK, RUN_SERVER
    user_data, user_options, user_subs = WS_USER_DATA.get(client["address"], (None, None, None))
    if user_data is None:
        # close websocket if auth token invalid
        auth_valid, user_data = check_auth_token_hmac(message)
        if user_data is None or not auth_valid:
            close_ws_client(client, server)
            return
        user_options = user_data.get("options", {})
        with WS_DATA_LOCK:
            WS_USER_DATA[client["address"]] = (user_data, user_options, [])
            if not user_options.get("status", False):
                WEBSOCKET_LIST.append(client)
        # send __test__ to acknowledge websocket auth
        server.send_message(client, "__test__")
        # if not user_options.get("status", False):
        #     # we don't need to send the entire param_cache as the values will get sent when the client subscribes to them
        #     for p in param_cache.values():
        #         server.send(client, p[1])
    elif message == "__test__":
        server.send_message(client, "__test__")
    elif message == "status":
        if user_data.get("admin", False):
            server.send_message(client, json.dumps({
                "type": "status",
                "data": client_thread_status
            }))
    elif message == "version":
        if user_data.get("admin", False):
            server.send_message(client, json.dumps({
                "type": "version",
                "data": VERSION
            }))
    elif message == "restart":
        if user_data.get("admin", False):
            print(f"Restart attempted by {user_data['username']}")
            RUN_SERVER = False
    elif not user_options.get("statusonly", False):
        try:
            data = json.loads(message)
            if data.get("type", "") == "UNSUBSCRIBE_ALL":
                user_subs = []
                with WS_DATA_LOCK:
                    WS_USER_DATA[client["address"]] = (user_data, user_options, user_subs)
            else:
                p = Packet.from_json(json.loads(message))
                sub_handler_node = get_packet_node_handler(p)
                # print(p, flush=True)
                sent_value = False
                if p.message_type == MessageType.SUBSCRIBE or p.message_type == MessageType.SUBSCRIBE_PERCENT:
                    p.value = config["subscription_rate_ms"]
                    for sub in subscribed_params[sub_handler_node]:
                        if sub.param_str() == p.param_str() and sub.message_type == p.message_type:
                            if p.param_str() in param_cache: # avoid resubscribing to parameters if value cached
                                server.send_message(client, param_cache[p.param_str()][1])
                                sent_value = True
                            else:
                                subscribed_params[sub_handler_node].remove(sub)
                    if not sent_value: # avoid resubscribing to parameters
                        # send unsub first so we get param sent to us
                        p2 = p.copy()
                        has_unsub = False
                        if p.message_type == MessageType.SUBSCRIBE:
                            p2.message_type = MessageType.UNSUBSCRIBE
                            has_unsub = True
                        elif p.message_type == MessageType.SUBSCRIBE_PERCENT:
                            p2.message_type = MessageType.UNSUBSCRIBE_PERCENT
                            has_unsub = True
                        if has_unsub:
                            msg_queues[sub_handler_node].sync_q.put(p2)

                        subscribed_params[sub_handler_node].append(p)
                        # msg_queues[sub_handler_node].sync_q.put(p)
                    msg_queues[sub_handler_node].sync_q.put(p) # resubscribe (sometimes soundweb forgets about us i think)
                    if p.param_str not in user_subs:
                        user_subs.append(p.param_str())
                        with WS_DATA_LOCK:
                            WS_USER_DATA[client["address"]] = (user_data, user_options, user_subs)
                elif p.message_type == MessageType.UNSUBSCRIBE or p.message_type == MessageType.UNSUBSCRIBE_PERCENT:
                    for sub in subscribed_params[sub_handler_node]:
                        if sub.param_str() == p.param_str() and sub.message_type == p.message_type:
                            subscribed_params[sub_handler_node].remove(sub)
                    msg_queues[sub_handler_node].sync_q.put(p)
                    if p.param_str() in user_subs:
                        user_subs.remove(p.param_str())
                        with WS_DATA_LOCK:
                            WS_USER_DATA[client["address"]] = (user_data, user_options, user_subs)
                else:
                    msg_queues[sub_handler_node].sync_q.put(p)
        except (json.JSONDecodeError, DecodeFailed, UnsupportedMessage) as ex:
            print("Failed to decode:", ex, ":", message, flush=True)

def ws_on_connection_close(client, server):
    global WS_DATA_LOCK, WEBSOCKET_LIST, WS_USER_DATA
    with WS_DATA_LOCK:
        if client in WEBSOCKET_LIST:
            WEBSOCKET_LIST.remove(client)
        ip = client["address"]
        if ip in WS_USER_DATA:
            WS_USER_DATA.pop(ip)

health_check_queue = None

def update_health(healthy: bool):
    with open("health.status", "w") as f:
        if healthy:
            f.write("0")
        else:
            f.write("1")

async def health_check():
    global client_thread_status, RUN_SERVER
    client_thread_status = {}
    if health_check_queue is None:
        return
    while RUN_SERVER:
        # Get a "work item" out of the queue.
        status = await health_check_queue.async_q.get()
        client_thread_status[status["id"]] = status["status"]

        healthy = all(s for s in client_thread_status.values())
        update_health(healthy)

def get_node_alias(n):
    global config
    # Return the alias or just the node id
    return config["node_names"].get(n, n)

def test_udp_receive(bind_ip, hiqnet_port, dest_ip):
    # server socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.bind((bind_ip, hiqnet_port))
    s.settimeout(1)

    # test client socket
    s2 = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s2.settimeout(1)

    test_str = str(uuid.uuid4()).encode()

    s2.sendto(test_str, (dest_ip, hiqnet_port))

    try:
        for i in range(10): # allow 10 timeouts before failing
            try:
                while True: # keep receiving until timeout occurs, we may be getting flooded with packets
                    data = s.recv(1024)
                    if data == test_str:
                        s.close()
                        s2.close()
                        print("UDP test passed")
                        return True
            except (TimeoutError, socket.timeout):
                continue
            time.sleep(1)
    except Exception as ex:
        print("Error testing UDP receive:", ex)
    finally:
        s.close()
        s2.close()
    print("Failed to receive UDP message sent to itself!")
    print(f"Please check that the server_ip_address (& related) config values are correct and UDP port {hiqnet_port} is accessible at this IP")
    return False


hiqnet_udp_thread = None
hiqnet_tcp_threads = []
UDP_NODE_ID = "UDP"
async def main():
    global config, ws_server, msg_queues, resp_queues, hiqnet_udp_thread, hiqnet_tcp_threads, subscribed_params, health_check_queue, RUN_SERVER
    health_check_queue = Queue(50)
    msg_queues = {key: Queue(200) for key in config["nodes"].keys()}
    resp_queues = {key: Queue(200) for key in config["nodes"].keys()}
    resp_queues[UDP_NODE_ID] = Queue(200)
    subscribed_params = {key: list() for key in config["nodes"].keys()}

    # check UDP works
    if not test_udp_receive("0.0.0.0", HIQNET_PORT, config["server_ip_address"]):
        return

    MY_ADDRESS.device = int(config["server_node_address"], base=16)
    network_info = NetworkInfo(
        config["server_mac_address"],
        False, # dhcp not yet supported
        config["server_ip_address"],
        config["server_subnet_mask"],
        config["server_gateway"])
    disco_info = DiscoveryInformation(network_info)

    hiqnet_tcp_threads = {
        key: HiQnetThread(f"HiQnet {key} TCP Thread", get_node_alias(key), int(key, base=16), ip, HIQNET_PORT,msg_queues[key], resp_queues[key], subscribed_params[key], health_check_queue, disco_info)
        for key, ip in config["nodes"].items()}
    hiqnet_udp_thread = HiQnetUDPListenerThread("HiQnet UDP Thread", UDP_NODE_ID, "0.0.0.0", HIQNET_PORT, resp_queues[UDP_NODE_ID], health_check_queue)
    
    # start udp thread first to receive initial messages
    hiqnet_udp_thread.start()
    for t in hiqnet_tcp_threads.values():
        t.start()
    print(f"Websocket server listening on ws://0.0.0.0:{config['websocket_port']}", flush=True)
    
    for node in config["nodes"]:
        asyncio.create_task(resp_broadcast(node))
    asyncio.create_task(resp_broadcast(UDP_NODE_ID))

    ws_server = WebsocketServer(host="0.0.0.0", port=config["websocket_port"])
    ws_server.set_fn_new_client(ws_on_connection_open)
    ws_server.set_fn_client_left(ws_on_connection_close)
    ws_server.set_fn_message_received(ws_on_data_receive)
    ws_server.run_forever(threaded=True)
    health_task = asyncio.create_task(health_check())
    while RUN_SERVER:
        await asyncio.sleep(2)
    health_task.cancel()
    try:
        await health_task
    except asyncio.CancelledError:
        pass

if __name__ == "__main__":
    update_health(False) # set healthy to false when starting
    config = load_config("config/config.json")
    print("HiQnet Websocket Proxy", VERSION)
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
    print("Exiting...")

    if hiqnet_tcp_threads:
        for t in hiqnet_tcp_threads.values():
            t.exitFlag = True
        for t in hiqnet_tcp_threads.values():
            t.join()
    if ws_server:
        ws_server.shutdown_gracefully()
        # should figure out how to get thread to exit, but thread is daemonized so will get killed when program exits
    if hiqnet_udp_thread:
        hiqnet_udp_thread.exitFlag = True
        hiqnet_udp_thread.join()

    if msg_queues:
        for q in msg_queues.values():
            q.close()
    if resp_queues:
        for q in resp_queues.values():
            q.close()