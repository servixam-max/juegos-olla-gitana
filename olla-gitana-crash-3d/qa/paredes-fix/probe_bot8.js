/* Suite de aceptación del encargo: 8 niveles, bot, godMode, 8000 frames a 1/30.
   Debe dar mode==='end' en cada nivel y 0 errores JS. */
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
  qa.step(1 / 30, 8000);
  const s = qa.state();
  const falls = qa.data.damageLog.filter((d) => d.reason === 'fall').length;
  out.push({
    nivel: i + 1, id: s.levelId, mode: s.mode, ended: !!s.ended, vidas: s.lives,
    z: +s.pos.z.toFixed(1), notas: s.notas, cajas: s.cajas + '/' + s.totalCajas,
    falls, ms: Math.round(performance.now() - t0),
    errores: qa.data.errors.slice(0, 5)
  });
}
return out;
