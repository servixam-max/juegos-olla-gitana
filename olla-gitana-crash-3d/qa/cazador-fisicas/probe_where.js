/* ¿Dónde mueren N2 y N7? Posiciones de cada daño */
const out = [];
for (const idx of [1, 6]) {
  window.__qa.data.damageLog.length = 0;
  window.__qa.start(idx);
  window.__qa.enableBot();
  window.__qa.step(1 / 30, 4200);
  const s = window.__qa.state();
  out.push({ idx, id: s.levelId, mode: s.mode, z: +s.pos.z.toFixed(1),
    dmg: window.__qa.data.damageLog.map((d) => `${d.reason}@z${d.z},x${d.x},y${d.y}`) });
}
return out;
