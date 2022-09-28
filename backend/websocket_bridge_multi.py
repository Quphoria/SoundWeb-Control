import asyncio, os, sys, threading
from janus import Queue
import json, hmac, hashlib, time
from config import load_config
from concurrent.futures import ThreadPoolExecutor
from functools import partial

from websocket_server import WebsocketServer
from soundweb_proto import MessageType, Packet, meter_value_db, decode_packets, DecodeFailed
from soundweb_client import SoundWebThread

token_time_range = 10 * 60 * 1000 # +-10 minutes

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
                        subscribed_params[sub_handler_node].append(p)
                        # subscribe_queues[sub_handler_node].sync_q.put(p)
                    subscribe_queues[sub_handler_node].sync_q.put(p) # resubscribe (sometimes soundweb forgets about us i think)
                    if p.param_str not in user_subs:
                        user_subs.append(p.param_str())
                        with WS_DATA_LOCK:
                            WS_USER_DATA[client["address"]] = (user_data, user_options, user_subs)
                elif p.message_type == MessageType.UNSUBSCRIBE or p.message_type == MessageType.UNSUBSCRIBE_PERCENT:
                    for sub in subscribed_params[sub_handler_node]:
                        if sub.param_str() == p.param_str() and sub.message_type == p.message_type:
                            subscribed_params[sub_handler_node].remove(sub)
                    subscribe_queues[sub_handler_node].sync_q.put(p)
                    if p.param_str() in user_subs:
                        user_subs.remove(p.param_str())
                        with WS_DATA_LOCK:
                            WS_USER_DATA[client["address"]] = (user_data, user_options, user_subs)
                else:
                    msg_queue.sync_q.put(p)
        except (json.JSONDecodeError, DecodeFailed) as ex:
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

soundweb_thread = None
soundweb_subscribe_threads = []
async def main():
    global config, ws_server, msg_queue, resp_queues, subscribe_queues, soundweb_thread, soundweb_subscribe_threads, subscribed_params, health_check_queue, RUN_SERVER
    msg_queue = Queue(200)
    health_check_queue = Queue(50)
    resp_queues = {key: Queue(200) for key in config["nodes"].keys()}
    subscribe_queues = {key: Queue(200) for key in config["nodes"].keys()}
    soundweb_ip = config["nodes"]["default"]
    subscribed_params = {key: list() for key in config["nodes"].keys()}

    soundweb_thread = SoundWebThread("SoundWeb Message Thread", "Message (default)", soundweb_ip, 1023, msg_queue, None, None, health_check_queue)
    soundweb_subscribe_threads = {
        key: SoundWebThread(f"SoundWeb {key} Sync Thread", key, ip, 1023, subscribe_queues[key], resp_queues[key], subscribed_params[key], health_check_queue)
        for key, ip in config["nodes"].items()}
    soundweb_thread.start()
    for t in soundweb_subscribe_threads.values():
        t.start()
    print(f"Websocket server listening on ws://0.0.0.0:{config['websocket_port']}", flush=True)
    
    for node in config["nodes"]:
        asyncio.create_task(resp_broadcast(node))
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

    if soundweb_thread:
        soundweb_thread.exitFlag = True
        soundweb_thread.join()
    if ws_server:
        ws_server.shutdown_gracefully()
        # should figure out how to get thread to exit, but thread is daemonized so will get killed when program exits
    for t in soundweb_subscribe_threads.values():
        t.exitFlag = True
        t.join()

    msg_queue.close()
    for q in resp_queues.values():
        q.close()
    for q in subscribe_queues.values():
        q.close()