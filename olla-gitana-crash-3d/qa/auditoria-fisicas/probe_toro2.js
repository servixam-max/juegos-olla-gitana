/* TORO aislado: colocar al jugador UNA vez a 5 m del toro y observar el ciclo
   completo (paseo → aviso 1,7 s → embiste → aturde) sin teleports. */
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const R = {};
function toro(levelIdx, dz) {
  qa.start(levelIdx);
  qa.step(1/30, 5);
  const b0 = qa.diag().enemigosPos.find((e) => e.k === 'toro');
  qa.teleport(b0.x, 0.1, b0.z + dz);
  qa.step(1/30, 2);
  const traza = [];
  let vMax = 0, nAviso = 0, nEmb = 0, quieto = 0, prev = null;
  for (let i = 0; i < 900; i++) {
    qa.step(1/30, 1);
    const b = qa.diag().enemigosPos.find((e) => e.k === 'toro');
    if (!b) break;
    const v = prev ? Math.hypot(b.x - prev.x, b.z - prev.z) * 30 : 0;
    vMax = Math.max(vMax, v);
    if (v > 6) nEmb++;
    if (i % 15 === 0) traza.push([i, +b.x.toFixed(1), +b.z.toFixed(1), +v.toFixed(1)]);
    prev = b;
  }
  return { vMax: +vMax.toFixed(1), framesEmbistiendo: nEmb, traza: traza.slice(0, 30) };
}
R.toro_N1_dz5 = toro(0, 5);
R.toro_N2_dz5 = toro(1, 5);
R.errores = qa.data.errors.slice(0, 6);
qa.godMode(false);
return R;
