/* Cobertura: para cada z (paso 0.5) mira si hay SUELO en alguna x de la ruta
   (|x|<=5.2) a menos de 1 m por debajo del techo esperado. Devuelve los tramos
   SIN suelo (agujeros involuntarios = el bot cae ahí). */
const out = [];
for (let i = 0; i < 8; i++) {
  window.__qa.start(i);
  for (let k = 0; k < 60; k++) window.__qa.step(1 / 30, 1);
  const gapZ = [];
  for (let z = 2; z <= 308; z += 0.5) {
    let ok = false;
    for (const x of [-4.6, -3.4, -2.2, -1.1, 0, 1.1, 2.2, 3.4, 4.6]) {
      // ¿hay algo sólido cuyo techo esté entre -1 m y +4.5 m respecto al ras?
      for (const y of [0, 0.24, 0.2, 0.7, 1.4, 2.1, 2.8, 3.5, 4.2]) {
        const b = window.__qa.sonda(x, y + 0.15, z);
        if (b && b.tag !== 'crate') { ok = true; break; }
      }
      if (ok) break;
    }
    if (!ok) gapZ.push(z);
  }
  // compactar
  const tramos = [];
  for (const z of gapZ) {
    const last = tramos[tramos.length - 1];
    if (last && z - last[1] <= 0.6) last[1] = z; else tramos.push([z, z]);
  }
  out.push({ idx: i, id: window.__qa.state().levelId, tramos: tramos.filter((t) => t[1] - t[0] >= 0.5) });
}
return out;
