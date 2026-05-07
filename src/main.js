import MIDIStreamer from './app.js';

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new MIDIStreamer());
} else {
    new MIDIStreamer();
}
