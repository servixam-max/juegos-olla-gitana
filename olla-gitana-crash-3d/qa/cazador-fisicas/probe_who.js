/* ¿Quién corrompe pos.z? Volcado de TODOS los movers tras 1 paso + vigilancia de b.pos.z */
const out = { steps: [] };
window.__qa.start(1);
window.__qa.enableBot();
for (let i = 0; i < 600 && window.__qa.state().mode !== 'play'; i++) window.__qa.step(1 / 30, 1);
const snap = [];
for (let k = 0; k < 40; k++) {
  window.__qa.step(1 / 30, 6);
  const mv = window.__qa.moviles();
  snap.push({ k, movers: mv.map((m) => ({ t: m.tag, x: +m.pos.x, y: +m.pos.y, z: String(m.pos.z).slice(0, 24) })) });
  if (mv.some((m) => !isFinite(m.pos.x) || !isFinite(m.pos.z))) break;
}
out.steps = snap.filter((s, i) => i % 4 === 0 || s.movers.some((m) => isNaN(+m.z)));
out.badFirst = snap.findIndex((s) => s.movers.some((m) => isNaN(+m.z)));
out.errs = window.__qa.data.errors.slice(0, 8);
out.state = window.__qa.state();
return out;
