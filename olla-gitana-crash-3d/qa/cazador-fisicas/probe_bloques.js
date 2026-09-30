/* Traza de la caída en N1 alrededor de z 88-100 (SOLO BLOQUES 1) */
window.__qa.data.damageLog.length = 0;
window.__qa.start(0);
window.__qa.enableBot();
for (let i = 0; i < 600 && window.__qa.state().mode !== 'play'; i++) window.__qa.step(1 / 30, 1);
const ring = [];
for (let k = 0; k < 6000; k++) {
  window.__qa.step(1 / 30, 1);
  const s = window.__qa.state(), d = window.__qa.diag();
  if (s.pos.z > 84) {
    ring.push({ z: +s.pos.z.toFixed(2), x: +s.pos.x.toFixed(2), y: +s.pos.y.toFixed(2), vz: +d.vel.z.toFixed(2), vy: +d.vel.y.toFixed(2), g: d.grounded, j: d.jumps });
  }
  if (ring.length > 70) ring.shift();
  if (window.__qa.data.damageLog.some((x) => x.reason === 'fall')) break;
  if (s.mode !== 'play') break;
}
return { frames: ring.slice(-40), dmg: window.__qa.data.damageLog.slice(0, 3) };
