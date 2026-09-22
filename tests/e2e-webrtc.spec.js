/**
 * End-to-end two-peer WebRTC test.
 *
 * Boots the real app in two browser contexts (= two machines), points both at a
 * real signaler, and asserts they actually reach a connected DataChannel.
 *
 * This is the layer the unit tests cannot cover: everything about who sends
 * which SDP, in what order, and whether the pair converges. The signaling
 * server used to register peers without ever introducing them, so no offer was
 * ever created and two peers sat in a room forever — a regression that shows up
 * here and nowhere else.
 *
 * Two mount points are exercised because the app's signaling URL is derived
 * from its own location: served at /, and served under a sub-path behind a
 * proxy that only rewrites /signal. The second case silently breaks the
 * signaling URL if module resolution depends on the mount path.
 *
 * The signaler is taken from $JAMRTC_SIGNALER, or built from signaler/main.go
 * if a Go toolchain is reachable; otherwise a JS fallback replicating main.go.
 */

const { test, expect, chromium } = require('@playwright/test');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const { spawn, spawnSync } = require('child_process');

const ROOT     = path.resolve(__dirname, '..');
const WEBPORT  = 17778;
const SIGPORT  = 17779;
const BASE     = `http://127.0.0.1:${WEBPORT}`;
const SIGNALER = process.env.JAMRTC_SIGNALER ||
                 path.join(os.tmpdir(), 'jamrtc-signaler-test');

const MIME = {
    '.js':'application/javascript', '.mjs':'application/javascript',
    '.html':'text/html', '.css':'text/css', '.json':'application/json',
    '.ico':'image/x-icon', '.png':'image/png', '.svg':'image/svg+xml',
};

// Serial: both tests share ports 17778/17779, and the signaler keeps a room
// entry for a peer whose id equals the previous room's. Running them in parallel
// would let one test's teardown land in the other test's roster.
test.describe.configure({ mode: 'serial' });

let webServer, signalerProc, browser;

// ── Signalers ────────────────────────────────────────────────────────────────

/** Minimal JS implementation of signaler/main.go — fallback when Go is absent. */
function startJsSignaler() {
    const { WebSocketServer } = require('ws');
    const wss   = new WebSocketServer({ port: SIGPORT });
    const rooms = new Map();               // room → Map(peerId → socket)

    wss.on('connection', (ws, req) => {
        const url  = new URL(req.url, 'http://x');
        const room = url.searchParams.get('room');
        const id   = url.searchParams.get('peer');
        if (!room || !id) { ws.close(); return; }

        if (!rooms.has(room)) rooms.set(room, new Map());
        const members = rooms.get(room);

        // Replicate main.go's join fan-out: tell the newcomer who is already
        // here, and tell everyone here that the newcomer arrived.
        const present = [...members.keys()];
        if (present.length) {
            ws.send(JSON.stringify({ type: 'peers', peers: present }));
            for (const otherId of present) {
                const sock = members.get(otherId);
                if (sock.readyState === 1) {
                    sock.send(JSON.stringify({ type: 'join', from: id }));
                }
            }
        }
        members.set(id, ws);

        ws.on('message', (data) => {
            let msg; try { msg = JSON.parse(data.toString()); } catch { return; }
            if (msg.type === 'keepalive') return;      // swallowed, as in main.go

            // "peers": the client reporting which links survived a signaling
            // outage. Ask the peers it dropped to re-announce.
            if (msg.type === 'peers') {
                const keep = new Set(msg.peers ?? []);
                for (const [otherId, sock] of members) {
                    if (otherId === id || keep.has(otherId)) continue;
                    if (sock.readyState === 1) {
                        sock.send(JSON.stringify({ type: 'reannounce', to: id }));
                    }
                }
                return;
            }

            const target = msg.to ? members.get(msg.to) : null;
            if (target && target.readyState === 1) {
                target.send(data.toString());
            } else if (!msg.to) {
                for (const [otherId, sock] of members) {
                    if (otherId !== id && sock.readyState === 1) sock.send(data.toString());
                }
            }
        });

        ws.on('close', () => {
            members.delete(id);
            if (members.size === 0) rooms.delete(room);
        });
    });
    return { kill: () => wss.close() };
}

