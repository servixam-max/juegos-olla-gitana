/* Runner: ejecuta probes en secuencia sobre la misma pestaña, cada uno con
   recarga previa (estado limpio) y guarda cada resultado en un JSON. */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import pkg from '/Volumes/465GB/migrated/juegos/olla-gitana-crash-3d/node_modules/ws/index.js';
const { WebSocket } = pkg;
const PORT = process.argv[2] || '9377';
const probes = process.argv.slice(3);

const list0 = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list0.find((t) => t.type === 'page' && t.url.includes('localhost:5199'));
if (!page) { console.log('NO PAGE'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 512 * 1024 * 1024 });
let id = 1; const pend = new Map();
ws.on('message', (d) => {
  let j; try { j = JSON.parse(d.toString()); } catch { return; }
  if (j.id && pend.has(j.id)) { pend.get(j.id)(j); pend.delete(j.id); }
  if (j.method === 'Runtime.consoleAPICalled') {
    const txt = (j.params.args || []).map((a) => a.value != null ? a.value : (a.description || a.type)).join(' ');
    if (txt.startsWith('PROG')) console.log('[page]', txt);
  }
});
await new Promise((r) => ws.on('open', r));
const call = (method, params = {}, timeout = 900000) => new Promise((res, rej) => {
  const mid = id++;
  const t = setTimeout(() => { pend.delete(mid); rej(new Error('cdp timeout ' + method)); }, timeout);
  pend.set(mid, (j) => { clearTimeout(t); j.error ? rej(new Error(JSON.stringify(j.error))) : res(j); });
  ws.send(JSON.stringify({ id: mid, method, params }));
});
await call('Runtime.enable');
await call('Page.enable');
const ev = async (expr, awaitPromise = true, timeout = 900000) => {
  const r = await call('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise }, timeout);
  if (r.result && r.result.exceptionDetails) throw new Error('page error: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 600));
  return r.result ? r.result.result.value : undefined;
};
const waitReady = async () => {
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 400));
    try { const m = await ev('!!window.__qa && window.__qa.state().mode', false, 15000); if (m) return true; } catch {}
  }
  return false;
};

for (const p of probes) {
  const body = readFileSync(p, 'utf8');
  const wrapped = `(async () => { ${body} })()`;
  await ev(`localStorage.setItem('olla3d_prefs_v1', JSON.stringify({ introVista: true, muted: true }))`).catch(() => {});
  await call('Page.reload', { ignoreCache: true }, 60000);
  await waitReady();
  const t0 = Date.now();
  let out, err = null;
  try { out = await ev(wrapped, true, 600000); } catch (e) { err = e.message; }
  const res = { probe: p, wall_s: +((Date.now() - t0) / 1000).toFixed(1), result: out, error: err };
  writeFileSync(p.replace(/\.js$/, '') + '.result.json', JSON.stringify(res, null, 1));
  console.log('### ' + p + ' -> ' + (err ? 'ERR ' + err : 'ok') + ' (' + res.wall_s + 's)');
}
ws.close();
process.exit(0);
