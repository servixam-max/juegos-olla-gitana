/* SUITE SEMBRADA (A/B): PRNG LCG sustituyendo Math.random antes de cada nivel,
   así las rondas son reproducibles bit a bit entre versiones de enemies.js.
   Mide: niveles terminados (mode 'end') y z final. */
const R = { semillas: {} };
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
qa.enableBot();
const makeLCG = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const SEEDS = [11, 22, 33, 44, 55, 66];
const origRandom = Math.random;
for (const seed of SEEDS) {
  const res = {};
  for (let i = 0; i < 8; i++) {
    Math.random = makeLCG(seed * 1000 + i);
    qa.start(i);
    let steps = 0, last = qa.state();
    while (steps < 4800) {
      qa.step(1/30, 30);
      steps += 30; last = qa.state();
      if (last.ended) break;
    }
    res[i] = { ok: !!last.ended && last.mode === 'end', endZ: last.pos ? +last.pos.z.toFixed(1) : null };
  }
  R.semillas[seed] = res;
}
Math.random = origRandom;
let total = 0;
for (const s of Object.values(R.semillas)) total += Object.values(s).filter((x) => x.ok).length;
R.totalOK = total + '/48';
R.errores = qa.data.errors.slice(0, 20);
qa.godMode(false);
return R;
