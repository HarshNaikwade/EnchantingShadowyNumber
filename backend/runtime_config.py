"""
Runtime configuration store.
Values are persisted to runtime_config.json so they survive hot-reloads
but reset on a full container restart (env var is used as the default).
"""
import json
import os
import threading

_CONFIG_FILE = os.path.join(os.path.dirname(__file__), "runtime_config.json")
_lock = threading.Lock()

_DEFAULTS: dict = {
    "ai_provider": os.getenv("AI_PROVIDER", "ollama"),
    "ollama_url": os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
}


def _load() -> dict:
    try:
        with open(_CONFIG_FILE) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _save(data: dict) -> None:
    with open(_CONFIG_FILE, "w") as f:
        json.dump(data, f, indent=2)


def get_setting(key: str, default=None):
    with _lock:
        cfg = _load()
        return cfg.get(key, _DEFAULTS.get(key, default))


def set_setting(key: str, value) -> None:
    with _lock:
        cfg = _load()
        cfg[key] = value
        _save(cfg)
