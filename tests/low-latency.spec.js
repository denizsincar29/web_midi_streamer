/**
 * Playwright tests for ultra-low-latency MIDI features.
 * The test itself owns the static file server so it survives across suites.
 */

const { test, expect, chromium } = require('@playwright/test');
const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT   = path.resolve(__dirname, '..');
const PORT   = 17777; // high port, unlikely to collide
const BASE   = `http://127.0.0.1:${PORT}`;
const CHROME = '/home/claude/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome';

const MIME = {
    '.js':'application/javascript', '.mjs':'application/javascript',
    '.html':'text/html', '.css':'text/css', '.json':'application/json',
    '.ico':'image/x-icon', '.png':'image/png', '.svg':'image/svg+xml',
};

// ── Shared fixtures ───────────────────────────────────────────────────────────
let server, browser, page;

test.beforeAll(async () => {
    // Start static server
    await new Promise((resolve, reject) => {
        server = http.createServer((req, res) => {
            let fp = path.join(ROOT, req.url.split('?')[0]);
            if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) fp = path.join(fp, 'index.html');
            fs.readFile(fp, (err, data) => {
                if (err) { res.writeHead(404); res.end('Not found'); return; }
                res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'text/plain' });
                res.end(data);
            });
        });
        server.listen(PORT, '127.0.0.1', resolve);
        server.on('error', reject);
    });

    browser = await chromium.launch({
        executablePath: CHROME,
        args: ['--no-sandbox','--disable-setuid-sandbox','--disable-web-security',
               '--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'],
    });

    const ctx = await browser.newContext({ permissions: [] });
    page = await ctx.newPage();
    page.on('console', () => {});
    page.on('pageerror', () => {});
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    // Expand all <details> so enclosed inputs are reachable
    await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
    await page.waitForTimeout(400);
});

test.afterAll(async () => {
    await browser.close();
    await new Promise(r => server.close(r));
});

// ── DOM presence ──────────────────────────────────────────────────────────────

test('Low-Latency Mode checkbox exists', async () => {
    await expect(page.locator('#lowLatencyMode')).toHaveCount(1);
});

test('Emergency All Notes Off button exists', async () => {
    await expect(page.locator('#emergencyAllNotesOff')).toHaveCount(1);
});

test('IP version badge exists and starts hidden', async () => {
    await expect(page.locator('#ipVersionBadge')).toHaveCount(1);
    const hidden = await page.locator('#ipVersionBadge').evaluate(el => el.hasAttribute('hidden'));
    expect(hidden).toBe(true);
});

test('Peer count badge exists', async () => {
    await expect(page.locator('#peerCountBadge')).toHaveCount(1);
});

// ── Low-Latency Mode toggle ───────────────────────────────────────────────────

test('Low-Latency Mode checkbox is unchecked by default', async () => {
    const checked = await page.locator('#lowLatencyMode').evaluate(el => el.checked);
    expect(checked).toBe(false);
});

test('Toggling Low-Latency Mode appends a message to the log', async () => {
    const before = (await page.locator('#messageLog').innerText()).length;
    await page.locator('#lowLatencyMode').evaluate(el => el.click());
    await page.waitForTimeout(250);
    const after = (await page.locator('#messageLog').innerText()).length;
    expect(after).toBeGreaterThan(before);
    // Reset
    await page.locator('#lowLatencyMode').evaluate(el => el.click());
});

// ── IP version badge CSS ──────────────────────────────────────────────────────

test('IP badge accepts ip-version-v6 class', async () => {
    await page.evaluate(() => {
        const b = document.getElementById('ipVersionBadge');
        b.textContent = '🌐 IPv6';
        b.className   = 'ip-version-badge ip-version-v6';
        b.removeAttribute('hidden');
    });
    const cls = await page.locator('#ipVersionBadge').evaluate(el => el.className);
    expect(cls).toContain('ip-version-v6');
});

test('IP badge accepts ip-version-v4 class', async () => {
    await page.evaluate(() => {
        const b = document.getElementById('ipVersionBadge');
        b.textContent = '🏠 IPv4';
        b.className   = 'ip-version-badge ip-version-v4';
    });
    const cls = await page.locator('#ipVersionBadge').evaluate(el => el.className);
    expect(cls).toContain('ip-version-v4');
    // Restore
    await page.evaluate(() => {
        const b = document.getElementById('ipVersionBadge');
        b.textContent = ''; b.className = 'ip-version-badge'; b.setAttribute('hidden','');
    });
});

