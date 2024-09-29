from enum import Enum
import dataclasses
from dataclasses import dataclass, field
from typing import Any, Dict, List, Tuple
import struct, re

class DecodeFailed(Exception):
    pass

class IncorrectDestination(Exception):
    pass

class EncodeFailed(Exception):
    pass

class UnsupportedMessage(Exception):
    pass

# type sizes
UBYTE = 1
UWORD = 2
ULONG = 4
HIQNETADDR = 6

MAX_SEQ_NUM = 0xffff

# used for GetNetworkInfo
# Taken from what AA was broadcasting
# MAX_MTU = 1048576
# Takes from BLU-100, seems to be a common value
MAX_MTU = 1452 # also in DiscoveryInformation

@dataclass
class HiQnetAddress:
    device: int = 0
    v_device: int = 0
    obj_id: int = 0

    def encode(self):
        address = self.device.to_bytes(2, "big")
        address += self.v_device.to_bytes(1, "big")
        address += self.obj_id.to_bytes(3, "big")
        return address

    def is_broadcast(self):
        return self.device == 0xffff and self.v_device == 0 and self.obj_id == 0

    @classmethod
    def broadcast(cls):
        return cls(device=0xffff)

    @classmethod
    def decode(cls, data):
        assert len(data) == HIQNETADDR, "Invalid HiQnet Address Length"
        device = int.from_bytes(data[:2], "big")
        v_device = data[2]
        obj_id = int.from_bytes(data[3:], "big")
        return cls(device, v_device, obj_id)

MY_ADDRESS = HiQnetAddress(device=0xfb00)

class MessageID(Enum):
    UNDEFINED = -1
    # routing layer
    DiscoInfo = 0x0000
    GetNetworkInfo = 0x0002
    RequestAddress = 0x0004
    AddressUsed = 0x0005
    SetAddress = 0x0006
    Goodbye = 0x0007
    Hello = 0x0008

    # device level methods
    GetAttributes = 0x010D
    GetVDList = 0x011A
    Store = 0x0124
    Recall = 0x0125
    Locate = 0x0129

    # useful
    MultiParamSet = 0x0100
    MultiObjectParamSet = 0x0101
    MultiParamGet = 0x0103
    MultiParamSubscribe = 0x010f
    MultiParamUnsubscribe = 0x0112
    ParameterSubscribeAll = 0x0113
    ParameterUnSubscribeAll = 0x0114
    ParamSetPercent = 0x0102
    ParamSubscribePercent = 0x0111

# See Foundation.Interfaces.eNmAttributes
class AttributeID(Enum):
    # All devices should support these
    ClassName = 0       # STRING
    NameString = 1      # STRING
    Flags = 2           # UWORD
    SerialNumber = 3    # BLOCK
    SoftwareVersion = 4 # STRING
    # The rest are ???, but 
    DeveloperAccessRights = 5
    HopCount = 6
    VenueTableSize = 7
    UserNameA = 8
    UserNameB = 9
    UserNameC = 10
    UserNameD = 11
    UserPasswordA = 12
    UserPasswordB = 13
    UserPasswordC = 14
    UserPasswordD = 15
    AddressMode = 16
    AdminPassword = 17  # BLOCK (0 length)?
    DevFuncPermsA = 18
    DevFuncPermsB = 19
    DevFuncPermsC = 20
    DevFuncPermsD = 21
    ConfigState = 22    # BLOCK (0 length)?
    DeviceState = 23    # ULONG (0)?
    VenueData = 24
    ContainerId = 25
    ContainerPosition = 26
    ContainerType = 27
    ContainerGUID = 28

    # There are more (device specific), but those are the important ones
BASE_ATTRIBUTES = [
    AttributeID.ClassName.value,
    AttributeID.NameString.value,
    AttributeID.Flags.value,
    AttributeID.SerialNumber.value,
    AttributeID.SoftwareVersion.value,
]

@dataclass
class HiQnetFlags:
    session_id: bool = False
    multi_part: bool = False
    guaranteed: bool = True # default to tcp (guaranteed)
    error_header: bool = False
    information: bool = False
    acknowledgement: bool = False
    req_acknowledgement: bool = False

    def encode(self):
        flags = 0
        flags |= 0x0100 if self.session_id else 0
        flags |= 0x0040 if self.multi_part else 0
        flags |= 0x0020 if self.guaranteed else 0
        flags |= 0x0008 if self.error_header else 0
        flags |= 0x0004 if self.information else 0
        flags |= 0x0002 if self.acknowledgement else 0
        flags |= 0x0001 if self.req_acknowledgement else 0
        
        return flags.to_bytes(2, "big")

    @classmethod
    def decode(cls, data):
        flags = int.from_bytes(data, "big")
        return cls(
            session_id = (flags & 0x0100) != 0,
            multi_part = (flags & 0x0040) != 0,
            guaranteed = (flags & 0x0020) != 0,
            error_header = (flags & 0x0008) != 0,
            information = (flags & 0x0004) != 0,
            acknowledgement = (flags & 0x0002) != 0,
            req_acknowledgement = (flags & 0x0001) != 0
        )
    
    @staticmethod
    def session_supported():
        # see 4.3.7 Hello Query
        return 0x01FF

