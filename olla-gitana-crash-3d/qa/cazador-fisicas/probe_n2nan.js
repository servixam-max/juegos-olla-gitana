/* Traza fina: N2 (idx 1) posición cada 10 pasos hasta que aparezca NaN o caída */
const log = [];
window.__qa.data.damageLog.length = 0;
window.__qa.start(1);
window.__qa.enableBot();
for (let i = 0; i < 600 && window.__qa.state().mode !== 'play'; i++) window.__qa.step(1 / 30, 1);
let nanAt = null;
for (let k = 0; k < 700; k++) {
  window.__qa.step(1 / 30, 10);
  const s = window.__qa.state();
  const near = (window.__qa.diag && window.__qa.moviles) ? null : null;
  if (k % 6 === 0 || !isFinite(s.pos.x) || !isFinite(s.pos.z)) {
    log.push({ k, z: +s.pos.z, x: +s.pos.x, y: +s.pos.y, lives: s.lives, mode: s.mode, grounded: window.__qa.diag().grounded });
  }
  if (!isFinite(s.pos.x) || !isFinite(s.pos.z) || !isFinite(s.pos.y)) { nanAt = k; break; }
  if (s.mode !== 'play') break;
}
return {
  nanAt, last: log.slice(-25),
  falls: window.__qa.data.damageLog.filter((d) => d.reason === 'fall'),
  all: window.__qa.data.damageLog,
  boxesNear: window.__qa.sonda(0, 0.01, 20),
  state: window.__qa.state()
};
