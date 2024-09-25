import json, re
from typing import Dict, List, Any

def default_config() -> Dict[str, Any]:
    return {
        "nodes": {"0x1": "192.168.1.2"},
        "node_names": {"0x1": "Node 1"},
        "subscription_rate_ms": 100,
        "websocket_port": 8765,
        "authTokenSecret": "different_password_at_least_32_characters_long",
        "server_ip_address": "192.168.1.100",
        "server_subnet_mask": "255.255.255.0",
        "server_gateway": "192.168.1.1",
        "server_mac_address": "AA:BB:CC:DD:EE:FF",
        "server_node_address": "0xfb00",
        "subscription_debug": False,
        "hiqnet_debug": False,
        "unsubscribe_delay_s": 300,
        "support_name": "Example",
        "support_email": "example@example.com",
        "proxy_ip_header": None,
        "proxy_port_header": None,
    }

def check_list_type(l: list, v_type) -> bool:
    return isinstance(l, list) and all(isinstance(v, v_type) for v in l)

def check_dict_type(d: dict, k_type, v_type) -> bool:
    return isinstance(d, dict) and all(isinstance(k, k_type) and isinstance(v, v_type) for k,v in d.items())

def check_range(v: int, min_v: int, max_v: int):
    return isinstance(v, int) and v >= min_v and v <= max_v

def check_node_ids(l: List[str]) -> bool:
    return all(re.match(r"^0[xX]([0-9a-fA-F]{1,4})$", s) for s in l)

def check_ip_address(s: str) -> bool:
    if not isinstance(s, str):
        return False
    ip_regex = r"^((([1-9]?[0-9])|(1[0-9]{2})|(2[0-4][0-9])|(25[0-5]))\.){3}(([1-9]?[0-9])|(1[0-9]{2})|(2[0-4][0-9])|(25[0-5]))$"
    return bool(re.match(ip_regex, s))

def check_mac_address(s: str) -> bool:
    if not isinstance(s, str):
        return False
    mac_regex = r"^(([0-9a-fA-F]{2}:){5})[0-9a-fA-F]{2}$"
    return bool(re.match(mac_regex, s))

def check_node_address(s: str) -> bool:
    if not isinstance(s, str):
        return False
    node_addr_regex = r"^0[xX]([0-9a-fA-F]{1,4})$"
    return bool(re.match(node_addr_regex, s))

def invalid_message(key):
    print(f"Invalid value for {key} in config")

config_tests = {
    "subscription_rate_ms": lambda x: check_range(x, 1, 10000),
    "websocket_port": lambda x: check_range(x, 20, 65535),
    "nodes": lambda x: check_dict_type(x, str, str) and check_node_ids(x.keys()),
    "node_names": lambda x: check_dict_type(x, str, str),
    "authTokenSecret": lambda x: isinstance(x, str),
    "server_ip_address": lambda x: check_ip_address(x),
    "server_subnet_mask": lambda x: check_ip_address(x),
    "server_gateway": lambda x: check_ip_address(x),
    "server_mac_address": lambda x: check_mac_address(x),
    "server_node_address": lambda x: check_node_address(x),
    "subscription_debug": lambda x: isinstance(x, bool),
    "hiqnet_debug":  lambda x: isinstance(x, bool),
    "unsubscribe_delay_s": lambda x: check_range(x, 0, 86400),
    "support_name": lambda x: isinstance(x, str),
    "support_email": lambda x: isinstance(x, str),
    "proxy_ip_header": lambda x: x is None or isinstance(x, str),
    "proxy_port_header": lambda x: x is None or isinstance(x, str),
}

def load_config(config_filename: str = "config.json", disable_save = False) -> dict:
    save_config = False
    config = default_config()
    try:
        with open(config_filename) as f:
            config = json.load(f)
    except (FileNotFoundError, PermissionError) as ex:
        print("Error opening config file: ", ex)
        save_config = True
    
    for key in config_tests.keys():
        if key not in config or not config_tests[key](config[key]):
            invalid_message(key)
            config[key] = default_config()[key]
            save_config = True

    if save_config and not disable_save:
        print(f"Modified config saved as {config_filename}")
        with open(config_filename, "w") as f:
            json.dump(config, f, sort_keys=True, indent=4)
    elif not save_config:
        print("Config OK")
    if config["subscription_rate_ms"] < 25:
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        print("!!! [WARNING] Subscription rate is less than 25ms, this could cause HiQnet nodes to freeze/crash !!!")
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    return config

if __name__ == "__main__":
    print("Checking config.json")
    load_config("config.json", disable_save=True)