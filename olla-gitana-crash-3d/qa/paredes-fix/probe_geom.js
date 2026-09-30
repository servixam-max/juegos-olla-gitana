/* Volcado de geometría en los puntos de penetración detectados por el cazador:
   N2 (3.66,1.05,57.5) tag platform; N5 (2.4,0.52,98.2); N6 (5.59,1.33,116.3) tag rama. */
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const R = {};
function dump(idx, x0, z0, nombre) {
  qa.start(idx);
  for (let i = 0; i < 900 && qa.state().mode !== 'play'; i++) qa.step(1 / 30, 1);
  const uniq = new Map();
  for (let dz = -1.5; dz <= 1.5; dz += 0.5) {
    for (let dx = -2; dx <= 2; dx += 0.25) {
      for (let y = 0.1; y <= 4.0; y += 0.2) {
        const s = qa.sonda(x0 + dx, y, z0 + dz);
        if (!s) continue;
        const k = `${s.tag}:${s.pos.x.toFixed(2)},${s.pos.y.toFixed(2)},${s.pos.z.toFixed(2)},${s.half.x.toFixed(2)},${s.half.y.toFixed(2)},${s.half.z.toFixed(2)}`;
        uniq.set(k, s);
      }
    }
  }
  R[nombre] = [...uniq.values()].map((s) => ({
    tag: s.tag, cx: +s.pos.x.toFixed(2), cy: +s.pos.y.toFixed(2), cz: +s.pos.z.toFixed(2),
    y0: +(s.pos.y - s.half.y).toFixed(2), y1: +(s.pos.y + s.half.y).toFixed(2),
    x0: +(s.pos.x - s.half.x).toFixed(2), x1: +(s.pos.x + s.half.x).toFixed(2)
  }));
}
dump(1, 3.66, 57.5, 'N2_z57');
dump(4, 2.4, 98.2, 'N5_z98');
dump(5, 5.59, 116.3, 'N6_z116');
return R;
