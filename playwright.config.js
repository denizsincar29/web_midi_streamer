/**
 * Playwright config for the two-peer end-to-end WebRTC test.
 *
 * The default browser path lives under ~/.cache/ms-playwright, which is not
 * executable inside every environment (the container's copy is noexec) — set
 * PLAYWRIGHT_BROWSERS_PATH or PLAYWRIGHT_CHROMIUM to point elsewhere.
 */
const fs = require('fs');
const path = require('path');

const CANDIDATES = [
    process.env.PLAYWRIGHT_CHROMIUM,
    path.join(process.env.HOME || '', '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'),
    path.join(process.env.HOME || '', '.cache/ms-playwright/chromium-1234/chrome-linux/chrome'),
    path.join(process.env.HOME || '', '.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell'),
    path.join(process.env.HOME || '', '.cache/ms-playwright/chromium_headless_shell-1234/chrome-linux/headless_shell'),
].filter(Boolean);

const executablePath = CANDIDATES.find((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } });

module.exports = {
    testDir: './tests',
    timeout: 120000,
    expect: { timeout: 10000 },
    workers: 1,
    fullyParallel: false,
    reporter: [['list']],
    use: {
        headless: true,
        launchOptions: {
            executablePath,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        },
    },
};
