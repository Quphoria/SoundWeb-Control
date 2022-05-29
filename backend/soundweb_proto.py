from enum import Enum
from dataclasses import dataclass
import binascii
import re

class MessageType(Enum):
    SET = 0x88
    SUBSCRIBE = 0x89
    UNSUBSCRIBE = 0x8A
    RECALL_PRESET = 0x8C
    SET_PERCENT = 0x8D
    SUBSCRIBE_PERCENT = 0x8E
    UNSUBSCRIBE_PERCENT = 0x9F
    BUMP_PERCENT = 0x90
    SET_STRING = 0x91

class InvalidChecksum(Exception):
    pass

class DecodeFailed(Exception):
    pass

byte_substitution_prefix = b'\x1B'
byte_substitution = {
    b'\x02': b'\x82',
    b'\x03': b'\x83',
    b'\x06': b'\x86',
    b'\x15': b'\x95',
    b'\x1B': b'\x9B' # make sure this is last so we don't get a double substitution
}

def sub_body(body: bytes):
    substituted = body
    for k, v in reversed(byte_substitution.items()):
        substituted = substituted.replace(k, byte_substitution_prefix + v)
    return substituted
def unsub_body(sub_body: bytes):
    body = sub_body
    for k, v in byte_substitution.items():
        body = body.replace(byte_substitution_prefix + v, k)
    return body
def calc_checksum(body: bytes):
    x = 0
    for c in body:
        x ^= c
    return x
    
