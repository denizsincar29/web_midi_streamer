/**
 * synth.js — Ultra-low-latency browser piano engine.
 *
 * ARCHITECTURE: Bypasses Tone.js's scheduler entirely. Uses raw Web Audio API
 * with AudioContext.currentTime for near-zero scheduling overhead.
 *
 * Latency sources we eliminate vs Tone.js approach:
 *  1. Tone.js lookAhead/updateInterval clock tick (10–50 ms)  → gone: direct scheduling
 *  2. Tone.js Reverb ConvolverNode (async generate())          → replaced: lightweight
 *     FeedbackDelay + Freeverb-style comb network, or optional ConvolverNode
 *  3. AudioContext latencyHint default ('interactive' not set) → fixed: force latencyHint: 0
 *  4. AudioContext auto-suspend                                → fixed: keep-alive oscillator
 *  5. Sample loading stall on noteOn                           → fixed: pre-cache all buffers
 *
 * Result target: ≤ 5 ms from noteOn() call to audible output on a modern browser.
 *
 * Sustain/Release model (mirrors real piano + Tone.js Sampler behaviour):
 *  - noteOn()  → starts AudioBufferSourceNode at currentTime + SCHEDULE_AHEAD (0 s)
 *  - noteOff() → if sustain pedal DOWN: mark as pending, don't release
 *              → if sustain pedal UP: ramp gain to 0 over RELEASE_TIME
 *  - pedalOff()→ release all pending notes
 *
 * Fallback: if samples fail to load, creates a small FM synth via OscillatorNode.
 */

// ─── Sample source ────────────────────────────────────────────────────────────
const SAMPLE_BASE_URL = 'https://tonejs.github.io/audio/salamander/';

// Sparse map — the engine pitch-shifts to fill missing notes (±6 semitones max)
const SAMPLED_MIDI_NOTES = {
    21: 'A0', 24: 'C1', 27: 'Ds1', 30: 'Fs1',
    33: 'A1', 36: 'C2', 39: 'Ds2', 42: 'Fs2',
    45: 'A2', 48: 'C3', 51: 'Ds3', 54: 'Fs3',
    57: 'A3', 60: 'C4', 63: 'Ds4', 66: 'Fs4',
    69: 'A4', 72: 'C5', 75: 'Ds5', 78: 'Fs5',
    81: 'A5', 84: 'C6', 87: 'Ds6', 90: 'Fs6',
    93: 'A6', 96: 'C7',
};

// Sorted MIDI keys for fast nearest-sample lookup
const SAMPLE_KEYS = Object.keys(SAMPLED_MIDI_NOTES).map(Number).sort((a, b) => a - b);

// ─── Tuning constants ─────────────────────────────────────────────────────────
const RELEASE_TIME   = 0.12;  // seconds — gain ramp to 0 on noteOff
const PEDAL_RELEASE  = 0.25;  // seconds — longer release when pedal lifts
const ATTACK_CLIP    = 0.003; // seconds — tiny gain ramp to avoid clicks on noteOn
const STORAGE_KEY    = 'jamrtc_browser_synth_enabled';

// ─── Keep-alive to prevent AudioContext auto-suspend ─────────────────────────
// A silent DC-offset oscillator with zero gain holds the graph alive.
let _keepAliveOsc = null;
function _startKeepAlive(ctx) {
    if (_keepAliveOsc) return;
    const gain = ctx.createGain();
    gain.gain.value = 0;           // silent — just keeps graph awake
    gain.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.frequency.value = 1;
    osc.connect(gain);
    osc.start();
    _keepAliveOsc = osc;
}

