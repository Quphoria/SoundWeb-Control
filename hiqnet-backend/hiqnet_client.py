import asyncore, asyncio, threading, time, functools, socket, uuid
from janus import Queue, SyncQueue, SyncQueueEmpty, SyncQueueFull
import janus
import traceback as tb

from hiqnet_proto import *

RX_MSG_SIZE = 4096
UDP_TEST_INTERVAL = 5 # 5 seconds
UDP_MAX_FAIL_THRESHOLD = 6 # 30 seconds (5*6)
UDP_DISCOVERY_BROADCAST_INTERVAL = 5 # 5 seconds
UDP_DISCOVERY_BROADCAST = False # See HiQnetUDPListenerProtocol.discovery_broadcast(), this does not affect the Device Arrival "Announce" messages
UDP_DISCOVERY_ANNOUNCEMENT_MESSAGES = 5
UDP_DISCOVERY_ANNOUNCEMENT_INTERVAL = 2
TCP_TEST_INTERVAL = 5 # 5 seconds
TCP_MAX_FAIL_THRESHOLD = 6 # 30 seconds (5*6)
PACKETS_PER_SECOND_INTERVAL = 5 # 5 seconds
UDP_DECODE_WORKERS = 5
UDP_RESP_QUEUE_FULL_WARN_INTEVAL = 2 # 2 seconds

