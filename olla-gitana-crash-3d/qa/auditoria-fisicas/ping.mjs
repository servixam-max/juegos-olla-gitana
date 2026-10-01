import pkg from '/Volumes/465GB/migrated/juegos/olla-gitana-crash-3d/node_modules/ws/index.js';
const { WebSocket } = pkg;
const PORT = process.argv[2] || '9378';
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((t) => t.type === 'page' && t.url.includes('localhost:5199'));
if (!page) { console.log('NO PAGE'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
let id = 1; const pend = new Map();
ws.on('message', (d) => { const j = JSON.parse(d.toString()); if (j.id && pend.has(j.id)) { pend.get(j.id)(j); pend.delete(j.id); } });
await new Promise((r) => ws.on('open', r));
const call = (method, params = {}) => new Promise((res, rej) => {
  const mid = id++; pend.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params }));
  setTimeout(() => { if (pend.has(mid)) { pend.delete(mid); rej(new Error('timeout ' + method)); } }, 15000);
});
const ev = async (expr) => { const r = await call('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result ? (r.result.exceptionDetails ? 'EXC ' + JSON.stringify(r.result.exceptionDetails).slice(0,300) : (r.result.result ? r.result.result.value : JSON.stringify(r.result))) : 'NO_RESULT'; };
console.log('alive:', await ev('1+1'));
console.log('paused:', await ev('window.__recordPaused'));
console.log('mode:', await ev('window.__qa ? window.__qa.state().mode : "noqa"'));
console.log('pos:', await ev('window.__qa ? JSON.stringify(window.__qa.state().pos) : "-"'));
ws.close();
process.exit(0);
