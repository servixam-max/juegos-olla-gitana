/* Reproduce el NaN de N2 y vuelca las plataformas móviles + estado */
function bad(v) { return !isFinite(v); }
const runs = [];
for (let r = 0; r < 6; r++) {
  window.__qa.start(1);
  window.__qa.enableBot();
  for (let i = 0; i < 600 && window.__qa.state().mode !== 'play'; i++) window.__qa.step(1 / 30, 1);
  let hit = null;
  for (let k = 0; k < 700; k++) {
    window.__qa.step(1 / 30, 10);
    const s = window.__qa.state();
    if (bad(s.pos.x) || bad(s.pos.y) || bad(s.pos.z)) {
      const mv = window.__qa.moviles();
      hit = {
        k, pos: s.pos, lives: s.lives,
        badMovers: mv.filter((m) => bad(m.pos.x) || bad(m.pos.y) || bad(m.pos.z)).map((m) => ({ tag: m.tag, pos: m.pos, moving: m.moving })),
        nMovers: mv.length,
        diag: window.__qa.diag(),
        dmg: window.__qa.data.damageLog.slice(-4)
      };
      break;
    }
    if (s.mode !== 'play') break;
  }
  runs.push(hit ? { r, hit } : { r, ok: true, z: +window.__qa.state().pos.z.toFixed(1), mode: window.__qa.state().mode });
}
return runs;
