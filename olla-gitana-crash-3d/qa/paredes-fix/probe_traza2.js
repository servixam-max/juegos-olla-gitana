/* Trazas exactas del cruce. Muro N1: x∈[5.0,6.2] (cara interior 5.0), jugador r=0.42 -> límite 4.58. */
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const up = (c) => key(c, false);
const allUp = () => ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyC', 'KeyX', 'Space'].forEach(up);
const R = {};

qa.start(0);
for (let i = 0; i < 900 && qa.state().mode !== 'play'; i++) qa.step(1 / 30, 1);

// --- T1: barrida diagonal contra el muro (caso d de rep1), dt=1/30, z=8 -> hueco en z~17-23
function t1(dt, nombre) {
  allUp();
  qa.teleport(0, 0.2, 8);
  qa.step(dt, 12);
  key('ArrowLeft', true); key('ArrowUp', true); key('KeyC', true);
  qa.step(dt, 2);
  const tr = [];
  for (let i = 0; i < 80; i++) {
    qa.step(dt, 1);
    const p = qa.state().pos, d = qa.diag();
    const s = qa.sonda(p.x, p.y + 0.6, p.z);
    tr.push([i, +p.x.toFixed(3), +p.z.toFixed(3), +p.y.toFixed(3), +d.vel.x.toFixed(2), +d.vel.z.toFixed(2), +d.vel.y.toFixed(2), d.grounded ? 1 : 0, s ? s.tag : '-']);
  }
  allUp();
  R[nombre] = { dt, tr, maxX: Math.max(...tr.map((r) => r[1])), finalPos: { ...qa.state().pos } };
}
t1(1 / 30, 'T1a_diag_dt30');
t1(0.05, 'T1b_diag_dt50');

// --- T2: recto a 17 m/s (slide + spin encadenado) contra el muro en z=40 (suelo continuo)
function t2(dt) {
  allUp();
  qa.teleport(0, 0.2, 40);
  qa.step(dt, 10);
  key('ArrowLeft', true); key('KeyC', true);
  qa.step(dt, 2);
  key('KeyX', true);   // giro con impulso sobre la barrida (17.25 m/s)
  qa.step(dt, 1); up('KeyX');
  const tr = [];
  for (let i = 0; i < 40; i++) {
    qa.step(dt, 1);
    const p = qa.state().pos, d = qa.diag();
    tr.push([i, +p.x.toFixed(3), +p.y.toFixed(3), +d.vel.x.toFixed(2), d.ground ? 1 : 0, qa.sonda(p.x, p.y + 0.6, p.z) ? 1 : 0]);
  }
  allUp();
  R['T2_recto_spin_dt' + (dt === 0.05 ? '50' : '30')] = { maxX: Math.max(...tr.map((r) => r[1])), tr: tr.filter((r, i) => i % 2 === 0) };
}
t2(0.05);

// --- T3: caída a lo largo de la cara del muro con input lateral, en z=30 (suelo continuo) y z=20 (hueco)
function t3(z, y, dt, nombre) {
  allUp();
  qa.teleport(4.3, y, z);
  qa.step(dt, 2);
  key('ArrowLeft', true);
  const tr = [];
  for (let i = 0; i < 70; i++) {
    qa.step(dt, 1);
    const p = qa.state().pos, d = qa.diag();
    tr.push([i, +p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(2), +d.vel.y.toFixed(1), d.grounded ? 1 : 0]);
  }
  allUp();
  R[nombre] = { maxX: Math.max(...tr.map((r) => r[1])), cruza5: tr.some((r) => r[1] > 5.0), tr: tr.filter((r, i) => i % 3 === 0) };
}
t3(30, 9, 0.05, 'T3a_caida_muro_z30');
t3(20, 9, 0.05, 'T3b_caida_muro_hueco_z20');

// --- T4: caída vertical a 30 m/s junto al muro y desplazamiento lateral (sin hueco: caída desde 40 m en z=30)
allUp();
qa.teleport(4.3, 40, 30);
qa.step(0.05, 2);
key('ArrowLeft', true);
{
  const tr = [];
  for (let i = 0; i < 90; i++) {
    qa.step(0.05, 1);
    const p = qa.state().pos, d = qa.diag();
    tr.push([i, +p.x.toFixed(3), +p.y.toFixed(2), +d.vel.y.toFixed(1), d.grounded ? 1 : 0]);
  }
  allUp();
  R.T4_caida40 = { maxX: Math.max(...tr.map((r) => r[1])), tr: tr.filter((r, i) => i % 4 === 0) };
}
R.errors = qa.data.errors.slice();
return R;