ATTR_CLASS_NAME = "Quphoria's Soundweb Control"
ATTR_NAME = "Soundweb Control"

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
        
        resp_data = []
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
                    resp_data.append(p.to_json())

        if resp_data:
            if self.resp_queue.closed:
                self.end_connection()
                return
            if self.resp_queue.full():
                self.resp_queue.get() # remove oldest if queue full
            self.resp_queue.put(resp_data)

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
        self.discovery_task = None
        self.discovery_task = loop.create_task(self.discovery_broadcast())
        self.stats_task = loop.create_task(self.update_stats())
        self.transport = None
        self.read_buffer = b""
        self.seq = 0
        self.udp_test_uuid = None
        self.dead = False
        self.packets = 0
        self.good_packets = 0
        self.packet_decode_time = 0
        self.test_st = 0
        self.test_rtt = None
        self.decode_queue = Queue(200)
        self.decode_thread = None
        self.hiqnet_device_ip_cache = {}

    def end_connection(self):
        if self.discovery_task:
            self.discovery_task.cancel()
        self.udp_test_task.cancel()
        self.stats_task.cancel()
        self.decode_queue.close()
        if self.decode_thread:
            self.decode_thread.join()

    def next_seq(self):
        s = self.seq
        self.seq = (s+1) % 0x10000 # max is 0xffff
        return s

    async def udp_test(self):
        """Periodically test the UDP socket"""
        await self._ready.wait()
        while not self.dead and self.loop.is_running():
            test_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            try:
                test_socket.settimeout(1)
                failed_tests = -1
                retry_health_update = False
                while self.loop.is_running():
                    if self.udp_test_uuid is None:
                        if failed_tests != 0 or retry_health_update:
                            retry_health_update = False
                            try:
                                self.health_queue.sync_q.put({"id": self.h_id, "status": True}, timeout=5) # update status
                            except SyncQueueFull:
                                retry_health_update = True
                        failed_tests = 0
                    else:
                        print("UDP Test Packet Failed", flush=True)
                        self.test_rtt = None
                        if failed_tests == 0 or retry_health_update:
                            retry_health_update = False
                            try:
                                self.health_queue.sync_q.put({"id": self.h_id, "status": False}, timeout=5) # update status
                            except SyncQueueFull:
                                retry_health_update = True
                        failed_tests += 1
                        if failed_tests >= UDP_MAX_FAIL_THRESHOLD:
                            self.dead = True
                            raise Exception(f"Failed {UDP_MAX_FAIL_THRESHOLD} Consecutive UDP Test Packets")
                    self.udp_test_uuid = str(uuid.uuid4()).encode()
                    test_socket.sendto(self.udp_test_uuid, (self.server_ip, self.hiqnet_port))
                    self.test_st = time.time()
                    await asyncio.sleep(UDP_TEST_INTERVAL)
            except Exception as ex:
                print("UDP Test Error:", ex)
                raise ex
            finally:
                try:
                    test_socket.close()
                except:
                    pass

    # We probably don't have to do this,
    # as we now respond to DiscoInfo messages asking for us (see 4.2.1 Searching for a Device)
    async def discovery_broadcast(self):
        """Periodically send DiscoInfo broadcast packets"""
        await self._ready.wait()
        disco_info_msg = DiscoInfo(self.disco_info, is_query=False, header=HiQnetHeader(HiQnetAddress.broadcast()))
        disco_info_msg.header.flags.guaranteed = False
        n = UDP_DISCOVERY_ANNOUNCEMENT_MESSAGES
        print(self.name, "Sending Device Arrival/Annoucement messages")
        while self.loop.is_running():
            try:
                self.transport.sendto(disco_info_msg.encode(self.next_seq()), (self.broadcast_address, self.hiqnet_port))
            except UnsupportedMessage as ex:
                print(self.name, "Error Sending UDP Discovery Packet:", ex)
            
            if n == 1:
                print(self.name, "Finished sending Device Arrival/Annoucement messages")
            n = max(0, n-1)
            if n != 0:
                await asyncio.sleep(UDP_DISCOVERY_ANNOUNCEMENT_INTERVAL)
                continue

            if not UDP_DISCOVERY_BROADCAST:
                # we have finished announcement
                # but are not configured to continuously annouce
                break

            await asyncio.sleep(UDP_DISCOVERY_BROADCAST_INTERVAL)

    async def update_stats(self):
        """Periodically update stats"""
        await self._ready.wait()
        while self.loop.is_running():
            decode_time = 0
            packets = self.packets
            if packets != 0:
                decode_time = 1000 * self.packet_decode_time / packets
            decode_percent = 100 * self.packet_decode_time / PACKETS_PER_SECOND_INTERVAL
            test_rtt = self.test_rtt
            if test_rtt is not None:
                test_rtt *= 1000
            await self.stats_queue.async_q.put({"id": self.h_id, "stats": {
                "good_pps": self.good_packets / PACKETS_PER_SECOND_INTERVAL,
                "total_pps": self.packets / PACKETS_PER_SECOND_INTERVAL,
                "decode_time_ms": decode_time,
                "decode_time_percent": f"{decode_percent:.2f}%",
                "test_rtt_ms": test_rtt,
            }})
            self.packets = 0
            self.good_packets = 0
            self.packet_decode_time = 0
            await asyncio.sleep(PACKETS_PER_SECOND_INTERVAL)

    def connection_made(self, transport):
        print(self.name, "Connected", flush=True)
        self.status_ok = False

        self.decode_thread = threading.Thread(target=self.decode_handler, args=(self,))
        self.decode_thread.daemon = True
        self.decode_thread.start()
        
        self.transport = transport
        # clear read buffer
        self.read_buffer = b""
        self._ready.set()

    @staticmethod
    def decode_handler(protocol: 'HiQnetUDPListenerProtocol'):
        name = protocol.name
        resp_queue = protocol.resp_queue
        seq_cache = {}
        last_resp_queue_full_warn = 0

        while not protocol.decode_queue.sync_q.closed:
            try:
                data = protocol.decode_queue.sync_q.get(timeout=1)
            except SyncQueueEmpty:
                continue

            st = time.time()

            try:
                msgs = decode_message(data)
            except DecodeFailed as ex:
                print(name, "Decode Error:", ex, flush=True)
                protocol.packet_decode_time += time.time() - st
                return
        
            protocol.good_packets += 1

            resp_data = []
            
            for msg in msgs:
                if type(msg) == DecodeFailed:
                    print(name, "Decode Error:", msg, flush=True)
                    continue

                if type(msg) == IncorrectDestination:
                    print(name, "Incorrect Destination:", msg, flush=True)
                    continue

                if type(msg) == DiscoInfo:
                    # See comment before discovery_broadcast()
                    dest = msg.header.source_address

                    dev = msg.info.hiqnet_device
                    ip = msg.info.network_info.ip
                    protocol.hiqnet_device_ip_cache[dev] = ip

                    if msg.is_query():
                        disco_info_msg = DiscoInfo(protocol.disco_info, is_query=False, header=HiQnetHeader(dest))
                        disco_info_msg.header.flags.guaranteed = False
                        try:
                            protocol.transport.sendto(disco_info_msg.encode(protocol.next_seq()), (ip, protocol.hiqnet_port))
                        except UnsupportedMessage as ex:
                            print(protocol.name, "Error Sending UDP Discovery Reply:", ex)
                    continue

                if type(msg) == GetNetworkInfo and msg.is_query:
                    # print(f"{msg.header.source_address.device} : {msg}", flush=True)
                    dest = msg.header.source_address
                    if dest.device not in protocol.hiqnet_device_ip_cache:
                        print("Unable to send GetNetworkInfo reply, as ip address is not known for device:", dest.device)
                        continue
                    ip = protocol.hiqnet_device_ip_cache[dest.device]

                    serial = protocol.disco_info.serial
                    intf = NetworkInterface(
                        network_id=protocol.disco_info.network_id,
                        network_info=protocol.disco_info.network_info
                    )

                    network_info_msg = GetNetworkInfo(serial, [intf], is_query=False, header=HiQnetHeader(dest))
                    network_info_msg.header.flags.guaranteed = False
                    network_info_msg.header.flags.information = True
                    try:
                        protocol.transport.sendto(network_info_msg.encode(protocol.next_seq()), (ip, protocol.hiqnet_port))
                    except UnsupportedMessage as ex:
                        print(protocol.name, "Error Sending GetNetworkInfo Reply:", ex)
                    continue

                if type(msg) in (MultiObjectParamSet, MultiParamSet, ParamSetPercent):
                    for p in Packet.from_msg(msg):
                        if type(p) == UnsupportedMessage or type(p) == DecodeFailed:
                            print(name, "Error decoding packet:", p, flush=True)
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
                                
                                print(name, "Out of order sequence from", msg.header.source_address, flush=True)
                                continue
                        
                        # add to sequence number cache
                        seq_cache[seq_cache_key] = (t, msg.header.sequence_number)

                        resp_data.append(p.to_json())

            if resp_data:
                if resp_queue.sync_q.closed:
                    protocol.end_connection()
                    return
                if resp_queue.sync_q.full():
                    t = time.time()
                    if t - last_resp_queue_full_warn > UDP_RESP_QUEUE_FULL_WARN_INTEVAL:
                        last_resp_queue_full_warn = t
                        print(name, "resp_queue full!")
                    resp_queue.sync_q.get() # remove oldest if queue full
                resp_queue.sync_q.put(resp_data)
            
            protocol.packet_decode_time += time.time() - st
        
    def datagram_received(self, data, _):
        # check for test packet

        if self.udp_test_uuid and data == self.udp_test_uuid:
            self.test_rtt = time.time() - self.test_st
            self.udp_test_uuid = None
            return
        
        self.packets += 1

        if not self.decode_queue.sync_q.closed:
            self.decode_queue.sync_q.put(data)

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
        self.stats_queue.sync_q.put({"id": self.h_id, "stats": {"good_pps": None, "total_pps": None, "decode_time": None, "decode_time_percent": None, "test_rtt_ms": None}})
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
            self.stats_queue.sync_q.put({"id": self.h_id, "stats": {"good_pps": None, "total_pps": None, "decode_time": None, "decode_time_percent": None, "test_rtt_ms": None}})
            if not self.exitFlag:
                print(self.name, "HiQnet UDP listener thread stopped, Restarting in 5 seconds", flush=True)
                for _ in range(5):
                    if self.exitFlag:
                        break
                    time.sleep(1)
        print(self.name, "exited", flush=True)

