import asyncio, os, sys, threading, ipaddress
from janus import Queue, SyncQueueEmpty
import json, hmac, hashlib, time
from config import load_config
from concurrent.futures import ThreadPoolExecutor
from functools import partial
import socket, uuid
from typing import Optional, Dict, Set

from websocket_server import WebsocketServer
from hiqnet_proto import *
from hiqnet_client import HiQnetThread, HiQnetUDPListenerThread, HiQnetTCPListenerThread

token_time_range = 10 * 60 * 1000 # +-10 minutes

HIQNET_PORT = 3804
FAILSAFE_SHUTDOWN_TIME = 30 # safe shutdown aborted after 30 seconds

subscribed_params = {}

ws_server = None
WS_DATA_LOCK = threading.Lock()
WEBSOCKET_LIST = []
WS_USER_DATA = {}
RUN_SERVER = True

# used to store subscriptions, to know when to unsubscribe
SUBS_lock = threading.Lock()
SUBS: Dict[str, Set[str]] = {}
SUBS_UNSUB_DELAY: Dict[str, float] = {}
UNSUB_PACKETS: Dict[str, Packet] = {}

PC_SUBS_lock = threading.Lock()
PC_SUBS: Dict[str, Set[str]] = {}
PC_SUBS_UNSUB_DELAY: Dict[str, float] = {}
PC_UNSUB_PACKETS: Dict[str, Packet] = {}
# used to store unsub packets for later

param_cache_lock = threading.Lock()
param_cache = {}
# separate cache for percent values (in case we get both)
pc_param_cache_lock = threading.Lock()
pc_param_cache = {}
param_rebroadcast_time = 5 # 5 seconds

client_thread_status = {}
stats = {}

VERSION = ""
try:
    with open(os.path.join(sys.path[0], 'VERSION'), "r") as f:
        VERSION = f.read().strip()
except:
    pass
if VERSION == "":
    VERSION = "Unknown"

def should_send(client, parameter=None):
    if parameter is None:
        return True
    addr = client.get("address", "")
    if not addr:
        return True
    if not addr in WS_USER_DATA:
        return False
    _, _, user_subs = WS_USER_DATA[addr]
    if user_subs is None:
        return False
    return parameter in user_subs[0] or parameter in user_subs[1]

def subscribe(p: Packet, addr: str) -> Optional[dict]:
    global subscribed_params, param_cache, param_cache_lock, pc_param_cache, param_cache_lock
    sub_handler_node = get_packet_node_handler(p)
    if sub_handler_node is None:
        return None
    
    p.value = config["subscription_rate_ms"]
    is_percent = p.message_type ==  MessageType.SUBSCRIBE_PERCENT
    param_str = p.param_str()

    old_cached_value = None
    invalidate_cache = True
    if is_percent:
        with PC_SUBS_lock:
            if param_str in PC_SUBS:
                PC_SUBS[param_str].add(addr)
                invalidate_cache = False
            if param_str in PC_SUBS_UNSUB_DELAY:
                del PC_SUBS_UNSUB_DELAY[param_str]
        with pc_param_cache_lock:
            if param_str in pc_param_cache:
                t, old_cached_value = pc_param_cache[param_str]
                # entry is not invalid
                if t is not None:
                    if invalidate_cache:
                        pc_param_cache[param_str] = (None, old_cached_value)
                    else:
                        return old_cached_value
                # if we didn't find it in the param cache, try and resubscribe
    else:
        with SUBS_lock:
            if param_str in SUBS:
                SUBS[param_str].add(addr)
                invalidate_cache = False
            if param_str in SUBS_UNSUB_DELAY:
                del SUBS_UNSUB_DELAY[param_str]
        with param_cache_lock:
            if param_str in param_cache:
                t, old_cached_value = param_cache[param_str]
                # entry is not invalid
                if t is not None:
                    if invalidate_cache:
                        param_cache[param_str] = (None, old_cached_value)
                    else:
                        return old_cached_value
                # if we didn't find it in the param cache, try and resubscribe

    
    # send unsub first so we get param sent to us
    p2 = p.copy()
    has_unsub = False
    if p.message_type == MessageType.SUBSCRIBE:
        p2.message_type = MessageType.UNSUBSCRIBE
        has_unsub = True
    elif p.message_type == MessageType.SUBSCRIBE_PERCENT:
        p2.message_type = MessageType.UNSUBSCRIBE_PERCENT
        has_unsub = True

    assert has_unsub, "Error generating unsub packet"
    msg_queues[sub_handler_node].sync_q.put(p2)

    msg_queues[sub_handler_node].sync_q.put(p) # resubscribe (sometimes soundweb forgets about us i think)

    # append to the nodes subscribe parameters (remove old copies first)
    for sub in subscribed_params[sub_handler_node]:
        if sub.param_str() == p.param_str() and sub.message_type == p.message_type:
            subscribed_params[sub_handler_node].remove(sub)
    subscribed_params[sub_handler_node].append(p)
    if config["subscription_debug"]:
        print(f"Subscribing to: [{sub_handler_node}] {p.param_str()}{' %' if is_percent else ''}", flush=True)

    if is_percent:
        with PC_SUBS_lock:
            if param_str not in PC_SUBS:
                PC_SUBS[param_str] = set()
            PC_SUBS[param_str].add(addr)
            PC_UNSUB_PACKETS[param_str] = p2
    else:
        with SUBS_lock:
            if param_str not in SUBS:
                SUBS[param_str] = set()
            SUBS[param_str].add(addr)
            UNSUB_PACKETS[param_str] = p2

    return old_cached_value

