#!/usr/bin/env node
/* Grabador del vídeo de presentación — MODO DETERMINISTA.
   Uso:  node tools/record.mjs [url] [salida.mp4]

   Cómo funciona:
   1. Chrome headless abre la página en modo demo (?demo=1).
   2. Se pausa el bucle de rAF (window.__recordPaused = true) y el guion se
      arranca desde cero.
   3. Por cada fotograma: __demo.stepFrame(1/30) → captura → repetir.
      Así el vídeo avanza EXACTAMENTE 1/30 s por imagen, sin importar cuánto
      tarde la captura: ni timelapse ni frames perdidos.
   4. ffmpeg monta los JPEG a 30 fps y añade la música de la banda.
*/
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const URL_BASE = process.argv[2] || 'http://localhost:5199';
const OUT = process.argv[3] || join(ROOT, 'presentacion-olla-gitana-3d.mp4');
const FRAMES_DIR = join(ROOT, '.frames');
const FPS = 30;
const W = 1280, H = 720;

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary'
];
const chromePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chromePath) { console.error('No encuentro Chrome. Instala Google Chrome.'); process.exit(1); }

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  console.log('· arrancando Chrome headless…');
  rmSync(FRAMES_DIR, { recursive: true, force: true });
  mkdirSync(FRAMES_DIR, { recursive: true });

  const userDir = '/tmp/og3d-record-profile';
  rmSync(userDir, { recursive: true, force: true });
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9333',
    '--user-data-dir=' + userDir,
    `--window-size=${W},${H}`,
    '--hide-scrollbars',
    '--no-first-run', '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-features=Translate,MediaRouter',
    `--app=${URL_BASE}/?demo=1`
  ], { stdio: ['ignore', 'ignore', 'ignore'] });

  await sleep(5200);

  // descubrir el target
  const list = await (await fetch('http://127.0.0.1:9333/json/list')).json();
  const page = list.find((t) => t.type === 'page' && t.url.includes('demo=1')) || list.find((t) => t.type === 'page');
  if (!page) { console.error('no encuentro la pestaña'); chrome.kill(); process.exit(1); }
  console.log('· pestaña:', page.url);

  const { WebSocket } = await import('ws').catch(() => ({}));
  if (!WebSocket) { console.error('falta el paquete ws (npm i ws)'); chrome.kill(); process.exit(1); }
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });

  let id = 1;
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = id++;
    const onMsg = (data) => {
      try {
        const j = JSON.parse(data.toString());
        if (j.id === mid) { ws.off('message', onMsg); j.error ? reject(new Error(JSON.stringify(j.error))) : resolve(j.result); }
      } catch (_) {}
    };
    ws.on('message', onMsg);
    ws.send(JSON.stringify({ id: mid, method, params }));
    setTimeout(() => { ws.off('message', onMsg); reject(new Error('cdp timeout ' + method)); }, 30000);
  });
  const ev = async (expr) => {
    const r = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(expr + ' → ' + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails));
    return r.result?.value;
  };

  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await sleep(2500);

  // pausar el bucle y arrancar el guion desde el principio
  await ev('window.__demo.pause(); true');
  await sleep(200);
  const ready = await ev('!!window.__demo');
  if (!ready) { console.error('modo demo no disponible'); chrome.kill(); process.exit(1); }
  await ev('window.__demo.start(); true');
  await sleep(300);

  const tiempos = await ev('JSON.stringify(window.__demo.guion.map(g=>g.t))');
  const total = JSON.parse(tiempos).reduce((a, b) => a + b, 0);
  const frames = Math.ceil(total * FPS) + 15;
  console.log(`· guion: ${total.toFixed(1)} s → ${frames} fotogramas a ${FPS} fps (determinista)`);

  for (let f = 0; f < frames; f++) {
    await ev('window.__demo.stepFrame(1/30)');
    const shot = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
    writeFileSync(join(FRAMES_DIR, `f${String(f).padStart(5, '0')}.jpg`), Buffer.from(shot.data, 'base64'));
    if (f % 120 === 0) console.log(`   ${f}/${frames} (${(f / FPS).toFixed(1)}s)`);
  }

  console.log('· montando con ffmpeg…');
  const musica = join(ROOT, 'public/assets/music.mp3');
  const cmd = `ffmpeg -y -framerate ${FPS} -i "${FRAMES_DIR}/f%05d.jpg" ` +
    `-i "${musica}" -shortest -map 0:v -map 1:a ` +
    `-c:v libx264 -pix_fmt yuv420p -crf 20 -preset medium ` +
    `-c:a aac -b:a 160k -af "afade=t=out:st=${Math.max(0, total - 3)}:d=3" ` +
    `-movflags +faststart "${OUT}"`;
  execSync(cmd, { stdio: 'inherit' });

  ws.close();
  chrome.kill();
  console.log('· vídeo listo:', OUT);
  console.log('· fotogramas en', FRAMES_DIR, '(bórralos si no los necesitas)');
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
