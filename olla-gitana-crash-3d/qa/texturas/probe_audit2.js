/* AUDITORÍA PRECISA: por nivel, agrupa las mallas de CAJA sin textura (map=null)
   por color y suma el área de la cara superior; lista las 8 cajas más grandes.
   Objetivo: saber qué superficies grandes siguen a color plano. */
const qa = window.__qa;
window.__recordPaused = true;
qa.godMode(true);
const S = window.__tex.scene();
const out = {};
for (const lv of [0, 1, 2, 3, 4, 5, 6, 7]) {
  qa.start(lv);
  qa.step(1 / 30, 2);
  const porColor = new Map();
  const grandes = [];
  let conMapa = 0, plano = 0, areaMap = 0;
  S.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const g = o.geometry;
    if (!g.parameters || g.type !== 'BoxGeometry') return;
    const p = g.parameters;
    const mat = o.material;
    const area = p.width * p.depth;
    if (mat.map) { conMapa++; areaMap += area; return; }
    plano++;
    const hex = mat.color ? '#' + mat.color.getHexString() : '?';
    const k = hex + (mat.transparent ? '/op' + mat.opacity : '');
    const e = porColor.get(k) || { n: 0, area: 0 };
    e.n++; e.area += area;
    porColor.set(k, e);
    if (area > 8 || p.height > 2.5) grandes.push([+p.width.toFixed(1), +p.height.toFixed(1), +p.depth.toFixed(1), hex, +o.position.x.toFixed(1), +o.position.y.toFixed(1), +o.position.z.toFixed(1)]);
  });
  grandes.sort((a, b) => (b[0] * b[2]) - (a[0] * a[2]));
  out['N' + (lv + 1)] = {
    id: qa.state().levelId, conMapa, plano, areaMap: Math.round(areaMap),
    porColor: [...porColor.entries()].sort((a, b) => b[1].area - a[1].area).slice(0, 8).map(([c, e]) => c + ' n=' + e.n + ' area=' + Math.round(e.area)),
    grandes: grandes.slice(0, 8)
  };
}
return out;
