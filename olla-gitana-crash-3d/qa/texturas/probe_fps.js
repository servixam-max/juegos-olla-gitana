/* FPS REAL: deja correr el rAF en tiempo real con el bot jugando (sin
   __recordPaused). Mide avgFps/minFps reales por ventanas de 6 s. */
const qp = new URLSearchParams(location.search);
const lv = Number(qp.get('lv') || 0);
const qa = window.__qa;
/* renderer/scene vía el hook de devtools instalado antes de cargar la página */
const seen = window.__THREE__DEVTOOLS__SEEN || [];
const rnd = seen.find((o) => o && o.isWebGLRenderer) || null;
qa.godMode(true);
qa.enableBot();
qa.start(lv);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
await espera(5000);                       // warm-up (shaders + texturas)
const ventanas = [];
for (let v = 0; v < 2; v++) {
  qa.data.fpsSamples.length = 0;
  await espera(6000);
  const s = qa.data.fpsSamples.filter((x) => x > 0);
  ventanas.push({
    avg: s.length ? +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(1) : null,
    min: s.length ? Math.min(...s) : null, n: s.length
  });
}
return {
  lv: lv + 1, id: qa.state().levelId, mode: qa.state().mode,
  ventanas, avgFps: qa.avgFps(), minFps: qa.minFps(),
  draw: rnd ? { calls: rnd.info.render.calls, tris: rnd.info.render.triangles } : null,
  mem: rnd ? { geos: rnd.info.memory.geometries, texs: rnd.info.memory.textures, progs: rnd.info.programs.length } : null,
  z: +qa.state().pos.z.toFixed(1),
  errores: qa.data.errors.slice(0, 4)
};
