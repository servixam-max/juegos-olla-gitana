/* Timing: cuánto tarda el bot en un nivel y qué pasa */
const t0 = performance.now();
window.__qa.start(0);
window.__qa.enableBot();
const marks = [];
for (let i = 0; i < 300; i++) {
  window.__qa.step(1 / 30, 10);
  if (i % 60 === 0) {
    const s = window.__qa.state();
    marks.push({ i, t: Math.round(performance.now() - t0), mode: s.mode, z: +s.pos.z.toFixed(1), lives: s.lives });
  }
  if (window.__qa.state().mode !== 'play') break;
}
const s = window.__qa.state();
return { total_ms: Math.round(performance.now() - t0), marks, fi: { mode: s.mode, z: +s.pos.z.toFixed(1), lives: s.lives, ended: s.ended } };
