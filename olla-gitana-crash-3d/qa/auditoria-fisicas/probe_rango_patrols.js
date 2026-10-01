/* RANGOS DE PATRULLA: replica la lógica de clamp que se va a aplicar en
   enemies.js y mide, para cada bicho móvil, el recorrido VÁLIDO (libre de
   sólidos + con suelo). Sirve para detectar patrullas que quedarían
   congeladas antes de tocar el código. */
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const R = { niveles: {} };
const libre = (x, z, r = 0.5) => !qa.sonda(x, 0.65, z) || (() => { const s = qa.sonda(x, 0.65, z); return r < 0.0; })();
function libre2(x, z, r) {
  // sonda en varios puntos del AABB (q a.sonda usa una caja de 0.4)
  const s1 = qa.sonda(x, 0.65, z);
  return !s1;
}
function haySuelo(x, z) {
  const g = qa.mapa(x, z, z, 1);
  return !!(g && g.length && g[0][1] != null);
}
function rangoPatrulla(bx, bz, axis, amp) {
  const ok = (o) => {
    const x = axis === 'z' ? bx : bx + o;
    const z = axis === 'z' ? bz + o : bz;
    return libre2(x, z) && haySuelo(x, z);
  };
  let p = amp;
  for (let k = 0; k < 40 && p > 0.2 && !ok(p); k++) p -= 0.16;
  let n = -amp;
  for (let k = 0; k < 40 && n < -0.2 && !ok(n); k++) n += 0.16;
  return [ +p.toFixed(2), +n.toFixed(2) ];
}
for (let i = 0; i < 8; i++) {
  qa.start(i);
  qa.step(1/30, 3);
  const out = [];
  for (const e of qa.diag().enemigosPos) {
    if (!['patrol', 'blindado', 'toro', 'bee', 'globo'].includes(e.k)) continue;
    // la base es la primera muestra (el bicho arranca en su base)
    out.push({ k: e.k, x: e.x, z: e.z });
  }
  // para cada uno, medir el rango en x y z alrededor de su posición inicial
  R.niveles['N' + (i + 1)] = out.map((e) => {
    const ampX = 4.5, ampZ = 3.0;
    return { k: e.k, base: [e.x, e.z], rangoX: rangoPatrulla(e.x, e.z, 'x', ampX), rangoZ: rangoPatrulla(e.x, e.z, 'z', ampZ), sueloAquí: haySuelo(e.x, e.z), libreAquí: libre2(e.x, e.z) };
  });
}
R.errors = qa.data.errors.slice(0, 5);
qa.godMode(false);
return R;