/** Real signaler/main.go — built binary if present, else `go run`. */
function startGoSignaler(goBin) {
    const args = fs.existsSync(SIGNALER)
        ? ['-addr', `:${SIGPORT}`]
        : ['run', '.', '-addr', `:${SIGPORT}`];
    const bin  = fs.existsSync(SIGNALER) ? SIGNALER : goBin;
    const proc = spawn(bin, args, {
        cwd: path.join(ROOT, 'signaler'),
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    proc.stdout.on('data', (d) => process.stdout.write(`[signaler] ${d}`));
    proc.stderr.on('data', (d) => process.stderr.write(`[signaler] ${d}`));
    return { kill: () => proc.kill() };
}

function findGo() {
    // A prebuilt signaler binary is enough on its own — it needs no toolchain.
    // Requiring `go` here silently demoted a perfectly usable $JAMRTC_SIGNALER
    // to the JS fallback, which then collided with the binary already holding
    // the port (EADDRINUSE) instead of testing the real server.
    if (fs.existsSync(SIGNALER)) return null;

    for (const c of ['go', path.join(process.env.HOME || '', '.local/go/bin/go'),
                     path.join(ROOT, '.tools/go-root/bin/go')]) {
        const r = spawnSync(c, ['version'], { encoding: 'utf8' });
        if (r.status === 0) return c;
    }
    return null;
}

async function waitForPort(port, timeoutMs = 15000) {
    const net = require('net');
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const ok = await new Promise((resolve) => {
            const s = net.connect(port, '127.0.0.1');
            s.on('connect', () => { s.destroy(); resolve(true); });
            s.on('error',   () => resolve(false));
        });
        if (ok) return true;
        await new Promise(r => setTimeout(r, 150));
    }
    throw new Error(`port ${port} never opened`);
}

// ── Static server ────────────────────────────────────────────────────────────

/**
 * Serve the app from ROOT. In 'root' mode the app lives at /; in 'subpath'
 * mode it lives only under /jamrtc/ and /signal is proxied to the signaler,
 * mimicking a reverse proxy that mounts the app at a sub-path.
 *
 * WebSocket upgrades are proxied through raw TCP so the page shares an origin
 * with the signaler — the app derives its signaling host from location.
 */
function startWebServer(mode) {
    const { URL } = require('url');
    // Local stand-in for Caddy's `handle /signal* { reverse_proxy 127.0.0.1:8987 }`:
    // strip the mount prefix, then raw-TCP the handshake to the signaler. The
    // app resolves its socket against document.baseURI, so under a sub-path the
    // request arrives as /jamrtc/signal and only the prefix removal makes it
    // match the signaler's own "/signal" route.
    const proxyUpgrade = (req, socket) => {
        const net  = require('net');
        const path = new URL(req.url, 'http://x').pathname;
        // Strip the mount prefix by pathname, but forward the query verbatim:
        // the signaler keys the room on ?room= and ?peer=, so a rewritten
        // request line without them reaches serveWS as an empty room and it
        // answers 400. Keep req.url whole and only trim the leading segment.
        const rel  = mode === 'subpath'
            ? req.url.replace(/^\/jamrtc(?=\/signal)/, '')
            : req.url;

        const up = net.connect(SIGPORT, '127.0.0.1', () => {
            const key = req.headers['sec-websocket-key'];
            up.write(
                `GET ${rel} HTTP/1.1\r\n` +
                `Host: 127.0.0.1:${SIGPORT}\r\n` +
                `Upgrade: websocket\r\n` +
                `Connection: Upgrade\r\n` +
                `Sec-WebSocket-Version: 13\r\n` +
                `Sec-WebSocket-Key: ${key}\r\n` +
                '\r\n'
            );
            socket.pipe(up); up.pipe(socket);
        });
        up.on('error', () => socket.destroy());
        socket.on('error', () => up.destroy());
    };

    const server = http.createServer((req, res) => {
        const urlPath = new URL(req.url, 'http://x').pathname;

        // The app resolves its signaling URL against document.baseURI, so under
        // a sub-path the socket lands on /jamrtc/signal — the mount prefix is
        // part of the proxy's route, exactly as Caddy's `handle /signal*` block
        // does at the root. Route it here rather than from an 'upgrade' listener:
        // the request event fires for upgrade requests too, and dispatching by
        // path keeps one switch instead of two that can disagree.
        const relPath = mode === 'subpath' ? urlPath.replace(/^\/jamrtc(?=\/)/, '') : urlPath;
        if (relPath === '/signal') {
            // The app sends a bare HTTP request here only when something is
            // misconfigured; the real server 404s it the same way.
            if (!req.headers.upgrade) { res.writeHead(404); return res.end('Not found'); }
            proxyUpgrade(req, req.socket, null);
            return;
        }

        let rel = null;
        if (mode === 'subpath') {
            if (urlPath.startsWith('/jamrtc/')) rel = urlPath.slice('/jamrtc/'.length);
            else if (urlPath === '/jamrtc') { res.writeHead(302, { Location: '/jamrtc/' }); return res.end(); }
        } else {
            rel = urlPath.replace(/^\//, '');
        }

        // A plain HTTP GET on the signal path is not a WebSocket handshake; the
        // real server answers it with a 404 too (only 'upgrade' reaches it).
        if (rel === null) { res.writeHead(404); return res.end('Not found'); }
        if (rel === '') rel = 'index.html';

        let fp = path.join(ROOT, rel);
        if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) fp = path.join(fp, 'index.html');
        fs.readFile(fp, (err, data) => {
            if (err) { res.writeHead(404); res.end('Not found'); return; }
            res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'text/plain' });
            res.end(data);
        });
    });

    return server;
}

