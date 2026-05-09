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
