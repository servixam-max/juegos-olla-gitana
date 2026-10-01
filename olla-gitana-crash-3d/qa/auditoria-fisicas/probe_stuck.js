/* A/B: ¿el atasco del bot es por mis cambios en enemies.js? Devuelve
   información de dónde se atasca (z, x, enemigos cerca) por nivel. */
const R = { niveles: {} };
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
qa.enableBot();
// 6 pasadas cortas por nivel para ver dónde atasca (z estancada)
for (const i of [2, 3, 5, 6]) {
  const pasadas = [];
  for (let k = 0; k < 4; k++) {
    qa.start(i);
    let steps = 0, last = qa.state(), zHist = [];
    let stuckAt = null, prevZ = null, same = 0;
    while (steps < 5400) {
      qa.step(1/30, 30); steps += 30; last = qa.state();
      if (last.ended) { stuckAt = null; break; }
      if (prevZ != null && Math.abs(last.pos.z - prevZ) < 0.4) same++; else same = 0;
      if (same > 60 && stuckAt == null) stuckAt = { z: +last.pos.z.toFixed(1), x: +last.pos.x.toFixed(1), enemies: qa.diag().enemigosPos.filter((e) => Math.abs(e.z - last.pos.z) < 6) };
      prevZ = last.pos.z;
    }
    pasadas.push({ ok: !!last.ended, mode: last.mode, endZ: +last.pos.z.toFixed(1), stuck: stuckAt });
  }
  R.niveles['N' + (i + 1)] = pasadas;
}
R.errores = qa.data.errors.slice(0, 10);
qa.godMode(false);
return R;
