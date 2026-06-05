#!/usr/bin/env python3
"""
chimes_manager.py — Interactive manager for JamRTC chimes.json

Compares the deployed chimes.json against the known chime keys used by the
application, lets you add/edit/delete/test chime entries, and saves back to
the deploy directory.

Deploy dir is resolved the same way rebuild.sh does it:
  default  →  /var/www/html/jamrtc
  override →  first CLI argument

Usage:
  python3 scripts/chimes_manager.py
  python3 scripts/chimes_manager.py /custom/deploy/path
"""

import json
import os
import re
import sys
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

# ── Constants ──────────────────────────────────────────────────────────────────

# All chime keys the JS code can call playStatusChime() with.
# Keys starting with _ are metadata-only (not played), excluded from checks.
KNOWN_KEYS: list[str] = [
    "startup",
    "info",
    "success",
    "warning",
    "error",
    "connecting",
    "room_connection",
    "peer_connection",
    "peer_disconnection",
]

DEFAULT_DEPLOY_DIR = "/var/www/html/jamrtc"

NOTE_PATTERN = re.compile(
    r"^([A-Ga-g][b#]?\d)(\+[A-Ga-g][b#]?\d)*"
    r"( ([A-Ga-g][b#]?\d)(\+[A-Ga-g][b#]?\d)*)*$"
)

# ── ANSI colours (degrade gracefully if terminal doesn't support them) ─────────

def _supports_color() -> bool:
    return sys.stdout.isatty() and os.environ.get("TERM", "") != "dumb"

USE_COLOR = _supports_color()

def c(text: str, code: str) -> str:
    return f"\033[{code}m{text}\033[0m" if USE_COLOR else text

def green(t: str) -> str:  return c(t, "32")
def yellow(t: str) -> str: return c(t, "33")
def red(t: str) -> str:    return c(t, "31")
def bold(t: str) -> str:   return c(t, "1")
def dim(t: str) -> str:    return c(t, "2")
def cyan(t: str) -> str:   return c(t, "36")

# ── Helpers ────────────────────────────────────────────────────────────────────

def hr(char: str = "─", width: int = 60) -> None:
    print(dim(char * width))


def ask(prompt: str, default: str = "") -> str:
    """Prompt with optional default shown in brackets."""
    suffix = f" [{default}]" if default else ""
    try:
        val = input(f"{prompt}{suffix}: ").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return default
    return val if val else default


def ask_int(prompt: str, lo: int, hi: int, default: int | None = None) -> int:
    while True:
        raw = ask(prompt, str(default) if default is not None else "")
        if raw.isdigit() and lo <= int(raw) <= hi:
            return int(raw)
        print(red(f"  Enter a number between {lo} and {hi}."))


def confirm(prompt: str, default: bool = False) -> bool:
    suffix = " [Y/n]" if default else " [y/N]"
    raw = ask(prompt + suffix, "").lower()
    if not raw:
        return default
    return raw.startswith("y")


def find_repo_root() -> Path:
    """Walk up from this script to find the repo root (contains index.html)."""
    here = Path(__file__).resolve().parent
    for candidate in [here, here.parent, here.parent.parent]:
        if (candidate / "index.html").exists():
            return candidate
    # Fallback: cwd
    return Path.cwd()


def resolve_deploy_dir(argv: list[str]) -> Path:
    if len(argv) > 1:
        return Path(argv[1])
    return Path(DEFAULT_DEPLOY_DIR)


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: dict[str, Any]) -> None:
    # Write to a temp file beside the target, then atomic rename
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    tmp.replace(path)


def validate_notes(notes: str) -> tuple[bool, str]:
    """Check the notes string syntax: 'C5 E5 G5' or 'C5+E5 G5'."""
    if not notes.strip():
        return False, "Notes string cannot be empty."
    if NOTE_PATTERN.match(notes.strip()):
        return True, ""
    # Give a more helpful error
    return False, (
        "Invalid note syntax. Use note name + octave, e.g. 'C5 E5 G5'.\n"
        "  Simultaneous notes: 'C5+E5 G5+B5'\n"
        "  Valid names: C Db D Eb E F Gb G Ab A Bb B (with # as alternative to b)"
    )

