#!/usr/bin/env python3
"""Update all project dependencies to latest versions."""
import subprocess
import sys
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VENV_DIR = os.path.join(ROOT, ".venv")


def venv_python():
    """Get the path to the venv python executable."""
    if os.name == "nt":
        return os.path.join(VENV_DIR, "Scripts", "python.exe")
    return os.path.join(VENV_DIR, "bin", "python")


def run(cmd, cwd=None):
    """Run a shell command and return the result."""
    print(f"\n> {cmd}")
    result = subprocess.run(cmd, shell=True, cwd=cwd or ROOT)
    return result.returncode == 0


def main():
    print("=" * 60)
    print("  Updating Project Dependencies")
    print("=" * 60)

    # Check if venv exists
    if not os.path.exists(venv_python()):
        print("\nError: Virtual environment not found!")
        print("Run setup first: python scripts/setup.py")
        sys.exit(1)

    # Update Python dependencies
    print("\n[1/2] Updating Python dependencies...")
    print("  Upgrading pip...")
    if not run(f'"{venv_python()}" -m pip install --upgrade pip'):
        print("Failed to upgrade pip")
        return False

    print("  Updating packages...")
    if not run(f'"{venv_python()}" -m pip install --upgrade -r apps/backend/requirements.txt'):
        print("Failed to update Python dependencies")
        return False

    # Update Node dependencies
    print("\n[2/2] Updating Node.js dependencies...")
    if not run("npm update"):
        print("Failed to update Node dependencies")
        return False

    print("\n" + "=" * 60)
    print("  Dependencies updated successfully!")
    print("=" * 60)
    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
