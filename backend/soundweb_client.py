import asyncore, asyncio, threading, time, functools
from contextlib import suppress
from janus import Queue, SyncQueue, SyncQueueEmpty
import janus

from soundweb_proto import MessageType, Packet, meter_value_db, decode_packets

# self.send(b'\x02\xff\x03')

def run_in_executor(f):
    @functools.wraps(f)
    def inner(*args, **kwargs):
        loop = asyncio.get_running_loop()
        return loop.run_in_executor(None, lambda: f(*args, **kwargs))

    return inner

class SoundWebClientProtocol(asyncio.Protocol):
    def __init__(self, name: str, msg_queue: SyncQueue, resp_queue: SyncQueue, subscribed_params: list, loop):
        self.name = name
        self.msg_queue = msg_queue
        self.resp_queue = resp_queue
        self.subscribed_params = subscribed_params
        self._ready = asyncio.Event()
        self.loop = loop
        self.send_task = loop.create_task(self.send_messages())
        self.transport = None
        self.read_buffer = b""

    def end_connection(self):
        self.send_task.cancel()

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
                # print("O", p)
                self.transport.write(p.encode())

    def connection_test_packet(self, transport):
        # this packet gives no response and doesn't make soundweb kill the connection
        transport.write(b'\x02\xff\x03') 

    def connection_made(self, transport):
        print(self.name, "Connected")
        if self.subscribed_params:
            for p in self.subscribed_params:
                transport.write(p.encode())
        # empty message queue to clear delayed commands (otherwise could cause unexpected changes on connection)
        while (not self.msg_queue.closed) and (not self.msg_queue.empty()):
            self.msg_queue.get(timeout=1)
        self.transport = transport
        # clear read buffer
        self.read_buffer = b""
        self._ready.set()

    def data_received(self, data):
        if not self.resp_queue:
            return
        packets, self.read_buffer = decode_packets(self.read_buffer + data)
        for p in packets:
            # print(p)
            # print(p, meter_value_db(p.value))
            if self.resp_queue.closed:
                self.end_connection()
                return
            if self.resp_queue.full():
                self.resp_queue.get() # remove oldest if queue full
            self.resp_queue.put(p.to_json())

    def connection_lost(self, exc):
        print(self.name, "Connection Error:", exc)
        self.end_connection()
        self.loop.stop()

class SoundWebThread(threading.Thread):
    def __init__(self, name: str, soundweb_ip: str, soundweb_port: int, msg_queue: Queue, resp_queue: Queue, subscribed_params: list):
        super().__init__(daemon=True)
        self.name = name
        self.soundweb_ip = soundweb_ip
        self.soundweb_port = soundweb_port
        self.msg_queue = msg_queue
        self.resp_queue = resp_queue
        self.subscribed_params = subscribed_params
        self.exitFlag = False
    async def createClient(self, loop):
        if self.resp_queue:
            transport, protocol = await loop.create_connection(
                lambda: SoundWebClientProtocol(self.name,
                    self.msg_queue.sync_q, self.resp_queue.sync_q,
                    self.subscribed_params, loop),
                self.soundweb_ip, self.soundweb_port)
        else:
            transport, protocol = await loop.create_connection(
                lambda: SoundWebClientProtocol(self.name,
                    self.msg_queue.sync_q, None,
                    self.subscribed_params, loop),
                self.soundweb_ip, self.soundweb_port)
        n = 0
        while not self.exitFlag:
            await asyncio.sleep(1)
            n += 1  # check connection is alive every 10 seconds
            if n >= 10:
                n = 0
                protocol.connection_test_packet(transport)
        transport.close()
        # cancel send task
        protocol.send_task.cancel()
        try:
            await protocol.send_task
        except asyncio.CancelledError:
            pass
    def run(self):
        print(self.name, "started")
        while not self.exitFlag:
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                client_task = loop.create_task(self.createClient(loop))
                loop.run_until_complete(client_task)
                loop.stop()
                loop.close()
            except Exception as ex:
                print(self.name, "Error:", ex)
            if not self.exitFlag:
                print(self.name, "Disconnected from SoundWeb, Reconnecting in 5 seconds")
                for i in range(5):
                    if self.exitFlag:
                        break
                    time.sleep(1)
        print(self.name, "exited")