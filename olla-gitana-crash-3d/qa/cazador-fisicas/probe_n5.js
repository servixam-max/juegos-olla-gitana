/* N5 (idx 4): traza de las caídas y de la zona 60-110 */
window.__qa.data.damageLog.length = 0;
window.__qa.start(4);
window.__qa.enableBot();
for (let i = 0; i < 600 && window.__qa.state().mode !== 'play'; i++) window.__qa.step(1 / 30, 1);
const falls = {}, ring = [];
for (let k = 0; k < 3000; k++) {
  window.__qa.step(1 / 30, 1);
  const s = window.__qa.state(), d = window.__qa.diag();
  const f = window.__qa.data.damageLog.filter((x) => x.reason === 'fall');
  ring.push({ z: +s.pos.z.toFixed(1), x: +s.pos.x.toFixed(2), y: +s.pos.y.toFixed(2), g: d.grounded });
  if (ring.length > 60) ring.shift();
  if (f.length >= 3) break;
  if (s.mode !== 'play') break;
}
return { falls: window.__qa.data.damageLog.filter((x) => x.reason === 'fall'), tail: ring.slice(-30) };
