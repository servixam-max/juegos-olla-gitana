/* CONTACTO DE ENEMIGOS: (a) pegado a un enemigo → daño; (b) a 3 m → 0 daños en
   5 s; (c) a 2 m con escudo/girando. Registra damageLog para probar "daño solo
   por contacto real". */
const qa = window.__qa;
window.__recordPaused = true;
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const P = () => qa.state().pos;
const S = () => qa.state();
const D = () => qa.diag();
const sleep = (n) => qa.step(1/30, n);
const R = { casos: {} };
qa.godMode(false);
localStorage.removeItem('olla3d_progreso_v1');
qa.start(0);
sleep(8);
const baseLog = qa.data.damageLog.length;

// (a) LEJOS: patrulla en z=26; ponerse a 3 m de su x (la patrulla recorre ±2.5)
function lejos(dz) {
  qa.start(0);
  sleep(8);
  const e = qa.diag().enemigosPos[0];
  const marcador = qa.data.damageLog.length;
  let vidasAntes = S().lives;
  for (let i = 0; i < 150; i++) {
    const es = qa.diag().enemigosPos.filter((x) => x.k === 'patrol');
    const e0 = es[0];
    if (e0) qa.teleport(e0.x + dz, 0.1, e0.z);
    sleep(2);
  }
  return { vidas: S().lives, vidasAntes, danoEnemigo: qa.data.damageLog.slice(marcador).filter((d) => d.reason === 'enemy').length, log: qa.data.damageLog.slice(marcador).slice(0, 3) };
}
R.casos.a_3m = lejos(3);
// (b) A 1.5 m: fuera del alcance (dx<0.75 && dz<0.75)
R.casos.b_1_5m = lejos(1.5);
// (c) PEGADO encima: dx 0, dz 0 → debe dañar
qa.start(0);
sleep(8);
{
  const marcador = qa.data.damageLog.length;
  let vidasAntes = S().lives;
  for (let i = 0; i < 150; i++) {
    const es = qa.diag().enemigosPos.filter((x) => x.k === 'patrol');
    if (es[0]) qa.teleport(es[0].x, 0.1, es[0].z);
    sleep(2);
    if (S().lives < vidasAntes) break;
  }
  R.casos.c_pegado = { vidasAntes, vidas: S().lives, dano: qa.data.damageLog.slice(marcador).slice(0, 4) };
}
// (d) girando: el enemigo muere al contacto
qa.start(0);
sleep(8);
{
  const antes = qa.diag().enemigosDetalle.filter((x) => x === 'patrol').length;
  key('KeyX', true);
  for (let i = 0; i < 200; i++) {
    const es = qa.diag().enemigosPos.filter((x) => x.k === 'patrol');
    if (es[0]) qa.teleport(es[0].x, 0.1, es[0].z);
    key('KeyX', true);
    sleep(2);
    if (qa.diag().enemigosDetalle.filter((x) => x === 'patrol').length < antes) break;
  }
  key('KeyX', false);
  R.casos.d_girando = { patrullasAntes: antes, patrullasAhora: qa.diag().enemigosDetalle.filter((x) => x === 'patrol').length, vidas: S().lives };
}
R.errors = qa.data.errors.slice(0, 6);
return R;
