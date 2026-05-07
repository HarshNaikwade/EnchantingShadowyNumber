#!/usr/bin/env python3
"""Manually seed the database with default RBI clauses."""
import sys
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "apps", "backend"))

from db.seed_data import seed_database

if __name__ == "__main__":
    print("Running database seed...")
    seed_database()
