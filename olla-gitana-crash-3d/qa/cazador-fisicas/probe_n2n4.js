/* N2 y N4, 5 corridas cada uno: dónde muere y por qué */
const out = [];
for (let run = 0; run < 5; run++) {
  for (const idx of [1, 3]) {
    window.__qa.data.damageLog.length = 0;
    window.__qa.start(idx);
    window.__qa.enableBot();
    window.__qa.step(1 / 30, 4200);
    const s = window.__qa.state();
    out.push({ run, idx, id: s.levelId, mode: s.mode, z: isFinite(s.pos.z) ? +s.pos.z.toFixed(1) : null,
      dmg: window.__qa.data.damageLog.map((d) => `${d.reason}@z${d.z}`).join(' ') });
  }
}
return out;
