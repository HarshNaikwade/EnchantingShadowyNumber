#!/usr/bin/env python3
"""Start backend + frontend in parallel dev mode."""
import subprocess
import sys
import os
import signal
import time
import venv

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VENV_DIR = os.path.join(ROOT, ".venv")
procs = []


def venv_python():
    """Get the path to the venv python executable."""
    if os.name == "nt":
        return os.path.join(VENV_DIR, "Scripts", "python.exe")
    return os.path.join(VENV_DIR, "bin", "python")


def python_bin():
    venv_exe = venv_python()
    return venv_exe if os.path.exists(venv_exe) else sys.executable


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
    # Auto-setup: Check if venv exists, if not run setup
    if not os.path.exists(venv_python()):
        print("\n" + "=" * 60)
        print("  Virtual environment not found. Running setup...")
        print("=" * 60)
        setup_result = subprocess.run(
            [sys.executable, os.path.join(ROOT, "scripts", "setup.py")],
            cwd=ROOT
        )
        if setup_result.returncode != 0:
            print("\nSetup failed. Please run: python scripts/setup.py")
            sys.exit(1)
        print("\n" + "=" * 60)
        print("  Setup complete! Starting development servers...")
        print("=" * 60)
    
    env = os.environ.copy()

    backend = subprocess.Popen(
        [python_bin(), "main.py"],
        cwd=os.path.join(ROOT, "apps", "backend"),
        env=env,
    )
    procs.append(backend)
    print(f"Backend started  (PID {backend.pid}) \u2014 http://localhost:8000")

    vite_bin = os.path.join(ROOT, "node_modules", ".bin", "vite")
    if os.name == "nt":
        vite_bin += ".cmd"
    frontend = subprocess.Popen(
        [vite_bin, "--port", "5000", "--host", "0.0.0.0"],
        cwd=os.path.join(ROOT, "apps", "frontend"),
        env=env,
    )
    procs.append(frontend)
    print(f"Frontend started (PID {frontend.pid}) \u2014 http://localhost:5000")
    print("\nPress Ctrl+C to stop both services.\n")

    backend.wait()
    frontend.wait()


if __name__ == "__main__":
    main()
