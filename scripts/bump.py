#!/usr/bin/env python3
"""
scripts/bump.py — Bump the JamRTC cache version atomically.

Updates BOTH files that must stay in sync:
  - service-worker.js  →  CACHE_NAME = 'jamrtc-vX.Y.Z'
  - src/config.js      →  APP_VERSION = 'jamrtc-vX.Y.Z'

Usage:
    python3 scripts/bump.py              # auto-increment patch (2.0.18 → 2.0.19)
    python3 scripts/bump.py 2.1.0        # set explicit version
    python3 scripts/bump.py --dry-run    # show what would change, don't write
    python3 scripts/bump.py --check      # verify both files are in sync, exit 0/1

Claude: run this script instead of manually editing either file.
The two files MUST always have the same version string.
"""

import re
import sys
from pathlib import Path

ROOT   = Path(__file__).resolve().parent.parent
SW     = ROOT / 'service-worker.js'
CONFIG = ROOT / 'src' / 'config.js'

SW_RE     = re.compile(r"(const CACHE_NAME\s*=\s*'jamrtc-v)([\d]+\.[\d]+\.[\d]+)(')")
CONFIG_RE = re.compile(r"(export const APP_VERSION\s*=\s*'jamrtc-v)([\d]+\.[\d]+\.[\d]+)(')")


def read_current_version():
    content = SW.read_text()
    m = SW_RE.search(content)
    if not m:
        raise RuntimeError("CACHE_NAME not found in service-worker.js")
    return m.group(2)  # e.g. '2.0.18'


def bump_patch(version: str) -> str:
    major, minor, patch = version.split('.')
    return f"{major}.{minor}.{int(patch) + 1}"


def apply(path: Path, pattern: re.Pattern, new_version: str, dry: bool) -> str:
    content = path.read_text()
    new_content, n = pattern.subn(
        lambda m: m.group(1) + new_version + m.group(3),
        content
    )
    if n == 0:
        raise RuntimeError(f"Pattern not found in {path}")
    if not dry:
        path.write_text(new_content)
    # Return the old version for display
    old = pattern.search(content).group(2)
    return old


def versions():
    sw_m     = SW_RE.search(SW.read_text())
    cfg_m    = CONFIG_RE.search(CONFIG.read_text())
    if not sw_m or not cfg_m:
        raise RuntimeError("CACHE_NAME or APP_VERSION not found")
    return sw_m.group(2), cfg_m.group(2)


def main():
    if '--check' in sys.argv:
        sw, cfg = versions()
        if sw == cfg:
            print(f"OK: service-worker.js and src/config.js both at v{sw}")
            sys.exit(0)
        print(f"MISMATCH: service-worker.js v{sw} != src/config.js v{cfg}")
        print("Run: python3 scripts/bump.py [X.Y.Z]")
        sys.exit(1)

    dry  = '--dry-run' in sys.argv
    args = [a for a in sys.argv[1:] if a not in ('--dry-run', '--check', '--help', '-h')]

    if '--help' in sys.argv or '-h' in sys.argv:
        print(__doc__)
        sys.exit(0)

    current = read_current_version()

    if args:
        new_version = args[0].lstrip('v')
        if not re.fullmatch(r'\d+\.\d+\.\d+', new_version):
            print(f"Error: '{new_version}' is not a valid X.Y.Z version")
            sys.exit(1)
    else:
        new_version = bump_patch(current)

    tag = '(dry run) ' if dry else ''
    print(f"{tag}Bumping jamrtc-v{current} → jamrtc-v{new_version}")

    for path, pattern in [(SW, SW_RE), (CONFIG, CONFIG_RE)]:
        old = apply(path, pattern, new_version, dry)
        status = 'would update' if dry else 'updated'
        print(f"  {status}: {path.relative_to(ROOT)}  v{old} → v{new_version}")

    if not dry:
        print()
        print(f"Done. Commit with a message that mentions the bump,")
        print(f"e.g.: git commit -m 'feat/fix: ... (bump cache v{new_version})'")


if __name__ == '__main__':
    main()
