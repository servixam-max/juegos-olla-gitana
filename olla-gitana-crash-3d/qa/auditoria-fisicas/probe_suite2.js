/* SUITE 8 NIVELES × 2 RONDAS con godMode (modo end + 0 errores). */
const R = { rondas: [], errores: [] };
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
qa.enableBot();
const BUDGET = 5400;
for (let ronda = 0; ronda < 2; ronda++) {
  const res = {};
  for (let i = 0; i < 8; i++) {
    qa.start(i);
    let steps = 0, last = qa.state();
    while (steps < BUDGET) {
      qa.step(1/30, 30);
      steps += 30;
      last = qa.state();
      if (last.ended) break;
    }
    res[i] = { ok: !!last.ended && last.mode === 'end', mode: last.mode, steps, notas: last.notas, endZ: last.pos ? +last.pos.z.toFixed(1) : null };
  }
  const ok = Object.values(res).filter((x) => x.ok).length;
  R.rondas.push({ ronda: ronda + 1, ok, total: 8, detalle: res });
}
R.errores = qa.data.errors.slice(0, 20);
qa.godMode(false);
return R;
