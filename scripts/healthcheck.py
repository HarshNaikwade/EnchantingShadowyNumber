#!/usr/bin/env python3
"""Quick health check — backend connectivity + AI status."""
import urllib.request
import json
import sys

BACKEND = "http://localhost:8000"


def check():
    try:
        with urllib.request.urlopen(f"{BACKEND}/api/health", timeout=5) as r:
            data = json.loads(r.read())
        print(f"Backend     : {data.get('status', 'unknown').upper()}")
        print(f"AI provider : {data.get('ai_provider', 'unknown')}")
        print(f"AI connected: {data.get('ai_connected', False)}")
        print(f"AI model    : {data.get('ai_model', 'unknown')}")
        if data.get("ai_provider") == "ollama":
            print(f"Ollama URL  : {data.get('ollama_url', 'unknown')}")
        return 0
    except Exception as e:
        print(f"Health check failed: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(check())
