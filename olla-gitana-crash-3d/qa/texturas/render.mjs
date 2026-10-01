/* Render de una foto de QA con canvas.toDataURL en el mismo task (evita el
   buffer perdido de preserveDrawingBuffer=false). Uso:
   node render.mjs <lv> <px,py,pz> <lx,ly,lz> <out.png> [--port=9400] */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const [lv, camS, lookS, out] = args;
const opt = (k, d) => { const a = args.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const PORT = Number(opt('port', '9400'));
const BASE = opt('base', 'http://localhost:5199/?bot=1');
const PROFILE = '/tmp/tex1-render-' + PORT;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(dirname(out), { recursive: true });
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
  const call = (m, p = {}, t = 180000) => new Promise((res, rej) => {
    const mid = id++; const to = setTimeout(() => { pend.delete(mid); rej(new Error('cdp timeout ' + m)); }, t);
    pend.set(mid, (j) => { clearTimeout(to); j.error ? rej(new Error(JSON.stringify(j.error))) : res(j.result); });
    ws.send(JSON.stringify({ id: mid, method: m, params: p }));
  });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  await call('Runtime.enable'); await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  const ev = async (e, ap = true) => {
    const r = await call('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: ap });
    if (r.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result ? r.result.value : undefined;
  };
  await call('Page.navigate', { url: BASE + '&lv=' + lv });
  let ready = false;
  for (let i = 0; i < 100; i++) { await sleep(300); try { if (await ev(`!!window.__qa && !!window.__qa.state`, false)) { ready = true; break; } } catch {} }
  if (!ready) throw new Error('sin __qa');
  await ev(`localStorage.setItem('olla3d_prefs_v1', JSON.stringify({ introVista: true, muted: true })); true`);
  await ev(`window.__recordPaused = true; window.__qa.godMode(true); document.getElementById('hud').classList.add('hidden'); true`);
  await ev(`window.__qa.start(${lv}); true`);
  await ev(`window.__qa.step(1/30, 200); true`);
  const b64 = await ev(`(() => { window.__qa.foto(${camS},${lookS});
    const c = document.getElementById('game');
    return c.toDataURL('image/png').split(',')[1]; })()`);
  writeFileSync(out, Buffer.from(b64, 'base64'));
  const st = await ev(`({mode: window.__qa.state().mode, err: window.__qa.data.errors.slice(0,3)})`);
  console.log(out, JSON.stringify(st));
  ws.close();
}
main().catch((e) => { console.error('RENDER ERROR:', e.message); process.exit(1); });
