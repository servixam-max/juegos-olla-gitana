/* Estabilidad: 3 rondas independientes de los 8 niveles (como pidió verificar
   el usuario: start(i) + enableBot() + step(1/30, 4200)) */
const t0 = performance.now();
const out = [];
for (let ronda = 0; ronda < 3; ronda++) {
  const fila = [];
  for (let i = 0; i < 8; i++) {
    window.__qa.data.damageLog.length = 0;
    window.__qa.start(i);
    window.__qa.enableBot();
    for (let k = 0; k < 140 && window.__qa.state().mode === 'play'; k++) window.__qa.step(1 / 30, 30);
    let s = window.__qa.state();
    const ok = s.mode === 'end';
    fila.push({ i, id: s.levelId, mode: s.mode, ok, z: isFinite(s.pos.z) ? +s.pos.z.toFixed(1) : null, lives: s.lives });
  }
  out.push({ ronda: ronda + 1, fila, ok: fila.filter((f) => f.ok).length });
}
return { rondas: out, ms: Math.round(performance.now() - t0) };
