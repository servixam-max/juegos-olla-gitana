/* CICLO DEL TORO Y DEL BLINDADO: detecta embestida (velocidad alta), aturdido
   (parado tras el trompazo) y que no se salga del escenario. Muestreo a 30 Hz. */
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const R = {};
function ciclo(levelIdx, kind, jugarCerca) {
  qa.start(levelIdx);
  qa.step(1/30, 10);
  // esperar a tener el bicho localizado y acercar al jugador para disparar
  let prev = null, embistiendo = false, embFrames = 0, maxV = 0, quedadas = 0, salidas = 0, minX = 99, maxX = -99, minZ = 1e9, maxZ = -1e9, aturdidoFrames = 0, aturdidoTrasEmbestida = false;
  const baseZ = [];
  for (let i = 0; i < 1500; i++) {
    const b = qa.diag().enemigosPos.find((e) => e.k === kind);
    if (!b) break;
    // acercar al jugador a 4 m por delante en z para provocar
    if (jugarCerca && i % 5 === 0) qa.teleport(b.x, 0.1, b.z + 4);
    qa.step(1/30, 1);
    const b2 = qa.diag().enemigosPos.find((e) => e.k === kind);
    if (!b2) break;
    const v = Math.hypot(b2.x - b.x, b2.z - b.z) * 30;
    maxV = Math.max(maxV, v);
    minX = Math.min(minX, b2.x); maxX = Math.max(maxX, b2.x);
    minZ = Math.min(minZ, b2.z); maxZ = Math.max(maxZ, b2.z);
    if (v > 6) { embistiendo = true; embFrames++; }
    if (embistiendo && v < 0.5) quedadas++;
    if (embistiendo && v > 6) aturdidoTrasEmbestida = false;
    prev = b2;
  }
  return { maxV: +maxV.toFixed(1), framesEmbestida: embFrames, framesQuieto: quedadas, x: [+minX.toFixed(1), +maxX.toFixed(1)], z: [+minZ.toFixed(1), +maxZ.toFixed(1)] };
}
R.toro_N1 = ciclo(0, 'toro', true);
R.toro_N2 = ciclo(1, 'toro', true);
R.blindado_N1 = ciclo(0, 'blindado', true);
R.blindado_N5 = ciclo(4, 'blindado', true);
R.errores = qa.data.errors.slice(0, 6);
qa.godMode(false);
return R;
