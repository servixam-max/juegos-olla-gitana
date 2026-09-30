/* Bot en cada nivel con margen amplio: 220 s simulados y, si está 'cine'
   (jefe intermedio) o 'play', sigue avanzando. Devuelve la tabla de verificación. */
const out = [];
for (let i = 0; i < 8; i++) {
  window.__qa.data.damageLog.length = 0;
  window.__qa.start(i);
  window.__qa.enableBot();
  let steps = 0, maxZ = 0, deaths = 0;
  for (let k = 0; k < 1400; k++) {
    const s0 = window.__qa.state();
    if (s0.mode === 'end' || s0.mode === 'over') break;
    window.__qa.step(1 / 30, 10); steps += 10;
    const s = window.__qa.state();
    if (isFinite(s.pos.z)) maxZ = Math.max(maxZ, s.pos.z);
    if (s.mode === 'end' || s.mode === 'over') break;
  }
  const s = window.__qa.state();
  const dmg = {};
  for (const d of window.__qa.data.damageLog) dmg[d.reason] = (dmg[d.reason] || 0) + 1;
  out.push({ idx: i, id: s.levelId, mode: s.mode, ended: s.ended, lives: s.lives, z: +s.pos.z.toFixed(1), maxZ: +maxZ.toFixed(1), secs: +(steps / 30).toFixed(0), notas: s.notas, cajas: s.cajas + '/' + s.totalCajas, dmg });
}
return out;
