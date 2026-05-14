/**
 * piano.js — Visual piano keyboard that lights up with active MIDI notes.
 *
 * Renders a 49-key keyboard (C2–C6, MIDI 36–84) as SVG-free DOM elements.
 * Notes are lit from two sources:
 *   • Local:  MIDI input played by this peer (blue)
 *   • Remote: MIDI received from the teacher/peer (amber/orange)
 *
 * Public API
 * ──────────────────────────────────────────────────────────────────────────────
 *   const kb = new PianoKeyboard('#piano-container');
 *   kb.noteOn(pitch,  'local');    // light up (blue)
 *   kb.noteOn(pitch,  'remote');   // light up (amber)
 *   kb.noteOff(pitch, 'local');
 *   kb.noteOff(pitch, 'remote');
 *   kb.allOff();                   // clear everything
 */

// Range shown on screen
const FIRST_NOTE = 36;  // C2
const LAST_NOTE  = 84;  // C6
// Which semitones within an octave are black keys
const BLACK_SEMITONES = new Set([1, 3, 6, 8, 10]);

function isBlack(midi) { return BLACK_SEMITONES.has(midi % 12); }

export class PianoKeyboard {
    /**
     * @param {string|HTMLElement} container  CSS selector or DOM element
     * @param {string} [ariaLabel]            Localised aria-label for the keyboard
     */
    constructor(container, ariaLabel) {
        this._ariaLabel = ariaLabel ?? 'Piano keyboard showing active notes';
        this._root = typeof container === 'string'
            ? document.querySelector(container)
            : container;
        if (!this._root) throw new Error(`PianoKeyboard: container not found: ${container}`);

        // pitch → Set<'local'|'remote'>
        this._active = new Map();

        this._build();
    }

    // ── Build DOM ──────────────────────────────────────────────────────────────

    _build() {
        this._root.innerHTML = '';
        this._root.classList.add('piano-keyboard');
        this._root.setAttribute('role', 'img');
        this._root.setAttribute('aria-label', this._ariaLabel);

        this._keys = {}; // pitch → element

        for (let pitch = FIRST_NOTE; pitch <= LAST_NOTE; pitch++) {
            const el = document.createElement('div');
            el.className = isBlack(pitch) ? 'piano-key piano-key--black' : 'piano-key piano-key--white';
            el.dataset.pitch = pitch;
            el.setAttribute('aria-hidden', 'true'); // decorative; screen-reader info via #midiActivity
            this._keys[pitch] = el;
            this._root.appendChild(el);
        }
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    noteOn(pitch, source = 'local') {
        if (pitch < FIRST_NOTE || pitch > LAST_NOTE) return;
        if (!this._active.has(pitch)) this._active.set(pitch, new Set());
        this._active.get(pitch).add(source);
        this._render(pitch);
    }

    noteOff(pitch, source = 'local') {
        if (!this._active.has(pitch)) return;
        this._active.get(pitch).delete(source);
        if (this._active.get(pitch).size === 0) this._active.delete(pitch);
        this._render(pitch);
    }

    allOff() {
        for (const pitch of Object.keys(this._keys)) this._render(Number(pitch), true);
        this._active.clear();
    }

    // ── Internal ───────────────────────────────────────────────────────────────

    _render(pitch, forceOff = false) {
        const el = this._keys[pitch];
        if (!el) return;
        const sources = forceOff ? new Set() : (this._active.get(pitch) ?? new Set());
        const base    = isBlack(pitch) ? 'piano-key--black' : 'piano-key--white';
        const classes = ['piano-key', base];
        if (sources.has('local') && sources.has('remote')) classes.push('piano-key--both');
        else if (sources.has('local'))  classes.push('piano-key--local');
        else if (sources.has('remote')) classes.push('piano-key--remote');
        el.className = classes.join(' ');
    }
}
