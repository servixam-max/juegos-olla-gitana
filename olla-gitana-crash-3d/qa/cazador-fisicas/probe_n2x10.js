/* N2 en 10 corridas: modo final y causa */
const out = [];
for (let run = 0; run < 10; run++) {
  window.__qa.data.damageLog.length = 0;
  window.__qa.start(1);
  window.__qa.enableBot();
  window.__qa.step(1 / 30, 4200);
  const s = window.__qa.state();
  out.push({ run, mode: s.mode, z: isFinite(s.pos.z) ? +s.pos.z.toFixed(1) : null, lives: s.lives,
    dmg: window.__qa.data.damageLog.map((d) => `${d.reason}@z${d.z}`).join(' ') });
}
return out;
