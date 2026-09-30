/* CAZADOR de penetraciones: corre el bot en cada nivel y detecta frames donde
   el jugador está DENTRO de un sólido o da un salto de posición anómalo.
   Un frame "dentro" = __qa.sonda (caja ±0.2) sobre el centro del actor (pies+0.6)
   o a la altura de la cabeza (pies+1.1) devuelve caja. */
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const out = [];
const probe = (p, dy) => { const s = qa.sonda(p.x, p.y + dy, p.z); return s ? s.tag : null; };

for (let i = 0; i < 8; i++) {
  qa.start(i);
  qa.enableBot();
  qa.step(1 / 30, 20);
  let dentro = 0, saltos = 0, maxDx = 0, maxDz = 0, muestras = [];
  let prev = { ...qa.state().pos };
  const t0 = performance.now();
  for (let f = 0; f < 8000; f++) {
    qa.step(1 / 30, 1);
    const p = qa.state().pos;
    const s1 = probe(p, 0.6), s2 = probe(p, 1.1);
    if (s1 || s2) {
      dentro++;
      if (muestras.length < 8) muestras.push({ f, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(1), tag: s1 || s2, vx: +qa.diag().vel.x.toFixed(1), vz: +qa.diag().vel.z.toFixed(1), g: qa.diag().grounded });
    }
    const dx = Math.abs(p.x - prev.x), dz = Math.abs(p.z - prev.z);
    if (dx > 1.2 || dz > 1.6) { saltos++; if (muestras.length < 8) muestras.push({ f, tipo: 'salto', dx: +dx.toFixed(2), dz: +dz.toFixed(2), x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(1) }); }
    maxDx = Math.max(maxDx, dx); maxDz = Math.max(maxDz, dz);
    prev = { ...p };
    if (qa.state().mode !== 'play') break;
  }
  const st = qa.state();
  out.push({
    nivel: i + 1, id: st.levelId, mode: st.mode, z: +st.pos.z.toFixed(1),
    framesDentroSolido: dentro, saltosPosicion: saltos, maxDx: +maxDx.toFixed(2), maxDz: +maxDz.toFixed(2),
    muestras, ms: Math.round(performance.now() - t0), errores: qa.data.errors.slice(0, 3)
  });
}
return out;
