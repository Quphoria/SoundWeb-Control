import asyncore, asyncio, threading, time, functools, socket, uuid
from concurrent.futures import ThreadPoolExecutor
from janus import Queue, SyncQueue, SyncQueueEmpty
import janus

from hiqnet_proto import *

RX_MSG_SIZE = 4096
UDP_TEST_INTERVAL = 5 # 5 seconds
UDP_MAX_FAIL_THRESHOLD = 6 # 30 seconds (5*6)
UDP_DISCOVERY_BROADCAST_INTERVAL = 5 # 5 seconds
PACKETS_PER_SECOND_INTERVAL = 5 # 5 seconds
UDP_DECODE_WORKERS = 5

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
                    print(self.name, "Error Sending Message:", ex, flush=True)

    def send_keepalive(self, transport):
        if self.last_time:
            disco_info_msg = DiscoInfo(self.disco_info, is_query=True, header=HiQnetHeader(self.node_addr))
            transport.write(disco_info_msg.encode(self.next_seq()))

    def send_goodbye(self, transport):
        goodbye_msg = Goodbye(header=HiQnetHeader(self.node_addr))
        transport.write(goodbye_msg.encode(self.next_seq()))

    def connection_made(self, transport):
        print(self.name, "Connected", flush=True)
        self.status_ok = False
        
        disco_info_msg = DiscoInfo(self.disco_info, is_query=True, header=HiQnetHeader(self.node_addr))
        transport.write(disco_info_msg.encode(self.next_seq()))

        start_keepalives = StartKeepAlive(HiQnetHeader(self.node_addr))
        transport.write(start_keepalives.encode(self.next_seq()))

        # start timeout
        self.last_time = time.time()

        self.resubscribe(transport)
        
        # empty message queue to clear delayed commands (otherwise could cause unexpected changes on connection)
        while (not self.msg_queue.closed) and (not self.msg_queue.empty()):
            self.msg_queue.get(timeout=1)
        self.transport = transport
        # clear read buffer
        self.read_buffer = b""
        self._ready.set()

    def resubscribe(self, transport):
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
                        print(self.name, "Error Sending Unsubscription:", ex, flush=True)

                try:
                    transport.write(p.to_msg().encode(self.next_seq()))
                except UnsupportedMessage as ex:
                    print(self.name, "Error Sending Subscription:", ex, flush=True)
        
    def data_received(self, data):
        try:
            msgs = decode_message(data)
        except DecodeFailed as ex:
            print("Decode Error:", ex)
        for msg in msgs:
            if type(msg) == DecodeFailed:
                print(self.name, "Decode Error:", msg, flush=True)
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

            if type(msg) == HelloInfo:
                print(self.node_id, ": ", str(msg), flush=True)
                continue
            
            if type(msg) == HelloQuery:
                print(self.node_id, ": ", str(msg), flush=True)
                continue

            if type(msg) == Goodbye:
                print(self.node_id, ": ", str(msg), flush=True)
                # we got a goodbye
                if msg.device_address == self.node_id:
                    self.health_queue.put({"id": self.h_id, "status": False})
                    self.end_connection()
                    return
                continue

            if type(msg) in (MultiObjectParamSet, MultiParamSet, ParamSetPercent):
                for p in Packet.from_msg(msg):
                    if type(p) == UnsupportedMessage or type(p) == DecodeFailed:
                        print(self.name, "Error decoding packet:", p, flush=True)
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
        self.restartFlag = False
        self.fast_reconnect = False
    async def createClient(self, loop):
        transport, protocol = await loop.create_connection(
            lambda: HiQnetClientProtocol(self.name, self.h_id, self.node_id,
                self.msg_queue.sync_q, self.resp_queue.sync_q,
                self.subscribed_params, self.health_queue.sync_q, self.disco_info, loop),
            self.hiqnet_ip, self.hiqnet_port)
        n = 0
        while not self.exitFlag and not self.restartFlag:
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
        else:
            # we are reconnecting or exiting
            # be good and send a Goodbye message
            protocol.send_goodbye(transport)
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
            self.restartFlag = False
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

