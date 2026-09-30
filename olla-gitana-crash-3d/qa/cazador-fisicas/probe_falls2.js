/* Caídas del bot con POSICIÓN (N1-N3) + traza del punto exacto */
const out = [];
for (const idx of [0, 1, 2]) {
  window.__qa.data.damageLog.length = 0;
  window.__qa.start(idx);
  window.__qa.enableBot();
  for (let i = 0; i < 600 && window.__qa.state().mode !== 'play'; i++) window.__qa.step(1 / 30, 1);
  let maxZ = 0, steps = 0;
  for (let k = 0; k < 300 && window.__qa.state().mode === 'play'; k++) {
    window.__qa.step(1 / 30, 20); steps += 20;
    const s = window.__qa.state();
    if (isFinite(s.pos.z)) maxZ = Math.max(maxZ, s.pos.z);
  }
  const s = window.__qa.state();
  out.push({
    idx, id: s.levelId, mode: s.mode, lives: s.lives, maxZ: +maxZ.toFixed(1), secs: +(steps / 30).toFixed(0),
    dmg: window.__qa.data.damageLog.map((d) => d.reason + '@' + d.z + ',' + d.x),
    lastPos: { x: +s.pos.x.toFixed(2), y: +s.pos.y.toFixed(2), z: +s.pos.z.toFixed(2) }
  });
}
return out;