class HiQnetTCPListenerProtocol(asyncio.Protocol):
    def __init__(self, name: str, h_id: str, server_ip: str, hiqnet_port: int, disco_info: DiscoveryInformation, version: str, loop):
        self.name = name
        self.h_id = h_id
        self.server_ip = server_ip
        self.hiqnet_port = hiqnet_port
        self.disco_info = disco_info
        self.version = version
        self.loop = loop
        self.transport = None
        self.seq = 0
        self.peername = None
        self.decode_queue = Queue(200)
        self.decode_thread = None
        self.reply_header = None
        self.send_keepalives = False
        self.timeout_task = loop.create_task(self.check_timeout())
        self.timeout_interval_ms = 15_000 # default to 15 seconds (times out after 32)
        self.last_packet = 0
        self.keepalive_task = loop.create_task(self.keepalive())
        self.keepalive_interval_ms = self.disco_info.keep_alive_ms

    async def check_timeout(self):
        while self.loop.is_running():
            if self.last_packet == 0:
                await asyncio.sleep(1)
                continue

            dt = time.time() - self.last_packet
            if dt > (2*self.timeout_interval_ms/1000 + 2):
                # keepalive timeout reached, close connection
                self.transport.close()
                break

            await asyncio.sleep(1)


    async def keepalive(self):
        while self.loop.is_running():
            if self.send_keepalives and self.reply_header:
                disco_info_msg = DiscoInfo(self.disco_info, header=self.reply_header.copy())
                self.transport.write(disco_info_msg.encode(self.next_seq()))
                await asyncio.sleep(self.keepalive_interval_ms / 1000)
            else:
                await asyncio.sleep(1)

    def end_connection(self):
        self.timeout_task.cancel()
        self.keepalive_task.cancel()
        self.decode_queue.close()
        if self.decode_thread:
            self.decode_thread.join()

    def next_seq(self):
        s = self.seq
        self.seq = (s+1) % 0x10000 # max is 0xffff
        return s

    def connection_made(self, transport):
        self.peername = transport.get_extra_info('peername')
        print(self.name, f'Connection from {self.peername}', flush=True)

        self.decode_thread = threading.Thread(target=self.decode_handler, args=(self,))
        self.decode_thread.daemon = True
        self.decode_thread.start()
        
        self.transport = transport

        # start waiting for timeout
        self.last_packet = time.time()

        # Send DiscoInfo (to broadcast address, since we don't know the remote id)
        # Observed a BLU-100 doing this
        disco_info_msg = DiscoInfo(self.disco_info, is_query=False, header=HiQnetHeader(HiQnetAddress.broadcast()))
        try:
            self.transport.write(disco_info_msg.encode(self.next_seq()))
        except UnsupportedMessage as ex:
            print(self.name, f"Error Sending TCP Discovery Info to {self.peername}:", ex)

    def data_received(self, data):
        if not self.decode_queue.sync_q.closed:
            self.decode_queue.sync_q.put(data)

    def connection_lost(self, exc):
        print(self.name, f"Connection Error from {self.peername}:", exc, flush=True)
        self.end_connection()

    @staticmethod
    def decode_handler(protocol: 'HiQnetTCPListenerProtocol'):
        name = protocol.name

        got_goodbye = False
        while not protocol.decode_queue.sync_q.closed and not got_goodbye:
            try:
                data = protocol.decode_queue.sync_q.get(timeout=1)
            except SyncQueueEmpty:
                continue

            try:
                msgs = decode_message(data)
            except DecodeFailed as ex:
                print(name, "Decode Error:", ex, flush=True)
                return
            
            if msgs:
                protocol.last_packet = time.time()
            
            for msg in msgs:
                if type(msg) == DecodeFailed:
                    print(name, "Decode Error:", msg, flush=True)
                    continue

                if type(msg) == IncorrectDestination:
                    print(name, "Incorrect Destination:", msg, flush=True)
                    continue

                if type(msg) == DiscoInfo:
                    # keepalive time, yay!
                    protocol.keepalive_interval_ms = min(protocol.keepalive_interval_ms, msg.info.keep_alive_ms - 1000)
                    
                    if not protocol.reply_header:
                        protocol.reply_header = HiQnetHeader(msg.header.source_address)

                    if msg.is_query():
                        disco_info_msg = DiscoInfo(protocol.disco_info, is_query=False, header=protocol.reply_header.copy())
                        try:
                            protocol.transport.write(disco_info_msg.encode(protocol.next_seq()))
                        except UnsupportedMessage as ex:
                            print(protocol.name, f"Error Sending TCP Discovery Reply to {protocol.peername}:", ex)
                    continue

                if type(msg) == StartKeepAlive:
                    if not protocol.reply_header:
                        protocol.reply_header = HiQnetHeader(msg.header.source_address)
                    protocol.send_keepalives = True
                    continue

                if type(msg) == HelloQuery:
                    # Supported flags:
                    #   Session num: 0x100
                    # - Multi part: 0x40   No support
                    #   Guaranteed: 0x20
                    #   Error headers?: 0x8
                    #   Information: 0x4
                    #   Ack: 0x2
                    #   Req Ack: 0x1
                    if not protocol.reply_header:
                        protocol.reply_header = HiQnetHeader(msg.header.source_address)
                    protocol.send_keepalives = True

                    protocol.reply_header.session_id = msg.session_number
                    hello_info_msg = HelloInfo(msg.session_number, 0x12f, protocol.reply_header.copy())
                    try:
                        protocol.transport.write(hello_info_msg.encode(protocol.next_seq()))
                    except UnsupportedMessage as ex:
                        print(protocol.name, f"Error Sending TCP HelloInfo to {protocol.peername}:", ex)
                    continue

                if type(msg) == Goodbye:
                    print(protocol.name, f"Got Goodbye from {protocol.peername}", flush=True)
                    
                    # close socket
                    protocol.transport.close()
                    got_goodbye = True
                    break

                if type(msg) == GetAttributes:
                    print(protocol.name, f"GetAttributes request {msg.attribute_ids} from {protocol.peername}", flush=True)
                    
                    attr_data = {
                        AttributeID.ClassName: (ParamType.STRING, ATTR_CLASS_NAME),
                        AttributeID.NameString: (ParamType.STRING, ATTR_NAME),
                        AttributeID.SerialNumber: (ParamType.BLOCK, protocol.disco_info.serial),
                        AttributeID.SoftwareVersion: (ParamType.STRING, protocol.version),
                        # Values from BLU-100 reply
                        AttributeID.AdminPassword: (ParamType.BLOCK, b""),
                        AttributeID.ConfigState: (ParamType.BLOCK, b""),
                        AttributeID.DeviceState: (ParamType.ULONG, 0),
                    }

                    attributes = []
                    unknown = False
                    for aid in msg.attribute_ids:
                        # Skip unknown aids
                        if not any(True for x in AttributeID if x.value == aid):
                            print(protocol.name, f"GetAttributes request for unknown attribute id ({aid}) from {protocol.peername}", flush=True)
                            unknown = True
                            break

                        if AttributeID(aid) not in attr_data:
                            print(protocol.name, f"GetAttributes request for undefined attribute id ({aid}) from {protocol.peername}", flush=True)
                            unknown = True
                            break

                        datatype, value = attr_data[AttributeID(aid)]
                        attributes.append(Attribute(aid, datatype, value))

                    if unknown:
                        continue


                    getattr_reply = GetAttributesReply(attributes, protocol.reply_header.copy())
                    try:
                        protocol.transport.write(getattr_reply.encode(protocol.next_seq()))
                    except UnsupportedMessage as ex:
                        print(protocol.name, f"Error Sending GetAttributesReply to {protocol.peername}:", ex)
                    continue

                if type(msg) == ParameterSubscribeAll:
                    continue

                print("TCP Server MSG:", msg)

