/**
 * synth.js — Lightweight browser piano using soundfont-player + FluidR3_GM.
 *
 * soundfont-player (danigb) is a tiny (~10 KB) Web Audio wrapper that loads
 * individual note MP3s from the gleitz CDN on demand — no Tone.js, no main
 * thread blocking, no Reverb.generate() hanging Firefox.
 *
 * Sample source: FluidR3_GM / acoustic_grand_piano via gleitz.github.io
 *   - ~20–40 KB per note MP3, loaded lazily when first played
 *   - Warm, natural piano sound; well-known open-source soundfont
 *   - No server setup required
 *
 * Fallback reverb: a tiny mathematically-generated IR convolved in Web Audio —
 * synchronous math, zero render thread cost.
 */

const SOUNDFONT_PLAYER_CDN =
    'https://cdn.jsdelivr.net/npm/soundfont-player@0.12.0/dist/soundfont-player.min.js';

const SOUNDFONT_URL =
    'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3.js';

const STORAGE_KEY = 'jamrtc_browser_synth_enabled';

/** Build a short reverb IR entirely in JS — no offline render needed. */
function makeReverbIR(ctx, secs = 1.2, decay = 3.0) {
    const len = Math.floor(ctx.sampleRate * secs);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
        const ch = buf.getChannelData(c);
        for (let i = 0; i < len; i++) {
            ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
        }
    }
    return buf;
}

export class BrowserSynth {
    constructor() {
        this._instrument = null;   // soundfont-player instrument
        this._ctx        = null;   // AudioContext
        this._reverb     = null;   // ConvolverNode (wet)
        this._dryBus     = null;   // GainNode (dry)
        this._wetBus     = null;   // GainNode (wet level)
        this._loaded     = false;
        this._loading    = false;
        this._loadPromise = null;
        this._enabled    = localStorage.getItem(STORAGE_KEY) === 'true';
        this._active     = new Map();  // midiNote → soundfont-player node
        this._onReady    = null;
    }

    get enabled() { return this._enabled; }
    get loaded()  { return this._loaded; }

    setEnabled(enabled) {
        this._enabled = !!enabled;
        localStorage.setItem(STORAGE_KEY, String(this._enabled));
        if (!this._enabled) this.allNotesOff();
    }

    onReady(fn) { this._onReady = fn; }

    load() {
        if (this._loadPromise) return this._loadPromise;
        this._loadPromise = this._doLoad().catch(err => {
            console.error('[BrowserSynth] Load failed:', err);
            this._loading = false;
            this._loadPromise = null;  // allow retry
            throw err;
        });
        return this._loadPromise;
    }

    async _doLoad() {
        if (this._loaded) return;
        this._loading = true;

        // 1. AudioContext — must exist before any Web Audio work
        this._ctx = new (window.AudioContext || window.webkitAudioContext)(
            { latencyHint: 'interactive' }
        );
        if (this._ctx.state === 'suspended') {
            await this._ctx.resume().catch(() => {});
        }

        // 2. Reverb chain (math IR — no thread blocking)
        this._reverb = this._ctx.createConvolver();
        this._reverb.buffer = makeReverbIR(this._ctx);

        this._dryBus = this._ctx.createGain();
        this._dryBus.gain.value = 1.0;
        this._dryBus.connect(this._ctx.destination);

        this._wetBus = this._ctx.createGain();
        this._wetBus.gain.value = 0.20;  // subtle room, not a cathedral
        this._reverb.connect(this._wetBus);
        this._wetBus.connect(this._ctx.destination);

        // 3. Load soundfont-player from CDN if not present
        if (!window.Soundfont) {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = SOUNDFONT_PLAYER_CDN;
                s.onload  = resolve;
                s.onerror = () => reject(new Error('soundfont-player CDN failed'));
                document.head.appendChild(s);
            });
        }

        // 4. Load the instrument — soundfont-player fetches note MP3s lazily
        this._instrument = await window.Soundfont.instrument(
            this._ctx,
            'acoustic_grand_piano',
            {
                format   : 'mp3',
                soundfont: 'FluidR3_GM',
                nameToUrl: (name, sf, format) =>
                    `https://gleitz.github.io/midi-js-soundfonts/${sf}/${name}-${format}.js`,
            }
        );

        this._loaded  = true;
        this._loading = false;
        if (this._onReady) this._onReady();
    }

    noteOn(midiNote, velocity = 80) {
        if (!this._enabled) return;

        if (this._ctx?.state === 'suspended') {
            this._ctx.resume().catch(() => {});
        }

        if (!this._loaded) {
            this.load().then(() => this.noteOn(midiNote, velocity)).catch(() => {});
            return;
        }

        // Stop any existing node on this pitch (retrigger)
        this._stopNote(midiNote, true);

        const gain = velocity / 127;
        try {
            // soundfont-player returns an AudioNode; we route it through our bus
            const node = this._instrument.play(midiNote, this._ctx.currentTime, {
                gain,
                destination: this._dryBus,  // dry path
            });
            // Also send to reverb
            if (node && this._reverb) {
                node.connect(this._reverb);
            }
            this._active.set(midiNote, node);
        } catch (e) {
            console.warn('[BrowserSynth] noteOn error:', e);
        }
    }

    noteOff(midiNote) {
        this._stopNote(midiNote, false);
    }

    _stopNote(midiNote, immediate = false) {
        const node = this._active.get(midiNote);
        if (!node) return;
        try {
            if (immediate) {
                node.stop(0);
            } else {
                // Natural piano release: ~300 ms fade
                node.stop(this._ctx.currentTime + 0.3);
            }
        } catch (_) {}
        this._active.delete(midiNote);
    }

    allNotesOff() {
        for (const note of [...this._active.keys()]) {
            this._stopNote(note, true);
        }
        this._active.clear();
    }

    processMidi(data) {
        if (!this._enabled || data.length < 2) return;
        const status   = data[0] & 0xF0;
        const note     = data[1];
        const velocity = data[2] ?? 0;

        if (status === 0x90 && velocity > 0) {
            this.noteOn(note, velocity);
        } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
            this.noteOff(note);
        } else if (status === 0xB0 && note === 123) {
            this.allNotesOff();
        }
    }
}