# ── Chime display ──────────────────────────────────────────────────────────────

def fmt_chime(key: str, entry: dict[str, Any]) -> str:
    ctype = entry.get("type", "?")
    if ctype == "silent":
        comment = entry.get("comment", "")
        line = dim("(silent)")
        if comment:
            line += f"  {dim('# ' + comment)}"
    elif ctype == "notes":
        notes    = entry.get("notes", "")
        vel      = entry.get("velocity", "?")
        dur      = entry.get("duration", "?")
        comment  = entry.get("comment", "")
        line = f"  notes={cyan(notes)}  vel={vel}  dur={dur}ms"
        if comment:
            line += f"  {dim('# ' + comment)}"
    elif ctype == "midi":
        fpath   = entry.get("file", "?")
        comment = entry.get("comment", "")
        line = f"  file={cyan(fpath)}"
        if comment:
            line += f"  {dim('# ' + comment)}"
    else:
        line = f"  {dim(repr(entry))}"
    return f"{bold(key):30s}{line}"


def print_chimes(chimes: dict[str, Any], highlight_missing: bool = False) -> None:
    present = {k for k in chimes if not k.startswith("_")}
    for key in KNOWN_KEYS:
        if key in chimes:
            entry = chimes[key]
            is_silent = entry.get("type") == "silent"
            mark = dim("—") if is_silent else green("✓")
            print(f" {mark} {fmt_chime(key, entry)}")
        elif highlight_missing:
            mark = yellow("✗")
            print(f" {mark} {bold(key):30s} {yellow('MISSING')}")
    # Extra keys in the file not in KNOWN_KEYS
    extras = [k for k in present if k not in KNOWN_KEYS]
    for key in extras:
        mark = dim("·")
        print(f" {mark} {fmt_chime(key, chimes[key])}  {dim('(extra)')}")

# ── Chime editor ───────────────────────────────────────────────────────────────

def edit_notes_chime(existing: dict[str, Any] | None = None) -> dict[str, Any] | None:
    """Interactively build/edit a 'notes' chime. Returns None on abort."""
    print()
    print(bold("  Notes syntax:") + "  'C5 E5 G5'  —  sequential notes")
    print("                 'C5+E5 G5+B5' — simultaneous chords")
    print("  Octaves 0–9, note names: C Db D Eb E F Gb G Ab A Bb B")
    print()

    default_notes = existing.get("notes", "") if existing else ""
    default_vel   = existing.get("velocity", 70) if existing else 70
    default_dur   = existing.get("duration", 100) if existing else 100
    default_com   = existing.get("comment", "") if existing else ""

    # Notes
    while True:
        notes = ask("  Notes", default_notes)
        ok, err = validate_notes(notes)
        if ok:
            break
        print(red(f"  {err}"))
        if not confirm("  Try again?", default=True):
            return None

    # Velocity
    vel_raw = ask("  Velocity (1–127)", str(default_vel))
    try:
        velocity = max(1, min(127, int(vel_raw)))
    except ValueError:
        velocity = default_vel

    # Duration
    dur_raw = ask("  Duration ms (10–5000)", str(default_dur))
    try:
        duration = max(10, min(5000, int(dur_raw)))
    except ValueError:
        duration = default_dur

    # Comment
    comment = ask("  Comment (optional)", default_com)

    entry: dict[str, Any] = {"type": "notes", "notes": notes,
                              "velocity": velocity, "duration": duration}
    if comment:
        entry["comment"] = comment
    return entry


def edit_midi_chime(existing: dict[str, Any] | None = None) -> dict[str, Any] | None:
    """Interactively build/edit a 'midi' chime. Returns None on abort."""
    print()
    print("  Path is relative to the deploy directory (e.g. ./chimes/logo.mid)")
    default_file    = existing.get("file", "./chimes/") if existing else "./chimes/"
    default_comment = existing.get("comment", "") if existing else ""

    file_path = ask("  MIDI file path", default_file)
    if not file_path:
        return None
    comment = ask("  Comment (optional)", default_comment)

    entry: dict[str, Any] = {"type": "midi", "file": file_path}
    if comment:
        entry["comment"] = comment
    return entry


