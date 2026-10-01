#!/usr/bin/env node
/* QA harness: launches headless Chrome against the game dev server, evaluates a
   probe file (JS body, async) with __qa available, prints the JSON result.
   Usage: node qa.mjs <probe.js> [--url=http://localhost:5199/?bot=1] [--port=9355] [--kill] */
import { spawn, execSync } from 'node:child_process';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { basename } from 'node:path';

const args = process.argv.slice(2);
const probeFile = args.find((a) => !a.startsWith('--'));
const opt = (k, d) => { const a = args.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const URL_ = opt('url', 'http://localhost:5199/?bot=1');
const PORT = Number(opt('port', '9355'));
const PROFILE = '/tmp/ogj9qa-profile-' + PORT;
const KILL = args.includes('--kill');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function listTargets() {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    return await r.json();
  } catch { return null; }
}

async function ensureChrome() {
  let list = await listTargets();
  if (list && list.some((t) => t.type === 'page')) return;
  rmSync(PROFILE, { recursive: true, force: true });
  spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`, '--user-data-dir=' + PROFILE,
    '--window-size=1024,768', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--mute-audio', '--autoplay-policy=no-user-gesture-required', `--app=${URL_}`
  ], { stdio: ['ignore', 'ignore', 'ignore'], detached: false });
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    list = await listTargets();
    if (list && list.some((t) => t.type === 'page')) return;
  }
  throw new Error('chrome no arrancó');
}

function connect(wsUrl) {
  return new Promise(async (resolve, reject) => {
    const { WebSocket } = await import('ws');
    const ws = new WebSocket(wsUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
    let id = 1;
    const pend = new Map();
    ws.on('message', (data) => {
      let j; try { j = JSON.parse(data.toString()); } catch { return; }
      if (j.id && pend.has(j.id)) { const p = pend.get(j.id); pend.delete(j.id); p(j); return; }
      if (j.method === 'Runtime.consoleAPICalled') {
        const txt = (j.params.args || []).map((a) => a.value != null ? a.value : (a.description || a.type)).join(' ');
        if (txt.startsWith('PROG')) console.log('[page]', txt);
      }
    });
    ws.on('open', () => resolve({
      ws,
      call: (method, params = {}, timeout = 300000) => new Promise((res, rej) => {
        const mid = id++;
        const t = setTimeout(() => { pend.delete(mid); rej(new Error('cdp timeout ' + method)); }, timeout);
        pend.set(mid, (j) => { clearTimeout(t); j.error ? rej(new Error(JSON.stringify(j.error))) : res(j.result); });
        ws.send(JSON.stringify({ id: mid, method, params }));
      })
    }));
    ws.on('error', reject);
  });
}

async function main() {
  if (KILL) { try { execSync(`pkill -f ${PROFILE} || true`); } catch {} console.log('killed'); return; }
  await ensureChrome();
  let list = await listTargets();
  let page = list.find((t) => t.type === 'page' && t.url.includes('localhost:5199')) || list.find((t) => t.type === 'page');
  if (!page) throw new Error('sin pestaña');
  const { call, ws } = await connect(page.webSocketDebuggerUrl);
  await call('Runtime.enable');
  await call('Page.enable');

  const ev = async (expr, awaitPromise = true, timeout = 300000) => {
    const r = await call('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise }, timeout);
    if (r.exceptionDetails) throw new Error('page error: ' + JSON.stringify(r.exceptionDetails).slice(0, 500));
    return r.result ? r.result.value : undefined;
  };

  // recargar para estado limpio y precargar prefs (sin intro)
  await ev(`localStorage.setItem('olla3d_prefs_v1', JSON.stringify({ introVista: true, muted: true }))`).catch(() => {});
  await call('Page.reload', { ignoreCache: true });
  // esperar a __qa listo
  let ready = false;
  for (let i = 0; i < 120; i++) {
    await sleep(500);
    try {
      const ok = await ev(`!!window.__qa && !!window.__qa.state && window.__qa.state().mode`, false, 20000);
      if (ok) { ready = true; break; }
    } catch (e) { /* sigue */ }
  }
  if (!ready) throw new Error('__qa no apareció');

  const body = readFileSync(probeFile, 'utf8');
  const wrapped = `(async () => { ${body} })()`;
  const t0 = Date.now();
  const out = await ev(wrapped, true, 1200000);
  console.log('=== RESULT (' + basename(probeFile) + ', ' + ((Date.now() - t0) / 1000).toFixed(1) + 's) ===');
  console.log(JSON.stringify(out, null, 2));
  ws.close();
}

main().catch((e) => { console.error('HARNESS ERROR:', e.message); process.exit(1); });
