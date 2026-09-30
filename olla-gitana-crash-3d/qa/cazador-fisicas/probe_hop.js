/* Mide el salto REAL del bot: cada vuelo (despegue -> aterrizaje) en N1 y N4.
   Devuelve distancias, si usa doble salto y la altura máxima. */
const res = [];
for (const idx of [0, 1, 3, 5]) {
  window.__qa.start(idx);
  window.__qa.enableBot();
  const flights = [];
  let prevG = false, takeZ = 0, takeX = 0, maxY = 0, doubleJump = false, prevJumps = 0;
  for (let i = 0; i < 3600; i++) {
    window.__qa.step(1 / 30, 1);
    const d = window.__qa.diag();
    const p = window.__qa.state().pos;
    const g = d.grounded;
    if (g) {
      if (!prevG && takeZ) {
        flights.push({ dz: +(p.z - takeZ).toFixed(2), maxY: +maxY.toFixed(2), dj: doubleJump, landY: +p.y.toFixed(2) });
        takeZ = 0;
      }
    } else {
      if (prevG) { takeZ = p.z; takeX = p.x; maxY = p.y; doubleJump = false; }
      else { maxY = Math.max(maxY, p.y); if (d.jumps >= 2) doubleJump = true; }
    }
    prevG = g; prevJumps = d.jumps;
    if (window.__qa.state().mode !== 'play') break;
  }
  const s = window.__qa.state();
  const d = flights.filter((f) => f.dz > 0.5);
  res.push({
    idx, mode: s.mode, z: +s.pos.z.toFixed(1), nFlights: d.length,
    maxDz: d.length ? Math.max(...d.map((f) => f.dz)) : null,
    avgDz: d.length ? +(d.reduce((a, f) => a + f.dz, 0) / d.length).toFixed(2) : null,
    djFlights: d.filter((f) => f.dj).length,
    big: d.filter((f) => f.dz > 4).slice(0, 12)
  });
}
return res;
