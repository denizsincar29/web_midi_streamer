/**
 * synth.js — Browser piano synthesiser using Tone.js + Salamander Grand Piano samples.
 *
 * Samples are loaded from the well-known CDN hosted by @gleitz/midi-js-soundfonts.
 * Only the notes that are actually played are fetched (Tone.Sampler lazy-loads).
 * Total download for a typical session: ~1–3 MB of MP3s.
 *
 * Usage:
 *   const synth = new BrowserSynth();
 *   await synth.load();          // loads Tone.js + samples (call once)
 *   synth.noteOn(60, 100);       // middle C, velocity 100
 *   synth.noteOff(60);
 *   synth.allNotesOff();
 *   synth.setEnabled(true/false);
 */

// Salamander Grand Piano — every C + F# across 7 octaves, MP3, ~100 KB each
const SAMPLE_BASE = 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/acoustic_grand_piano-mp3/';

// The sampler only needs a sparse set of reference notes; Tone.js pitch-shifts the rest
const SAMPLE_NOTES = {
    'A0' : SAMPLE_BASE + 'A0.mp3',
    'C1' : SAMPLE_BASE + 'C1.mp3',
    'D#1': SAMPLE_BASE + 'Ds1.mp3',
    'F#1': SAMPLE_BASE + 'Fs1.mp3',
    'A1' : SAMPLE_BASE + 'A1.mp3',
    'C2' : SAMPLE_BASE + 'C2.mp3',
    'D#2': SAMPLE_BASE + 'Ds2.mp3',
    'F#2': SAMPLE_BASE + 'Fs2.mp3',
    'A2' : SAMPLE_BASE + 'A2.mp3',
    'C3' : SAMPLE_BASE + 'C3.mp3',
    'D#3': SAMPLE_BASE + 'Ds3.mp3',
    'F#3': SAMPLE_BASE + 'Fs3.mp3',
    'A3' : SAMPLE_BASE + 'A3.mp3',
    'C4' : SAMPLE_BASE + 'C4.mp3',
    'D#4': SAMPLE_BASE + 'Ds4.mp3',
    'F#4': SAMPLE_BASE + 'Fs4.mp3',
    'A4' : SAMPLE_BASE + 'A4.mp3',
    'C5' : SAMPLE_BASE + 'C5.mp3',
    'D#5': SAMPLE_BASE + 'Ds5.mp3',
    'F#5': SAMPLE_BASE + 'Fs5.mp3',
    'A5' : SAMPLE_BASE + 'A5.mp3',
    'C6' : SAMPLE_BASE + 'C6.mp3',
    'D#6': SAMPLE_BASE + 'Ds6.mp3',
    'F#6': SAMPLE_BASE + 'Fs6.mp3',
    'A6' : SAMPLE_BASE + 'A6.mp3',
    'C7' : SAMPLE_BASE + 'C7.mp3',
    'D#7': SAMPLE_BASE + 'Ds7.mp3',
    'F#7': SAMPLE_BASE + 'Fs7.mp3',
    'A7' : SAMPLE_BASE + 'A7.mp3',
    'C8' : SAMPLE_BASE + 'C8.mp3',
};

const STORAGE_KEY = 'jamrtc_browser_synth_enabled';
const TONE_CDN    = 'https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js';

// MIDI note number → Tone.js note name (e.g. 60 → "C4")
function midiToNote(midi) {
    const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const octave = Math.floor(midi / 12) - 1;
    return names[midi % 12] + octave;
}

export class BrowserSynth {
    constructor() {
        this._sampler  = null;
        this._loaded   = false;
        this._loading  = false;
        this._enabled  = localStorage.getItem(STORAGE_KEY) === 'true';
        this._active   = new Set();   // currently held MIDI note numbers
        this._onReady  = null;        // callback when sampler finishes loading
    }

    get enabled() { return this._enabled; }
    get loaded()  { return this._loaded;  }

    /**
     * Load Tone.js from CDN then initialise the sampler.
     * Safe to call multiple times — only loads once.
     * @returns {Promise<void>}
     */
    async load() {
        if (this._loaded || this._loading) return;
        this._loading = true;

        // 1. Load Tone.js from CDN if not already present
        if (!window.Tone) {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = TONE_CDN;
                s.onload  = resolve;
                s.onerror = () => reject(new Error('Failed to load Tone.js from CDN'));
                document.head.appendChild(s);
            });
        }

        const Tone = window.Tone;

        // 2. Create reverb for a natural room sound
        const reverb = new Tone.Reverb({ decay: 1.8, wet: 0.25 }).toDestination();
        await reverb.generate();

        // 3. Create the sampler
        await new Promise((resolve, reject) => {
            this._sampler = new Tone.Sampler(SAMPLE_NOTES, {
                release : 1.2,
                onload  : resolve,
                onerror : reject,
            }).connect(reverb);
        });

        this._loaded  = true;
        this._loading = false;
        if (this._onReady) this._onReady();
    }

    /**
     * Enable or disable the browser synth.
     * Persists to localStorage.
     */
    setEnabled(enabled) {
        this._enabled = !!enabled;
        localStorage.setItem(STORAGE_KEY, this._enabled);
        if (!this._enabled) this.allNotesOff();
    }

    /**
     * Play a note. velocity 0–127.
     * Triggers load() automatically if not yet loaded.
     */
    noteOn(midiNote, velocity = 80) {
        if (!this._enabled) return;
        this._ensureAudioContext();
        if (!this._loaded) {
            // Queue: load then replay this note
            this.load().then(() => this.noteOn(midiNote, velocity));
            return;
        }
        const noteName = midiToNote(midiNote);
        const vol = Tone.gainToDb(velocity / 127);
        try {
            this._sampler.triggerAttack(noteName, Tone.now(), velocity / 127);
            this._active.add(midiNote);
        } catch (e) {
            console.warn('[BrowserSynth] noteOn error:', e);
        }
    }

    /**
     * Release a held note.
     */
    noteOff(midiNote) {
        if (!this._loaded || !this._sampler) return;
        const noteName = midiToNote(midiNote);
        try {
            this._sampler.triggerRelease(noteName, Tone.now());
            this._active.delete(midiNote);
        } catch (e) {
            console.warn('[BrowserSynth] noteOff error:', e);
        }
    }

    /**
     * Release all held notes immediately.
     */
    allNotesOff() {
        if (!this._loaded || !this._sampler) return;
        for (const note of this._active) {
            try { this._sampler.triggerRelease(midiToNote(note), Tone.now()); } catch (_) {}
        }
        this._active.clear();
    }

    /**
     * Process a raw MIDI byte array [status, note, velocity].
     * Call this from midi.js send() to route output through synth.
     */
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
            // All notes off CC
            this.allNotesOff();
        }
    }

    /** Ensure AudioContext is running (must be triggered from a user gesture). */
    _ensureAudioContext() {
        if (window.Tone && Tone.context.state !== 'running') {
            Tone.start().catch(() => {});
        }
    }

    /** Register a callback to fire when samples are fully loaded. */
    onReady(fn) { this._onReady = fn; }
}
