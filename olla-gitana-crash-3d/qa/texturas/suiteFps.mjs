#!/usr/bin/env node
/* Suite FPS real: una página nueva por nivel (rAF en tiempo real, bot jugando).
   Uso: node suiteFps.mjs probe_fps.js 0,1,2 [--port=9372] */
import { spawn } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';

const args = process.argv.slice(2);
const probeFile = args.find((a) => !a.startsWith('--'));
const opt = (k, d) => { const a = args.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const PORT = Number(opt('port', '9372'));
const LEVELS = opt('levels', '0,1,2,3,4,5,6,7').split(',').map(Number);
const base = opt('base', 'http://localhost:5199/?bot=1');
const PROFILE = '/tmp/tex1-fps-' + PORT;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HOOK = `
window.__THREE_DEVTOOLS__ = { dispatchEvent(e) { try { (window.__THREE__DEVTOOLS__SEEN = window.__THREE__DEVTOOLS__SEEN || []).push(e.detail); } catch (_) {} } };
`;
const listT = async () => { try { return await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); } catch { return null; } };

async function main() {
  let list = await listT();
  if (!list || !list.some((t) => t.type === 'page')) {
    rmSync(PROFILE, { recursive: true, force: true });
    spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--user-data-dir=' + PROFILE,
      '--window-size=1280,720', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
      '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--app=about:blank'],
      { stdio: ['ignore', 'ignore', 'ignore'], detached: false });
    for (let i = 0; i < 60; i++) { await sleep(500); list = await listT(); if (list && list.some((t) => t.type === 'page')) break; }
  }
  const page = list.find((t) => t.type === 'page');
  const { WebSocket } = await import('ws');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
  let id = 1; const pend = new Map();
  ws.on('message', (d) => { let j; try { j = JSON.parse(d.toString()); } catch { return; }
    if (j.id && pend.has(j.id)) { const p = pend.get(j.id); pend.delete(j.id); p(j); } });
  const call = (method, params = {}, timeout = 600000) => new Promise((res, rej) => {
    const mid = id++; const t = setTimeout(() => { pend.delete(mid); rej(new Error('cdp timeout ' + method)); }, timeout);
    pend.set(mid, (j) => { clearTimeout(t); j.error ? rej(new Error(JSON.stringify(j.error))) : res(j.result); });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  await call('Runtime.enable'); await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await call('Page.addScriptToEvaluateOnNewDocument', { source: HOOK });
  const ev = async (expr, ap = true) => {
    const r = await call('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: ap });
    if (r.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
    return r.result ? r.result.value : undefined;
  };
  await ev(`localStorage.setItem('olla3d_prefs_v1', JSON.stringify({ introVista: true, muted: true })); true`).catch(() => {});
  const body = readFileSync(probeFile, 'utf8');
  const wrapped = `(async () => { ${body} })()`;
  const results = [];
  for (const lv of LEVELS) {
    await call('Page.navigate', { url: base + '&lv=' + lv });
    let ready = false;
    for (let i = 0; i < 100; i++) { await sleep(300); try { if (await ev(`!!window.__qa && !!window.__qa.state && window.__qa.state().mode`, false)) { ready = true; break; } } catch {} }
    if (!ready) { results.push({ lv, ok: false, err: 'no __qa' }); console.log('--- nivel', lv, 'SIN __qa'); continue; }
    const out = await ev(wrapped, true);
    results.push(out);
    console.log('--- nivel', lv, JSON.stringify(out));
  }
  console.log('=== FPS TABLA ==='); console.log(JSON.stringify(results, null, 1));
  ws.close();
}
main().catch((e) => { console.error('SUITE ERROR:', e.message); process.exit(1); });
