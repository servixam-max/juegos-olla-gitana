/* Bot en el nivel de la URL (lv=) con presupuesto amplio, godMode. */
const lv = Number(new URLSearchParams(location.search).get('lv') || 0);
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
qa.data.errors.length = 0;
qa.data.damageLog.length = 0;
qa.start(lv);
qa.enableBot();
const t0 = performance.now();
let pasos = 0;
for (let k = 0; k < 80 && qa.state().mode !== 'end'; k++) { qa.step(1 / 30, 400); pasos += 400; }
const s = qa.state();
return {
  nivel: lv + 1, id: s.levelId, mode: s.mode, ended: !!s.ended, pasos,
  z: +s.pos.z.toFixed(1), notas: s.notas, cajas: s.cajas + '/' + s.totalCajas, vidas: s.lives,
  muro: qa.data.damageLog.filter((d) => d.reason === 'wall').length,
  falls: qa.data.damageLog.filter((d) => d.reason === 'fall').length,
  ms: Math.round(performance.now() - t0), errores: qa.data.errors.slice(0, 4)
};
