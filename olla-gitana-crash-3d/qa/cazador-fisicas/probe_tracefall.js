/* Traza de la caída: N1, últimos 90 frames antes del primer daño 'fall' */
window.__qa.data.damageLog.length = 0;
window.__qa.start(0);
window.__qa.enableBot();
for (let i = 0; i < 600 && window.__qa.state().mode !== 'play'; i++) window.__qa.step(1 / 30, 1);
const ring = [];
let n = 0;
for (let k = 0; k < 4000; k++) {
  window.__qa.step(1 / 30, 1); n++;
  const s = window.__qa.state(), d = window.__qa.diag();
  ring.push({ n, x: +s.pos.x.toFixed(2), y: +s.pos.y.toFixed(2), z: +s.pos.z.toFixed(2), vy: +d.vel.y.toFixed(2), vz: +d.vel.z.toFixed(2), g: d.grounded, j: d.jumps });
  if (ring.length > 90) ring.shift();
  if (window.__qa.data.damageLog.some((x) => x.reason === 'fall')) break;
  if (s.mode !== 'play') break;
}
return { frames: ring, dmg: window.__qa.data.damageLog.slice(0, 3) };
