#!/usr/bin/env python3
"""One-command project starter - handles setup, updates, and startup."""
import subprocess
import sys
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
VENV_DIR = os.path.join(ROOT, ".venv")


def venv_python():
    """Get the path to the venv python executable."""
    if os.name == "nt":
        return os.path.join(VENV_DIR, "Scripts", "python.exe")
    return os.path.join(VENV_DIR, "bin", "python")


def run_script(script_name, use_system_python=False):
    """Run a Python script in the scripts directory using venv (or system Python if specified)."""
    script_path = os.path.join(ROOT, "scripts", script_name)
    python_exe = sys.executable if use_system_python else venv_python()
    result = subprocess.run([python_exe, script_path], cwd=ROOT)
    return result.returncode


def ensure_venv():
    """Ensure virtual environment exists before running venv-based commands."""
    if os.path.exists(venv_python()):
        return 0
    print("\nVirtual environment not found. Running setup first...")
    return run_script("setup.py", use_system_python=True)


def run_docker(command):
    """Run docker compose helper commands."""
    return subprocess.run(["docker", "compose", command], cwd=ROOT).returncode


def run_dev_directly():
    """Run the dev script directly in the current process to handle Ctrl+C properly."""
    from scripts.dev import main
    try:
        main()
    except KeyboardInterrupt:
        pass  # Expected when user presses Ctrl+C
    return 0


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="RBI Compliance Checker - Project Manager",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python start.py              Start dev servers (auto-setup if needed)
    python start.py setup        Setup/reset project
    python start.py update       Update all dependencies
    python start.py dev          Start development servers only
    python start.py health       Run health checks
    python start.py docker-up     Start containers with docker compose
    python start.py docker-down   Stop containers
        """
    )
    parser.add_argument(
        "command",
        nargs="?",
        default="dev",
        choices=["dev", "setup", "update", "health", "docker-up", "docker-down"],
        help="Command to run (default: dev)"
    )

    args = parser.parse_args()

    if args.command == "setup":
        print("\nRunning project setup...")
        return run_script("setup.py", use_system_python=True)
    if args.command == "update":
        setup_code = ensure_venv()
        if setup_code != 0:
            return setup_code
        print("\nUpdating dependencies...")
        return run_script("update-deps.py")

    if args.command == "health":
        setup_code = ensure_venv()
        if setup_code != 0:
            return setup_code
        print("\nRunning health checks...")
        return run_script("healthcheck.py")

    if args.command == "docker-up":
        print("\nStarting docker compose services...")
        return run_docker("up")

    if args.command == "docker-down":
        print("\nStopping docker compose services...")
        return run_docker("down")

    # dev
    setup_code = ensure_venv()
    if setup_code != 0:
        return setup_code
    print("\nStarting development servers...")
    return run_dev_directly()


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
