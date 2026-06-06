import MIDIStreamer from './app.js';
import { t } from './i18n.js';
import { APP_VERSION } from './config.js';

// ── Service Worker update handler ─────────────────────────────────────────────
// When a new SW activates it sends SW_UPDATED. We reload immediately so the
// page runs fresh JS/CSS — otherwise the old page JS keeps running even though
// the SW now serves new files.
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SW_UPDATED') {
            const newVer = event.data.version ?? '';
            console.log('[SW] New version active:', newVer, '— reloading page');
            // Small delay so the SW finishes claiming before we reload.
            setTimeout(() => window.location.reload(), 100);
        }
    });

    // Register SW and check for waiting worker on every page load.
    // If there's already a waiting SW (installed in background), tell it
    // to skip waiting so it activates now rather than on next tab open.
    navigator.serviceWorker.register('./service-worker.js').then(reg => {
        // New SW finished installing while page was open — activate it now.
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        reg.addEventListener('updatefound', () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
                if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                    // New SW installed — tell it to take over immediately.
                    installing.postMessage({ type: 'SKIP_WAITING' });
                }
            });
        });
    }).catch(err => console.warn('[SW] Registration failed:', err));
}

/**
 * Fetch the CACHE_NAME from service-worker.js and extract the version string.
 * Falls back gracefully if the fetch fails or the pattern isn't found.
 */
function boot() {
    // Show version from APP_VERSION constant (always in sync with SW cache name)
    const versionEl = document.getElementById('appVersion');
    if (versionEl) {
        const ver = APP_VERSION.replace('jamrtc-v', '');
        versionEl.textContent = 'v' + ver;
        versionEl.setAttribute('aria-label', 'version ' + ver);
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