def choose_type(existing_type: str | None = None) -> str | None:
    default = existing_type or "notes"
    print(f"\n  Chime type:  1) notes  2) midi  3) (silent / remove)")
    choice = ask("  Choice", "1" if default == "notes" else "2")
    if choice == "1":
        return "notes"
    if choice == "2":
        return "midi"
    if choice == "3":
        return "silent"
    return default


def edit_chime(key: str, chimes: dict[str, Any]) -> bool:
    """Edit or create a chime for `key`. Returns True if chimes was modified."""
    existing = chimes.get(key)
    print()
    hr()
    if existing:
        is_silent = existing.get("type") == "silent"
        print(f" Editing {bold(key)}:")
        print(f"   {fmt_chime(key, existing)}")
    else:
        is_silent = False
        print(f" Creating {bold(yellow(key))} (currently missing)")

    ctype = choose_type(existing.get("type") if existing else None)
    if ctype is None:
        return False

    if ctype == "silent":
        comment = ask("  Comment (optional)", existing.get("comment", "") if existing else "")
        entry: dict[str, Any] = {"type": "silent"}
        if comment:
            entry["comment"] = comment
        chimes[key] = entry
        print(green(f"  Set '{key}' to silent."))
        return True

    if ctype == "notes":
        entry = edit_notes_chime(existing if existing and existing.get("type") == "notes" else None)
    else:
        entry = edit_midi_chime(existing if existing and existing.get("type") == "midi" else None)

    if entry is None:
        print(yellow("  Aborted — no changes."))
        return False

    chimes[key] = entry
    print(green(f"  Saved '{key}'."))
    return True

# ── Missing chimes wizard ──────────────────────────────────────────────────────

def fill_missing(chimes: dict[str, Any], example: dict[str, Any]) -> bool:
    """Walk through missing keys, offer to copy from example or create custom."""
    missing = [k for k in KNOWN_KEYS
               if k not in chimes or chimes[k].get("type") == "silent"]
    truly_missing = [k for k in missing if k not in chimes]
    silenced      = [k for k in missing if k in chimes]
    if not missing:
        print(green("  All known chime keys are present. Nothing missing!"))
        return False

    parts = []
    if truly_missing: parts.append(f"{len(truly_missing)} missing")
    if silenced:      parts.append(f"{len(silenced)} silenced")
    print(yellow(f"\n  {', '.join(parts)}: {', '.join(missing)}"))
    changed = False

    for key in missing:
        print()
        hr()
        print(f" Missing: {bold(yellow(key))}")
        if key in example:
            ex = example[key]
            print(f"  Example default: {fmt_chime(key, ex)}")
            print("  1) Use example default")
            print("  2) Create custom")
            print("  3) Skip (leave missing = silent)")
            choice = ask("  Choice", "1")
        else:
            print("  (No example default available)")
            print("  1) Create custom")
            print("  2) Skip")
            choice = ask("  Choice", "2")
            # Shift choices to match the no-example branch
            choice = "2" if choice == "1" else ("3" if choice == "2" else choice)

        if choice == "1" and key in example:
            chimes[key] = dict(example[key])
            print(green(f"  Copied example for '{key}'."))
            changed = True
        elif choice == "2":
            if edit_chime(key, chimes):
                changed = True
        else:
            print(dim(f"  Skipped '{key}'."))

    return changed

# ── Main menu ──────────────────────────────────────────────────────────────────