def client_unsubscribe(param_str: str, is_percent: bool, addr: str, fallback_packet: Packet = None):
    global subscribed_params, param_cache, param_cache_lock, pc_param_cache, param_cache_lock
    if is_percent:
        with PC_SUBS_lock:
            if param_str in PC_SUBS and addr in PC_SUBS[param_str]:
                PC_SUBS[param_str].remove(addr)
                if len(PC_SUBS[param_str]) != 0:
                    return # Other clients are still subscribed, don't unsubscribe yet
            if param_str not in PC_UNSUB_PACKETS:
                PC_UNSUB_PACKETS[param_str] = fallback_packet
            PC_SUBS_UNSUB_DELAY[param_str] = time.time()
    else:
        with SUBS_lock:
            if param_str in SUBS and addr in SUBS[param_str]:
                SUBS[param_str].remove(addr)
                if len(SUBS[param_str]) != 0:
                    return # Other clients are still subscribed, don't unsubscribe yet
            if param_str not in UNSUB_PACKETS:
                UNSUB_PACKETS[param_str] = fallback_packet
            SUBS_UNSUB_DELAY[param_str] = time.time()
    
    if config["unsubscribe_delay_s"] == 0:
        unsubscribe(param_str, is_percent)

def unsubscribe(param_str: str, is_percent: bool):
    global subscribed_params, param_cache, param_cache_lock, pc_param_cache, param_cache_lock
    t = time.time()
    unsub_packet = None
    if is_percent:
        with PC_SUBS_lock:
            if param_str not in PC_SUBS_UNSUB_DELAY:
                return
            if t - PC_SUBS_UNSUB_DELAY[param_str] < config["unsubscribe_delay_s"]:
                return
            if param_str in PC_UNSUB_PACKETS:
                unsub_packet = PC_UNSUB_PACKETS[param_str]
    else:
        with SUBS_lock:
            if param_str not in SUBS_UNSUB_DELAY:
                return
            if t - SUBS_UNSUB_DELAY[param_str] < config["unsubscribe_delay_s"]:
                return
            if param_str in UNSUB_PACKETS:
                unsub_packet = UNSUB_PACKETS[param_str]
    
    if not unsub_packet:
        print("Error:", "Attempted to unsubscribe without an unsubscribe packet", flush=True)
        return
    
    sub_handler_node = get_packet_node_handler(unsub_packet)
    msg_queues[sub_handler_node].sync_q.put(unsub_packet)
    if config["subscription_debug"]:
        print(f"Unsubscribing from: [{sub_handler_node}] {unsub_packet.param_str()}{' %' if is_percent else ''}", flush=True)

    # remove from the nodes subscribed parameters
    expected_msg_type = MessageType.SUBSCRIBE_PERCENT if is_percent else MessageType.SUBSCRIBE
    for sub in subscribed_params[sub_handler_node]:
        if sub.param_str() == unsub_packet.param_str() and sub.message_type == expected_msg_type:
            subscribed_params[sub_handler_node].remove(sub)

    if is_percent:
        with PC_SUBS_lock:
            if param_str in PC_SUBS:
                del PC_SUBS[param_str]
            if param_str in PC_SUBS_UNSUB_DELAY:
                del PC_SUBS_UNSUB_DELAY[param_str]
        with pc_param_cache_lock:
            if param_str in pc_param_cache:
                # invalidate cache entry (set t to None)
                pc_param_cache[param_str] = (None, pc_param_cache[param_str][1])
    else:
        with SUBS_lock:
            if param_str in SUBS:
                del SUBS[param_str]
            if param_str in SUBS_UNSUB_DELAY:
                del SUBS_UNSUB_DELAY[param_str]
        with param_cache_lock:
            if param_str in param_cache:
                # invalidate cache entry (set t to None)
                param_cache[param_str] = (None, param_cache[param_str][1])

