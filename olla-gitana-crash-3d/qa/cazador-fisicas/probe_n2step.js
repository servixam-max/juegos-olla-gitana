/* N2 paso a paso desde el inicio: ¿en qué frame aparece el NaN y con qué estado? */
window.__qa.start(1);
window.__qa.enableBot();
for (let i = 0; i < 600 && window.__qa.state().mode !== 'play'; i++) window.__qa.step(1 / 30, 1);
const rows = [];
for (let k = 0; k < 90; k++) {
  const s = window.__qa.state();
  if (!isFinite(s.pos.x) || !isFinite(s.pos.z) || !isFinite(s.pos.y)) { rows.push({ k, NaN: true, pos: s.pos, d: window.__qa.diag() }); break; }
  rows.push({ k, x: +s.pos.x.toFixed(2), y: +s.pos.y.toFixed(2), z: +s.pos.z.toFixed(2), g: window.__qa.diag().grounded, v: window.__qa.diag().vel });
  window.__qa.step(1 / 30, 1);
}
return { rows: rows.slice(-30), errs: window.__qa.data.errors.slice(0, 5) };
