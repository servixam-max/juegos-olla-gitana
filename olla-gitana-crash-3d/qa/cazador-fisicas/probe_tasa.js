/* Tasa de éxito: 8 rondas completas del protocolo del usuario */
const out = [];
const cuenta = {};
for (let ronda = 0; ronda < 8; ronda++) {
  const fila = [];
  for (let i = 0; i < 8; i++) {
    window.__qa.start(i);
    window.__qa.enableBot();
    window.__qa.step(1 / 30, 4200);
    const s = window.__qa.state();
    const ok = s.mode === 'end';
    fila.push({ i, id: s.levelId, mode: s.mode, ok });
    const k = s.levelId;
    cuenta[k] = cuenta[k] || { ok: 0, n: 0 };
    cuenta[k].n++; if (ok) cuenta[k].ok++;
  }
  out.push({ ronda: ronda + 1, ok: fila.filter((f) => f.ok).length });
}
return { rondas: out, porNivel: cuenta };