// ─── Lightweight reverb (no async generate()) ─────────────────────────────────
// Three comb filters + allpass chain — 0 ms setup latency.
// Optional: swap with ConvolverNode for higher quality (adds ~50 ms setup).
function _buildReverb(ctx, wet = 0.25) {
    const dry = ctx.createGain();
    const wetGain = ctx.createGain();
    dry.gain.value = 1;
    wetGain.gain.value = wet;

    // Schroeder reverb: 4 comb filters in parallel, 2 allpass in series
    const COMB_DELAYS  = [0.0297, 0.0371, 0.0411, 0.0437]; // seconds
    const COMB_DECAY   = 0.84;
    const AP_DELAYS    = [0.005, 0.0017];
    const AP_FEEDBACK  = 0.7;

    const combOut = ctx.createGain();
    combOut.gain.value = 0.25; // mix 4 combs equally

    for (const delayTime of COMB_DELAYS) {
        const delay = ctx.createDelay(0.1);
        delay.delayTime.value = delayTime;
        const fb = ctx.createGain();
        fb.gain.value = COMB_DECAY;
        delay.connect(fb);
        fb.connect(delay);          // feedback loop
        delay.connect(combOut);
        // Input → comb chain is connected below
        combOut._inputs = combOut._inputs || [];
        combOut._inputs.push(delay);
    }

    let lastNode = combOut;
    for (const ap of AP_DELAYS) {
        const delay = ctx.createDelay(0.05);
        delay.delayTime.value = ap;
        const fbGain = ctx.createGain();
        fbGain.gain.value = -AP_FEEDBACK;
        const inGain = ctx.createGain();
        inGain.gain.value = AP_FEEDBACK;
        lastNode.connect(delay);
        delay.connect(inGain);
        delay.connect(fbGain);
        fbGain.connect(delay); // feedback
        lastNode = inGain;
    }
    lastNode.connect(wetGain);

    // Public interface
    return {
        inputDry: dry,
        // call .connect(inputNode) for each comb:
        _combDelays: combOut._inputs,
        wet: wetGain,
        setWet(v) { wetGain.gain.value = Math.max(0, Math.min(1, v)); },
        connectInput(sourceNode) {
            sourceNode.connect(dry);
            for (const c of combOut._inputs) sourceNode.connect(c);
        },
        connectOutput(destNode) {
            dry.connect(destNode);
            wetGain.connect(destNode);
        },
    };
}

// ─── Sample loader ────────────────────────────────────────────────────────────
async function _loadBuffer(ctx, url) {
    const resp = await fetch(url);
    const ab   = await resp.arrayBuffer();
    return ctx.decodeAudioData(ab);
}

// ─── Nearest-sample lookup ────────────────────────────────────────────────────
function _nearestSample(midiNote) {
    let best = SAMPLE_KEYS[0];
    let bestDist = Math.abs(midiNote - best);
    for (const k of SAMPLE_KEYS) {
        const d = Math.abs(midiNote - k);
        if (d < bestDist) { bestDist = d; best = k; }
    }
    return { baseMidi: best, name: SAMPLED_MIDI_NOTES[best] };
}

// ─── FM fallback voice ────────────────────────────────────────────────────────
function _makeFMVoice(ctx, freq, gainValue, dest) {
    const modFreq = freq * 3.01;
    const mod = ctx.createOscillator();
    mod.frequency.value = modFreq;
    const modGain = ctx.createGain();
    modGain.gain.value = modFreq * 0.5;
    mod.connect(modGain);

    const car = ctx.createOscillator();
    car.type = 'triangle';
    car.frequency.value = freq;
    modGain.connect(car.frequency); // FM

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, ctx.currentTime);
    env.gain.linearRampToValueAtTime(gainValue, ctx.currentTime + ATTACK_CLIP);
    env.gain.setTargetAtTime(gainValue * 0.12, ctx.currentTime + 0.08, 0.3);

    car.connect(env);
    env.connect(dest);

    mod.start(ctx.currentTime);
    car.start(ctx.currentTime);

    return {
        stop(releaseTime = RELEASE_TIME) {
            const t = ctx.currentTime;
            env.gain.cancelScheduledValues(t);
            env.gain.setValueAtTime(env.gain.value, t);
            env.gain.linearRampToValueAtTime(0, t + releaseTime);
            mod.stop(t + releaseTime + 0.05);
            car.stop(t + releaseTime + 0.05);
        }
    };
}

