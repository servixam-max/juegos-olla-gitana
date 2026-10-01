/* SMOKE final: arranca N1, 3 s de simulación, comprueba mode play, 0 errores,
   enemigos vivos y el estado del puro. */
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
qa.enableBot();
qa.start(0);
qa.step(1/30, 90);
const s = qa.state();
const d = qa.diag();
return {
  mode: s.mode, level: s.levelId, lives: s.lives, pos: s.pos,
  enemigos: d.enemigos, enemigosDetalle: d.enemigosDetalle,
  errores: qa.data.errors.slice(0, 10),
  puros: qa.purosPos().length,
  moviles: qa.moviles().length
};
