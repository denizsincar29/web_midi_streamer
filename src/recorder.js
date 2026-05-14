/**
 * MIDI Recorder
 *
 * Records raw MIDI events with timestamps, then compacts them by trimming
 * leading/trailing silence and collapsing internal pauses longer than
 * MAX_PAUSE_MS down to MAX_PAUSE_MS.
 *
 * Output format: array of { data: Uint8Array|Array, deltaMs: number }
 * where deltaMs is milliseconds since the previous event (0 for the first).
 */

const MAX_PAUSE_MS = 1000;   // internal pauses beyond this are trimmed to this

export class MIDIRecorder {
    constructor() {
        this.recording  = false;
        this.events     = [];   // { data, ts }  — raw wall-clock events
        this.startTime  = 0;
        this.onStateChange = null;  // (recording: bool) => void
    }

    get isRecording() { return this.recording; }

    start() {
        if (this.recording) return;
        this.events    = [];
        this.startTime = performance.now();
        this.recording = true;
        this.onStateChange?.(true);
    }

    /** Feed every incoming MIDI message here while recording. */
    feed(data) {
        if (!this.recording) return;
        this.events.push({ data: Array.from(data), ts: performance.now() });
    }

    /**
     * Stop recording and return a compacted take.
     * @returns {{ events: Array<{data:Array, deltaMs:number}>, durationMs: number }}
     */
    stop() {
        if (!this.recording) return null;
        this.recording = false;
        this.onStateChange?.(false);

        if (this.events.length === 0) return { events: [], durationMs: 0 };

        // Build delta sequence
        const raw = this.events.map((ev, i) => ({
            data:    ev.data,
            deltaMs: i === 0 ? 0 : ev.ts - this.events[i-1].ts,
        }));

        // Trim leading silence (deltaMs of first real note is irrelevant — drop it)
        // Collapse internal gaps
        const compacted = raw.map((ev, i) => ({
            data:    ev.data,
            deltaMs: i === 0 ? 0 : Math.min(ev.deltaMs, MAX_PAUSE_MS),
        }));

        const durationMs = compacted.reduce((s, ev) => s + ev.deltaMs, 0);
        return { events: compacted, durationMs };
    }

    /** Export take as a simple JSON blob the user can save. */
    static exportJSON(take) {
        return JSON.stringify({ version: 1, maxPauseMs: MAX_PAUSE_MS, ...take }, null, 2);
    }

    /**
     * Export take as a Standard MIDI File (SMF format 0, single track).
     *
     * SMF structure:
     *   MThd  — header chunk  (6 bytes of data)
     *   MTrk  — track chunk   (variable length)
     *
     * Each event: variable-length delta time (in ticks) followed by MIDI bytes.
     * We use 480 ticks-per-quarter-note (PPQ) at 120 BPM (500 000 µs/beat),
     * so 1 tick = 500 000 / 480 µs ≈ 1.04 ms.
     *
     * @param {object} take  — result of MIDIRecorder.stop()
     * @returns {Uint8Array}
     */
    static exportMID(take) {
        const PPQ    = 480;          // ticks per quarter note
        const TEMPO  = 500000;       // µs per beat = 120 BPM
        const MS_PER_TICK = TEMPO / 1000 / PPQ;  // ≈ 1.04167 ms

        // ── helpers ──────────────────────────────────────────────────────────
        const u32be = (n) => [(n >>> 24) & 0xFF, (n >>> 16) & 0xFF, (n >>> 8) & 0xFF, n & 0xFF];
        const u16be = (n) => [(n >>> 8) & 0xFF, n & 0xFF];

        // Variable-length quantity encoding (MIDI delta time)
        function vlq(n) {
            if (n < 0x80) return [n];
            const out = [];
            out.unshift(n & 0x7F); n >>= 7;
            while (n > 0) { out.unshift((n & 0x7F) | 0x80); n >>= 7; }
            return out;
        }

        // ── build track data ─────────────────────────────────────────────────
        const trackBytes = [];

        // Tempo meta-event (FF 51 03 tttttt)
        trackBytes.push(0x00, 0xFF, 0x51, 0x03, ...u32be(TEMPO).slice(1)); // 3-byte tempo

        for (const ev of take.events) {
            const deltaTicks = Math.round(ev.deltaMs / MS_PER_TICK);
            trackBytes.push(...vlq(deltaTicks), ...ev.data);
        }

        // End-of-track meta-event (delta=0, FF 2F 00)
        trackBytes.push(0x00, 0xFF, 0x2F, 0x00);

        // ── assemble SMF ──────────────────────────────────────────────────────
        // MThd
        const header = [
            0x4D, 0x54, 0x68, 0x64,   // "MThd"
            ...u32be(6),               // chunk length = 6
            ...u16be(0),               // format 0 (single track)
            ...u16be(1),               // 1 track
            ...u16be(PPQ),             // ticks per quarter note
        ];

        // MTrk
        const track = [
            0x4D, 0x54, 0x72, 0x6B,   // "MTrk"
            ...u32be(trackBytes.length),
            ...trackBytes,
        ];

        return new Uint8Array([...header, ...track]);
    }

    /**
     * Play back a take into a MIDI output function.
     * @param {Array} events  - compacted event list from stop()
     * @param {Function} sendFn  - called with raw data array per event
     * @param {Function} [onDone]
     * @returns {{ cancel: Function }}
     */
    static playback(events, sendFn, onDone) {
        let cancelled = false;
        let offset = 0;

        (function schedule(idx) {
            if (cancelled || idx >= events.length) { if (!cancelled) onDone?.(); return; }
            const ev = events[idx];
            setTimeout(() => {
                if (!cancelled) sendFn(ev.data);
                schedule(idx + 1);
            }, ev.deltaMs);
        })(0);

        return { cancel() { cancelled = true; } };
    }
}
