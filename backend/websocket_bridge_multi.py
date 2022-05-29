import asyncio, websockets
from janus import Queue
import json, hmac, hashlib, time
from config import load_config
from concurrent.futures import ThreadPoolExecutor

from soundweb_proto import MessageType, Packet, meter_value_db, decode_packets, DecodeFailed
from soundweb_client import SoundWebThread

token_time_range = 10 * 60 * 1000 # +-10 minutes

subscribed_params = {}

WEBSOCKET_LIST = []

param_cache = {}

async def resp_broadcast(node: str):
    global param_cache
    while True:
        # Get a "work item" out of the queue.
        msg = await resp_queues[node].async_q.get()
        if msg["type"] == "SET":
            param_cache[msg["parameter"]] = json.dumps(msg)
        for websocket in WEBSOCKET_LIST:
            try:
                await websocket.send(json.dumps(msg))
            except websockets.exceptions.ConnectionClosedError:
                if websocket in WEBSOCKET_LIST:
                    WEBSOCKET_LIST.remove(websocket)
            except Exception as ex:
                print("Broadcast Error: " + str(ex), flush=True)
                try:
                    await websocket.close()
                except:
                    pass
                if websocket in WEBSOCKET_LIST:
                    WEBSOCKET_LIST.remove(websocket)

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
                return True
    except Exception as ex:
        # print(ex, flush=True)
        # hmac failed
        # ignore error
        pass
    return False

process_pool = ThreadPoolExecutor(2)

async def msg_handler(websocket):
    print("Websocket Connection:", websocket.remote_address, flush=True)
    try:
        first_message = True
        async for message in websocket:
            # print("WS MSG:", message, flush=True)
            if first_message:
                # break out of loop if auth token invalid
                # run check_auth_token_hmac in executor to prevent hanging the main thread with hmac calculations
                loop = asyncio.get_event_loop()
                auth_valid = await loop.run_in_executor(process_pool, check_auth_token_hmac, message)
                if not auth_valid:
                    await websocket.close()
                    break
                # send __test__ to acknowledge websocket auth
                await websocket.send("__test__")
                for p in param_cache.values():
                    await websocket.send(p)
                WEBSOCKET_LIST.append(websocket)
                first_message = False
            elif message == "__test__":
                await websocket.send("__test__")
            else:
                try:
                    p = Packet.from_json(json.loads(message))
                    sub_handler_node = get_packet_node_handler(p)
                    # print(p, flush=True)
                    sent_value = False
                    if p.message_type == MessageType.SUBSCRIBE or p.message_type == MessageType.SUBSCRIBE_PERCENT:
                        p.value = config["subscription_rate_ms"]
                        for sub in subscribed_params[sub_handler_node]:
                            if sub.param_str() == p.param_str() and sub.message_type == p.message_type:
                                if p.param_str() in param_cache: # avoid resubscribing to parameters if value cached
                                    await websocket.send(param_cache[p.param_str()])
                                    sent_value = True
                                else:
                                    subscribed_params[sub_handler_node].remove(sub)
                        if not sent_value: # avoid resubscribing to parameters
                            subscribed_params[sub_handler_node].append(p)
                            await subscribe_queues[sub_handler_node].async_q.put(p)
                    elif p.message_type == MessageType.UNSUBSCRIBE or p.message_type == MessageType.UNSUBSCRIBE_PERCENT:
                        for sub in subscribed_params[sub_handler_node]:
                            if sub.param_str() == p.param_str() and sub.message_type == p.message_type:
                                subscribed_params[sub_handler_node].remove(sub)
                        await subscribe_queues[sub_handler_node].async_q.put(p)
                    else:
                        await msg_queue.async_q.put(p)
                except (json.JSONDecodeError, DecodeFailed) as ex:
                    print("Failed to decode:", ex, ":", message, flush=True)
    except websockets.exceptions.ConnectionClosedError:
        pass
    try:
        await websocket.close()
    except:
        pass
    if websocket in WEBSOCKET_LIST:
        WEBSOCKET_LIST.remove(websocket)

health_check_queue = None

def update_health(healthy: bool):
    with open("health.status", "w") as f:
        if healthy:
            f.write("0")
        else:
            f.write("1")

async def health_check():
    client_thread_status = {}
    if health_check_queue is None:
        return
    while True:
        # Get a "work item" out of the queue.
        status = await health_check_queue.async_q.get()
        client_thread_status[status["name"]] = status["status"]

        healthy = all(s for s in client_thread_status.values())
        update_health(healthy)
    
soundweb_thread = None
soundweb_subscribe_threads = []
async def main():
    global config, msg_queue, resp_queues, subscribe_queues, soundweb_thread, soundweb_subscribe_threads, subscribed_params, health_check_queue
    msg_queue = Queue(200)
    health_check_queue = Queue(50)
    resp_queues = {key: Queue(200) for key in config["nodes"].keys()}
    subscribe_queues = {key: Queue(200) for key in config["nodes"].keys()}
    soundweb_ip = config["nodes"]["default"]
    subscribed_params = {key: list() for key in config["nodes"].keys()}

    soundweb_thread = SoundWebThread("SoundWeb Message Thread", soundweb_ip, 1023, msg_queue, None, None, health_check_queue)
    soundweb_subscribe_threads = {
        key: SoundWebThread(f"SoundWeb {key} Sync Thread", ip, 1023, subscribe_queues[key], resp_queues[key], subscribed_params[key], health_check_queue)
        for key, ip in config["nodes"].items()}
    soundweb_thread.start()
    for t in soundweb_subscribe_threads.values():
        t.start()
    print(f"Websocket server listening on ws://0.0.0.0:{config['websocket_port']}", flush=True)
    async with websockets.serve(msg_handler, "0.0.0.0", config["websocket_port"]):
        for node in config["nodes"]:
            asyncio.create_task(resp_broadcast(node))
        asyncio.create_task(health_check())
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    update_health(False) # set healthy to false when starting
    config = load_config("config.json")
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass

    if soundweb_thread:
        soundweb_thread.exitFlag = True
        soundweb_thread.join()
    for t in soundweb_subscribe_threads.values():
        t.exitFlag = True
        t.join()

    msg_queue.close()
    for q in resp_queues.values():
        q.close()
    for q in subscribe_queues.values():
        q.close()