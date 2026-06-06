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

ROOMS_URL     = "https://jamrtc.denizsincar.ru/rooms"
BASE_URL      = "https://jamrtc.denizsincar.ru"
POLL_INTERVAL = 10    # seconds between polls
BEEP_FREQ     = 440   # Hz
BEEP_DUR      = 80    # ms — long enough to hear before speech


# ── Network helper ─────────────────────────────────────────────────────────────

def _fetch_rooms():
    """Fetch room list from the signaling server. Returns list of dicts or None."""
    if _urllib is None or _json is None:
        log.warning("jamrtcMonitor: urllib/json not available")
        return None
    try:
        req = _urllib.Request(ROOMS_URL, headers={"Accept": "application/json"})
        with _urllib.urlopen(req, timeout=8) as r:
            data = _json.loads(r.read().decode("utf-8"))
            if isinstance(data, list):
                return data
            log.warning("jamrtcMonitor: unexpected response format: %r" % type(data))
    except Exception as e:
        log.debug("jamrtcMonitor: fetch error: %s" % e)
    return None


def _rooms_dict(rooms_list):
    if not rooms_list:
        return {}
    return {r.get("name", ""): r.get("peerCount", 0)
            for r in rooms_list if r.get("name")}


# ── Plugin ─────────────────────────────────────────────────────────────────────

class GlobalPlugin(globalPluginHandler.GlobalPlugin):

    # Plain string — do NOT call _() here, it runs before translations are ready
    scriptCategory = "JamRTC Room Monitor"

    def __init__(self):
        super().__init__()
        log.info("jamrtcMonitor: plugin loaded")
        self._known_rooms = {}
        self._last_room   = None
        self._running     = True
        self._thread = threading.Thread(
            target=self._poll_loop,
            name="jamrtcMonitor-poll",
            daemon=True,
        )
        self._thread.start()
        log.info("jamrtcMonitor: poll thread started")

    def terminate(self):
        log.info("jamrtcMonitor: terminating")
        self._running = False
        super().terminate()

    # ── Background polling ────────────────────────────────────────────────────

    def _poll_loop(self):
        log.debug("jamrtcMonitor: poll loop starting, seeding initial state")
        try:
            initial = _fetch_rooms()
            self._known_rooms = _rooms_dict(initial) or {}
            log.debug("jamrtcMonitor: initial rooms: %r" % list(self._known_rooms.keys()))
        except Exception as e:
            log.warning("jamrtcMonitor: initial fetch failed: %s" % e)

        while self._running:
            try:
                time.sleep(POLL_INTERVAL)
                if not self._running:
                    break
                rooms = _fetch_rooms()
                if rooms is None:
                    continue
                new_dict = _rooms_dict(rooms)
                self._process_diff(self._known_rooms, new_dict)
                self._known_rooms = new_dict
            except Exception as e:
                log.warning("jamrtcMonitor: poll error: %s" % e)

    def _process_diff(self, old, new):
        messages = []
        for name in sorted(set(old) | set(new)):
            if name not in old:
                n = new[name]
                msg = _("New room {name}, {n} player(s)").format(name=name, n=n)
                messages.append(msg)
                self._last_room = name
                log.debug("jamrtcMonitor: new room: %s (%d)" % (name, n))
            elif name not in new:
                messages.append(_("Room {name} closed").format(name=name))
                log.debug("jamrtcMonitor: room closed: %s" % name)
            else:
                if old[name] != new[name]:
                    n = new[name]
                    messages.append(
                        _("Room {name}: now {n} player(s)").format(name=name, n=n)
                    )
                    self._last_room = name

        if messages:
            full_msg = "; ".join(messages)
            log.info("jamrtcMonitor: announcing: %s" % full_msg)
            # _announce must run on the NVDA main thread.
            # wx.CallAfter is the correct way to do this from a background thread.
            try:
                import wx
                wx.CallAfter(self._announce_main, full_msg)
            except Exception as e:
                log.warning("jamrtcMonitor: wx.CallAfter failed: %s" % e)

    def _announce_main(self, message):
        """Called on the NVDA main thread. Beep then speak."""
        try:
            tones.beep(BEEP_FREQ, BEEP_DUR)
            ui.message(message)
        except Exception as e:
            log.warning("jamrtcMonitor: announce error: %s" % e)

    # ── Scripts ───────────────────────────────────────────────────────────────

    @script(
        description=_("Open JamRTC in the default browser"),
        gesture="kb:NVDA+shift+m",
    )
    def script_openJamRTC(self, gesture):
        log.debug("jamrtcMonitor: script_openJamRTC triggered")
        try:
            webbrowser.open(BASE_URL)
            ui.message(_("Opening JamRTC"))
        except Exception as e:
            log.warning("jamrtcMonitor: openJamRTC error: %s" % e)

    @script(
        description=_("Join the last announced JamRTC room in the browser"),
        gesture="kb:NVDA+shift+r",
    )
    def script_joinLastRoom(self, gesture):
        log.debug("jamrtcMonitor: script_joinLastRoom triggered, last=%r" % self._last_room)
        try:
            if self._last_room:
                url = "{base}?room={room}".format(base=BASE_URL, room=self._last_room)
                webbrowser.open(url)
                ui.message(_("Opening room {name}").format(name=self._last_room))
            else:
                ui.message(_("No room announced yet. Wait for a room to appear."))
        except Exception as e:
            log.warning("jamrtcMonitor: joinLastRoom error: %s" % e)