// ─── Main export ──────────────────────────────────────────────────────────────
export class BrowserSynth {
    constructor() {
        this._ctx       = null;
        this._reverb    = null;
        this._buffers   = new Map();   // midiNote → AudioBuffer
        this._voices    = new Map();   // midiNote → { gainNode, source, stop() }
        this._sustained = new Set();   // notes awaiting pedal release
        this._pedalDown = false;
        this._wet       = 0.25;
        this._loaded    = false;
        this._loading   = false;
        this._loadPromise = null;
        this._usingSampler = false;
        this._enabled   = localStorage.getItem(STORAGE_KEY) === 'true';
        this._onReady   = null;
    }

    get enabled() { return this._enabled; }
    get loaded()  { return this._loaded; }

    setEnabled(v) {
        this._enabled = !!v;
        localStorage.setItem(STORAGE_KEY, String(this._enabled));
        if (!this._enabled) this.allNotesOff();
    }

    onReady(fn) { this._onReady = fn; }

    // ── Loading ───────────────────────────────────────────────────────────────
    load() {
        if (this._loadPromise) return this._loadPromise;
        this._loadPromise = this._doLoad().catch(err => {
            console.error('[BrowserSynth] Load failed:', err);
            this._loading = false;
            this._loadPromise = null;
            throw err;
        });
        return this._loadPromise;
    }

