/**
 * synth.js — Browser piano output backed by Tone.js Sampler + Salamander Grand Piano.
 *
 * This mirrors the Piano repo's sound engine: load Tone.js on demand, use a
 * sampled grand piano with a small hall reverb, and fall back to a synthesized
 * piano if samples fail to load.
 */

const TONE_CDN =
    'https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js';

const SAMPLE_BASE_URL =
    'https://tonejs.github.io/audio/salamander/';

const SAMPLED_NOTES = {
    A0: 'A0.mp3', C1: 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
    A1: 'A1.mp3', C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
    A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
    A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
    A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
    A5: 'A5.mp3', C6: 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
    A6: 'A6.mp3', C7: 'C7.mp3',
};

const STORAGE_KEY = 'jamrtc_browser_synth_enabled';

let toneLoadPromise = null;

async function loadTone() {
    if (window.Tone) return window.Tone;
    if (!toneLoadPromise) {
        toneLoadPromise = new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-tonejs="true"]');
            if (existing && window.Tone) {
                resolve(window.Tone);
                return;
            }

            const script = document.createElement('script');
            script.src = TONE_CDN;
            script.async = true;
            script.dataset.tonejs = 'true';
            script.onload = () => resolve(window.Tone);
            script.onerror = () => reject(new Error('Tone.js CDN failed'));
            document.head.appendChild(script);
        }).catch((error) => {
            toneLoadPromise = null;
            throw error;
        });
    }
    return toneLoadPromise;
}

export class BrowserSynth {
    constructor() {
        this._tone = null;
        this._sampler = null;
        this._reverb = null;
        this._fallback = null;
        this._wet = 0.3;
        this._loaded = false;
        this._loading = false;
        this._loadPromise = null;
        this._enabled    = localStorage.getItem(STORAGE_KEY) === 'true';
        this._active = new Map();  // midiNote → currently sounding note handle
        this._onReady = null;
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

        this._tone = await loadTone();
        await this._resumeAudio();

        const reverb = new this._tone.Reverb({
            decay: 3.5,
            wet: this._wet,
            preDelay: 0.01,
        }).toDestination();
        await reverb.generate();
        this._reverb = reverb;
        this._reverb.wet.value = this._wet;

        const sampler = new this._tone.Sampler({
            urls: SAMPLED_NOTES,
            release: 1.5,
            baseUrl: SAMPLE_BASE_URL,
        }).connect(this._reverb);

        const sampleTimeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Sample load timed out')), 20000);
        });

        try {
            await Promise.race([sampler.loaded, sampleTimeout]);
            this._sampler = sampler;
        } catch (error) {
            try { sampler.dispose(); } catch (_) {}
            await this._createFallbackSynth();
        }

        this._loaded  = true;
        this._loading = false;
        if (this._onReady) this._onReady();
    }

    async _createFallbackSynth() {
        if (!this._tone) return;

        if (!this._reverb) {
            this._reverb = new this._tone.Reverb({
                decay: 3.5,
                wet: this._wet,
                preDelay: 0.01,
            }).toDestination();
            await this._reverb.generate();
            this._reverb.wet.value = this._wet;
        }

        this._fallback = new this._tone.PolySynth(this._tone.Synth, {
            maxPolyphony: 16,
            options: {
                oscillator: {
                    type: 'fmtriangle',
                    modulationType: 'sine',
                    harmonicity: 3.01,
                    modulationIndex: 0.5,
                },
                envelope: {
                    attack: 0.005,
                    decay: 1.8,
                    sustain: 0.12,
                    release: 1.6,
                },
                volume: -6,
            },
        }).connect(this._reverb);
    }

    _engine() {
        return this._sampler ?? this._fallback;
    }

    _midiToNote(midiNote) {
        return this._tone?.Frequency(midiNote, 'midi').toNote() ?? null;
    }

    async _resumeAudio() {
        if (!this._tone) return;
        if (this._tone.context?.state === 'suspended') {
            await this._tone.start().catch(() => {});
        }
    }

    setReverb(wet) {
        const nextWet = Math.max(0, Math.min(1, Number(wet)));
        this._wet = Number.isFinite(nextWet) ? nextWet : this._wet;
        if (this._reverb?.wet) {
            this._reverb.wet.value = this._wet;
        }
    }

    noteOn(midiNote, velocity = 80) {
        if (!this._enabled) return;

        void this._resumeAudio();

        if (!this._loaded) {
            this.load().then(() => this.noteOn(midiNote, velocity)).catch(() => {});
            return;
        }

        // Stop any existing note on this pitch before retriggering.
        this._stopNote(midiNote, true);

        const engine = this._engine();
        const note = this._midiToNote(midiNote);
        if (!engine || !note) return;

        const gain = velocity / 127;
        try {
            engine.triggerAttack(note, undefined, gain);
            this._active.set(midiNote, {
                note,
                engine: engine === this._sampler ? 'sampler' : 'fallback',
            });
        } catch (e) {
            console.warn('[BrowserSynth] noteOn error:', e);
        }
    }

    noteOff(midiNote) {
        this._stopNote(midiNote, false);
    }

    _stopNote(midiNote, immediate = false) {
        const entry = this._active.get(midiNote);
        if (!entry) return;
        try {
            const engine = this._engine();
            if (!engine) {
                this._active.delete(midiNote);
                return;
            }
            if (immediate) {
                engine.triggerRelease(entry.note);
            } else {
                engine.triggerRelease(entry.note);
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
