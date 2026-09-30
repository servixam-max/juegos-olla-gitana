/* Mapa de suelo por nivel (corregido): sonda(x, top+0.15, z) detecta el techo
   de una caja cuyo top es `top`. Testea varios niveles de altura. */
const LEVELS_Y = [0, 0.24, 0.9, 1.0, 1.4, 1.5, 1.8, 2.0, 2.8, 3.3, 3.9, 4.4];
const out = [];
for (let i = 0; i < 8; i++) {
  window.__qa.start(i);
  for (let k = 0; k < 120; k++) window.__qa.step(1 / 30, 1);
  const rows = [];
  for (let z = 2; z <= 300; z += 2) {
    let sup = null;
    for (const c of LEVELS_Y) {
      const h = window.__qa.sonda(0, c + 0.15, z);
      if (h) { sup = { y: c, tag: h.tag }; break; }
    }
    rows.push({ z, sup });
  }
  const holes = rows.filter((r) => !r.sup).map((r) => r.z);
  out.push({ idx: i, id: window.__qa.state().levelId, holes });
}
return out;
