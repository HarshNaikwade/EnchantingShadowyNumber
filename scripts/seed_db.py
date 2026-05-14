#!/usr/bin/env python3
"""Manually seed the database with default RBI clauses."""
import sys
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VENV_DIR = os.path.join(ROOT, ".venv")


def venv_python():
    """Get the path to the venv python executable."""
    if os.name == "nt":
        return os.path.join(VENV_DIR, "Scripts", "python.exe")
    return os.path.join(VENV_DIR, "bin", "python")


def run_seed():
    """Run the seed script in the venv."""
    sys.path.insert(0, os.path.join(ROOT, "apps", "backend"))
    
    from db.seed_data import seed_database

    print("Running database seed...")
    seed_database()


if __name__ == "__main__":
    run_seed()
