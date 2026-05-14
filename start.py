#!/usr/bin/env python3
"""One-command project starter - handles setup, updates, and startup."""
import subprocess
import sys
import os

ROOT = os.path.dirname(os.path.abspath(__file__))


def run_script(script_name):
    """Run a Python script in the scripts directory."""
    script_path = os.path.join(ROOT, "scripts", script_name)
    result = subprocess.run([sys.executable, script_path], cwd=ROOT)
    return result.returncode


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
        return run_script("setup.py")
    elif args.command == "update":
        print("\nUpdating dependencies...")
        return run_script("update-deps.py")
    else:  # dev
        print("\nStarting development servers...")
        return run_script("dev.py")


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
