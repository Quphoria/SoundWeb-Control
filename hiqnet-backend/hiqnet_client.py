import asyncore, asyncio, threading, time, functools, socket
from contextlib import suppress
from janus import Queue, SyncQueue, SyncQueueEmpty
import janus

from hiqnet_proto import *

RX_MSG_SIZE = 4096

SEQ_NUM_MIN_DIST = 0x1000
SEQ_NUM_TIMEOUT = 10 # 10 seconds

def run_in_executor(f):
    @functools.wraps(f)
    def inner(*args, **kwargs):
        loop = asyncio.get_running_loop()
        return loop.run_in_executor(None, lambda: f(*args, **kwargs))

    return inner

class HiQnetClientProtocol(asyncio.Protocol):
    def __init__(self, name: str, h_id: str, node_id: int, msg_queue: SyncQueue, resp_queue: SyncQueue, subscribed_params: list, health_queue: SyncQueue, disco_info: DiscoveryInformation, loop):
        self.name = name
        self.h_id = h_id
        self.node_id = node_id
        self.msg_queue = msg_queue
        self.resp_queue = resp_queue
        self.subscribed_params = subscribed_params
        self.health_queue = health_queue
        self.disco_info = disco_info
        self._ready = asyncio.Event()
        self.loop = loop
        self.send_task = loop.create_task(self.send_messages())
        self.transport = None
        self.read_buffer = b""
        self.last_time = 0
        self.keepalive_interval_ms = self.disco_info.keep_alive_ms
        self.seq = 0
        self.status_ok = False
        self.node_addr = HiQnetAddress(device=node_id)

    def end_connection(self):
        self.send_task.cancel()

    def next_seq(self):
        s = self.seq
        self.seq = (s+1) % 0x10000 # max is 0xffff
        return s

    @run_in_executor
    def get_next_message(self):  # Your wrapper for async use
        if self.msg_queue.closed:
            self.end_connection()
            return
        try:
            return self.msg_queue.get(timeout=1)
        except SyncQueueEmpty:
            pass

    async def send_messages(self):
        """ Send messages to the server as they become available. """
        await self._ready.wait()
        while True:
            p = await self.get_next_message()
            if p:
                try:
                    self.transport.write(p.to_msg().encode(self.next_seq()))
                except UnsupportedMessage as ex:
                    print(self.name, "Error Sending Message:", ex)

    def send_keepalive(self, transport):
        if self.last_time:
            disco_info_msg = DiscoInfo(self.disco_info, is_query=True, header=HiQnetHeader(self.node_addr))
            transport.write(disco_info_msg.encode(self.next_seq()))

    def connection_made(self, transport):
        print(self.name, "Connected", flush=True)
        self.status_ok = False
        
        disco_info_msg = DiscoInfo(self.disco_info, is_query=True, header=HiQnetHeader(self.node_addr))
        transport.write(disco_info_msg.encode(self.next_seq()))

        start_keepalives = StartKeepAlive(HiQnetHeader(self.node_addr))
        transport.write(start_keepalives.encode(self.next_seq()))
        # start timeout
        self.last_time = time.time()

        if self.subscribed_params:
            for p in self.subscribed_params:
                # unsubscribe first to get value sent to us
                has_unsub = False
                p2 = p.copy()
                if p.message_type == MessageType.SUBSCRIBE:
                    p2.message_type = MessageType.UNSUBSCRIBE
                    has_unsub = True
                elif p.message_type == MessageType.SUBSCRIBE_PERCENT:
                    p2.message_type = MessageType.UNSUBSCRIBE_PERCENT
                    has_unsub = True
                if has_unsub:
                    try:
                        transport.write(p2.to_msg().encode(self.next_seq()))
                    except UnsupportedMessage as ex:
                        print(self.name, "Error Sending Unsubscription:", ex)

                try:
                    transport.write(p.to_msg().encode(self.next_seq()))
                except UnsupportedMessage as ex:
                    print(self.name, "Error Sending Subscription:", ex)
        # empty message queue to clear delayed commands (otherwise could cause unexpected changes on connection)
        while (not self.msg_queue.closed) and (not self.msg_queue.empty()):
            self.msg_queue.get(timeout=1)
        self.transport = transport
        # clear read buffer
        self.read_buffer = b""
        self._ready.set()
        
    def data_received(self, data):
        try:
            msgs = decode_message(data)
        except DecodeFailed as ex:
            print("Decode Error:", ex)
        for msg in msgs:
            if type(msg) == DecodeFailed:
                print(self.name, "Decode Error:", ex)
                continue
            if self.last_time > 0: # Only reset timer if its started and we get correctly formed packets
                self.last_time = time.time()

            if type(msg) == DiscoInfo:
                # set status here once we know connection is alive
                if not self.status_ok:
                    self.health_queue.put({"id": self.h_id, "status": True})
                    self.status_ok = True
                self.keepalive_interval_ms = min(self.keepalive_interval_ms, msg.info.keep_alive_ms - 1000)
                continue

            if type(msg) in (MultiObjectParamSet, MultiParamSet, ParamSetPercent):
                for p in Packet.from_msg(msg):
                    if type(p) == UnsupportedMessage or type(p) == DecodeFailed:
                        print(self.name, "Error decoding packet:", p)
                        continue
                    if self.resp_queue.closed:
                        self.end_connection()
                        return
                    if self.resp_queue.full():
                        self.resp_queue.get() # remove oldest if queue full
                    self.resp_queue.put(p.to_json())

    def connection_lost(self, exc):
        print(self.name, "Connection Error:", exc, flush=True)
        self.end_connection()
        self.loop.stop()

