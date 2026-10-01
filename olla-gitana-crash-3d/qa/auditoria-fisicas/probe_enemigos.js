/* AUDITORÍA ENEMIGOS: por cada nivel, muestrea TODOS los enemigos vivos cada
   15 frames durante ~40 s simulados: rango x/z, altura y, y si su centro cae
   dentro de un sólido (sonda) → atravesamiento de muro/empotramiento.
   Detecta también enemigos de suelo que flotan o se hunden. */
const R = { levels: {}, errors: [] };
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);

const SAMPLE = 15, FRAMES = 1200;

for (let i = 0; i < 8; i++) {
  qa.start(i);
  qa.step(1/30, 5);
  const acc = {};   // kind -> {n, minX, maxX, minY, maxY, minZ, maxZ, inside, insideTags}
  for (let f = 0; f < FRAMES; f += SAMPLE) {
    qa.step(1/30, SAMPLE);
    const d = qa.diag();
    for (const e of d.enemigosPos) {
      let a = acc[e.k];
      if (!a) a = acc[e.k] = { n: 0, minX: 99, maxX: -99, minY: 99, maxY: -99, minZ: 9999, maxZ: -9999, inside: 0, tags: {}, below0: 0 };
      a.n++;
      a.minX = Math.min(a.minX, e.x); a.maxX = Math.max(a.maxX, e.x);
      a.minY = Math.min(a.minY, e.y); a.maxY = Math.max(a.maxY, e.y);
      a.minZ = Math.min(a.minZ, e.z); a.maxZ = Math.max(a.maxZ, e.z);
      if (e.y < -0.05) a.below0++;
      // sonda en el pecho del bicho (0.5 por encima de su base)
      const s = qa.sonda(e.x, e.y + 0.5, e.z);
      if (s) { a.inside++; a.tags[s.tag] = (a.tags[s.tag] || 0) + 1; }
    }
  }
  const out = {};
  for (const k of Object.keys(acc)) {
    const a = acc[k];
    out[k] = {
      n: a.n, x: [+a.minX.toFixed(1), +a.maxX.toFixed(1)], y: [+a.minY.toFixed(2), +a.maxY.toFixed(2)],
      z: [+a.minZ.toFixed(1), +a.maxZ.toFixed(1)], dentro_solido: a.inside, tags: a.tags, bajo_suelo: a.below0
    };
  }
  R.levels['N' + (i + 1)] = out;
}
R.errors = qa.data.errors.slice(0, 10);
qa.godMode(false);
return R;
