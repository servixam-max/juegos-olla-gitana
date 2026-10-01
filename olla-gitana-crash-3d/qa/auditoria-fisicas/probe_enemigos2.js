/* ENEMIGOS (compacto): por nivel y tipo → rango, y nº de muestras DENTRO de un
   sólido (con tag) y SIN suelo debajo (para los de suelo). Solo resumen. */
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const R = {};
for (let i = 0; i < 8; i++) {
  qa.start(i);
  qa.step(1/30, 5);
  const acc = {};
  for (let f = 0; f < 1500; f += 10) {
    qa.step(1/30, 10);
    for (const e of qa.diag().enemigosPos) {
      let a = acc[e.k];
      if (!a) a = acc[e.k] = { n: 0, minX: 99, maxX: -99, minY: 99, maxY: -99, minZ: 9999, maxZ: -9999, inside: {}, sinSuelo: 0 };
      a.n++;
      a.minX = Math.min(a.minX, e.x); a.maxX = Math.max(a.maxX, e.x);
      a.minY = Math.min(a.minY, e.y); a.maxY = Math.max(a.maxY, e.y);
      a.minZ = Math.min(a.minZ, e.z); a.maxZ = Math.max(a.maxZ, e.z);
      const s = qa.sonda(e.x, e.y + 0.5, e.z);
      if (s) a.inside[s.tag] = (a.inside[s.tag] || 0) + 1;
      if (['patrol', 'roller', 'turret', 'toro', 'blindado', 'barril'].includes(e.k)) {
        const g = qa.mapa(e.x, e.z, e.z, 1);
        if (!g.length || g[0][1] == null) a.sinSuelo++;
      }
    }
  }
  const out = {};
  for (const k of Object.keys(acc)) {
    const a = acc[k];
    out[k] = {
      x: [+a.minX.toFixed(1), +a.maxX.toFixed(1)], y: [+a.minY.toFixed(2), +a.maxY.toFixed(2)],
      z: [+a.minZ.toFixed(1), +a.maxZ.toFixed(1)],
      dentro: Object.keys(a.inside).length ? a.inside : 0,
      sinSuelo: a.sinSuelo, n: a.n
    };
  }
  R['N' + (i + 1)] = out;
}
R.errors = qa.data.errors.slice(0, 6);
qa.godMode(false);
return R;