@dataclass
class Packet:
    message_type: MessageType
    node: int = 0
    v_device: int = 0
    obj_id: int = 0
    param_id: int = 0
    value: int = 0
    string_bytes: bytes = b''

    def __post_init__(self):
        assert len(self.string_bytes) <= 32, "String longer than 32 bytes"

    def __str__(self):
        s = "Packet{" + self.message_type.name + " "
        if self.message_type in (MessageType.SET, MessageType.SUBSCRIBE, MessageType.SUBSCRIBE_PERCENT, MessageType.BUMP_PERCENT,
                MessageType.SET_STRING, MessageType.UNSUBSCRIBE, MessageType.UNSUBSCRIBE_PERCENT):
            s += format(self.node, '04x') + " " + format(self.v_device, '02x') + " " + format(self.obj_id, '06x') + " " + format(self.param_id, '04x')
            if self.message_type in (MessageType.SET, MessageType.SUBSCRIBE, MessageType.SUBSCRIBE_PERCENT, MessageType.BUMP_PERCENT):
                s += " " + format(self.value, '#08x')
            elif self.message_type == MessageType.SET_STRING:
                s += " " + self.string_bytes
        elif self.message_type == MessageType.RECALL_PRESET:
            s += format(self.value, '08x')
        else:
            s += "Unknown?"
        return s + "}"

    def encode(self):
        body = self.message_type.value.to_bytes(1, byteorder='big')
        if self.message_type in (MessageType.SET, MessageType.SUBSCRIBE, MessageType.SUBSCRIBE_PERCENT, MessageType.BUMP_PERCENT,
                MessageType.SET_STRING, MessageType.UNSUBSCRIBE, MessageType.UNSUBSCRIBE_PERCENT):
            body += self.node.to_bytes(2, byteorder='big')
            body += self.v_device.to_bytes(1, byteorder='big')
            body += self.obj_id.to_bytes(3, byteorder='big')
            body += self.param_id.to_bytes(2, byteorder='big')
            if self.message_type in (MessageType.SET, MessageType.SUBSCRIBE, MessageType.SUBSCRIBE_PERCENT, MessageType.BUMP_PERCENT):
                body += self.value.to_bytes(4, byteorder='big', signed=True)
            elif self.message_type == MessageType.SET_STRING:
                body += len(self.string_bytes).to_bytes(1, byteorder='big')
                body += self.string_bytes
                body += b'\x00' # null byte
        elif self.message_type == MessageType.RECALL_PRESET:
            body += self.value.to_bytes(4, byteorder='big')
        else:
            assert False, "Unknown Message Type: " + self.message_type
        chksm = calc_checksum(body).to_bytes(1, byteorder='big')
        msg = b'\x02' + sub_body(body + chksm) + b'\x03'
        return msg

    @classmethod
    def decode(cls, data):
        assert data[0] == 0x02, "Packet must start with 0x02"
        assert data[-1] == 0x03, "Packet must end with 0x03"
        body = unsub_body(data[1:-1])
        chksm = calc_checksum(body[:-1])
        if chksm != body[-1]:
            raise InvalidChecksum("Invalid Checksum! Calculated: " + format(chksm, '02x') + " Got: " + format(body[-1], '02x') + " Msg: " + data.hex())
        message_type = MessageType(body[0])
        c = cls(message_type)
        if message_type in (MessageType.SET, MessageType.SUBSCRIBE, MessageType.SUBSCRIBE_PERCENT, MessageType.BUMP_PERCENT,
                MessageType.SET_STRING, MessageType.UNSUBSCRIBE, MessageType.UNSUBSCRIBE_PERCENT):
            c.node = int.from_bytes(body[1:3], byteorder='big')
            c.v_device = body[3]
            c.obj_id = int.from_bytes(body[4:7], byteorder='big')
            c.param_id = int.from_bytes(body[7:9], byteorder='big')
            if message_type in (MessageType.SET, MessageType.SUBSCRIBE, MessageType.SUBSCRIBE_PERCENT, MessageType.BUMP_PERCENT):
                c.value = int.from_bytes(body[9:13], byteorder='big', signed=True)
            elif message_type == MessageType.SET_STRING:
                str_len = body[9]
                c.string_bytes = body[10:10+str_len]
                assert body[10+str_len] == 0, "String must end with 0x00"
        elif message_type == MessageType.RECALL_PRESET:
            c.value = int.from_bytes(body[1:5], byteorder='big')

        return c
    def param_str(self):
        return format(self.node, '04x') + ":" + format(self.v_device, '02x') + ":" + format(self.obj_id, '06x') + ":" + format(self.param_id, '04x')
    def to_json(self):
        return {
            "type": self.message_type.name,
            "parameter": self.param_str(),
            "value": self.value
        }
    @classmethod
    def from_json(cls, data):
        if not ("type" in data and "parameter" in data and "value" in data):
            raise DecodeFailed("Missing Fields")
        if not (type(data["type"]) == str and type(data["parameter"]) == str and type(data["value"] == int)):
            raise DecodeFailed("Field type incorrect")
        try:
            c = cls(MessageType[data["type"]])
        except KeyError:
            raise DecodeFailed("Unknown Packet Type")
        parameter = data["parameter"].lower().split(":")
        if len(parameter) != 4:
            raise DecodeFailed("Parameter length incorrect")
        def from_hex(s, l):
            if len(s) != l:
                raise DecodeFailed("Parameter field length invalid")
            if not re.match("^[0-9a-f]+$", s):
                raise DecodeFailed("Parameter invalid hex")
            return int(s, 16)
        c.node = from_hex(parameter[0], 4)
        c.v_device = from_hex(parameter[1], 2)
        c.obj_id = from_hex(parameter[2], 6)
        c.param_id = from_hex(parameter[3], 4)
        c.value = data["value"]
        return c

__test_p = Packet(MessageType.SUBSCRIBE, node=0x0001, v_device=0x03, obj_id=0x00011a, param_id=0x0000)
__test_p2_hex = binascii.unhexlify("028900011B8300011A0000000000009003")
__test_p2 = Packet.decode(__test_p2_hex)
assert __test_p == __test_p2, "Failed to decode test packet"
assert __test_p2.encode() == __test_p2_hex, "Failed to encode test packet"

def decode_packets(msg: bytes):
    packets = []
    pkt_msg = b''
    while msg:
        if msg[:1] == 0x02:
            pkt_msg = b'' # start of message nyte
        pkt_msg += msg[:1] # take next byte
        msg = msg[1:]
        if pkt_msg[-1] == 0x03:
            try:
                packets.append(Packet.decode(pkt_msg))
            except InvalidChecksum as ex:
                print(ex, flush=True)
            # clear packet so it doesn't get returned as remaining
            pkt_msg = b''
    return packets, pkt_msg # return remaining bytes

def meter_value_db(value):
    return str(value / 10000) + " dB"