def restart_all_connections():
    if hiqnet_tcp_threads:
        for t in hiqnet_tcp_threads.values():
            t.restartFlag = True
    if hiqnet_udp_thread:
        hiqnet_udp_thread.restartFlag = True

async def resp_broadcast(node: str):
    global param_cache, param_cache_lock, pc_param_cache, param_cache_lock, ws_server, WEBSOCKET_LIST
    while True:
        # Get a "work item" out of the queue.
        msgs = await resp_queues[node].async_q.get()
        bc_msgs = []
        for msg in msgs:
            data = json.dumps(msg)
            parameter = msg["parameter"]
            if msg["type"] == "SET":
                with param_cache_lock:
                    t = time.time()
                    # check if value has stayed the same in the cache (only check if cache line is valid)
                    if parameter in param_cache and param_cache[parameter][1] == data and param_cache[parameter][0] is not None:
                        # if it has not been the minimum rebroadcast time, don't bother resending the data
                        if t - param_cache[parameter][0] < param_rebroadcast_time:
                            continue
                    param_cache[parameter] = (t, data)
            elif msg["type"] == "SET_PERCENT":
                with pc_param_cache_lock:
                    t = time.time()
                    # check if value has stayed the same in the cache (only check if cache line is valid)
                    if parameter in pc_param_cache and pc_param_cache[parameter][1] == data and pc_param_cache[parameter][0] is not None:
                        # if it has not been the minimum rebroadcast time, don't bother resending the data
                        if t - pc_param_cache[parameter][0] < param_rebroadcast_time:
                            continue
                    pc_param_cache[parameter] = (t, data)
            if config["hiqnet_debug"]:
                print(f"HiQnet RX [{node}]:", msg, flush=True)
            bc_msgs.append((parameter, data))
        await bc_queues[node].async_q.put(bc_msgs)

def websocket_broadcast_thread(node: str):
    global bc_queues
    print("Starting websocket broadcast thread for:", node)
    while RUN_SERVER:
        try:
            msgs = bc_queues[node].sync_q.get(timeout=1)
        except SyncQueueEmpty:
            continue
        for parameter, data in msgs:
            try:
                SEND_LIST = filter(partial(should_send, parameter=parameter), WEBSOCKET_LIST)
                if SEND_LIST:
                    ws_server.send_message_to_list(SEND_LIST, data)
            except Exception as ex:
                print(f"Websocket broadcast thread {node} error:", ex)
    print("Finished websocket broadcast thread for:", node)

def get_packet_node_handler(p: Packet) -> str:
    global config, nodes
    if hex(p.node) in config["nodes"]:
        return hex(p.node)
    print(f"Node {hex(p.node)} not available, please add a config entry for it", flush=True)
    return None

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
    if client is None:
        return
    print("Websocket Connection:", client["address"], flush=True)

def close_ws_client(client, server):
    client["handler"].send_close(1000, b'')
    server._terminate_client_handler(client["handler"])