@dataclass
class HiQnetHeader:
    VERSION = 2
    dest_address: HiQnetAddress
    source_address: HiQnetAddress = field(default_factory=lambda: MY_ADDRESS)
    message_id: MessageID = MessageID.UNDEFINED
    flags: HiQnetFlags = field(default_factory=HiQnetFlags)
    hop_count: int = 5
    sequence_number: int = 0
    session_id: int = 0

    def copy(self):
        return dataclasses.replace(self)

    def encode(self, payload_length=0, sequence_number=None):
        if sequence_number is not None:
            self.sequence_number = sequence_number

        if self.message_id == MessageID.UNDEFINED:
            raise EncodeFailed("Message ID not set!")

        header = self.source_address.encode()
        header += self.dest_address.encode()
        header += self.message_id.value.to_bytes(UWORD, "big")

        if self.session_id != 0: # set session id flag
            self.flags.session_id = True
        header += self.flags.encode()
        header += self.hop_count.to_bytes(UBYTE, "big")
        header += self.sequence_number.to_bytes(UWORD, "big")

        if self.session_id != 0:
            header += self.session_id.to_bytes(UWORD, "big")

        data = self.VERSION.to_bytes(UBYTE, "big") # version
        data += (len(header) + 6).to_bytes(UBYTE, "big") # 1 byte (+6 for version, header len and msg length)
        data += (len(header) + 6 + payload_length).to_bytes(ULONG, "big") # 4 bytes
        data += header

        return data

    @classmethod
    def decode(cls, data):
        version = data[0]
        if version != HiQnetHeader.VERSION:
            raise DecodeFailed(f"Invalid version: {version}")
        if len(data) < data[1]:
            raise DecodeFailed("Header too short!")
        header = data[2:data[1]]

        message_length = int.from_bytes(header[:4], "big")
        if len(data) < message_length and False:
            raise DecodeFailed("Incorrect message length")

        source_addr = HiQnetAddress.decode(header[4:10])
        dest_addr = HiQnetAddress.decode(header[10:16])
        if dest_addr.device != MY_ADDRESS.device and not dest_addr.is_broadcast():
            raise IncorrectDestination(f"Incorrect destination address {dest_addr}")

        message_id = int.from_bytes(header[16:18], "big")
        try:
            message_id = MessageID(message_id)
        except ValueError:
            raise DecodeFailed(f"Unknown Message ID: {message_id}")

        flags = HiQnetFlags.decode(header[18:20])
        hop_count = header[20]
        seq_number = int.from_bytes(header[21:23], "big")

        if flags.error_header: # error header extension
            error_code = int.from_bytes(header[21:23], "big")
            error_msg = header[23:]
            raise DecodeFailed(f"Received error: {error_code} = {error_msg}")

        if flags.multi_part: # multi part
            start_seq_num = int.from_bytes(header[21:23], "big")
            bytes_remaining = int.from_bytes(header[23:27], "big")
            raise DecodeFailed(f"Multi-Part messages not supported")

        session_num = 0
        if flags.session_id: # session num
            session_num = int.from_bytes(header[21:23], "big")
            # raise DecodeFailed(f"Sessions not supported")

        message = data[data[1]:message_length]

        return cls(
            source_address=source_addr,
            dest_address=dest_addr,
            message_id=message_id,
            flags=flags,
            hop_count=hop_count,
            sequence_number=seq_number,
            session_id=session_num
        ), message, data[message_length:]

class HiQnetMessage:
    def __init__(self, header: HiQnetHeader):
        self.header = header

    def get_payload(self):
        raise EncodeFailed("get_payload not implemented")

    def encode(self, sequence_number=None):
        payload = self.get_payload()

        data = self.header.encode(len(payload), sequence_number)
        data += payload

        return data
    
    @classmethod
    def decode(cls, data: bytes, header: HiQnetHeader):
        raise DecodeFailed("decode not implemented")

def decode_message(data) -> List[HiQnetMessage]:
    msgs = []
    while len(data):
        try:
            header, message, data = HiQnetHeader.decode(data)
        except (IncorrectDestination, DecodeFailed) as ex:
            msgs.append(ex)
            break

        try:
            if header.message_id == MessageID.DiscoInfo:
                msgs.append(DiscoInfo.decode(message, header))
            elif header.message_id == MessageID.Hello and not header.flags.information:
                msgs.append(HelloQuery.decode(message, header))
            elif header.message_id == MessageID.Hello:
                msgs.append(HelloInfo.decode(message, header))
            elif header.message_id == MessageID.Goodbye:
                msgs.append(Goodbye.decode(message, header))
            elif header.message_id == MessageID.MultiObjectParamSet:
                msgs.append(MultiObjectParamSet.decode(message, header))
            elif header.message_id == MessageID.ParamSetPercent:
                msgs.append(ParamSetPercent.decode(message, header))
            elif header.message_id == MessageID.MultiParamGet:
                msg = MultiParamGet.decode(message, header)
                if msg.is_start_keepalive():
                    msgs.append(StartKeepAlive.decode(message, header))
                else:
                    msgs.append(msg)
            elif header.message_id == MessageID.GetNetworkInfo:
                msgs.append(GetNetworkInfo.decode(message, header))
            elif header.message_id == MessageID.GetAttributes:
                if header.flags.information:
                    msgs.append(GetAttributesReply.decode(message, header))
                else:
                    msgs.append(GetAttributes.decode(message, header))
            else:
                raise DecodeFailed(f"Message ID {header.message_id} not implemented")
        except DecodeFailed as ex: 
            msgs.append(ex)
    return msgs

