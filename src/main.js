import MIDIStreamer from './app.js';
import { t } from './i18n.js';

/**
 * Fetch the CACHE_NAME from service-worker.js and extract the version string.
 * Falls back gracefully if the fetch fails or the pattern isn't found.
 */
async function fetchSWVersion() {
    try {
        const res = await fetch('./service-worker.js', { cache: 'no-store' });
        if (!res.ok) return null;
        const text = await res.text();
        // Match: const CACHE_NAME = 'midi-streamer-vX.Y.Z';
        const m = text.match(/CACHE_NAME\s*=\s*['"][\w-]+-v([\d.]+[^'"]*)['"]/);
        return m ? m[1] : null;
    } catch {
        return null;
    }
}

async function boot() {
    // Resolve version and render it before the app boots
    const version = await fetchSWVersion();
    const versionEl = document.getElementById('appVersion');
    if (versionEl) {
        if (version) {
            versionEl.textContent = 'v' + version;
            versionEl.setAttribute('aria-label', 'version ' + version);
        } else {
            versionEl.hidden = true;
        }
    }

    // Render hero tagline (innerHTML so <strong> works)
    const taglineEl = document.getElementById('heroTagline');
    if (taglineEl) {
        taglineEl.innerHTML = t('app.tagline');
    }

    new MIDIStreamer();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