async function listen(server) {
    await new Promise((resolve, reject) => {
        server.listen(WEBPORT, '127.0.0.1', resolve);
        server.on('error', reject);
    });
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

test.beforeAll(async () => {
    const goBin   = findGo();
    const prebuilt = fs.existsSync(SIGNALER);
    if ((goBin || prebuilt) && !process.env.JAMRTC_FORCE_JS_SIGNALER) {
        console.log(`[e2e] signaler: ${prebuilt ? SIGNALER : `go run (${goBin})`}`);
        signalerProc = startGoSignaler(goBin);
    } else {
        console.log('[e2e] signaler: js fallback');
        signalerProc = startJsSignaler();
    }
    await waitForPort(SIGPORT);

    browser = await chromium.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox',
               '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    });
});

test.afterAll(async () => {
    await browser?.close();
    signalerProc?.kill();
    await new Promise(r => webServer?.close(r));
});

async function openPeer(url) {
    const ctx  = await browser.newContext();
    const page = await ctx.newPage();
    const seen = { status: [], errors: [], http: [] };
    page.on('console', (m) => {
        const t = m.text();
        if (t.includes('[PC]') || t.includes('[ICE') || t.includes('[Path]') ||
            t.includes('[RTC]') || t.includes('[WS]')) {
            seen.status.push(t);
        }
        // A module that fails to resolve logs a console error, not a pageerror —
        // without this a wrong mount path reads as a bare "no __jamrtc".
        if (m.type() === 'error') seen.errors.push('console: ' + t);
    });
    page.on('pageerror', (e) => seen.errors.push(String(e)));
    // Record failed asset fetches: a 404 on a module is the difference between
    // "the app crashed" and "the app was never served at this path".
    page.on('response', (r) => {
        if (r.status() >= 400) seen.http.push(`${r.status()} ${new URL(r.url()).pathname}`);
    });
    // Seed the nickname as a real storage entry before the app boots. The app
    // only auto-connects when a nickname is already known, and a fresh context
    // has empty storage — but injecting it via addInitScript made the read race
    // the page's own DOMContentLoaded handler: when connect() won, the signaling
    // socket was built with myId still null and the server rejected it with a
    // 400, which the test then read as "the app did not boot".
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { try { localStorage.setItem('midi_nickname', 'e2e'); } catch (e) {} });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);   // let MIDI permission + auto-connect settle
    return { ctx, page, seen };
}

function peerState(page) {
    return page.evaluate(() => {
        const m = window.__jamrtc?.webrtc;
        if (!m) return null;
        return {
            myId: m.myId?.slice(0, 6),
            ws: m.ws?.readyState ?? null,
            peers: [...m.peers.values()].map(p => ({
                id: p.remoteId?.slice(0, 6),
                polite: p.isPolite,
                dcState: p.dataChannel?.readyState ?? null,
                pcState: p.pc?.connectionState ?? null,
                open: p.isOpen(),
            })),
        };
    });
}