class ParamType(Enum):
    BYTE = 0
    UBYTE = 1
    WORD = 2
    UWORD = 3
    LONG = 4
    ULONG = 5
    FLOAT32 = 6
    FLOAT64 = 7
    BLOCK = 8
    STRING = 9
    LONG64 = 10
    ULONG64 = 11

@dataclass
class Parameter:
    param_id: int
    datatype: ParamType
    value: Any

    def encode(self):
        if self.datatype == ParamType.BYTE:
            return struct.pack(">b", self.value)
        elif self.datatype == ParamType.UBYTE:
            return struct.pack(">B", self.value)
        elif self.datatype == ParamType.WORD:
            return struct.pack(">h", self.value)
        elif self.datatype == ParamType.UWORD:
            return struct.pack(">H", self.value)
        elif self.datatype == ParamType.LONG:
            return struct.pack(">l", self.value)
        elif self.datatype == ParamType.ULONG:
            return struct.pack(">L", self.value)
        elif self.datatype == ParamType.FLOAT32:
            return struct.pack(">f", self.value)
        elif self.datatype == ParamType.FLOAT64:
            return struct.pack(">d", self.value)
        elif self.datatype == ParamType.BLOCK:
            return len(self.value).to_bytes(2, "big") + self.value
        elif self.datatype == ParamType.STRING:
            encoded = (self.value + "\x00").encode("UTF-16BE") # append null byte
            return len(encoded).to_bytes(2, "big") + encoded
        elif self.datatype == ParamType.LONG64:
            return struct.pack(">q", self.value)
        elif self.datatype == ParamType.ULONG64:
            return struct.pack(">Q", self.value)
        else:
            raise EncodeFailed(f"Unknown Parameter Datatype {self.datatype}")

    @classmethod
    def decode(cls, param_id: int, datatype: int, data: bytes, i: int):
        try:
            datatype = ParamType(datatype)
        except ValueError:
            raise DecodeFailed(f"Unknown Parameter Datatype {datatype}")
        
        if datatype == ParamType.BYTE:
            return i+1, cls(param_id, datatype, struct.unpack_from(">b", data, i)[0])
        elif datatype == ParamType.UBYTE:
            return i+1, cls(param_id, datatype, struct.unpack_from(">B", data, i)[0])
        elif datatype == ParamType.WORD:
            return i+2, cls(param_id, datatype, struct.unpack_from(">h", data, i)[0])
        elif datatype == ParamType.UWORD:
            return i+2, cls(param_id, datatype, struct.unpack_from(">H", data, i)[0])
        elif datatype == ParamType.LONG:
            return i+4, cls(param_id, datatype, struct.unpack_from(">l", data, i)[0])
        elif datatype == ParamType.ULONG:
            return i+4, cls(param_id, datatype, struct.unpack_from(">L", data, i)[0])
        elif datatype == ParamType.FLOAT32:
            return i+4, cls(param_id, datatype, struct.unpack_from(">f", data, i)[0])
        elif datatype == ParamType.FLOAT64:
            return i+8, cls(param_id, datatype, struct.unpack_from(">d", data, i)[0])
        elif datatype == ParamType.BLOCK:
            length = int.from_bytes(data[i:i+2], "big")
            value = data[i+2:i+2+length]
            return i+2+length, cls(param_id, datatype, value)
        elif datatype == ParamType.STRING:
            length = int.from_bytes(data[i:i+2], "big")
            value = data[i+2:i+2+length-2].decode("UTF-16BE") # remove null byte
            return i+2+length, cls(param_id, datatype, value)
        elif datatype == ParamType.LONG64:
            return i+8, cls(param_id, datatype, struct.unpack_from(">q", data, i)[0])
        elif datatype == ParamType.ULONG64:
            return i+8, cls(param_id, datatype, struct.unpack_from(">Q", data, i)[0])
        else:
            raise DecodeFailed(f"Unknown Parameter Datatype {datatype}")