class HiQnetTCPListenerThread(threading.Thread):
    def __init__(self, name: str, h_id: str, bind_ip: str, server_ip: str, hiqnet_port: int, health_check_queue: Queue, disco_info: DiscoveryInformation, version: str):
        super().__init__(daemon=True)
        self.name = name
        self.h_id = h_id
        self.bind_ip = bind_ip
        self.server_ip = server_ip
        self.hiqnet_port = hiqnet_port
        self.health_queue = health_check_queue
        self.health_queue.sync_q.put({"id": self.h_id, "status": False})
        self.disco_info = disco_info
        self.version = version
        self.exitFlag = False
        self.restartFlag = False

    async def createServer(self, loop):        
        server = await loop.create_server(
            lambda: HiQnetTCPListenerProtocol(self.name, self.h_id, self.server_ip,
                self.hiqnet_port, self.disco_info, self.version, loop),
            host=self.bind_ip, port=self.hiqnet_port)

        self.health_queue.sync_q.put({"id": self.h_id, "status": True})
        async with server:
            server_task = loop.create_task(server.serve_forever())
            while not self.exitFlag and not self.restartFlag:
                await asyncio.sleep(1)
            server.close()
            for task in [server_task]:
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
                client_task = loop.create_task(self.createServer(loop))
                loop.run_until_complete(client_task)
                loop.stop()
                loop.close()
            except Exception as ex:
                print(self.name, "Error:", ex, flush=True)
                print(tb.format_exc(), flush=True)
            self.health_queue.sync_q.put({"id": self.h_id, "status": False})
            if not self.exitFlag:
                print(self.name, "HiQnet TCP server thread stopped, Restarting in 5 seconds", flush=True)
                for _ in range(5):
                    if self.exitFlag:
                        break
                    time.sleep(1)
        print(self.name, "exited", flush=True)
