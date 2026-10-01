#!/usr/bin/env node
/* Harness de QA con hook de escena (__THREE_DEVTOOLS__) + capturas.
   Uso: node harness.mjs probe.js [--url=...] [--port=9371] [--shots=dir] */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';

const args = process.argv.slice(2);
const probeFile = args.find((a) => !a.startsWith('--'));
const opt = (k, d) => { const a = args.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const URL_ = opt('url', 'http://localhost:5199/?bot=1');
const PORT = Number(opt('port', '9371'));
const SHOTS = opt('shots', '');
const PROFILE = '/tmp/tex1-qa-' + PORT;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HOOK = `
window.__THREE__ = '186';
window.__THREE__DEVTOOLS__SEEN = [];
window.__THREE_DEVTOOLS__ = { dispatchEvent(e) { try { window.__THREE__DEVTOOLS__SEEN.push(e.detail); } catch (_) {} } };
`;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

async function listTargets() { try { return await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); } catch { return null; } }

function connect(wsUrl) {
  return new Promise(async (resolve, reject) => {
    const { WebSocket } = await import('ws');
    const ws = new WebSocket(wsUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
    let id = 1; const pend = new Map();
    ws.on('message', (d) => { let j; try { j = JSON.parse(d.toString()); } catch { return; }
      if (j.id && pend.has(j.id)) { const p = pend.get(j.id); pend.delete(j.id); p(j); } });
    ws.on('open', () => resolve({ ws, call: (method, params = {}, timeout = 900000) => new Promise((res, rej) => {
      const mid = id++; const t = setTimeout(() => { pend.delete(mid); rej(new Error('cdp timeout ' + method)); }, timeout);
      pend.set(mid, (j) => { clearTimeout(t); j.error ? rej(new Error(JSON.stringify(j.error))) : res(j.result); });
      ws.send(JSON.stringify({ id: mid, method, params }));
    }) }));
    ws.on('error', reject);
  });
}

async function main() {
  let list = await listTargets();
  if (!list || !list.some((t) => t.type === 'page')) {
    rmSync(PROFILE, { recursive: true, force: true });
    spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--user-data-dir=' + PROFILE,
      '--window-size=1280,720', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
      '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--app=about:blank'],
      { stdio: ['ignore', 'ignore', 'ignore'], detached: false });
    for (let i = 0; i < 60; i++) { await sleep(500); list = await listTargets(); if (list && list.some((t) => t.type === 'page')) break; }
  }
  const page = list.find((t) => t.type === 'page');
  if (!page) throw new Error('sin pestaña');
  const { call, ws } = await connect(page.webSocketDebuggerUrl);
  await call('Runtime.enable');
  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await call('Page.addScriptToEvaluateOnNewDocument', { source: HOOK });
  await call('Page.navigate', { url: URL_ });
  const ev = async (expr, awaitPromise = true, timeout = 900000) => {
    const r = await call('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise }, timeout);
    if (r.exceptionDetails) throw new Error('page error: ' + JSON.stringify(r.exceptionDetails).slice(0, 600));
    return r.result ? r.result.value : undefined;
  };
  let ready = false;
  for (let i = 0; i < 120; i++) {
    await sleep(400);
    try { const ok = await ev(`!!window.__qa && !!window.__qa.state && window.__qa.state().mode`, false, 20000); if (ok) { ready = true; break; } } catch {}
  }
  if (!ready) throw new Error('__qa no apareció');
  await ev(`localStorage.setItem('olla3d_prefs_v1', JSON.stringify({ introVista: true, muted: true })); true`).catch(() => {});
  // expone helpers de QA específicos del sprint de texturas
  await ev(`window.__tex = {
    scene: () => { const seen = window.__THREE__DEVTOOLS__SEEN || []; const s = seen.find((o) => o && o.isScene); return s || null; },
    renderer: () => { const seen = window.__THREE__DEVTOOLS__SEEN || []; const r = seen.find((o) => o && o.isWebGLRenderer); return r || null; },
    drawCalls: () => { const r = window.__tex.renderer(); return r && r.info ? { calls: r.info.render.calls, tris: r.info.render.triangles, geos: r.info.memory.geometries, texs: r.info.memory.textures, programs: r.info.programs ? r.info.programs.length : null } : null; },
    mats: () => { const s = window.__tex.scene(); if (!s) return null; const g = {}; let map = 0, plano = 0;
      s.traverse((o) => { if (!o.isMesh || !o.material) return; const k = (o.geometry.type || '?') + '|' + (o.material.map ? 'MAP' : 'plano');
        g[k] = (g[k] || 0) + 1; if (o.material.map) map++; else plano++; });
      return { map, plano, grupos: g }; },
    shot: async (name, px, py, pz, lx, ly, lz, pasos = 0) => { if (pasos) window.__qa.step(1/30, pasos);
      window.__qa.foto(px, py, pz, lx, ly, lz); return true; },
    fotoFin: () => { window.__qa.fotoFin(); return true; }
  }; true`);
  const body = readFileSync(probeFile, 'utf8');
  const wrapped = `(async () => { ${body} })()`;
  const t0 = Date.now();
  const out = await ev(wrapped, true, 1200000);
  console.log('=== RESULT (' + basename(probeFile) + ', ' + ((Date.now() - t0) / 1000).toFixed(1) + 's) ===');
  console.log(JSON.stringify(out, null, 1));
  if (SHOTS) {
    // script de capturas: devuelve [{lv, pasos, p:[x,y,z], l:[x,y,z], out}]
    const shotsFile = probeFile.replace(/\.js$/, '.shots.js');
    try {
      const shotBody = readFileSync(shotsFile, 'utf8');
      const items = JSON.parse(await ev(`(async () => { ${shotBody} })()`, true, 600000));
      await ev(`document.getElementById('hud').classList.add('hidden'); true`);
      const asegurar = async () => {
        // un HMR de otro agente puede recargar la página a mitad de las fotos
        for (let i = 0; i < 40; i++) {
          try { if (await ev(`!!window.__qa && !!window.__qa.state`, false, 15000)) return true; } catch {}
          await sleep(500);
        }
        await call('Page.navigate', { url: URL_ });
        for (let i = 0; i < 100; i++) { await sleep(400); try { if (await ev(`!!window.__qa && !!window.__qa.state`, false, 15000)) return true; } catch {} }
        return false;
      };
      for (const it of items) {
        if (!(await asegurar())) { console.error('shots: __qa no vuelve'); break; }
        await ev(`window.__recordPaused = true; window.__qa.godMode(true); true`);
        if (it.lv != null) await ev(`window.__qa.start(${it.lv}); true`);
        if (it.pasos) await ev(`window.__qa.step(1/30, ${it.pasos}); true`);
        if (it.accion) await ev(it.accion);
        await ev(`window.__qa.foto(${it.p.join(',')},${it.l.join(',')}); true`);
        const shot = await call('Page.captureScreenshot', { format: 'png' });
        writeFileSync(join(SHOTS, it.out + '.png'), Buffer.from(shot.data, 'base64'));
        console.log('· foto', it.out);
      }
      await ev('window.__qa.fotoFin(); true').catch(() => {});
    } catch (e) { if (!/ENOENT/.test(e.message)) console.error('shots error:', e.message); }
  }
  ws.close();
}
main().catch((e) => { console.error('HARNESS ERROR:', e.message); process.exit(1); });