def ws_on_data_receive(client, server, message):
    global WEBSOCKET_LIST, WS_USER_DATA, WS_DATA_LOCK, RUN_SERVER
    if client is None:
        return
    user_data, user_options, user_subs = WS_USER_DATA.get(client["address"], (None, None, None))
    if user_data is None:
        # close websocket if auth token invalid
        auth_valid, user_data = check_auth_token_hmac(message)
        if user_data is None or not auth_valid:
            close_ws_client(client, server)
            return
        user_options = user_data.get("options", {})
        with WS_DATA_LOCK:
            WS_USER_DATA[client["address"]] = (user_data, user_options, ([], []))
            if not user_options.get("status", False):
                WEBSOCKET_LIST.append(client)
        # send __test__ to acknowledge websocket auth
        server.send_message(client, "__test__")
        # update users stats
        update_connected_users()
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
    elif message == "stats":
        if user_data.get("admin", False):
            server.send_message(client, json.dumps({
                "type": "stats",
                "data": stats
            }))
    elif message == "version":
        if user_data.get("admin", False):
            server.send_message(client, json.dumps({
                "type": "version",
                "data": VERSION
            }))
    elif message == "debug":
        if user_data.get("admin", False):
            server.send_message(client, json.dumps({
                "type": "debug",
                "data": (config["subscription_debug"] and config["hiqnet_debug"])
            }))
    elif message == "enable_debug" or message == "disable_debug":
        enable = message == "enable_debug"
        if user_data.get("admin", False):
            if enable:
                print("Debug enabled by:", user_data["username"], flush=True)
            else:
                print("Debug disabled by:", user_data["username"], flush=True)
            config["subscription_debug"] = enable
            config["hiqnet_debug"] = enable
            server.send_message(client, json.dumps({
                "type": "debug",
                "data": enable
            }))
    elif message == "restart":
        if user_data.get("admin", False):
            print(f"Restart attempted by {user_data['username']}", flush=True)
            RUN_SERVER = False
    elif message == "reconnect":
        if user_data.get("admin", False):
            print(f"Reconnect attempted by {user_data['username']}", flush=True)
            restart_all_connections()
    elif message == "support":
        if user_data.get("admin", False):
            server.send_message(client, json.dumps({
                "type": "support",
                "data": {
                    "name": config["support_name"],
                    "email": config["support_email"],
                }
            }))
    elif not user_options.get("statusonly", False):
        try:
            data = json.loads(message)
            if data.get("type", "") == "UNSUBSCRIBE_ALL":
                for param_str in user_subs[0]:
                    client_unsubscribe(param_str, False, client["address"])
                for param_str in user_subs[1]:
                    client_unsubscribe(param_str, True, client["address"])
                user_subs = ([], [])
                with WS_DATA_LOCK:
                    WS_USER_DATA[client["address"]] = (user_data, user_options, user_subs)
            else:
                p = Packet.from_json(json.loads(message))
                sub_handler_node = get_packet_node_handler(p)
                if sub_handler_node is None:
                    return
                # print(p, flush=True)
                if p.message_type == MessageType.SUBSCRIBE or p.message_type == MessageType.SUBSCRIBE_PERCENT:
                    value = subscribe(p, client["address"])
                    if value is not None:
                        server.send_message(client, value)

                    is_percent = p.message_type == MessageType.SUBSCRIBE_PERCENT
                    if p.param_str not in user_subs[1 if is_percent else 0]:
                        user_subs[1 if is_percent else 0].append(p.param_str())
                        with WS_DATA_LOCK:
                            WS_USER_DATA[client["address"]] = (user_data, user_options, user_subs)
                elif p.message_type == MessageType.UNSUBSCRIBE or p.message_type == MessageType.UNSUBSCRIBE_PERCENT:
                    is_percent = p.message_type == MessageType.UNSUBSCRIBE_PERCENT
                    client_unsubscribe(p.param_str(), is_percent, client["address"], fallback_packet=p)

                    if p.param_str() in user_subs[1 if is_percent else 0]:
                        user_subs[1 if is_percent else 0].remove(p.param_str())
                        with WS_DATA_LOCK:
                            WS_USER_DATA[client["address"]] = (user_data, user_options, user_subs)
                else:
                    msg_queues[sub_handler_node].sync_q.put(p)
        except (json.JSONDecodeError, DecodeFailed, UnsupportedMessage) as ex:
            print("Failed to decode:", ex, ":", message, flush=True)

def ws_on_connection_close(client, server):
    global WS_DATA_LOCK, WEBSOCKET_LIST, WS_USER_DATA
    if client is None:
        return
    with WS_DATA_LOCK:
        if client in WEBSOCKET_LIST:
            WEBSOCKET_LIST.remove(client)
        addr = client["address"]
        if addr in WS_USER_DATA:
            _, _, user_subs = WS_USER_DATA.pop(addr)
            if user_subs is not None:
                for param_str in user_subs[0]:
                    client_unsubscribe(param_str, False, addr)
                for param_str in user_subs[1]:
                    client_unsubscribe(param_str, True, addr)
    update_connected_users()

health_check_queue = None
stats_queue = None

def update_health(status):
    healthy = all(s for s in status.values()) if status else False

    with open("health.status", "w") as f:
        if healthy:
            f.write("0\n")
        else:
            f.write("1\n")
        if status:
            for t_id, t_status in status.items():
                f.write(f"{t_id}: {'Healthy' if t_status else 'Unhealthy'}\n")
        else:
            print("(Empty)", flush=True)

