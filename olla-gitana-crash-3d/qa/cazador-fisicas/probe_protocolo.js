/* PROTOCOLO EXACTO DEL USUARIO: start(i); enableBot(); step(1/30, 4200) → mode==='end' */
const out = [];
for (let i = 0; i < 8; i++) {
  window.__qa.data.damageLog.length = 0;
  window.__qa.start(i);
  window.__qa.enableBot();
  const t0 = performance.now();
  window.__qa.step(1 / 30, 4200);
  const s = window.__qa.state();
  const dmg = {};
  for (const d of window.__qa.data.damageLog) dmg[d.reason] = (dmg[d.reason] || 0) + 1;
  out.push({
    idx: i, id: s.levelId, mode: s.mode, ok: s.mode === 'end', ended: s.ended,
    z: isFinite(s.pos.z) ? +s.pos.z.toFixed(1) : null, lives: s.lives,
    notas: s.notas, cajas: s.cajas + '/' + s.totalCajas, dmg, ms: Math.round(performance.now() - t0)
  });
}
return out;
