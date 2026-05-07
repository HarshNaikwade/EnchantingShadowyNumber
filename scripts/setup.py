#!/usr/bin/env python3
"""One-command project setup for RBI Compliance Checker."""
import subprocess
import sys
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def run(cmd, cwd=None, check=True):
    print(f"\n> {cmd}")
    return subprocess.run(cmd, shell=True, check=check, cwd=cwd or ROOT)


def main():
    print("=" * 60)
    print("  RBI Compliance Checker — Project Setup")
    print("=" * 60)

    # Python dependencies
    print("\n[1/4] Installing Python dependencies...")
    run(f"{sys.executable} -m pip install -r apps/backend/requirements.txt")

    # Node dependencies
    print("\n[2/4] Installing Node dependencies...")
    if not os.path.exists(os.path.join(ROOT, "node_modules")):
        run("npm install")
    else:
        print("  node_modules already exists, skipping.")

    # Required directories
    print("\n[3/4] Creating required directories...")
    for d in ["uploads", "logs"]:
        path = os.path.join(ROOT, d)
        os.makedirs(path, exist_ok=True)
        print(f"  {path}")

    # Verify Ollama (optional)
    print("\n[4/4] Checking Ollama availability...")
    result = run("ollama list", check=False)
    if result.returncode != 0:
        print("  Ollama not found. Install from https://ollama.ai")
        print("  Then run: ollama pull llama3 && ollama serve")
    else:
        print("  Ollama detected.")

    print("\n" + "=" * 60)
    print("  Setup complete!")
    print("  Start development: python scripts/dev.py")
    print("=" * 60)


if __name__ == "__main__":
    main()