class HiQnetUDPListenerProtocol(asyncio.DatagramProtocol):
    def __init__(self, name: str, h_id: str, server_ip: str, hiqnet_port: int, resp_queue: Queue, health_queue: Queue, stats_queue: Queue, disco_info: DiscoveryInformation, broadcast_address: str, loop):
        self.name = name
        self.h_id = h_id
        self.server_ip = server_ip
        self.hiqnet_port = hiqnet_port
        self.resp_queue = resp_queue
        self.health_queue = health_queue
        self.stats_queue = stats_queue
        self.disco_info = disco_info
        self.broadcast_address = broadcast_address
        self._ready = asyncio.Event()
        self.loop = loop
        self.udp_test_task = loop.create_task(self.udp_test())
        self.discovery_task = loop.create_task(self.discovery_broadcast())
        self.stats_task = loop.create_task(self.update_stats())
        self.transport = None
        self.read_buffer = b""
        self.seq = 0
        self.seq_cache = {}
        self.udp_test_uuid = None
        self.dead = False
        self.packets = 0
        self.good_packets = 0
        self.packet_decode_time = 0
        self.test_st = 0
        self.test_rtt = None
        self.decode_executor = None

    def end_connection(self):
        self.discovery_task.cancel()
        self.udp_test_task.cancel()
        self.stats_task.cancel()

    def next_seq(self):
        s = self.seq
        self.seq = (s+1) % 0x10000 # max is 0xffff
        return s

    async def udp_test(self):
        """Periodically test the UDP socket"""
        await self._ready.wait()
        test_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            test_socket.settimeout(1)
            failed_tests = -1
            while self.loop.is_running():
                if self.udp_test_uuid is None:
                    if failed_tests != 0:
                        await self.health_queue.async_q.put({"id": self.h_id, "status": True}) # update status
                    failed_tests = 0
                else:
                    print("UDP Test Packet Failed", flush=True)
                    self.test_rtt = None
                    if failed_tests == 0:
                        await self.health_queue.async_q.put({"id": self.h_id, "status": False}) # update status
                    failed_tests += 1
                    if failed_tests >= UDP_MAX_FAIL_THRESHOLD:
                        self.dead = True
                        raise Exception(f"Failed {UDP_MAX_FAIL_THRESHOLD} Consecutive UDP Test Packets")
                self.udp_test_uuid = str(uuid.uuid4()).encode()
                test_socket.sendto(self.udp_test_uuid, (self.server_ip, self.hiqnet_port))
                self.test_st = time.time()
                await asyncio.sleep(UDP_TEST_INTERVAL)
        finally:
            try:
                test_socket.close()
            except:
                pass

    async def discovery_broadcast(self):
        """Periodically send DiscoInfo broadcast packets"""
        await self._ready.wait()
        disco_info_msg = DiscoInfo(self.disco_info, is_query=False, header=HiQnetHeader(HiQnetAddress.broadcast()))
        disco_info_msg.header.flags.guaranteed = False
        while self.loop.is_running():
            try:
                self.transport.sendto(disco_info_msg.encode(self.next_seq()), (self.broadcast_address, self.hiqnet_port))
            except UnsupportedMessage as ex:
                print(self.name, "Error Sending UDP Discovery Packet:", ex)
            await asyncio.sleep(UDP_DISCOVERY_BROADCAST_INTERVAL)

    async def update_stats(self):
        """Periodically update stats"""
        await self._ready.wait()
        while self.loop.is_running():
            decode_time = 0
            packets = self.packets
            if packets != 0:
                decode_time = self.packet_decode_time / packets
            test_rtt = self.test_rtt
            if test_rtt is not None:
                test_rtt *= 1000
            await self.stats_queue.async_q.put({"id": self.h_id, "stats": {
                "good_pps": self.good_packets / PACKETS_PER_SECOND_INTERVAL,
                "total_pps": self.packets / PACKETS_PER_SECOND_INTERVAL,
                "decode_time": decode_time,
                "test_rtt_ms": test_rtt,
            }})
            self.packets = 0
            self.good_packets = 0
            self.packet_decode_time = 0
            await asyncio.sleep(PACKETS_PER_SECOND_INTERVAL)

    def connection_made(self, transport):
        print(self.name, "Connected", flush=True)
        self.status_ok = False
        
        self.transport = transport
        # clear read buffer
        self.read_buffer = b""
        self._ready.set()

    def decode_handler(self, data):
        st = time.time()

        try:
            msgs = decode_message(data)
        except DecodeFailed as ex:
            print(self.name, "Decode Error:", ex, flush=True)
            self.packet_decode_time += time.time() - st
            return
        
        self.good_packets += 1
        
        for msg in msgs:
            if type(msg) == DecodeFailed:
                print(self.name, "Decode Error:", msg, flush=True)
                continue

            if type(msg) == IncorrectDestination:
                print(self.name, "Incorrect Destination:", msg, flush=True)
                continue

            if type(msg) in (MultiObjectParamSet, MultiParamSet, ParamSetPercent):
                for p in Packet.from_msg(msg):
                    if type(p) == UnsupportedMessage or type(p) == DecodeFailed:
                        print(self.name, "Error decoding packet:", p, flush=True)
                        continue

                    seq_cache_key = (
                        p.message_type,
                        p.node,
                        p.v_device,
                        p.obj_id,
                        p.param_id
                    )

                    t = time.time()
                    if seq_cache_key in self.seq_cache:
                        old_time, old_seq_num = self.seq_cache[seq_cache_key]

                        # ensure sequence number is spaced enough apart
                        # or has timed out
                        if (t - old_time < SEQ_NUM_TIMEOUT and
                                msg.header.sequence_number < old_seq_num and
                                old_seq_num - msg.header.sequence_number < SEQ_NUM_MIN_DIST):
                            
                            print(self.name, "Out of order sequence from", msg.header.source_address, flush=True)
                            continue
                    
                    # add to sequence number cache
                    self.seq_cache[seq_cache_key] = (t, msg.header.sequence_number)

                    if self.resp_queue.sync_q.closed:
                        self.end_connection()
                        return
                    if self.resp_queue.sync_q.full():
                        self.resp_queue.sync_q.get() # remove oldest if queue full
                    self.resp_queue.sync_q.put(p.to_json())
        
        self.packet_decode_time += time.time() - st
        
    def datagram_received(self, data, _):
        # check for test packet

        if self.udp_test_uuid and data == self.udp_test_uuid:
            self.test_rtt = time.time() - self.test_st
            self.udp_test_uuid = None
            return
        
        self.packets += 1

        if self.decode_executor:
            self.decode_executor.submit(self.decode_handler, data)
        
        # self.decode_handler(data)

    def connection_lost(self, exc):
        print(self.name, "Connection Error:", exc, flush=True)
        self.end_connection()