class RawMessage(HiQnetMessage):
    def __init__(self, message: bytes, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.message = message

    def get_payload(self):
        return self.message

    @classmethod
    def decode(cls, data: bytes, header: HiQnetHeader):
        return cls(data, header)

@dataclass
class NetworkInfo:
    mac_addr: str # AA:BB:CC:DD:EE:FF
    dhcp: bool
    ip: str
    subnet: str
    gateway: str

    MSG_LENGTH = 19

    def __str__(self):
        return f"MAC={self.mac_addr} DHCP={1 if self.dhcp else 0} IP={self.ip} SUBNET={self.subnet} GATEWAY={self.gateway}"

    @staticmethod
    def encode_ip(s):
        ip_str = re.match(r"^([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$", s)
        a, b, c, d = ip_str.groups()
        a, b, c, d = int(a), int(b), int(c), int(d)
        if min(a,b,c,d) < 0 or max(a,b,c,d) > 255:
            raise Exception("Invalid IP address")
        return (a << 24) | (b << 16) | (c << 8) | d

    def encode(self):
        data = bytes.fromhex(self.mac_addr.replace(":", ""))
        data += (1 if self.dhcp else 0).to_bytes(1, "big")
        data += self.encode_ip(self.ip).to_bytes(4, "big")
        data += self.encode_ip(self.subnet).to_bytes(4, "big")
        data += self.encode_ip(self.gateway).to_bytes(4, "big")
        return data

    @staticmethod
    def format_ip(ip):
        ip = int.from_bytes(ip, "big")
        return f"{ip >> 24}.{(ip >> 16) & 0xff}.{(ip >> 8) & 0xff}.{ip & 0xff}"

    @classmethod
    def decode(cls, data: bytes):
        mac = data[:6].hex().upper()
        mac = ":".join([mac[i:i+2] for i in range(0, len(mac), 2)])
        dhcp = data[6] == 1
        ip = cls.format_ip(data[7:11])
        subnet = cls.format_ip(data[11:15])
        gateway = cls.format_ip(data[15:19])
        return cls(mac, dhcp, ip, subnet, gateway)

@dataclass
class DiscoveryInformation:
    network_info: NetworkInfo
    hiqnet_device: int = field(default_factory=lambda: MY_ADDRESS.device)
    cost: int = 0
    serial: bytes = field(default_factory=lambda: bytes(16))
    max_message_size: int = 1452
    keep_alive_ms: int = 10000
    network_id: int = 1

    def __str__(self):
        return f"DEV={self.hiqnet_device} COST={self.cost} SER={self.serial.hex()} MAX={self.max_message_size} KEEP={self.keep_alive_ms} NET={self.network_id} {self.network_info}"

    def encode(self):
        data = self.hiqnet_device.to_bytes(2, "big")
        data += self.cost.to_bytes(1, "big")
        data += len(self.serial).to_bytes(2, "big")
        data += self.serial
        data += self.max_message_size.to_bytes(4, "big")
        data += self.keep_alive_ms.to_bytes(2, "big")
        data += self.network_id.to_bytes(1, "big")
        data += self.network_info.encode()
        return data

    @staticmethod
    def format_ip(ip):
        ip = int.from_bytes(ip, "big")
        return f"{ip >> 24}.{(ip >> 16) & 0xff}.{(ip >> 8) & 0xff}.{ip & 0xff}"

    @classmethod
    def decode(cls, data: bytes):
        hiqnet_device = int.from_bytes(data[:2], "big")
        cost = data[2]
        serial_length = int.from_bytes(data[3:5], "big")
        serial = data[5:5+serial_length] # 16 bytes
        max_message_size = int.from_bytes(data[5+serial_length:9+serial_length], "big")
        keep_alive_ms = int.from_bytes(data[9+serial_length:11+serial_length], "big")
        network_id = data[11+serial_length]
        network_info = NetworkInfo.decode(data[12+serial_length:])
        return cls(network_info, hiqnet_device, cost, serial, max_message_size, keep_alive_ms, network_id)

class DiscoInfo(HiQnetMessage):
    def __init__(self, info: DiscoveryInformation, is_query=False, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.header.message_id = MessageID.DiscoInfo
        self.header.flags.information = not is_query
        self.info = info
    
    def is_query(self):
        return not self.header.flags.information

    def get_payload(self):
        return self.info.encode()

    def __str__(self):
        return ("DiscoInfo" if self.header.flags.information else "DiscoQuery") + " " + str(self.info)

    @classmethod
    def decode(cls, data: bytes, header: HiQnetHeader):
        info = DiscoveryInformation.decode(data)
        is_query = not header.flags.information
        return cls(info, is_query, header)

@dataclass
class NetworkInterface:
    network_info: NetworkInfo
    network_id: int = 1
    max_mtu: int = MAX_MTU

    def encode(self):
        data = self.max_mtu.to_bytes(ULONG, "big")
        data += self.network_id.to_bytes(UBYTE, "big")
        data += self.network_info.encode()
        return data
    
    @classmethod
    def decode(cls, data, i):
        max_mtu = int.from_bytes(data[i:4+i], "big")
        network_id = data[4+i]
        network_info = NetworkInfo.decode(data[5+i:])
        i += 5 + NetworkInfo.MSG_LENGTH
        return i, cls(max_mtu=max_mtu, network_id=network_id, network_info=network_info)

class GetNetworkInfo(HiQnetMessage):
    def __init__(self, serial: bytes, interfaces: List[NetworkInterface], is_query=False, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.header.message_id = MessageID.GetNetworkInfo
        self.header.flags.information = not is_query
        self.serial = serial
        self.interfaces = interfaces
    
    def is_query(self):
        return not self.header.flags.information

    def get_payload(self):
        data = len(self.serial).to_bytes(2, "big")
        data += self.serial
        data += len(self.interfaces).to_bytes(UWORD, "big")
        for intf in self.interfaces:
            data += intf.encode()
        return data

    def __str__(self):
        if not self.header.flags.information:
            return f"GetNetworkInfo SER={self.serial.hex()}"
        return f"GetNetworkInfo SER={self.serial.hex()} NETS={self.interfaces}"

    @classmethod
    def decode(cls, data: bytes, header: HiQnetHeader):
        is_query = not header.flags.information
        serial_length = int.from_bytes(data[:2], "big")
        serial = data[2:2+serial_length] # 16 bytes
        num_interfaces = int.from_bytes(data[2+serial_length:4+serial_length], "big")
        i = 4+serial_length
        interfaces = []
        for _ in range(num_interfaces):
            i, intf = NetworkInterface.decode(data, i)
            interfaces.append(intf)
        return cls(serial, interfaces, is_query, header)

class HelloQuery(HiQnetMessage):
    def __init__(self, session_number: int, flag_mask: int = HiQnetFlags.session_supported(), *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.header.message_id = MessageID.Hello
        self.session_number = session_number
        self.flag_mask = flag_mask
    
    def get_session_number(self):
        return self.session_number

    def get_payload(self):
        data = self.session_number.to_bytes(UWORD, "big")
        data += self.flag_mask.to_bytes(UWORD, "big")
        return data

    def __str__(self):
        return "HelloQuery " + str(self.session_number) + " : " + hex(self.flag_mask) 

    @classmethod
    def decode(cls, data: bytes, header: HiQnetHeader):
        session_number = int.from_bytes(data[:2], "big")
        flag_mask = int.from_bytes(data[2:4], "big")
        return cls(session_number, flag_mask, header)
    
class HelloInfo(HiQnetMessage):
    def __init__(self, session_number: int, flag_mask: int = HiQnetFlags.session_supported(), *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.header.message_id = MessageID.Hello
        self.header.flags.information = True
        self.session_number = session_number
        self.flag_mask = flag_mask
    
    def get_session_number(self):
        return self.session_number

    def get_payload(self):
        data = self.session_number.to_bytes(UWORD, "big")
        data += self.flag_mask.to_bytes(UWORD, "big")
        return data

    def __str__(self):
        return "HelloInfo " + str(self.session_number) + " : " + hex(self.flag_mask) 

    @classmethod
    def decode(cls, data: bytes, header: HiQnetHeader):
        session_number = int.from_bytes(data[:2], "big")
        flag_mask = int.from_bytes(data[2:4], "big")
        return cls(session_number, flag_mask, header)

class Goodbye(HiQnetMessage):
    def __init__(self, device_address: int = MY_ADDRESS.device, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.header.message_id = MessageID.Goodbye
        self.device_address = device_address
    
    def get_device_address(self):
        return self.device_address

    def get_payload(self):
        data = self.device_address.to_bytes(UWORD, "big")
        return data

    def __str__(self):
        return "Goodbye " + str(self.device_address)

    @classmethod
    def decode(cls, data: bytes, header: HiQnetHeader):
        device_address = int.from_bytes(data[:2], "big")
        return cls(device_address, header)
    
class GetAttributes(HiQnetMessage):
    def __init__(self, attribute_ids: List[int] = BASE_ATTRIBUTES, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.header.message_id = MessageID.GetAttributes
        self.attribute_ids = attribute_ids
    
    def get_payload(self):
        data = len(self.attribute_ids).to_bytes(UWORD, "big")
        for aid in self.attribute_ids:
            data += aid(UWORD, "big")
        return data

    def __str__(self):
        return f"GetAttributes : {self.attribute_ids}"

    @classmethod
    def decode(cls, data: bytes, header: HiQnetHeader):
        num_aids = int.from_bytes(data[:2], "big")
        aids = []
        for i in range(num_aids):
            aids.append(int.from_bytes(data[2+i*2:4+i*2], "big"))
        return cls(aids, header)

@dataclass
class Attribute:
    aid: int
    datatype: ParamType
    value: Any

    def encode(self):
        data = self.aid.to_bytes(UWORD, "big")
        data += self.datatype.value.to_bytes(UBYTE, "big")
        # avoid re-writing datatype encode function
        # use from Parameter
        data += Parameter(0, self.datatype, self.value).encode()
        return data
    
    @classmethod
    def decode(cls, data, i):
        aid = int.from_bytes(data[i:2+i], "big")
        datatype = ParamType(data[2+i])
        # avoid re-writing datatype decode function
        # use from Parameter
        i, p = Parameter.decode(0, datatype, data, 3+i)
        return i, cls(aid, datatype, p.value)

class GetAttributesReply(HiQnetMessage):
    def __init__(self, attributes: List[Attribute], *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.header.message_id = MessageID.GetAttributes
        self.header.flags.information = True
        self.attributes = attributes

    def get_payload(self):
        data = len(self.attributes).to_bytes(UWORD, "big")
        for attribute in self.attributes:
            data += attribute.encode()
        return data

    def __str__(self):
        return f"GetAttributesReply : {self.attributes}" 

    @classmethod
    def decode(cls, data: bytes, header: HiQnetHeader):
        num_attributes = int.from_bytes(data[:2], "big")
        attributes = []
        n = 2
        for _ in range(num_attributes):
            n, attr = Attribute.decode(data, n)
            attributes.append(attr)
        return cls(attributes, header)

class MultiObjectParamSet(HiQnetMessage):
    # dictionary of objects with list of parameters
    def __init__(self, object_params: Dict[int, List[Parameter]], *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.header.message_id = MessageID.MultiObjectParamSet
        self.object_params = object_params

    def get_payload(self):
        data = len(self.object_params).to_bytes(UWORD, "big")
        for obj, params in self.object_params.items():
            data += obj.to_bytes(ULONG, "big")
            data += len(params).to_bytes(UWORD, "big")
            for param in params:
                data += param.param_id.to_bytes(UWORD, "big")
                data += param.datatype.value.to_bytes(UBYTE, "big")
                data += param.encode()
        return data

    @classmethod
    def decode(cls, data: bytes, header: HiQnetHeader):
        object_params = {}
        num_objects = int.from_bytes(data[:2], "big")
        i = 2
        for _ in range(num_objects):
            params = []
            object_dest = int.from_bytes(data[i:i+4], "big")
            num_params = int.from_bytes(data[i+4:i+6], "big")
            i += 6
            for _ in range(num_params):
                param_id = int.from_bytes(data[i:i+2], "big")
                param_datatype = int.from_bytes(data[i+2:i+3], "big")
                i, param = Parameter.decode(param_id, param_datatype, data, i+3)
                params.append(param)
            if params:
                object_params[object_dest] = params

        # print("MultiObjectParamSet", object_params)

        return cls(object_params, header)

class MultiParamSet(HiQnetMessage):
    # list of parameters
    def __init__(self, params: List[Parameter], *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.header.message_id = MessageID.MultiParamSet
        self.params = params

    def get_payload(self):
        data = len(self.params).to_bytes(UWORD, "big")
        for param in self.params:
            data += param.param_id.to_bytes(UWORD, "big")
            data += param.datatype.value.to_bytes(UBYTE, "big")
            data += param.encode()
        return data

    @classmethod
    def decode(cls, data: bytes, header: HiQnetHeader):
        params = []
        num_params = int.from_bytes(data[i:i+2], "big")
        i = 2
        for _ in range(num_params):
            param_id = int.from_bytes(data[i:i+2], "big")
            param_datatype = int.from_bytes(data[i+2:i+3], "big")
            i, param = Parameter.decode(param_id, param_datatype, data, i+3)
            params.append(param)

        # print("MultiParamSet", params)

        return cls(params, header)

@dataclass
class SubscriptionEntry():
    param_id: int
    dest_address: HiQnetAddress
    dest_param_id: int
    interval_ms: int
    sub_type: int = 0 # 0 = all

class MultiParamSubscribe(HiQnetMessage):
    def __init__(self, subscriptions: List[SubscriptionEntry], *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.header.message_id = MessageID.MultiParamSubscribe
        self.subscriptions = subscriptions 

    def get_payload(self):
        data = len(self.subscriptions).to_bytes(UWORD, "big")
        for sub in self.subscriptions:
            data += sub.param_id.to_bytes(UWORD, "big")
            data += sub.sub_type.to_bytes(UBYTE, "big")
            data += sub.dest_address.encode()
            data += sub.dest_param_id.to_bytes(UWORD, "big")
            data += bytes(3) # reserved
            data += sub.interval_ms.to_bytes(UWORD, "big")
        return data

    @classmethod
    def decode(cls, data: bytes, header: HiQnetHeader):
        raise DecodeFailed("decode not implemented for MultiParamSubscribe")

@dataclass
class UnsubEntry():
    param_id: int
    dest_param_id: int

class MultiParamUnsubscribe(HiQnetMessage):
    def __init__(self, dest_address, unsubscriptions: List[UnsubEntry], *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.header.message_id = MessageID.MultiParamUnsubscribe
        self.dest_address = dest_address
        self.unsubscriptions = unsubscriptions 

    def get_payload(self):
        data = self.dest_address.encode()
        data += len(self.unsubscriptions).to_bytes(UWORD, "big")
        for unsub in self.unsubscriptions:
            data += unsub.param_id.to_bytes(UWORD, "big")
            data += unsub.dest_param_id.to_bytes(UWORD, "big")
        return data

    @classmethod
    def decode(cls, data: bytes, header: HiQnetHeader):
        raise DecodeFailed("decode not implemented for MultiParamUnsubscribe")

class MultiParamGet(HiQnetMessage):
    # list of parameters
    def __init__(self, params: List[int], *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.header.message_id = MessageID.MultiParamGet
        self.params = params

    def get_payload(self):
        data = len(self.params).to_bytes(UWORD, "big")
        for param in self.params:
            data += param.to_bytes(UWORD, "big")
        return data

    def is_start_keepalive(self):
        return len(self.params) == 0

    @classmethod
    def decode(cls, data: bytes, header: HiQnetHeader):
        params = []
        num_params = int.from_bytes(data[:2], "big")
        i = 2
        for _ in range(num_params):
            params.append(int.from_bytes(data[i:i+2], "big"))
            i += 2

        # print("MultiParamGet", params)

        return cls(params, header)

class StartKeepAlive(MultiParamGet):
    def __init__(self, *args, **kwargs):
        # no params = start keepalives
        params = []
        super().__init__(params, *args, **kwargs)
        self.header.message_id = MessageID.MultiParamGet

    @classmethod
    def decode(cls, data: bytes, header: HiQnetHeader):
        return cls(header)

class Recall(HiQnetMessage):
    def __init__(self, scene_id: int, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.header.message_id = MessageID.Recall
        self.scene_id = scene_id

    def get_payload(self):
        data = (5).to_bytes(UBYTE, "big") # 5 - venue recall
        data += self.scene_id.to_bytes(UWORD, "big")
        data += (2).to_bytes(UWORD, "big") # workgroup path length
        data += bytes(2) # null character
        data += (0).to_bytes(UBYTE, "big") # scope (unused)
        return data

    @classmethod
    def decode(cls, data: bytes, header: HiQnetHeader):
        raise DecodeFailed("decode not implemented for Recall")

class ParamSetPercent(HiQnetMessage):
    # list of parameters and percents (-0x8000 to 0x7fff)
    def __init__(self, params: List[Tuple[int, int]], *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.header.message_id = MessageID.ParamSetPercent
        self.params = params

    def get_payload(self):
        data = len(self.params).to_bytes(UWORD, "big")
        for param_id, percent_value in self.params:
            data += param_id.to_bytes(UWORD, "big")
            percent_value = min(0x7fff, max(-0x8000, percent_value))
            data += percent_value.to_bytes(2, "big", signed=True)
        return data

    @classmethod
    def decode(cls, data: bytes, header: HiQnetHeader):
        params = []
        num_params = int.from_bytes(data[:2], "big")
        i = 2
        for _ in range(num_params):
            param_id = int.from_bytes(data[i:i+2], "big")
            percent_value = int.from_bytes(data[i+2:i+4], "big", signed=True)
            percent_value = min(0x7fff, max(-0x8000, percent_value))
            params.append((param_id, percent_value))
            i += 4

        # print("ParamSetPercent", params)

        return cls(params, header)

class ParamSubscribePercent(HiQnetMessage):
    def __init__(self, subscriptions: List[SubscriptionEntry], *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.header.message_id = MessageID.ParamSubscribePercent
        self.subscriptions = subscriptions 

    def get_payload(self):
        # same payload as MultiParamSubscribe
        data = len(self.subscriptions).to_bytes(UWORD, "big")
        for sub in self.subscriptions:
            data += sub.param_id.to_bytes(UWORD, "big")
            data += sub.sub_type.to_bytes(UBYTE, "big")
            data += sub.dest_address.encode()
            data += sub.dest_param_id.to_bytes(UWORD, "big")
            data += bytes(3) # reserved
            data += sub.interval_ms.to_bytes(UWORD, "big")
        return data

    @classmethod
    def decode(cls, data: bytes, header: HiQnetHeader):
        raise DecodeFailed("decode not implemented for ParamSubscribePercent")
    
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
        if self.message_type == MessageType.BUMP_PERCENT:
            raise UnsupportedMessage("BUMP_PERCENT not supported")

    def copy(self):
        return self.__class__(
            self.message_type,
            self.node,
            self.v_device,
            self.obj_id,
            self.param_id,
            self.value,
            self.string_bytes
        )

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

    def to_msg(self) -> HiQnetMessage:
        MY_SUB_ADDR = HiQnetAddress(
            device=MY_ADDRESS.device,
            v_device=0, # 0 for normal subscriptions, 1 for percent subscriptions
            obj_id=self.obj_id
        )
        # we use v_device for designating subscription types,
        # this prevents us from unsubscribing from both normal
        # and percentage subscriptions to the same parameter
        if self.message_type in (MessageType.SUBSCRIBE_PERCENT, MessageType.UNSUBSCRIBE_PERCENT):
            MY_SUB_ADDR.v_device = 1

        if self.message_type == MessageType.SET:
            param = Parameter(self.param_id, ParamType.LONG, self.value)
            return MultiParamSet([param], HiQnetHeader(HiQnetAddress(
                device=self.node,
                v_device=self.v_device,
                obj_id=self.obj_id
            )))
        elif self.message_type == MessageType.SUBSCRIBE:
            subs = [
                SubscriptionEntry(
                    param_id=self.param_id,
                    dest_address=MY_SUB_ADDR,
                    dest_param_id=self.param_id,
                    interval_ms=self.value
                )
            ]
            return MultiParamSubscribe(subs, HiQnetHeader(HiQnetAddress(
                device=self.node,
                v_device=self.v_device,
                obj_id=self.obj_id
            )))
        elif self.message_type == MessageType.UNSUBSCRIBE or self.message_type == MessageType.UNSUBSCRIBE_PERCENT:
            unsubs = [
                UnsubEntry(
                    param_id=self.param_id,
                    dest_param_id=self.param_id
                )
            ]
            return MultiParamUnsubscribe(MY_SUB_ADDR, unsubs, HiQnetHeader(HiQnetAddress(
                device=self.node,
                v_device=self.v_device,
                obj_id=self.obj_id
            )))
        elif self.message_type == MessageType.RECALL_PRESET:
            return Recall(self.value, HiQnetHeader(HiQnetAddress(
                device=self.node,
                v_device=self.v_device,
                obj_id=self.obj_id
            )))
        elif self.message_type == MessageType.SET_PERCENT:
            return ParamSetPercent([(self.param_id, self.value)], HiQnetHeader(HiQnetAddress(
                device=self.node,
                v_device=self.v_device,
                obj_id=self.obj_id
            )))
        elif self.message_type == MessageType.SUBSCRIBE_PERCENT:
            subs = [
                SubscriptionEntry(
                    param_id=self.param_id,
                    dest_address=MY_SUB_ADDR,
                    dest_param_id=self.param_id,
                    interval_ms=self.value
                )
            ]
            return ParamSubscribePercent(subs, HiQnetHeader(HiQnetAddress(
                device=self.node,
                v_device=self.v_device,
                obj_id=self.obj_id
            )))
        elif self.message_type == MessageType.BUMP_PERCENT:
            raise UnsupportedMessage("BUMP_PERCENT not supported")
        elif self.message_type == MessageType.SET_STRING:
            param = Parameter(self.param_id, ParamType.STRING, self.value.decode("UTF-8"))
            return MultiParamSet([param], HiQnetHeader(HiQnetAddress(
                device=self.node,
                v_device=self.v_device,
                obj_id=self.obj_id
            )))
        else:
            raise UnsupportedMessage(f"Unknown message type: {self.message_type}")


    @classmethod
    def from_msg(cls, msg: HiQnetMessage) -> List['Packet']:
        packets = []
        if type(msg) == MultiObjectParamSet:
            node = msg.header.source_address.device
            v_device = msg.header.source_address.v_device
            for obj_id, params in msg.object_params.items():
                for parameter in params:
                    param_id = parameter.param_id
                    if parameter.datatype == ParamType.BLOCK:
                        packets.append(UnsupportedMessage(f"Unsupported packet datatype: BLOCK from {node:04x}:{v_device:02x}:{obj_id:06x}:{param_id:04x}"))
                        continue
                    elif parameter.datatype == ParamType.STRING:
                        packets.append(cls(MessageType.SET_STRING,
                            node=node, v_device=v_device, obj_id=obj_id, param_id=param_id,
                            string_bytes=parameter.value.encode("UTF-8")
                        ))
                        continue
                    
                    # convert value to signed 32-bit
                    value = int.from_bytes(parameter.value.to_bytes(4, "big", signed=True), "big", signed=True) 

                    packets.append(cls(MessageType.SET,
                        node=node, v_device=v_device, obj_id=obj_id, param_id=param_id,
                        value=value
                    ))
        elif type(msg) == MultiParamSet:
            node = msg.header.source_address.device
            v_device = msg.header.source_address.v_device
            obj_id = msg.header.source_address.obj_id
            for parameter in msg.params:
                param_id = parameter.param_id
                if parameter.datatype == ParamType.BLOCK:
                    packets.append(UnsupportedMessage(f"Unsupported packet datatype: BLOCK from {node:04x}:{v_device:02x}:{obj_id:06x}:{param_id:04x}"))
                    continue
                elif parameter.datatype == ParamType.STRING:
                    packets.append(cls(MessageType.SET_STRING,
                        node=node, v_device=v_device, obj_id=obj_id, param_id=param_id,
                        string_bytes=parameter.value.encode("UTF-8")
                    ))
                    continue
                
                # convert value to signed 32-bit
                value = int.from_bytes(parameter.value.to_bytes(4, "big", signed=True), "big", signed=True) 

                packets.append(cls(MessageType.SET,
                    node=node, v_device=v_device, obj_id=obj_id, param_id=param_id,
                    value=value
                ))
        elif type(msg) == ParamSetPercent:
            node = msg.header.source_address.device
            v_device = msg.header.source_address.v_device
            obj_id = msg.header.source_address.obj_id
            for param_id, percent_value in msg.params:
                packets.append(cls(MessageType.SET_PERCENT,
                    node=node, v_device=v_device, obj_id=obj_id, param_id=param_id,
                    value=percent_value
                ))
        else:
            return [UnsupportedMessage(f"Unsupported packet message ID: {type(msg)}")]

        return packets
        
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