def main_menu(chimes: dict[str, Any], example: dict[str, Any],
              chimes_path: Path) -> None:
    while True:
        print()
        hr("═")
        print(bold(" JamRTC Chimes Manager"))
        print(dim(f" File: {chimes_path}"))
        hr("═")
        print_chimes(chimes, highlight_missing=True)
        hr()
        print()
        print(f"  {bold('1')}  Fill in missing chimes (wizard)")
        print(f"  {bold('2')}  Edit / create a specific chime")
        print(f"  {bold('3')}  Delete a chime (make it silent)")
        print(f"  {bold('4')}  Copy ALL from example defaults")
        print(f"  {bold('5')}  Show full chime details")
        print(f"  {bold('6')}  Save and exit")
        print(f"  {bold('7')}  Exit without saving")
        print()

        choice = ask("Choice", "6")

        if choice == "1":
            changed = fill_missing(chimes, example)
            if changed and confirm("\n  Save now?", default=True):
                save_json(chimes_path, chimes)
                print(green("  Saved."))

        elif choice == "2":
            print("\n  Known keys:", ", ".join(KNOWN_KEYS))
            key = ask("  Key name").strip().lower()
            if not key:
                continue
            if edit_chime(key, chimes):
                if confirm("\n  Save now?", default=True):
                    save_json(chimes_path, chimes)
                    print(green("  Saved."))

        elif choice == "3":
            present = [k for k in chimes if not k.startswith("_")]
            if not present:
                print(yellow("  No chimes to silence."))
                continue
            print("  Present keys:", ", ".join(present))
            key = ask("  Key to silence").strip()
            if key in chimes:
                if confirm(f"  Set '{key}' to silent (type: silent)?", default=True):
                    chimes[key] = {"type": "silent"}
                    print(green(f"  '{key}' set to silent."))
                    if confirm("  Save now?", default=True):
                        save_json(chimes_path, chimes)
                        print(green("  Saved."))
            else:
                print(yellow(f"  '{key}' not found."))

        elif choice == "4":
            if confirm("  Overwrite ALL chimes from example defaults?", default=False):
                for key, val in example.items():
                    if not key.startswith("_"):
                        chimes[key] = dict(val)
                print(green("  Copied all example defaults."))
                if confirm("  Save now?", default=True):
                    save_json(chimes_path, chimes)
                    print(green("  Saved."))

        elif choice == "5":
            print()
            hr()
            print(json.dumps(chimes, indent=2, ensure_ascii=False))
            hr()

        elif choice == "6":
            save_json(chimes_path, chimes)
            print(green("  Saved. Goodbye!"))
            break

        elif choice == "7":
            if confirm("  Exit WITHOUT saving?", default=False):
                print(dim("  Goodbye (nothing saved)."))
                break

# ── Entry point ────────────────────────────────────────────────────────────────

def main() -> None:
    repo_root  = find_repo_root()
    deploy_dir = resolve_deploy_dir(sys.argv)
    chimes_path = deploy_dir / "chimes.json"
    example_path = repo_root / "chimes.example.json"

    print()
    print(bold("JamRTC Chimes Manager"))
    print(dim(f"Repo root  : {repo_root}"))
    print(dim(f"Deploy dir : {deploy_dir}"))
    print(dim(f"Chimes file: {chimes_path}"))
    print()

    # Load example
    if not example_path.exists():
        print(yellow(f"Warning: chimes.example.json not found at {example_path}"))
        example: dict[str, Any] = {}
    else:
        try:
            example = load_json(example_path)
        except json.JSONDecodeError as e:
            print(red(f"Error reading chimes.example.json: {e}"))
            example = {}

    # Load or bootstrap chimes.json
    if not chimes_path.exists():
        print(yellow(f"chimes.json not found in deploy dir."))
        if example and confirm("  Bootstrap from chimes.example.json?", default=True):
            deploy_dir.mkdir(parents=True, exist_ok=True)
            save_json(chimes_path, {k: v for k, v in example.items()
                                    if not k.startswith("_")})
            print(green(f"  Created {chimes_path}"))
        elif confirm("  Create empty chimes.json?", default=False):
            deploy_dir.mkdir(parents=True, exist_ok=True)
            save_json(chimes_path, {})
            print(green(f"  Created empty {chimes_path}"))
        else:
            print(red("  Cannot continue without a chimes.json. Exiting."))
            sys.exit(1)

    try:
        chimes = load_json(chimes_path)
    except json.JSONDecodeError as e:
        print(red(f"Error reading {chimes_path}: {e}"))
        sys.exit(1)

    # Strip metadata keys from working copy (keep them in file as-is on save)
    # Actually: keep them — the file may have _instructions etc that we want to preserve.

    try:
        main_menu(chimes, example, chimes_path)
    except KeyboardInterrupt:
        print(f"\n{dim('Interrupted — nothing saved.')}")
        sys.exit(0)


if __name__ == "__main__":
    main()
