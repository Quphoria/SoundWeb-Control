import json
from typing import Dict, List, Any

def default_config() -> Dict[str, Any]:
    return {
        "nodes": {"default": "192.168.1.2"},
        "subscription_rate_ms": 25,
        "websocket_port": 8765
    }

def check_list_type(l: list, v_type) -> bool:
    return isinstance(l, list) and all(isinstance(v, v_type) for v in l)

def check_dict_type(d: dict, k_type, v_type) -> bool:
    return isinstance(d, dict) and all(isinstance(k, k_type) and isinstance(v, v_type) for k,v in d.items())

def check_range(v: int, min_v: int, max_v: int):
    return isinstance(v, int) and v >= min_v and v <= max_v

def invalid_message(key):
    print(f"Invalid value for {key} in config")

def load_config(config_filename: str = "config.json", disable_save = False) -> dict:
    save_config = False
    config = default_config()
    try:
        with open(config_filename) as f:
            config = json.load(f)
    except (FileNotFoundError, PermissionError) as ex:
        print("Error opening config file: ", ex)
        save_config = True
    if "subscription_rate_ms" not in config or not check_range(config["subscription_rate_ms"], 1, 10000):
        invalid_message("subscription_rate_ms")
        config["subscription_rate_ms"] = default_config()["subscription_rate_ms"]
        save_config = True
    if "websocket_port" not in config or not check_range(config["websocket_port"], 20, 65535):
        invalid_message("websocket_port")
        config["websocket_port"] = default_config()["websocket_port"]
        save_config = True
    if "nodes" not in config or not check_dict_type(config["nodes"], str, str) or not "default" in config["nodes"]:
        invalid_message("nodes")
        config["nodes"] = default_config()["nodes"]
        save_config = True
    if save_config and not disable_save:
        print(f"Modified config saved as {config_filename}")
        with open(config_filename, "w") as f:
            json.dump(config, f, sort_keys=True, indent=4)
    elif not save_config:
        print("Config OK")
    if config["subscription_rate_ms"] < 25:
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        print("!!! [WARNING] Subscription rate is less than 25ms, this could cause SoundWeb nodes to freeze/crash !!!")
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    return config

if __name__ == "__main__":
    print("Checking config.json")
    load_config("config.json", disable_save=True)