/* N2 y N6: traza de dónde se queda el bot (posición cada 5 s de partida) */
const out = [];
for (const idx of [1, 5]) {
  window.__qa.data.damageLog.length = 0;
  window.__qa.start(idx);
  window.__qa.enableBot();
  const marcas = [];
  for (let k = 0; k < 4200; k++) {
    window.__qa.step(1 / 30, 1);
    if (k % 150 === 0) {
      const s = window.__qa.state();
      marcas.push(`t${(k / 30) | 0}s z${s.pos.z.toFixed(0)} y${s.pos.y.toFixed(1)} v${s.lives}`);
    }
    if (window.__qa.state().mode !== 'play') break;
  }
  out.push({ idx, id: window.__qa.state().levelId, mode: window.__qa.state().mode, marcas,
    dmg: window.__qa.data.damageLog.map((d) => `${d.reason}@z${d.z},y${d.y}`).join(' ') });
}
return out;
