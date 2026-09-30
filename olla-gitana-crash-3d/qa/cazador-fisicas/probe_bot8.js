/* Bot en cada nivel + traza de daños/muertes. Devuelve por nivel:
   mode final, z, vidas, daños por tipo y si murió (fall) */
const out = [];
for (let i = 0; i < 8; i++) {
  window.__qa.data.damageLog.length = 0;
  window.__qa.start(i);
  window.__qa.enableBot();
  let steps = 0, minY = 99, deaths = 0, maxZ = 0;
  for (let k = 0; k < 200 && window.__qa.state().mode === 'play'; k++) {
    window.__qa.step(1 / 30, 40);
    steps += 40;
    const s = window.__qa.state();
    minY = Math.min(minY, s.pos.y);
    maxZ = Math.max(maxZ, s.pos.z);
  }
  const s = window.__qa.state();
  const dmg = {};
  for (const d of window.__qa.data.damageLog) dmg[d.reason] = (dmg[d.reason] || 0) + 1;
  out.push({ idx: i, id: s.levelId, mode: s.mode, ended: s.ended, lives: s.lives, z: +s.pos.z.toFixed(1), maxZ: +maxZ.toFixed(1), minY: +minY.toFixed(2), secs: +(steps / 30).toFixed(0), notas: s.notas, cajas: s.cajas + '/' + s.totalCajas, dmg });
}
return out;
