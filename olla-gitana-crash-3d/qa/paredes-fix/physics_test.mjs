/* Banco de pruebas de FÍSICA en node (física pura, sin navegador, determinista).
   Compara el resolutor ANTES (ad04c80, copia en antes/physics_antes.js) con el
   ACTUAL (src/engine/physics.js) y comprueba los invariantes que pide el encargo:
   ningún actor dentro de un sólido, ningún cruce de muro, ningún túnel por
   geometría delgada, aterrizajes correctos y estabilidad numérica.

   Uso: node qa/paredes-fix/physics_test.mjs [--verbose]
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '../../src/engine/physics.js');
const ANTES = join(here, 'antes/physics_antes.js');

const ANT = await import(ANTES);
const ACT = await import(SRC);

const mkActor = (x, y, z) => ({
  pos: { x, y, z }, vel: { x: 0, y: 0, z: 0 }, radius: 0.42, height: 1.25,
  grounded: false, groundBox: null, fell: false, hitCeiling: false
});
const mkWorld = (M, boxes) => { const w = new M.World(); for (const b of boxes) w.add(b); return w; };
/* muro de N1: x∈[5.0,6.2]; jugador r=0.42 -> límite 4.58 */
const muro = (M, z) => new M.Box({ x: 5.6, y: 2.7, z, w: 1.2, h: 5.4, d: 12, tag: 'wall' });
const suelo = (M, z, { w = 13, d = 60, y1 = 0 } = {}) => new M.Box({ x: 0, y: y1 - 0.3, z, w, h: 0.6, d, tag: 'floor' });
const barrote = (M, x, y, z, w = 0.14) => new M.Box({ x: x + w, y: y + 0.55, z, w: w, h: 1.1, d: 1.7, tag: 'rail' });

function dentroDe(a, world) {
  const r = a.radius, h = a.height;
  for (const b of world.boxes) {
    if (b.min.x < a.pos.x + r && b.max.x > a.pos.x - r &&
        b.min.y < a.pos.y + h && b.max.y > a.pos.y &&
        b.min.z < a.pos.z + r && b.max.z > a.pos.z - r) return b.tag;
  }
  return null;
}
function sim(M, boxes, actor, { dt = 1 / 30, frames = 60, input = null, gravedad = true } = {}) {
  const world = mkWorld(M, boxes);
  let maxX = -Infinity, minX = Infinity, maxY = -Infinity, dentro = 0, nan = false;
  for (let i = 0; i < frames; i++) {
    if (gravedad) actor.vel.y = Math.max(-30, actor.vel.y - 30 * dt);
    if (input) input(actor, i);
    M.resolveActor(actor, world, dt);
    if (!Number.isFinite(actor.pos.x) || !Number.isFinite(actor.pos.y) || !Number.isFinite(actor.pos.z)) nan = true;
    if (dentroDe(actor, world)) dentro++;
    maxX = Math.max(maxX, actor.pos.x); minX = Math.min(minX, actor.pos.x); maxY = Math.max(maxY, actor.pos.y);
  }
  return { maxX: +maxX.toFixed(3), minX: +minX.toFixed(3), maxY: +maxY.toFixed(3), dentro, nan, final: { ...actor.pos } };
}

const T = [];
let fallos = 0;
const check = (nombre, ok, detalle) => { T.push({ nombre, ok: !!ok, detalle }); if (!ok) fallos++; console.log(`${ok ? 'OK   ' : 'FALLO'} ${nombre}  —  ${detalle}`); };

console.log('\n=== 1. Caída pegada al muro empujando hacia él (mecanismo medido en navegador: x 4.58 -> 6.40) ===');
for (const [etq, M] of [['ANTES', ANT], ['AHORA', ACT]]) {
  const boxes = [suelo(M, 30, { d: 60 }), muro(M, 30)];
  const a = mkActor(4.3, 12, 30); a.vel.x = 8.4; a.vel.z = 8.4;
  const res = sim(M, boxes, a, { dt: 0.05, frames: 45, input: (ac) => { ac.vel.x = 8.4; ac.vel.z = 8.4; } });
  console.log(`  [${etq}] maxX=${res.maxX} dentro=${res.dentro} final=${JSON.stringify(res.final)}`);
  if (etq === 'ANTES') check('ANTES reproduce el bug: cruza el muro (maxX>5)', res.maxX > 5.0, `maxX=${res.maxX}`);
  else check('AHORA queda fuera del muro (maxX<=4.58) y 0 frames dentro', res.maxX <= 4.581 && res.dentro === 0, `maxX=${res.maxX} dentro=${res.dentro}`);
}

