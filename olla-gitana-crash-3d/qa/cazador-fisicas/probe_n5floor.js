/* N5: ¿qué hay en el suelo en z 36-46? */
window.__qa.start(4);
for (let k = 0; k < 90; k++) window.__qa.step(1 / 30, 1);
const rows = [];
for (let z = 34; z <= 50; z += 0.5) {
  const probes = [];
  for (const x of [-4, -2, 0, 2, 4]) {
    for (const y of [0, 0.24, 0.6]) {
      const b = window.__qa.sonda(x, y + 0.15, z);
      if (b) probes.push(`${x}@${y}:${b.tag}(${b.pos.y.toFixed(2)}+-${b.half.y})`);
    }
  }
  rows.push({ z, probes });
}
return rows;
