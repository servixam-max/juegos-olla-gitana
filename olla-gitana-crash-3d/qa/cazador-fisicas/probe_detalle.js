/* Longitudes y contenido de los 8 niveles, leído de las definiciones de nivel
   mediante startLevel + hooks (goal.z, notas, cajas, plataformas móviles). */
const out = [];
for (let i = 0; i < 8; i++) {
  window.__qa.start(i);
  const st = window.__qa.state();
  const d = window.__qa.diag();
  const mov = window.__qa.moviles();
  let goalZ = null;
  try { goalZ = window.__qa.goalZ ? window.__qa.goalZ() : null; } catch (e) {}
  out.push({
    idx: i, id: st.levelId, goalZ,
    solidas: d.solidas, plataformas_moviles: mov.length,
    mov_axis: mov.map((m) => m.moving.axis).join(','),
    cajas: d.cajas, enemigos: d.enemigos,
    notas_disponibles: window.__qa.notes().length
  });
}
return out;
