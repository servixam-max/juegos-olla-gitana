/* Baseline: bot completa cada uno de los 8 niveles con los niveles ACTUALES */
const out = [];
for (let i = 0; i < 8; i++) {
  window.__qa.data.damageLog.length = 0;
  window.__qa.start(i);
  window.__qa.enableBot();
  const t0 = performance.now();
  window.__qa.step(1 / 30, 4500);
  const s = window.__qa.state();
  const fall = window.__qa.data.damageLog.filter((d) => d.reason === 'fall').length;
  out.push({
    idx: i, id: s.levelId, mode: s.mode, ended: s.ended, lives: s.lives,
    z: +s.pos.z.toFixed(1), notas: s.notas, cajas: s.cajas + '/' + s.totalCajas,
    falls: fall, ms: Math.round(performance.now() - t0)
  });
}
return out;
