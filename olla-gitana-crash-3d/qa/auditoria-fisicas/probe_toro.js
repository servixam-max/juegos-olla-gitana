/* TRACE TORO (N3 y N1): colocamos al jugador para disparar la embestida y
   medimos trayectoria, si cruza curb/muro y si se aturde.
   También lista enemigos de suelo DENTRO de un sólido o sin suelo, con coords. */
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const P = () => qa.state().pos;
const R = { toroN3: {}, toroN1: {}, atascos: {} };

function toroTrace(levelIdx, playerZ, out) {
  qa.start(levelIdx);
  qa.step(1/30, 10);
  qa.teleport(0, 0.1, playerZ);
  qa.step(1/30, 5);
  const t0 = qa.diag().enemigosPos.find((e) => e.k === 'toro');
  const traza = [];
  let estados = new Set();
  for (let i = 0; i < 900; i++) {
    qa.step(1/30, 1);
    const t = qa.diag().enemigosPos.find((e) => e.k === 'toro');
    if (!t) break;
    if (i % 10 === 0) traza.push([+t.x.toFixed(1), +t.y.toFixed(2), +t.z.toFixed(1)]);
    const s = qa.sonda(t.x, t.y + 0.5, t.z);
    if (s) estados.add('DENTRO:' + s.tag + '@i' + i);
  }
  out.inicio = t0;
  out.traza = traza.filter((_, i) => i % 3 === 0).slice(0, 40);
  out.dentro = [...estados].slice(0, 6);
  out.fin = qa.diag().enemigosPos.find((e) => e.k === 'toro');
}
toroTrace(2, 30, R.toroN3);
toroTrace(0, 30, R.toroN1);

// enemigos de suelo empotrados o flotando: coordenadas concretas
for (const [li, zMin] of [[0, 0], [4, 0]]) {
  qa.start(li);
  qa.step(1/30, 5);
  const casos = {};
  for (let f = 0; f < 900; f += 10) {
    qa.step(1/30, 10);
    for (const e of qa.diag().enemigosPos) {
      if (!['patrol', 'blindado', 'toro', 'roller', 'barril'].includes(e.k)) continue;
      const s = qa.sonda(e.x, e.y + 0.5, e.z);
      if (s) {
        const key = e.k + '@' + s.tag;
        if (!casos[key]) casos[key] = { n: 0, ej: [] };
        casos[key].n++;
        if (casos[key].ej.length < 4) casos[key].ej.push([+e.x.toFixed(1), +e.y.toFixed(2), +e.z.toFixed(1)]);
      }
    }
  }
  R['atascos_N' + (li + 1)] = casos;
}
R.errors = qa.data.errors.slice(0, 6);
qa.godMode(false);
return R;
