/* TRACE compacto: dónde termina el jugador con barrida+giro a tope en N1/N2/N5/N7
   y qué sólidos hay por la zona objetivo. Devuelve solo resumen (pocas líneas). */
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const P = () => qa.state().pos;
const R = { };

function run(levelIdx, zTest) {
  qa.start(levelIdx);
  qa.step(1/30, 10);
  qa.teleport(0, 0.05, zTest);
  qa.step(1/30, 20);
  const m0 = qa.moviles().filter((m) => Math.abs(m.pos.z - zTest) < 6);
  key('ArrowUp', true); key('KeyD', true);
  qa.step(1/30, 25);
  key('KeyC', true);
  let maxX = 0, minX = 0, minY = 99, maxY = -99, maxZ = -999;
  for (let i = 0; i < 100; i++) {
    qa.step(1/30, 1);
    const p = P();
    maxX = Math.max(maxX, p.x); minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    maxZ = Math.max(maxZ, p.z);
  }
  key('KeyC', false); key('KeyD', false); key('ArrowUp', false);
  const fin = { ...P() };
  // sólidos en el rango x 3..20 a la altura del pecho, z cerca del jugador
  const solidos = [];
  for (const x of [4, 5, 6, 6.5, 7, 7.5, 8, 10, 12, 15]) {
    const s = qa.sonda(x, 0.6, zTest);
    solidos.push([x, s ? s.tag : null, s ? +s.pos.x.toFixed(1) : null, s ? +s.half.x.toFixed(2) : null]);
  }
  // ¿hay suelo a esas x?
  const suelo = [];
  for (const x of [5, 6, 7, 8, 10, 12, 15]) {
    const g = qa.mapa(x, zTest, zTest + 1, 1);
    suelo.push([x, g && g[0] ? g[0][1] : null, g && g[0] ? g[0][2] : null]);
  }
  return { nivel: levelIdx + 1, z: zTest, maxX: +maxX.toFixed(2), minX: +minX.toFixed(2), minY: +minY.toFixed(2), maxY: +maxY.toFixed(2), fin: { x: +fin.x.toFixed(2), y: +fin.y.toFixed(2), z: +fin.z.toFixed(1) }, movilesZ: m0.map((m) => ({ tag: m.tag, x: +m.pos.x.toFixed(2), z: +m.pos.z.toFixed(0), mov: m.moving }) ), solidos, suelo };
}

R.N1 = run(0, 30);
R.N2 = run(1, 30);
R.N5 = run(4, 30);
R.N7 = run(6, 30);
R.errors = qa.data.errors.slice(0, 6);
qa.godMode(false);
return R;