class HiQnetUDPListenerThread(threading.Thread):
    def __init__(self, name: str, h_id: str, bind_ip: str, server_ip: str, hiqnet_port: int, resp_queue: Queue, health_check_queue: Queue, stats_queue: Queue, disco_info: DiscoveryInformation, broadcast_address: str):
        super().__init__(daemon=True)
        self.name = name
        self.h_id = h_id
        self.bind_ip = bind_ip
        self.server_ip = server_ip
        self.hiqnet_port = hiqnet_port
        self.resp_queue = resp_queue
        self.health_queue = health_check_queue
        self.health_queue.sync_q.put({"id": self.h_id, "status": False})
        self.stats_queue = stats_queue
        self.stats_queue.sync_q.put({"id": self.h_id, "stats": {"good_pps": None, "total_pps": None, "decode_time": None, "test_rtt_ms": None}})
        self.disco_info = disco_info
        self.broadcast_address = broadcast_address
        self.exitFlag = False
        self.restartFlag = False

    async def createClient(self, loop):
        transport, protocol = await loop.create_datagram_endpoint(
            lambda: HiQnetUDPListenerProtocol(self.name, self.h_id, self.server_ip,
                self.hiqnet_port, self.resp_queue, self.health_queue, self.stats_queue,
                self.disco_info, self.broadcast_address, loop),
            (self.bind_ip, self.hiqnet_port),
            allow_broadcast=True)

        with ThreadPoolExecutor(max_workers=UDP_DECODE_WORKERS) as executor:
            protocol.decode_executor = executor
            while not self.exitFlag and not self.restartFlag:
                await asyncio.sleep(1)
                if protocol.dead: # failed too many tests
                    break
        transport.close()
        # cancel tasks
        protocol.end_connection()
        for task in [protocol.discovery_task, protocol.udp_test_task, protocol.stats_task]:
            try:
                await task
            except asyncio.CancelledError:
                pass

    def run(self):
        print(self.name, "started", flush=True)
        while not self.exitFlag:
            self.restartFlag = False
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
            self.stats_queue.sync_q.put({"id": self.h_id, "stats": {"good_pps": None, "total_pps": None, "decode_time": None, "test_rtt_ms": None}})
            if not self.exitFlag:
                print(self.name, "HiQnet UDP listener thread stopped, Restarting in 5 seconds", flush=True)
                for _ in range(5):
                    if self.exitFlag:
                        break
                    time.sleep(1)
        print(self.name, "exited", flush=True)
