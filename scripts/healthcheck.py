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
        print(f"AI model    : {data.get('ai_model', 'unknown')}")
        print(f"AI connected: {data.get('ai_connected', False)}")
        print(f"Ollama      : {data.get('ollama_connected', False)} @ {data.get('ollama_url', 'unknown')}")
        print(f"LM Studio   : {data.get('lmstudio_connected', False)} @ {data.get('lmstudio_url', 'unknown')}")
        print(f"Groq        : {data.get('groq_connected', False)} @ {data.get('groq_model', 'unknown')}")
        return 0
    except Exception as e:
        print(f"Health check failed: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(check())