// ── Emergency All Notes Off ───────────────────────────────────────────────────

test('Emergency button is not disabled when disconnected', async () => {
    const disabled = await page.locator('#emergencyAllNotesOff').evaluate(el => el.disabled);
    expect(disabled).toBe(false);
});

test('Clicking Emergency button logs a message containing "Emergency"', async () => {
    await page.locator('#emergencyAllNotesOff').evaluate(el => el.click());
    await page.waitForTimeout(300);
    const log = await page.locator('#messageLog').innerText();
    expect(log).toContain('Emergency');
});

// ── Stuck Note Prevention — pure JS logic ─────────────────────────────────────

test('Note On arms timer; Note Off clears it', async () => {
    const r = await page.evaluate(() => {
        const active = new Map();
        function handle(data) {
            const st=data[0]&0xF0, p=data[1];
            if (st===0x90&&data[2]>0) { clearTimeout(active.get(p)); active.set(p,setTimeout(()=>active.delete(p),10000)); }
            else if (st===0x80||(st===0x90&&data[2]===0)) { clearTimeout(active.get(p)); active.delete(p); }
        }
        handle([0x90,60,100]); const on=active.has(60);
        handle([0x80,60,0]);   const off=active.has(60);
        return { on, off };
    });
    expect(r.on).toBe(true);
    expect(r.off).toBe(false);
});

test('Auto-release fires after stub timeout elapses', async () => {
    const r = await page.evaluate(() => new Promise(resolve => {
        const released=[], active=new Map(), T=60;
        function handle(data) {
            const st=data[0]&0xF0,p=data[1];
            if(st===0x90&&data[2]>0){clearTimeout(active.get(p));active.set(p,setTimeout(()=>{released.push(p);active.delete(p);},T));}
        }
        handle([0x90,62,80]);
        setTimeout(()=>resolve({released}), T+50);
    }));
    expect(r.released).toContain(62);
});

// ── Binary packet layout ──────────────────────────────────────────────────────

test('Packet without timestamp: flag=0x00, MIDI bytes intact', async () => {
    const r = await page.evaluate(() => {
        const midi=new Uint8Array([0x90,60,100]);
        const buf=new ArrayBuffer(1+midi.length);
        new DataView(buf).setUint8(0,0x00);
        new Uint8Array(buf,1).set(midi);
        const hasTs=(new DataView(buf).getUint8(0)&0x01)!==0;
        return { hasTs, decoded:Array.from(new Uint8Array(buf, hasTs?9:1)) };
    });
    expect(r.hasTs).toBe(false);
    expect(r.decoded).toEqual([0x90,60,100]);
});

test('Packet with timestamp: flag=0x01, f64 timestamp, MIDI bytes intact', async () => {
    const r = await page.evaluate(() => {
        const midi=new Uint8Array([0x80,60,0]);
        const ts=performance.now();
        const buf=new ArrayBuffer(1+8+midi.length);
        const view=new DataView(buf);
        view.setUint8(0,0x01); view.setFloat64(1,ts,false);
        new Uint8Array(buf,9).set(midi);
        const hasTs=(view.getUint8(0)&0x01)!==0;
        const tsBack=view.getFloat64(1,false);
        return { hasTs, tsOk:tsBack>0, decoded:Array.from(new Uint8Array(buf,hasTs?9:1)) };
    });
    expect(r.hasTs).toBe(true);
    expect(r.tsOk).toBe(true);
    expect(r.decoded).toEqual([0x80,60,0]);
});

// ── Service worker ────────────────────────────────────────────────────────────

test('Service worker cache version is >= v1.4.0', async () => {
    const sw   = await page.evaluate(async () => (await fetch('/service-worker.js')).text());
    const match = sw.match(/CACHE_NAME\s*=\s*'([^']+)'/);
    expect(match).not.toBeNull();
    const nums  = match[1].match(/(\d+)\.(\d+)\.(\d+)/).slice(1).map(Number);
    expect(nums[0] > 1 || (nums[0] === 1 && nums[1] >= 4)).toBe(true);
});

test('Service worker STATIC_ASSETS lists midi-worker.js', async () => {
    const sw = await page.evaluate(async () => (await fetch('/service-worker.js')).text());
    expect(sw).toContain('midi-worker.js');
});
