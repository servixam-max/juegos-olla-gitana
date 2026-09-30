/* N2: 400 pasos de 1, buscando el NaN y guardando el estado completo previo */
window.__qa.start(1);
window.__qa.enableBot();
for (let i = 0; i < 600 && window.__qa.state().mode !== 'play'; i++) window.__qa.step(1 / 30, 1);
const rows = [];
let nan = null;
for (let k = 0; k < 400; k++) {
  const s = window.__qa.state();
  const d = window.__qa.diag();
  const bad = !isFinite(s.pos.x) || !isFinite(s.pos.z) || !isFinite(s.pos.y) || !isFinite(d.vel.x) || !isFinite(d.vel.y) || !isFinite(d.vel.z);
  rows.push({ k, x: +s.pos.x.toFixed(2), y: +s.pos.y.toFixed(2), z: +s.pos.z.toFixed(2), g: d.grounded, v: { x: +d.vel.x.toFixed(2), y: +d.vel.y.toFixed(2), z: +d.vel.z.toFixed(2) }, j: d.jumps, bad });
  if (bad) { nan = k; break; }
  window.__qa.step(1 / 30, 1);
}
const bad = rows.filter((r) => r.bad).length;
return { nan, bad, tail: rows.slice(-16), errs: window.__qa.data.errors.slice(0, 5), state: window.__qa.state() };
