#!/usr/bin/env python3
"""Start backend + frontend in parallel dev mode."""
import subprocess
import sys
import os
import signal
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
procs = []


def python_bin():
    venv_python = os.path.join(ROOT, ".venv", "Scripts", "python.exe")
    if os.name != "nt":
        venv_python = os.path.join(ROOT, ".venv", "bin", "python")
    return venv_python if os.path.exists(venv_python) else sys.executable


def kill_all(sig=None, frame=None):
    print("\nShutting down...")
    for p in procs:
        try:
            p.terminate()
        except Exception:
            pass
    sys.exit(0)


signal.signal(signal.SIGINT, kill_all)
signal.signal(signal.SIGTERM, kill_all)


def main():
    env = os.environ.copy()

    backend = subprocess.Popen(
        [python_bin(), "main.py"],
        cwd=os.path.join(ROOT, "apps", "backend"),
        env=env,
    )
    procs.append(backend)
    print(f"Backend started  (PID {backend.pid}) — http://localhost:8000")

    vite_bin = os.path.join(ROOT, "node_modules", ".bin", "vite")
    if os.name == "nt":
        vite_bin += ".cmd"
    frontend = subprocess.Popen(
        [vite_bin, "--port", "5000", "--host", "0.0.0.0"],
        cwd=os.path.join(ROOT, "apps", "frontend"),
        env=env,
    )
    procs.append(frontend)
    print(f"Frontend started (PID {frontend.pid}) — http://localhost:5000")
    print("\nPress Ctrl+C to stop both services.\n")

    backend.wait()
    frontend.wait()


if __name__ == "__main__":
    main()
