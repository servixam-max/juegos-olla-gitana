/* Mapa de suelo por nivel: recorre z en pasos de 0.5 y dice si hay algo sólido
   justo a ras de suelo (y≈0.3) o una plataforma elevada (y=1..5).
   Sirve para detectar tramos sin suelo donde el jugador cae. */
const out = [];
for (let i = 0; i < 8; i++) {
  window.__qa.start(i);
  for (let k = 0; k < 200; k++) window.__qa.step(1 / 30, 1);
  const L = window.__qa.state().mode === 'play' ? 320 : 320;
  const rows = [];
  for (let z = 0; z <= 310; z += 2) {
    const low = window.__qa.sonda(0, 0.2, z);       // suelo a ras
    const lowL = window.__qa.sonda(-2.5, 0.2, z);
    const lowR = window.__qa.sonda(2.5, 0.2, z);
    const hi = window.__qa.sonda(0, 1.6, z) || window.__qa.sonda(0, 2.6, z) || window.__qa.sonda(0, 3.9, z);
    rows.push({ z, low: low ? low.tag : null, hi: hi ? hi.tag + '@' + (+hi.pos.y.toFixed(1)) : null, sides: (lowL ? 1 : 0) + (lowR ? 1 : 0) });
  }
  const holes = rows.filter((r) => !r.low && !r.hi).map((r) => r.z);
  out.push({ idx: i, id: window.__qa.state().levelId, holes, nHoles: holes.length });
}
return out;
