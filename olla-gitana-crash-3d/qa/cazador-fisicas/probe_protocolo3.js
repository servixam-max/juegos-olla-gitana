/* Protocolo del usuario, 3 rondas seguidas: start(i)+enableBot()+step(1/30,4200) */
const out = [];
for (let ronda = 0; ronda < 3; ronda++) {
  const f = [];
  for (let i = 0; i < 8; i++) {
    window.__qa.data.damageLog.length = 0;
    window.__qa.start(i);
    window.__qa.enableBot();
    window.__qa.step(1 / 30, 4200);
    const s = window.__qa.state();
    f.push({ i, id: s.levelId, mode: s.mode, ok: s.mode === 'end', lives: s.lives, z: isFinite(s.pos.z) ? +s.pos.z.toFixed(1) : null });
  }
  out.push({ ronda: ronda + 1, ok: f.filter((x) => x.ok).length, fila: f });
}
return out;