console.log('\n=== 2. Barrida diagonal a 15 m/s + caída contra el muro ===');
for (const [etq, M] of [['ANTES', ANT], ['AHORA', ACT]]) {
  const boxes = [suelo(M, 30, { d: 60 }), muro(M, 30)];
  const a = mkActor(3.0, 0.05, 26); a.vel.x = 10.6; a.vel.z = 10.6;
  const res = sim(M, boxes, a, { dt: 1 / 30, frames: 90, input: (ac) => { ac.vel.x = 10.6; ac.vel.z = 10.6; } });
  console.log(`  [${etq}] maxX=${res.maxX} dentro=${res.dentro}`);
  if (etq === 'ANTES') check('ANTES cruza el muro en diagonal (maxX>5)', res.maxX > 5.0, `maxX=${res.maxX}`);
  else check('AHORA la diagonal se para en la cara', res.maxX <= 4.581 && res.dentro === 0, `maxX=${res.maxX} dentro=${res.dentro}`);
}

console.log('\n=== 3. Túnel por geometría delgada: barrote de 0.14 m a 15 m/s y dt 0.05 (paso 0.75 m) ===');
for (const [etq, M] of [['ANTES', ANT], ['AHORA', ACT]]) {
  const boxes = [suelo(M, 30, { d: 60 }), barrote(M, 4.5, 0.5, 30)];
  const a = mkActor(0, 0.6, 30); a.vel.x = 15; a.vel.z = 0;
  // sin gravedad: se aísla el barrido lateral (el barrote está a media altura)
  const res = sim(M, boxes, a, { dt: 0.05, frames: 20, gravedad: false, input: (ac) => { ac.vel.x = 15; ac.vel.y = 0; } });
  console.log(`  [${etq}] maxX=${res.maxX} final=${JSON.stringify(res.final)}`);
  if (etq === 'ANTES') check('ANTES atraviesa el barrote delgado (maxX>4.6)', res.maxX > 4.6, `maxX=${res.maxX}`);
  else check('AHORA el barrote bloquea (maxX<=4.08)', res.maxX <= 4.08 + 0.02, `maxX=${res.maxX}`);
}

console.log('\n=== 4. Caída de 15 m sobre el borde de una plataforma gruesa (aterrizaje correcto) ===');
for (const [etq, M] of [['ANTES', ANT], ['AHORA', ACT]]) {
  const boxes = [suelo(M, 30, { d: 60 }), new M.Box({ x: 0, y: 3.0, z: 40, w: 5.4, h: 0.6, d: 20, tag: 'plataforma' })];
  const a = mkActor(2.4, 15, 40); a.vel.x = 0; a.vel.z = 0;
  const res = sim(M, boxes, a, { dt: 0.05, frames: 45, input: (ac) => { ac.vel.x = 0; } });
  console.log(`  [${etq}] final=${JSON.stringify(res.final)} dentro=${res.dentro}`);
  check(`caída al borde (${etq}): aterriza sobre la plataforma (y≈3.0) sin quedar dentro`,
    !res.nan && res.dentro === 0 && Math.abs(res.final.y - 3.0) < 0.01,
    `final.y=${res.final.y} dentro=${res.dentro}`);
}

console.log('\n=== 5. Cabezazo contra techo (no debe atravesar ni eyectar hacia arriba) ===');
for (const [etq, M] of [['ANTES', ANT], ['AHORA', ACT]]) {
  const boxes = [suelo(M, 30, { d: 60 }), new M.Box({ x: 0, y: 4.6, z: 30, w: 11.2, h: 0.5, d: 16, tag: 'roof' })];
  const a = mkActor(0, 0.05, 30);
  const res = sim(M, boxes, a, { dt: 1 / 30, frames: 60, input: (ac, i) => { if (i < 6) ac.vel.y = 10.6; } });
  console.log(`  [${etq}] maxY=${res.maxY} dentro=${res.dentro}`);
  check(`cabezazo (${etq}): no atraviesa el techo (maxY<=4.6) ni queda dentro`, res.maxY <= 4.6 + 0.001 && res.dentro === 0, `maxY=${res.maxY} dentro=${res.dentro}`);
}