async def health_check():
    global client_thread_status, RUN_SERVER
    client_thread_status = {}
    if health_check_queue is None:
        return
    while RUN_SERVER:
        # Get a "work item" out of the queue.
        status = await health_check_queue.async_q.get()
        client_thread_status[status["id"]] = status["status"]

        update_health(client_thread_status)

async def stats_check():
    global stats, RUN_SERVER
    stats = {}
    if stats_queue is None:
        return
    while RUN_SERVER:
        # Get a "work item" out of the queue.
        stat = await stats_queue.async_q.get()
        stats[stat["id"]] = stat["stats"]

def update_connected_users():
    global stats_queue, WS_USER_DATA
    if stats_queue is None:
        return
    
    users = []
    with WS_DATA_LOCK:
        for address, (user_data, user_options, user_subs) in WS_USER_DATA.items():
            formatted_address = str(address)
            try:
                formatted_address = f"{address[0]}:{address[1]}"
            except:
                pass

            users.append({
                "address": formatted_address,
                "username": user_data.get("username", None),
                "admin": user_data.get("admin", False),
                "options": user_options,
                # "subs": user_subs,
            })

    stats_queue.sync_q.put({
        "id": "users",
        "stats": users
    })

async def unsubscribe_delay_task():
    global RUN_SERVER
    if config["unsubscribe_delay_s"] == 0:
        return
    while RUN_SERVER:
        t = time.time()
        pc_to_unsubscribe = []
        to_unsubscribe = []
        with PC_SUBS_lock:
            for param_str, st in PC_SUBS_UNSUB_DELAY.items():
                if t - st >= config["unsubscribe_delay_s"]:
                    pc_to_unsubscribe.append(param_str)
        with SUBS_lock:
            for param_str, st in SUBS_UNSUB_DELAY.items():
                if t - st >= config["unsubscribe_delay_s"]:
                    to_unsubscribe.append(param_str)
        for param_str in pc_to_unsubscribe:
            unsubscribe(param_str, is_percent=True)
            await asyncio.sleep(0.02) # some delay here to avoid DOS'ing the server
        for param_str in to_unsubscribe:
            unsubscribe(param_str, is_percent=False)
            await asyncio.sleep(0.02) # some delay here to avoid DOS'ing the server
        await asyncio.sleep(1)

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
        for _ in range(10): # allow 10 timeouts before failing
            try:
                while True: # keep receiving until timeout occurs, we may be getting flooded with packets
                    data = s.recv(1024)
                    if data == test_str:
                        s.close()
                        s2.close()
                        print("UDP test passed", flush=True)
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
    print(f"Please check that the server_ip_address (& related) config values are correct and UDP port {hiqnet_port} is accessible at this IP", flush=True)
    return False


