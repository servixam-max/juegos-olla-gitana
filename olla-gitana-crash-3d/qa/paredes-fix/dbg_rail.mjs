/* Depuración del caso del barrote delgado (rail 0.14 m). */
import { Box, World, resolveActor } from '../../src/engine/physics.js';
import { Box as BoxA, World as WorldA, resolveActor as resolveA } from './antes/physics_antes.js';

function run(M, etq, { velx = 15, dt = 0.05, frames = 20, y0 = 2.9 }) {
  const { Box, World, resolveActor } = M;
  const world = new World();
  world.add(new Box({ x: 0, y: -0.3, z: 30, w: 13, h: 0.6, d: 60, tag: 'floor' }));
  world.add(new Box({ x: 4.6, y: 3.45, z: 30, w: 0.14, h: 1.1, d: 3.4, tag: 'rail' }));
  const a = { pos: { x: 3.4, y: y0, z: 30 }, vel: { x: velx, y: 0, z: 0 }, radius: 0.42, height: 1.25, grounded: false, groundBox: null, fell: false };
  const tr = [];
  for (let i = 0; i < frames; i++) {
    a.vel.x = velx; a.vel.y = Math.max(-30, a.vel.y - 30 * dt);
    resolveActor(a, world, dt);
    tr.push([i, +a.pos.x.toFixed(3), +a.pos.y.toFixed(3), +a.vel.y.toFixed(1), a.grounded ? 1 : 0]);
    if (a.pos.y < -1) break;
  }
  console.log(`\n[${etq}] velx=${velx} dt=${dt} y0=${y0}`);
  console.log(tr.map((r) => r.join(',')).join(' | '));
}
run({ Box: BoxA, World: WorldA, resolveActor: resolveA }, 'ANTES', {});
run({ Box, World, resolveActor }, 'AHORA', {});
// variante: el actor ya está a la altura y no cae (sin gravedad)
function runNoG(M, etq) {
  const { Box, World, resolveActor } = M;
  const world = new World();
  world.add(new Box({ x: 0, y: -0.3, z: 30, w: 13, h: 0.6, d: 60, tag: 'floor' }));
  world.add(new Box({ x: 4.6, y: 3.45, z: 30, w: 0.14, h: 1.1, d: 3.4, tag: 'rail' }));
  const a = { pos: { x: 3.4, y: 2.9, z: 30 }, vel: { x: 15, y: 0, z: 0 }, radius: 0.42, height: 1.25, grounded: false, groundBox: null, fell: false };
  const tr = [];
  for (let i = 0; i < 8; i++) {
    a.vel.x = 15; a.vel.y = 0;
    resolveActor(a, world, 0.05);
    tr.push([i, +a.pos.x.toFixed(3), +a.pos.y.toFixed(3), a.grounded ? 1 : 0]);
  }
  console.log(`\n[${etq}] sin gravedad (vel.y=0, sin caída)`);
  console.log(tr.map((r) => r.join(',')).join(' | '));
}
runNoG({ Box: BoxA, World: WorldA, resolveActor: resolveA }, 'ANTES');
runNoG({ Box, World, resolveActor }, 'AHORA');