class HiQnetThread(threading.Thread):
    def __init__(self, name: str, h_id: str, node_id: int, hiqnet_ip: str, hiqnet_port: int, msg_queue: Queue, resp_queue: Queue, subscribed_params: list, health_check_queue: Queue, disco_info: DiscoveryInformation):
        super().__init__(daemon=True)
        self.name = name
        self.h_id = h_id
        self.node_id = node_id
        self.hiqnet_ip = hiqnet_ip
        self.hiqnet_port = hiqnet_port
        self.msg_queue = msg_queue
        self.resp_queue = resp_queue
        self.health_queue = health_check_queue
        self.disco_info = disco_info
        self.subscribed_params = subscribed_params
        self.health_queue.sync_q.put({"id": self.h_id, "status": False})
        self.exitFlag = False
        self.fast_reconnect = False
    async def createClient(self, loop):
        transport, protocol = await loop.create_connection(
            lambda: HiQnetClientProtocol(self.name, self.h_id, self.node_id,
                self.msg_queue.sync_q, self.resp_queue.sync_q,
                self.subscribed_params, self.health_queue.sync_q, self.disco_info, loop),
            self.hiqnet_ip, self.hiqnet_port)
        n = 0
        while not self.exitFlag:
            await asyncio.sleep(1)
            n += 1  # check connection is alive every 10 seconds
            if n >= protocol.keepalive_interval_ms / 1000:
                n = 0
                protocol.send_keepalive(transport)
            # check how long since last message
            if protocol.last_time:
                # use 2x timeout period to be nice
                if time.time() - protocol.last_time > (2 * self.disco_info.keep_alive_ms / 1000):
                    self.fast_reconnect = True
                    break
        transport.close()
        # cancel send task
        protocol.send_task.cancel()
        try:
            await protocol.send_task
        except asyncio.CancelledError:
            pass
    def run(self):
        print(self.name, "started", flush=True)
        while not self.exitFlag:
            self.fast_reconnect = False
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                client_task = loop.create_task(self.createClient(loop))
                loop.run_until_complete(client_task)
                loop.stop()
                loop.close()
            except Exception as ex:
                print(self.name, "Error:", ex, flush=True)
                self.health_queue.sync_q.put({"id": self.h_id, "status": False})
            if not self.exitFlag:
                if self.fast_reconnect:
                    print(self.name, "HiQnet thread timeout, Reconnecting now", flush=True)
                    time.sleep(0.5)
                else:
                    print(self.name, "Disconnected from HiQnet, Reconnecting in 5 seconds", flush=True)
                    for i in range(5):
                        if self.exitFlag:
                            break
                        time.sleep(1)
        print(self.name, "exited", flush=True)

class HiQnetUDPListenerThread(threading.Thread):
    def __init__(self, name: str, h_id: str, bind_ip: str, hiqnet_port: int, resp_queue: Queue, health_check_queue: Queue):
        super().__init__(daemon=True)
        self.name = name
        self.h_id = h_id
        self.bind_ip = bind_ip
        self.hiqnet_port = hiqnet_port
        self.resp_queue = resp_queue
        self.health_queue = health_check_queue
        self.health_queue.sync_q.put({"id": self.h_id, "status": False})
        self.exitFlag = False

    def run(self):
        print(self.name, "started", flush=True)
        while not self.exitFlag:
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.bind((self.bind_ip, self.hiqnet_port))
                s.settimeout(1)
                self.health_queue.sync_q.put({"id": self.h_id, "status": True})

                seq_cache = {}

                while not self.exitFlag:
                    try:
                        data = s.recv(RX_MSG_SIZE)
                    except (TimeoutError, socket.timeout):
                        continue

                    if not data:
                        break

                    msgs = decode_message(data)
                    for msg in msgs:
                        if type(msg) == DecodeFailed:
                            print(self.name, "Decode Error:", ex)
                            continue

                        if type(msg) in (MultiObjectParamSet, MultiParamSet, ParamSetPercent):
                            print(msg.header.dest_address)
                            for p in Packet.from_msg(msg):
                                if type(p) == UnsupportedMessage or type(p) == DecodeFailed:
                                    print(self.name, "Error decoding packet:", p)
                                    continue

                                seq_cache_key = (
                                    p.message_type,
                                    p.node,
                                    p.v_device,
                                    p.obj_id,
                                    p.param_id
                                )

                                t = time.time()
                                if seq_cache_key in seq_cache:
                                    old_time, old_seq_num = seq_cache[seq_cache_key]

                                    # ensure sequence number is spaced enough apart
                                    # or has timed out
                                    if (t - old_time < SEQ_NUM_TIMEOUT and
                                            msg.header.sequence_number < old_seq_num and
                                            old_seq_num - msg.header.sequence_number < SEQ_NUM_MIN_DIST):
                                        
                                        print(self.name, "Out of order sequence from", msg.header.source_address)
                                        continue
                                
                                # add to sequence number cache
                                seq_cache[seq_cache_key] = (t, msg.header.sequence_number)

                                if self.resp_queue.sync_q.closed:
                                    self.end_connection()
                                    return
                                if self.resp_queue.sync_q.full():
                                    self.resp_queue.sync_q.get() # remove oldest if queue full
                                self.resp_queue.sync_q.put(p.to_json())
                
            except Exception as ex:
                print(self.name, "Error:", ex, flush=True)
                raise ex
                self.health_queue.sync_q.put({"id": self.h_id, "status": False})
            if not self.exitFlag:
                print(self.name, "HiQnet UDP listener thread stopped, Restarting in 5 seconds", flush=True)
                for i in range(5):
                    if self.exitFlag:
                        break
                    time.sleep(1)
        print(self.name, "exited", flush=True)