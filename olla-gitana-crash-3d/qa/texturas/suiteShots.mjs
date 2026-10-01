#!/usr/bin/env node
/* Capturas por sitio con PÁGINA NUEVA por cada uno (evita el canvas perdido tras
   muchos start() y los HMR de otros agentes). Uso:
   node suiteShots.mjs plan.json [--port=9390] [--out=dir]
   plan.json: [{ lv, pasos, p:[x,y,z], l:[x,y,z], out }] */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const planFile = args.find((a) => !a.startsWith('--'));
const opt = (k, d) => { const a = args.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const PORT = Number(opt('port', '9390'));
const OUT = opt('out', 'shots');
const BASE = opt('base', 'http://localhost:5199/?bot=1');
const PROFILE = '/tmp/tex1-shots-' + PORT;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const plan = JSON.parse(readFileSync(planFile, 'utf8'));
mkdirSync(OUT, { recursive: true });
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
  const call = (method, params = {}, timeout = 180000) => new Promise((res, rej) => {
    const mid = id++; const t = setTimeout(() => { pend.delete(mid); rej(new Error('cdp timeout ' + method)); }, timeout);
    pend.set(mid, (j) => { clearTimeout(t); j.error ? rej(new Error(JSON.stringify(j.error))) : res(j.result); });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  await call('Runtime.enable'); await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  const ev = async (expr, ap = true) => {
    const r = await call('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: ap });
    if (r.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result ? r.result.value : undefined;
  };
  await ev(`localStorage.setItem('olla3d_prefs_v1', JSON.stringify({ introVista: true, muted: true })); true`).catch(() => {});
  // primera navegación al ORIGEN del juego (localStorage por origen: en about:blank no sirve)
  await call('Page.navigate', { url: BASE });
  for (let i = 0; i < 100; i++) { await sleep(300); try { if (await ev(`!!window.__qa && !!window.__qa.state`, false)) break; } catch {} }
  await ev(`localStorage.setItem('olla3d_prefs_v1', JSON.stringify({ introVista: true, muted: true })); true`).catch(() => {});
  const hechas = [];
  for (const it of plan) {
    await call('Page.navigate', { url: BASE + '&lv=' + it.lv });
    let ready = false;
    for (let i = 0; i < 100; i++) { await sleep(300); try { if (await ev(`!!window.__qa && !!window.__qa.state`, false)) { ready = true; break; } } catch {} }
    if (!ready) { console.error('SIN __qa en', it.out); continue; }
    // congelar el bucle del juego: si no, el rAF sigue y la cine/intro tapa la foto
    await ev(`window.__recordPaused = true; window.__qa.godMode(true); document.getElementById('hud').classList.add('hidden'); true`);
    await ev(`window.__qa.start(${it.lv}); true`);
    await ev(`window.__qa.step(1/30, ${it.pasos || 130}); true`);
    // render de la foto + toDataURL en el MISMO evaluate: con
    // preserveDrawingBuffer=false el buffer se pierde antes de que llegue la
    // captura CDP (sale negro), así que se lee el canvas en el mismo task
    const b64 = await ev(`(() => { window.__qa.foto(${it.p.join(',')},${it.l.join(',')});
      const c = document.getElementById('game');
      return c.toDataURL('image/png').split(',')[1]; })()`);
    writeFileSync(join(OUT, it.out + '.png'), Buffer.from(b64, 'base64'));
    const st = await ev(`({mode: window.__qa.state().mode, z: +window.__qa.state().pos.z.toFixed(1), err: window.__qa.data.errors.slice(0,3)})`);
    hechas.push({ out: it.out, ...st });
    console.log('·', it.out, JSON.stringify(st));
  }
  console.log('=== TOTAL', hechas.length, '/', plan.length, '===');
  ws.close();
}
main().catch((e) => { console.error('SHOTS ERROR:', e.message); process.exit(1); });
