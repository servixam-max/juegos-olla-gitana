/* Tiempos y causa de fallo con presupuesto 140 s (4200 pasos) por nivel */
const out = [];
for (let i = 0; i < 8; i++) {
  window.__qa.data.damageLog.length = 0;
  window.__qa.start(i);
  window.__qa.enableBot();
  let pasosHastaEnd = null;
  for (let k = 0; k < 4200; k++) {
    window.__qa.step(1 / 30, 1);
    if (window.__qa.state().mode === 'end') { pasosHastaEnd = k; break; }
    if (window.__qa.state().mode === 'over') break;
  }
  const s = window.__qa.state();
  const dmg = {};
  for (const d of window.__qa.data.damageLog) dmg[d.reason] = (dmg[d.reason] || 0) + 1;
  out.push({
    idx: i, id: s.levelId, mode: s.mode, ok: s.mode === 'end',
    seg: pasosHastaEnd == null ? null : +(pasosHastaEnd / 30).toFixed(1),
    z: isFinite(s.pos.z) ? +s.pos.z.toFixed(1) : null, lives: s.lives, dmg,
    ultimos: window.__qa.data.damageLog.slice(-3).map((d) => `${d.reason}@z${d.z}`)
  });
}
return out;