console.log('\n=== 6. Caída de 40 m a 30 m/s: no debe atravesar el suelo ===');
for (const [etq, M] of [['ANTES', ANT], ['AHORA', ACT]]) {
  const a = mkActor(0, 40, 30);
  const res = sim(M, [suelo(M, 30, { d: 60 })], a, { dt: 0.05, frames: 60 });
  console.log(`  [${etq}] final.y=${res.final.y} dentro=${res.dentro}`);
  check(`caída 40 m (${etq}): aterriza sin hundirse`, res.final.y >= -0.001 && res.final.y < 0.01 && res.dentro === 0, `y=${res.final.y}`);
}

console.log('\n=== 7. El actor debe poder SUBIR a una plataforma de 2.2 m (sin regresión) ===');
for (const [etq, M] of [['ANTES', ANT], ['AHORA', ACT]]) {
  const boxes = [suelo(M, 30, { d: 60 }), new M.Box({ x: 0, y: 2.5, z: 32, w: 6, h: 0.6, d: 6, tag: 'plataforma' })];
  const a = mkActor(0, 0.0, 26); a.vel.z = 4;
  const res = sim(M, boxes, a, { dt: 1 / 30, frames: 150, input: (ac, i) => { ac.vel.z = 4; if (i === 4 || i === 30) ac.vel.y = 10.6; } });
  console.log(`  [${etq}] final=${JSON.stringify(res.final)}`);
  check(`sube a la plataforma 2,2 m (${etq})`, res.final.y > 2.1 && res.dentro === 0, `y=${res.final.y}`);
}

console.log('\n=== 8. Caída junto al muro (mecanismo exacto del navegador: z=30 sin hueco) ===');
for (const [etq, M] of [['ANTES', ANT], ['AHORA', ACT]]) {
  const boxes = [suelo(M, 30, { d: 60 }), muro(M, 30)];
  const a = mkActor(4.3, 9, 30); a.vel.z = 6;
  const res = sim(M, boxes, a, { dt: 0.05, frames: 60, input: (ac) => { ac.vel.x = 6; ac.vel.z = 6; } });
  console.log(`  [${etq}] maxX=${res.maxX} minX=${res.minX} final=${JSON.stringify(res.final)}`);
  if (etq === 'ANTES') check('ANTES cruza la cara del muro (maxX>5)', res.maxX > 5.0, `maxX=${res.maxX}`);
  else check('AHORA se queda en la cara (maxX<=4.58) sin quedar dentro', res.maxX <= 4.581 && res.dentro === 0, `maxX=${res.maxX}`);
}

console.log('\n=== 9. Estrés 2000 frames con velocidades del juego: sin NaN ni penetraciones persistentes ===');
{
  const M = ACT;
  const boxes = [suelo(M, 30, { d: 60 }), muro(M, 30), muro(M, 60), barrote(M, 3.0, 1.0, 40), new M.Box({ x: 0, y: 3.0, z: 48, w: 5.4, h: 0.6, d: 8, tag: 'plataforma' })];
  const a = mkActor(0, 0.05, 24);
  const res = sim(M, boxes, a, {
    dt: 1 / 30, frames: 2000,
    input: (ac, i) => { const t = i / 30; ac.vel.x = Math.sin(t * 2.1) * 15; ac.vel.z = Math.cos(t * 1.7) * 12; if (i % 40 === 0) ac.vel.y = 10.6; }
  });
  check('estrés: sin NaN y 0 frames dentro', !res.nan && res.dentro === 0, `nan=${res.nan} dentro=${res.dentro} final=${JSON.stringify(res.final)}`);
}

console.log('\n=== 10. Rendimiento con 165 sólidos ===');
{
  const M = ACT;
  const boxes = [];
  for (let i = 0; i < 165; i++) boxes.push(suelo(M, 20 + (i % 12) * 6, { w: 10, d: 5 }));
  const world = mkWorld(M, boxes);
  const a = mkActor(0, 0.05, 24);
  const N = 20000;
  const t0 = performance.now();
  for (let i = 0; i < N; i++) { a.vel.x = (i % 60) - 30; a.vel.z = ((i * 7) % 60) - 30; M.resolveActor(a, world, 1 / 30); }
  const ms = (performance.now() - t0) / N;
  console.log(`  ${ms.toFixed(4)} ms/llamada (antes: 0,019-0,025 ms/frame típico)`);
  check('rendimiento < 0.2 ms/llamada', ms < 0.2, `${ms.toFixed(4)} ms`);
}

const ok = T.filter((t) => t.ok).length;
console.log(`\n==== ${ok}/${T.length} pruebas OK ====`);
writeFileSync(join(here, 'physics_test_resultado.json'), JSON.stringify({ fecha: new Date().toISOString(), pruebas: T, ok, total: T.length }, null, 2));
process.exit(fallos ? 1 : 0);