    async _doLoad() {
        if (this._loaded) return;
        this._loading = true;

        // Create context with lowest possible latency hint
        this._ctx = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 0,
        });

        await this._resumeCtx();
        _startKeepAlive(this._ctx);

        console.log(
            `[BrowserSynth] AudioContext ready — sampleRate: ${this._ctx.sampleRate} Hz` +
            `, baseLatency: ${(this._ctx.baseLatency * 1000).toFixed(2)} ms` +
            `, outputLatency: ${(this._ctx.outputLatency * 1000).toFixed(2)} ms`
        );

        this._reverb = _buildReverb(this._ctx, this._wet);
        this._reverb.connectOutput(this._ctx.destination);

        // Load all sample buffers in parallel (parallel fetch, not sequential)
        let samplesOk = true;
        try {
            const entries = Object.entries(SAMPLED_MIDI_NOTES);
            const timeout = new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 25000));
            await Promise.race([
                Promise.all(entries.map(async ([midi, name]) => {
                    const url = `${SAMPLE_BASE_URL}${name}.mp3`;
                    try {
                        const buf = await _loadBuffer(this._ctx, url);
                        this._buffers.set(Number(midi), buf);
                    } catch (e) {
                        console.warn(`[BrowserSynth] sample ${name} failed:`, e);
                        samplesOk = false;
                    }
                })),
                timeout,
            ]);
        } catch (e) {
            console.warn('[BrowserSynth] Sample loading problem:', e);
            samplesOk = false;
        }

        this._usingSampler = this._buffers.size > 10; // at least some loaded
        if (!this._usingSampler) {
            console.warn('[BrowserSynth] Falling back to FM synth');
        }

        this._loaded  = true;
        this._loading = false;
        if (this._onReady) this._onReady();
    }

    async _resumeCtx() {
        if (!this._ctx) return;
        if (this._ctx.state === 'suspended') {
            try { await this._ctx.resume(); } catch (_) {}
        }
    }

    // ── Sustain pedal ─────────────────────────────────────────────────────────
    pedalOn()  { this._pedalDown = true; }
    pedalOff() {
        this._pedalDown = false;
        for (const note of this._sustained) {
            this._releaseVoice(note, PEDAL_RELEASE);
        }
        this._sustained.clear();
    }

    // ── Note on ───────────────────────────────────────────────────────────────
    noteOn(midiNote, velocity = 80) {
        if (!this._enabled) return;
        void this._resumeCtx();

        if (!this._loaded) {
            this.load().then(() => this.noteOn(midiNote, velocity)).catch(() => {});
            return;
        }

        // Retrigger: stop existing voice immediately (no ramp — avoid click via gain 0)
        this._killVoice(midiNote);
        this._sustained.delete(midiNote);

        const gain = (velocity / 127) * 0.9;
        const ctx  = this._ctx;
        const now  = ctx.currentTime;

        const envGain = ctx.createGain();
        envGain.gain.setValueAtTime(0, now);
        envGain.gain.linearRampToValueAtTime(gain, now + ATTACK_CLIP);
        this._reverb.connectInput(envGain);

        let voice;
        if (this._usingSampler) {
            const { baseMidi } = _nearestSample(midiNote);
            const buffer = this._buffers.get(baseMidi);
            if (!buffer) {
                // Sample missing — fall through to FM
                voice = _makeFMVoice(ctx, this._midiToHz(midiNote), gain, envGain);
                voice._envGain = envGain;
            } else {
                const src = ctx.createBufferSource();
                src.buffer = buffer;
                // Pitch-shift via playbackRate: 2^(semitones/12)
                src.playbackRate.value = Math.pow(2, (midiNote - baseMidi) / 12);
                src.connect(envGain);
                src.start(now);
                voice = {
                    stop(releaseTime = RELEASE_TIME) {
                        const t = ctx.currentTime;
                        envGain.gain.cancelScheduledValues(t);
                        envGain.gain.setValueAtTime(envGain.gain.value, t);
                        envGain.gain.linearRampToValueAtTime(0, t + releaseTime);
                        src.stop(t + releaseTime + 0.05);
                    },
                    _envGain: envGain,
                };
            }
        } else {
            voice = _makeFMVoice(ctx, this._midiToHz(midiNote), gain, envGain);
            voice._envGain = envGain;
        }

        this._voices.set(midiNote, voice);
    }

    // ── Note off ──────────────────────────────────────────────────────────────
    noteOff(midiNote) {
        if (this._pedalDown) {
            this._sustained.add(midiNote);
            return;
        }
        this._releaseVoice(midiNote, RELEASE_TIME);
    }

    _releaseVoice(midiNote, releaseTime) {
        const voice = this._voices.get(midiNote);
        if (!voice) return;
        try { voice.stop(releaseTime); } catch (_) {}
        this._voices.delete(midiNote);
    }

    _killVoice(midiNote) {
        const voice = this._voices.get(midiNote);
        if (!voice) return;
        try { voice.stop(0.005); } catch (_) {}
        this._voices.delete(midiNote);
    }

    allNotesOff() {
        for (const note of this._voices.keys()) this._killVoice(note);
        this._voices.clear();
        this._sustained.clear();
    }

    // ── MIDI dispatcher ───────────────────────────────────────────────────────
    processMidi(data) {
        if (!this._enabled || data.length < 2) return;
        const status   = data[0] & 0xF0;
        const note     = data[1];
        const velocity = data[2] ?? 0;

        if (status === 0x90 && velocity > 0) {
            this.noteOn(note, velocity);
        } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
            this.noteOff(note);
        } else if (status === 0xB0) {
            if (note === 64) {                 // sustain pedal CC
                velocity >= 64 ? this.pedalOn() : this.pedalOff();
            } else if (note === 123 || note === 120) {
                this.allNotesOff();            // All Notes Off / All Sound Off
            }
        }
    }

    // ── Reverb control ────────────────────────────────────────────────────────
    setReverb(wet) {
        this._wet = Math.max(0, Math.min(1, Number(wet)));
        this._reverb?.setWet(this._wet);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    _midiToHz(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }
}
