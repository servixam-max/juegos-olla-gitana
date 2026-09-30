// Dump all boxes near the N2 z=34 scaffold by rebuilding the level in a fake world.
const M = await import('/src/engine/physics.js');
const L = await import('/src/game/levels.js');
const scene = { add() {}, remove() {} };
const world = new M.World();
const fx = { addShake() {}, burst() {} };
L.LEVELS[1].build(world, scene, fx);   // N2
const near = world.boxes
  .filter((b) => Math.abs(b.pos.z - 34) < 3.5 && b.pos.x > 1.0 && b.pos.x < 5.5)
  .map((b) => ({ tag: b.tag, x: b.pos.x, y: b.pos.y, z: +b.pos.z.toFixed(2), minX: +(b.pos.x - b.half.x).toFixed(2), maxX: +(b.pos.x + b.half.x).toFixed(2), minY: +(b.pos.y - b.half.y).toFixed(2), maxY: +(b.pos.y + b.half.y).toFixed(2), minZ: +(b.pos.z - b.half.z).toFixed(2), maxZ: +(b.pos.z + b.half.z).toFixed(2) }));
return { near };
