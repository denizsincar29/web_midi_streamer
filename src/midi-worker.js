/**
 * midi-worker.js — Off-main-thread MIDI message processor
 *
 * Receives raw MIDI bytes from the main thread, stamps them with a high-res
 * timestamp, and posts them back ready to be shoved down the DataChannel.
 * Running this in a Worker keeps the main thread free of serialisation jank.
 *
 * Protocol (main → worker):
 *   { type: 'midi',      data: Uint8Array, sysexEnabled: boolean, timestampEnabled: boolean }
 *   { type: 'configure', sysexEnabled: boolean, timestampEnabled: boolean }
 *
 * Protocol (worker → main):
 *   { type: 'midi_ready', payload: Uint8Array, timestamp: number }  // binary message
 *   { type: 'dropped',    reason: string }
 */

import { MIDI_FRAME_VERSION } from './config.js';

let sysexEnabled = false;
let timestampEnabled = false;

self.onmessage = (e) => {
    const msg = e.data;

    if (msg.type === 'configure') {
        sysexEnabled     = msg.sysexEnabled;
        timestampEnabled = msg.timestampEnabled;
        return;
    }

    if (msg.type !== 'midi') return;

    const bytes = msg.data; // Uint8Array

    // ── Filter SysEx ───────────────────────────────────────────────────────
    if (!sysexEnabled && bytes[0] === 0xF0) {
        self.postMessage({ type: 'dropped', reason: 'sysex_disabled' });
        return;
    }

    // ── Build binary payload ────────────────────────────────────────────────
    // Layout (versioned):
    //   [0]         protocol version (MIDI_FRAME_VERSION)
    //   [1]         flags  (bit 0 = timestampEnabled)
    //   [2..9]      Float64 timestamp (performance.now()) — only if flag set
    //   [2 or 10..N] MIDI bytes
    //
    // Using a compact binary format avoids JSON stringification overhead.
    // The version byte lets receivers reject frames from a different framing
    // protocol instead of misinterpreting the bytes as MIDI.

    const ts = performance.now();

    let buf;
    if (timestampEnabled) {
        buf = new ArrayBuffer(2 + 8 + bytes.length);
        const view = new DataView(buf);
        view.setUint8(0, MIDI_FRAME_VERSION);
        view.setUint8(1, 0x01);           // flag: has timestamp
        view.setFloat64(2, ts, false);    // big-endian f64
        new Uint8Array(buf, 10).set(bytes);
    } else {
        buf = new ArrayBuffer(2 + bytes.length);
        const view = new DataView(buf);
        view.setUint8(0, MIDI_FRAME_VERSION);
        view.setUint8(1, 0x00);           // flag: no timestamp
        new Uint8Array(buf, 2).set(bytes);
    }

    // Transfer the buffer (zero-copy) back to the main thread
    self.postMessage({ type: 'midi_ready', buffer: buf, timestamp: ts }, [buf]);
};
