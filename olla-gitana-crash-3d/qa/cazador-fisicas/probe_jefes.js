/* N5 y N8: modo final y por qué (para separar culpa del rediseño de niveles
   del rework de jefes que está haciendo otro agente en paralelo) */
const out = [];
for (const idx of [4, 7]) {
  window.__qa.start(idx);
  window.__qa.enableBot();
  const traza = [];
  for (let k = 0; k < 4200; k++) {
    window.__qa.step(1 / 30, 1);
    if (k % 600 === 0) {
      const s = window.__qa.state();
      traza.push(`t${(k / 30) | 0}s z${s.pos.z.toFixed(0)} modo:${s.mode} v${s.lives} ${s.boss ? JSON.stringify(s.boss) : ''}${s.ferminPending ? ' ferminPending' : ''}`);
    }
    if (window.__qa.state().mode !== 'play' && window.__qa.state().mode !== 'cine') break;
  }
  const s = window.__qa.state();
  out.push({ idx, id: s.levelId, mode: s.mode, z: +s.pos.z.toFixed(1), boss: s.boss, ferminPending: s.ferminPending, traza });
}
return out;
