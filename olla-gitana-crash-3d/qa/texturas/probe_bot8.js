/* Suite de aceptación: bot + godMode en los 8 niveles, 12000 pasos (1/30 s).
   Debe dar mode 'end' en cada nivel y 0 errores JS. */
const out = [];
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
for (let i = 0; i < 8; i++) {
  qa.data.errors.length = 0;
  qa.data.damageLog.length = 0;
  qa.start(i);
  qa.enableBot();
  const t0 = performance.now();
  for (let k = 0; k < 40 && qa.state().mode !== 'end'; k++) qa.step(1 / 30, 300);
  const s = qa.state();
  out.push({
    nivel: i + 1, id: s.levelId, mode: s.mode, ended: !!s.ended, vidas: s.lives,
    z: +s.pos.z.toFixed(1), notas: s.notas, cajas: s.cajas + '/' + s.totalCajas,
    falls: qa.data.damageLog.filter((d) => d.reason === 'fall').length,
    ms: Math.round(performance.now() - t0),
    errores: qa.data.errors.slice(0, 4)
  });
}
return { ok: out.filter((o) => o.mode === 'end').length + '/8', out, fps: { avg: qa.avgFps(), min: qa.minFps() } };
