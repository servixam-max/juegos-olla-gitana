/* Traza detallada de caídas del bot: cada daño 'fall' con posición y modo.
   Solo en los niveles 0-2 (N1-N3). */
const out = [];
for (const idx of [0, 1, 2]) {
  window.__qa.data.damageLog.length = 0;
  window.__qa.start(idx);
  window.__qa.enableBot();
  // arrancar el nivel si está en cinemática de intro
  for (let i = 0; i < 600 && window.__qa.state().mode !== 'play'; i++) window.__qa.step(1 / 30, 1);
  const modes = [];
  let lastMode = null, maxZ = 0, steps = 0;
  for (let k = 0; k < 400; k++) {
    const s0 = window.__qa.state();
    if (s0.mode !== lastMode) { modes.push({ s: steps, mode: s0.mode, z: +s0.pos.z.toFixed(1), lives: s0.lives }); lastMode = s0.mode; }
    if (s0.mode !== 'play') { steps += 1; window.__qa.step(1 / 30, 1); continue; }
    window.__qa.step(1 / 30, 20); steps += 20;
    const s = window.__qa.state();
    maxZ = Math.max(maxZ, s.pos.z);
    if (s.mode !== 'play') break;
  }
  const s = window.__qa.state();
  out.push({
    idx, id: s.levelId, mode: s.mode, lives: s.lives, maxZ: +maxZ.toFixed(1), secs: +(steps / 30).toFixed(0),
    falls: window.__qa.data.damageLog.filter((d) => d.reason === 'fall'),
    modes, errs: window.__qa.data.errors.slice(0, 3)
  });
}
return out;
