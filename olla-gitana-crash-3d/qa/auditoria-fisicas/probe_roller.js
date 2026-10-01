/* Detalle del roller de N3: dónde se solapa con cajas/plataformas y con qué. */
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
qa.start(2);
qa.step(1/30, 5);
const casos = [];
for (let f = 0; f < 3000; f += 5) {
  qa.step(1/30, 5);
  for (const e of qa.diag().enemigosPos) {
    if (e.k !== 'roller') continue;
    const s = qa.sonda(e.x, e.y + 0.5, e.z);
    if (s) casos.push({ z: +e.z.toFixed(1), x: +e.x.toFixed(1), tag: s.tag, bx: +s.pos.x.toFixed(1), bz: +s.pos.z.toFixed(1), by: +s.pos.y.toFixed(2) });
  }
}
// agrupar por z
const porZ = {};
for (const c of casos) { const k = c.tag + '@z' + c.bz + ',x' + c.bx + ',y' + c.by; porZ[k] = (porZ[k] || 0) + 1; }
return { total: casos.length, porZ, ejemplo: casos.slice(0, 8), errors: qa.data.errors.slice(0, 4) };
