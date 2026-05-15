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


def run_dev_directly():
    """Run the dev script directly in the current process to handle Ctrl+C properly."""
    import sys
    sys.path.insert(0, os.path.join(ROOT, "scripts"))
    from dev import main
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
        """
    )
    parser.add_argument(
        "command",
        nargs="?",
        default="dev",
        choices=["dev", "setup", "update"],
        help="Command to run (default: dev)"
    )

    args = parser.parse_args()

    if args.command == "setup":
        print("\nRunning project setup...")
        return run_script("setup.py", use_system_python=True)
    elif args.command == "update":
        print("\nUpdating dependencies...")
        return run_script("update-deps.py")
    else:  # dev
        print("\nStarting development servers...")
        return run_dev_directly()


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
