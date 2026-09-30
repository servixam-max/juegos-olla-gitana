// Inspect ALL boxes near (0, 30) in N1 by rebuilding the level in-page.
const M = await import('/src/engine/physics.js');
const L = await import('/src/game/levels.js');
const R = {};
const scene = { add() {}, remove() {} };
const world = new M.World();
const fx = { addShake() {}, burst() {} };
let level;
try { level = L.LEVELS[0].build(world, scene, fx); } catch (e) { return { buildError: String(e) }; }
R.totalBoxes = world.boxes.length;
R.crates = level.crates.length;
R.boxesNear30 = world.boxes
  .filter((b) => Math.abs(b.pos.z - 30) <= 2 && b.pos.x >= -1.5 && b.pos.x <= 1.5)
  .map((b) => ({ tag: b.tag, pos: { x: +b.pos.x.toFixed(2), y: +b.pos.y.toFixed(2), z: +b.pos.z.toFixed(2) }, minY: +(b.pos.y - b.half.y).toFixed(3), maxY: +(b.pos.y + b.half.y).toFixed(3), solid: b.solid, hasMesh: !!b.mesh }));
// any box with min.y between 2.0 and 2.3 anywhere?
R.suspicious = world.boxes
  .filter((b) => (b.pos.y - b.half.y) > 2.0 && (b.pos.y - b.half.y) < 2.3 && Math.abs(b.pos.x) < 1.5 && Math.abs(b.pos.z - 30) < 3)
  .map((b) => ({ tag: b.tag, pos: { ...b.pos }, minY: +(b.pos.y - b.half.y).toFixed(3) }));
// count duplicates: same pos+size boxes
const key = (b) => `${b.pos.x.toFixed(2)}|${b.pos.y.toFixed(2)}|${b.pos.z.toFixed(2)}|${b.half.x}|${b.half.y}|${b.half.z}`;
const counts = {};
for (const b of world.boxes) counts[key(b)] = (counts[key(b)] || 0) + 1;
R.duplicateGroups = Object.entries(counts).filter(([, n]) => n > 1).length;
R.duplicatesSample = Object.entries(counts).filter(([, n]) => n > 1).slice(0, 8).map(([k, n]) => ({ k, n }));
R.crateTags = {};
for (const b of world.boxes) R.crateTags[b.tag] = (R.crateTags[b.tag] || 0) + 1;
return R;