hiqnet_udp_thread = None
hiqnet_tcp_server_thread = None
hiqnet_tcp_threads = {}
broadcast_threads = {}
UDP_NODE_ID = "UDP"
TCP_NODE_ID = "TCP"
async def main():
    global config, ws_server, msg_queues, resp_queues, bc_queues, hiqnet_udp_thread, hiqnet_tcp_threads, broadcast_threads, subscribed_params, health_check_queue, stats_queue, RUN_SERVER
    health_check_queue = Queue(50)
    stats_queue = Queue(50)
    msg_queues = {key: Queue(200) for key in config["nodes"].keys()}
    resp_queues = {key: Queue(200) for key in config["nodes"].keys()}
    bc_queues = {key: Queue(200) for key in config["nodes"].keys()}
    resp_queues[UDP_NODE_ID] = Queue(200)
    bc_queues[UDP_NODE_ID] = Queue(200)
    subscribed_params = {key: list() for key in config["nodes"].keys()}

    # check UDP works
    if not test_udp_receive("0.0.0.0", HIQNET_PORT, config["server_ip_address"]):
        return

    MY_ADDRESS.device = int(config["server_node_address"], base=16)
    # serial must be 16 bytes, 14 bytes for url, 2 bytes from device address (which is limited to 2 bytes in the config)
    SERIAL_NUM = b"quphoria.co.uk" + MY_ADDRESS.device.to_bytes(2, "big")
    network_info = NetworkInfo(
        config["server_mac_address"],
        False, # dhcp not yet supported
        config["server_ip_address"],
        config["server_subnet_mask"],
        config["server_gateway"])
    disco_info = DiscoveryInformation(network_info, serial=SERIAL_NUM)

    # use ipaddress module to calculate broadcast address
    net = ipaddress.IPv4Network(config["server_ip_address"] + '/' + config["server_subnet_mask"], False)
    broadcast_address = str(net.broadcast_address)

    hiqnet_tcp_threads = {
        key: HiQnetThread(f"HiQnet {key} TCP Thread", get_node_alias(key), int(key, base=16), ip, HIQNET_PORT,msg_queues[key], resp_queues[key], subscribed_params[key], health_check_queue, disco_info)
        for key, ip in config["nodes"].items()}
    hiqnet_udp_thread = HiQnetUDPListenerThread("HiQnet UDP Thread", UDP_NODE_ID, "0.0.0.0", config["server_ip_address"], HIQNET_PORT, resp_queues[UDP_NODE_ID], health_check_queue, stats_queue, disco_info, broadcast_address)
    hiqnet_tcp_server_thread = HiQnetTCPListenerThread("HiQnet TCP Server Thread", TCP_NODE_ID, "0.0.0.0", config["server_ip_address"], HIQNET_PORT, health_check_queue, disco_info, VERSION)
    
    broadcast_threads = {
        key: threading.Thread(target=websocket_broadcast_thread, args=(key,), daemon=True)
        for key in config["nodes"].keys()}
    broadcast_threads[UDP_NODE_ID] = threading.Thread(target=websocket_broadcast_thread, args=(UDP_NODE_ID,), daemon=True)
    
    for t in broadcast_threads.values():
        t.start()

    # start udp thread first to receive initial messages
    hiqnet_udp_thread.start()
    hiqnet_tcp_server_thread.start()
    for t in hiqnet_tcp_threads.values():
        t.start()
    print(f"Websocket server listening on ws://0.0.0.0:{config['websocket_port']}", flush=True)
    
    for node in config["nodes"]:
        asyncio.create_task(resp_broadcast(node))
    asyncio.create_task(resp_broadcast(UDP_NODE_ID))

    ws_server = WebsocketServer(host="0.0.0.0", port=config["websocket_port"], proxy_ip_header=config['proxy_ip_header'], proxy_port_header=config['proxy_port_header'])
    ws_server.set_fn_new_client(ws_on_connection_open)
    ws_server.set_fn_client_left(ws_on_connection_close)
    ws_server.set_fn_message_received(ws_on_data_receive)
    ws_server.run_forever(threaded=True)
    health_task = asyncio.create_task(health_check())
    stats_task = asyncio.create_task(stats_check())
    unsubscribe_task = asyncio.create_task(unsubscribe_delay_task())
    while RUN_SERVER:
        await asyncio.sleep(2)
        
    for task in [health_task, unsubscribe_task, stats_task]:
        task.cancel()
    for task in [health_task, unsubscribe_task, stats_task]:
        try:
            await task
        except asyncio.CancelledError:
            pass
    
def safe_shutdown_thread():
    if hiqnet_tcp_threads:
        for t in hiqnet_tcp_threads.values():
            t.exitFlag = True
        for t in hiqnet_tcp_threads.values():
            t.join()
    if broadcast_threads:
        for t in broadcast_threads.values():
            t.join()
    if ws_server:
        ws_server.shutdown_gracefully()
        # should figure out how to get thread to exit, but thread is daemonized so will get killed when program exits
    if hiqnet_udp_thread:
        hiqnet_udp_thread.exitFlag = True
        hiqnet_udp_thread.join()
    if hiqnet_tcp_server_thread:
        hiqnet_tcp_server_thread.exitFlag = True
        hiqnet_tcp_server_thread.join()

    if msg_queues:
        for q in msg_queues.values():
            q.close()
    if resp_queues:
        for q in resp_queues.values():
            q.close()

if __name__ == "__main__":
    update_health({}) # set healthy to false when starting
    config = load_config("config/config.json")
    print("HiQnet Websocket Proxy", VERSION, flush=True)
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        RUN_SERVER = False
    print("Exiting...")

    safe_shutdown_thread = threading.Thread(target=safe_shutdown_thread)
    safe_shutdown_thread.daemon = True
    safe_shutdown_thread.start()

    safely_shutdown = False
    try:
        for _ in range(FAILSAFE_SHUTDOWN_TIME):
            if not safe_shutdown_thread.is_alive():
                safely_shutdown = True
                break
            time.sleep(1)
    except Exception as ex:
        print("Safe shutdown error:", ex)
        safely_shutdown = False

    if not safely_shutdown:
        print("Safe shutdown failed, forcefully exiting")
        exit(1)
    else:
        print("Safe shutdown successful")
        exit(0)

