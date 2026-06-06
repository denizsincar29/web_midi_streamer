# -*- coding: utf-8 -*-
# JamRTC Room Monitor — NVDA Global Plugin
# Polls the JamRTC signaling server for room changes and announces them.
# Author: Deniz Sincar

import globalPluginHandler
import ui
import tones
import addonHandler
import threading
import time
import os
import webbrowser
from scriptHandler import script
from logHandler import log

try:
    import urllib.request as _urllib
    import json as _json
except ImportError:
    _urllib = None
    _json = None

addonHandler.initTranslation()

# ── Configuration ──────────────────────────────────────────────────────────────

ROOMS_URL   = "https://jamrtc.denizsincar.ru/rooms"
BASE_URL    = "https://jamrtc.denizsincar.ru"
POLL_INTERVAL = 10          # seconds between polls
BEEP_FREQ     = 440         # Hz
BEEP_DUR      = 50          # ms
SPEECH_DELAY  = 0.5         # seconds to wait after beep before speaking


# ── Helpers ────────────────────────────────────────────────────────────────────

def _fetch_rooms():
    """Fetch room list from the signaling server. Returns list of dicts or None."""
    if _urllib is None or _json is None:
        return None
    try:
        req = _urllib.Request(ROOMS_URL, headers={"Accept": "application/json"})
        with _urllib.urlopen(req, timeout=8) as r:
            data = _json.loads(r.read().decode("utf-8"))
            if isinstance(data, list):
                return data
    except Exception as e:
        log.debug("jamrtcMonitor: fetch error: %s" % e)
    return None


def _rooms_dict(rooms_list):
    """Convert list of {name, peerCount} to dict keyed by name."""
    if not rooms_list:
        return {}
    return {r.get("name", ""): r.get("peerCount", 0) for r in rooms_list if r.get("name")}


def _announce(message):
    """Beep then speak (speech delayed by SPEECH_DELAY_MS on the main thread)."""
    tones.beep(BEEP_FREQ, BEEP_DUR)
    # wx.CallLater schedules the speech after the beep without blocking.
    try:
        import wx
        wx.CallLater(int(SPEECH_DELAY * 1000), ui.message, message)
    except Exception:
        ui.message(message)


# ── Plugin ─────────────────────────────────────────────────────────────────────

class GlobalPlugin(globalPluginHandler.GlobalPlugin):

    # Translators: Category shown in NVDA Input Gestures dialog
    scriptCategory = _("JamRTC Room Monitor")

    def __init__(self):
        super().__init__()
        self._known_rooms = {}      # name → peerCount
        self._last_room   = None    # most recently announced room name
        self._running     = True
        self._thread = threading.Thread(target=self._poll_loop, daemon=True)
        self._thread.start()

    def terminate(self):
        self._running = False
        super().terminate()

    # ── Background polling ────────────────────────────────────────────────────

    def _poll_loop(self):
        # First poll happens immediately so the internal state is populated
        # before NVDA is done loading (no announcement on first poll).
        self._known_rooms = _rooms_dict(_fetch_rooms()) or {}
        while self._running:
            time.sleep(POLL_INTERVAL)
            if not self._running:
                break
            rooms = _fetch_rooms()
            if rooms is None:
                continue
            new_dict = _rooms_dict(rooms)
            self._process_diff(self._known_rooms, new_dict)
            self._known_rooms = new_dict

    def _process_diff(self, old, new):
        all_names = set(old) | set(new)
        messages  = []

        for name in sorted(all_names):
            if name not in old:
                # New room appeared
                n = new[name]
                # Translators: Announced when a new room appears (name, player count)
                messages.append(
                    _("New room {name}, {n} player(s)").format(name=name, n=n)
                )
                self._last_room = name
            elif name not in new:
                # Room closed
                # Translators: Announced when a room is closed
                messages.append(
                    _("Room {name} closed").format(name=name)
                )
            else:
                # Room still present — check peer count change
                if old[name] != new[name]:
                    n = new[name]
                    # Translators: Announced when peer count in a room changes
                    messages.append(
                        _("Room {name}: now {n} player(s)").format(name=name, n=n)
                    )
                    self._last_room = name

        if messages:
            full_msg = "; ".join(messages)
            # Schedule announcement on the main thread via wx.CallLater to be safe
            try:
                import wx
                wx.CallAfter(_announce, full_msg)
            except Exception:
                # Fallback: announce directly (may not be thread-safe on all NVDA versions)
                _announce(full_msg)

    # ── Scripts ───────────────────────────────────────────────────────────────

    @script(
        # Translators: Description shown in Input Gestures dialog
        description=_("Open JamRTC in the default browser"),
        gesture="kb:NVDA+shift+m",
    )
    def script_openJamRTC(self, gesture):
        webbrowser.open(BASE_URL)
        # Translators: Spoken after opening the browser
        ui.message(_("Opening JamRTC"))

    @script(
        # Translators: Description shown in Input Gestures dialog
        description=_("Join the last announced JamRTC room in the browser"),
        gesture="kb:NVDA+shift+r",
    )
    def script_joinLastRoom(self, gesture):
        if self._last_room:
            url = "{base}?room={room}".format(base=BASE_URL, room=self._last_room)
            webbrowser.open(url)
            # Translators: Spoken after opening the room in the browser
            ui.message(_("Opening room {name}").format(name=self._last_room))
        else:
            # Translators: Spoken when no room has been announced yet
            ui.message(_("No room announced yet. Wait for a room to appear."))
