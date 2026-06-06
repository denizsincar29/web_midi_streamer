#!/usr/bin/env python3
"""
Build script for the JamRTC Room Monitor NVDA addon.

Usage:
    python3 scripts/build_nvda_addon.py

Output:
    nvda_addon/jamrtc_room_monitor-1.0.0.nvda-addon

Requirements:
    - msgfmt (from gettext) must be in PATH to compile .po → .mo files
      On Debian/Ubuntu: sudo apt install gettext
      On Windows with NVDA dev setup: usually available
    - Falls back gracefully if msgfmt is missing (no .mo files, addon still works
      with English only since NVDA reads .po directly in some setups, or installs
      without translation)
"""

import os
import sys
import shutil
import subprocess
import zipfile
from pathlib import Path

ADDON_DIR   = Path(__file__).resolve().parent.parent / "nvda_addon" / "addon"
OUTPUT_DIR  = Path(__file__).resolve().parent.parent / "nvda_addon"
ADDON_NAME  = "jamrtc_room_monitor"
VERSION     = "1.0.2"
OUTPUT_FILE = OUTPUT_DIR / f"{ADDON_NAME}-{VERSION}.nvda-addon"


def compile_po_files():
    """Compile all .po files to .mo using msgfmt."""
    if not shutil.which("msgfmt"):
        print("Warning: msgfmt not found — skipping .mo compilation.")
        print("         Install gettext: sudo apt install gettext")
        return
    locale_dir = ADDON_DIR / "locale"
    for po_file in locale_dir.rglob("nvda.po"):
        mo_file = po_file.with_suffix(".mo")
        try:
            subprocess.run(
                ["msgfmt", str(po_file), "-o", str(mo_file)],
                check=True, capture_output=True
            )
            print(f"  Compiled: {po_file.relative_to(ADDON_DIR)}")
        except subprocess.CalledProcessError as e:
            print(f"  Error compiling {po_file}: {e.stderr.decode()}")


def build_addon():
    compile_po_files()

    # Collect all files from the addon directory
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    # Remove all old .nvda-addon builds (handles version renames)
    for old_file in OUTPUT_DIR.glob(f"{ADDON_NAME}-*.nvda-addon"):
        old_file.unlink()
        print(f"Removed old: {old_file.name}")

    with zipfile.ZipFile(OUTPUT_FILE, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(ADDON_DIR.rglob("*")):
            if path.is_file():
                # Skip __pycache__ and .pyc files
                if "__pycache__" in path.parts or path.suffix == ".pyc":
                    continue
                arcname = path.relative_to(ADDON_DIR)
                zf.write(path, arcname)
                print(f"  Added: {arcname}")

    size_kb = OUTPUT_FILE.stat().st_size // 1024
    print(f"\nBuilt: {OUTPUT_FILE.name}  ({size_kb} KB)")
    print(f"Install: copy to %APPDATA%\\nvda\\addons\\ or double-click in Windows")



if __name__ == "__main__":
    build_addon()
