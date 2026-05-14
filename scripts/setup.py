#!/usr/bin/env python3
"""One-command project setup for RBI Compliance Checker."""
import subprocess
import sys
import os
import venv

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VENV_DIR = os.path.join(ROOT, ".venv")


def venv_python():
    if os.name == "nt":
        return os.path.join(VENV_DIR, "Scripts", "python.exe")
    return os.path.join(VENV_DIR, "bin", "python")


def run(cmd, cwd=None, check=True):
    print(f"\n> {cmd}")
    return subprocess.run(cmd, shell=True, check=check, cwd=cwd or ROOT)


def main():
    print("=" * 60)
    print("  RBI Compliance Checker — Project Setup")
    print("=" * 60)

    # Python virtual environment
    print("\n[1/5] Setting up Python virtual environment...")
    if not os.path.exists(venv_python()):
        print(f"  Creating {VENV_DIR}")
        venv.EnvBuilder(with_pip=True).create(VENV_DIR)
    else:
        print(f"  Reusing {VENV_DIR}")

    # Upgrade pip first
    print("  Upgrading pip...")
    run(f'"{venv_python()}" -m pip install --upgrade pip')

    # Python dependencies (with upgrade)
    print("\n[2/5] Installing/Upgrading Python dependencies...")
    run(f'"{venv_python()}" -m pip install --upgrade -r apps/backend/requirements.txt')

    # Node dependencies (with update)
    print("\n[3/5] Installing/Updating Node dependencies...")
    run("npm install")  # npm install also checks and updates based on package.json
    print("  Updating npm packages to latest versions...")
    run("npm update")

    # Required directories
    print("\n[4/5] Creating required directories...")
    for d in ["uploads", "logs"]:
        path = os.path.join(ROOT, d)
        os.makedirs(path, exist_ok=True)
        print(f"  {path}")

    # Verify Ollama (optional)
    print("\n[5/5] Checking Ollama availability...")
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
