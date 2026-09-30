/* Caída en N1 z≈50-64: 1 paso de frame desde z=44 hasta el fall.
   Guardamos también si cada frame hay suelo (groundUnder) y los sólidos bajo el jugador. */
window.__qa.data.damageLog.length = 0;
window.__qa.start(0);
window.__qa.enableBot();
for (let i = 0; i < 600 && window.__qa.state().mode !== 'play'; i++) window.__qa.step(1 / 30, 1);
const rows = [];
for (let k = 0; k < 4000; k++) {
  window.__qa.step(1 / 30, 1);
  const s = window.__qa.state(), d = window.__qa.diag();
  if (s.pos.z > 44) {
    const sup = window.__qa.sonda(s.pos.x, s.pos.y + 0.1, s.pos.z);
    rows.push({ z: +s.pos.z.toFixed(2), x: +s.pos.x.toFixed(2), y: +s.pos.y.toFixed(2), vy: +d.vel.y.toFixed(2), g: d.grounded, under: sup ? sup.tag + '@' + (+sup.pos.y.toFixed(2)) : null });
  }
  if (rows.length > 80) rows.shift();
  if (window.__qa.data.damageLog.some((x) => x.reason === 'fall')) break;
  if (s.mode !== 'play') break;
}
return { rows: rows.slice(-45), dmg: window.__qa.data.damageLog.slice(0, 3) };
