// Full 8-level suite: bot + godMode, deterministic stepping. Baseline / post-fix.
const R = { levels: {}, errors: [] };
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
qa.enableBot();
const BUDGET = Number(window.__BUDGET || 5400);   // frames per level (180 s sim)
for (let i = 0; i < 8; i++) {
  qa.start(i);
  let steps = 0;
  const t0 = performance.now();
  let last = qa.state();
  while (steps < BUDGET) {
    qa.step(1/30, 30);
    steps += 30;
    last = qa.state();
    if (last.ended) break;
    if (steps % 1500 === 0) console.log('PROG nivel ' + i + ' steps ' + steps + ' mode ' + last.mode + ' z ' + (last.pos ? last.pos.z.toFixed(1) : '?'));
  }
  R.levels[i] = {
    mode: last.mode, level: last.level, notas: last.notas, cajas: last.cajas,
    ended: !!last.ended, ok: !!last.ended && last.mode === 'end',
    steps, wall_s: +((performance.now() - t0) / 1000).toFixed(1),
    endZ: last.pos ? +last.pos.z.toFixed(1) : null
  };
  console.log('PROG fin nivel ' + i + ': ' + JSON.stringify(R.levels[i]));
}
R.errors = qa.data.errors.slice(0, 20);
R.damageLog = qa.data.damageLog.slice(-15);
return R;