/** Drive the pair to a connected DataChannel; returns the last states seen. */
async function connectPair(urlFor) {
    const room = 'e2e-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const a = await openPeer(urlFor(room));

    // Poll: booting the app, fetching MIDI access and opening the socket is
    // asynchronous, and 1200 ms is not always enough on a cold module graph.
    // `ws` is null until connect() has been called at all, which is a different
    // failure from a socket that opened and closed (readyState 3) — the message
    // below must not conflate them, or a slow boot reads as a dead signaler.
    let stateA0 = null;
    for (let i = 0; i < 25; i++) {
        stateA0 = await peerState(a.page);
        if (stateA0?.ws === 1) break;
        await a.page.waitForTimeout(200);
    }
    expect(stateA0, 'app must expose window.__jamrtc.webrtc').not.toBeNull();
    if (stateA0.ws !== 1) {
        report('no-socket', { myId: stateA0.myId, ws: stateA0.ws, peers: [] }, null, a, null);
    }
    expect(stateA0.ws, stateA0.ws === null
        ? 'peer A never called connect() — the app did not boot'
        : `peer A signaling socket must be open (got ${stateA0.ws})`).toBe(1);

    const b = await openPeer(urlFor(room));

    let sa = null, sb = null;
    for (let i = 0; i < 40; i++) {          // up to 20 s for ICE + DTLS
        sa = await peerState(a.page);
        sb = await peerState(b.page);
        if (sa.peers.some(p => p.open) && sb.peers.some(p => p.open)) break;
        await a.page.waitForTimeout(500);
    }

    return { a, b, sa, sb, stateA0 };
}

function report(name, sa, sb, a, b) {
    console.log(`[e2e:${name}] A:`, JSON.stringify(sa));
    console.log(`[e2e:${name}] B:`, JSON.stringify(sb));
    if (a?.seen.status.length) console.log(`[e2e:${name}] A console:`, a.seen.status.join(' | '));
    if (b?.seen.status.length) console.log(`[e2e:${name}] B console:`, b.seen.status.join(' | '));
    if (a?.seen.errors.length) console.log(`[e2e:${name}] A pageerrors:`, a.seen.errors.join(' | '));
    if (b?.seen.errors.length) console.log(`[e2e:${name}] B pageerrors:`, b.seen.errors.join(' | '));
    if (a?.seen.http.length) console.log(`[e2e:${name}] A http failures:`, a.seen.http.join(' | '));
    if (b?.seen.http.length) console.log(`[e2e:${name}] B http failures:`, b.seen.http.join(' | '));
}

// ── The tests that matter ────────────────────────────────────────────────────

test('two peers reach a connected DataChannel (served at /)', async () => {
    webServer = startWebServer('root');
    await listen(webServer);

    const { a, b, sa, sb } = await connectPair((room) => `${BASE}/?room=${room}`);
    report('root', sa, sb, a, b);

    expect(sa.peers.some(p => p.open), `A never opened a DataChannel: ${JSON.stringify(sa)}`).toBe(true);
    expect(sb.peers.some(p => p.open), `B never opened a DataChannel: ${JSON.stringify(sb)}`).toBe(true);

    // Exactly one side must be polite, or offer collision has no tie-breaker.
    // Compare the peer that actually carries the link on each side — A can hold
    // a stale entry alongside the live one, so peers[0] is not the live peer.
    const liveA = sa.peers.find(p => p.open);
    const liveB = sb.peers.find(p => p.open);
    expect(liveA.polite, 'A must be impolite').toBe(false);
    expect(liveB.polite, 'B must be polite').toBe(true);

    await a.ctx.close();
    await b.ctx.close();
});

test('two peers reach a connected DataChannel (served under /jamrtc/)', async () => {
    // The previous test's contexts were closed, but the server may still have
    // connections draining; if close() never calls back, webServer stays
    // undefined and every later assertion dies on it. Bound the wait.
    await new Promise((r) => {
        const done = () => r();
        webServer.close(done);
        setTimeout(done, 3000);
    });
    webServer = startWebServer('subpath');
    await listen(webServer);

    // Nothing at / — a page must not be able to load from there.
    const stray = await fetch(`${BASE}/src/webrtc.js`).then(r => r.status).catch(() => 0);
    expect(stray, 'root must be empty in sub-path mode').toBe(404);

    const { a, b, sa, sb } = await connectPair((room) => `${BASE}/jamrtc/?room=${room}`);
    report('subpath', sa, sb, a, b);

    expect(sa.peers.some(p => p.open), `A never opened a DataChannel: ${JSON.stringify(sa)}`).toBe(true);
    expect(sb.peers.some(p => p.open), `B never opened a DataChannel: ${JSON.stringify(sb)}`).toBe(true);

    await a.ctx.close();
    await b.ctx.close();
});
