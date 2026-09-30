/* Físicas propias: colisión AABB contra cajas estáticas y plataformas móviles.
   El jugador se trata como una cápsula aproximada por un cilindro -> AABB
   resuelta por ejes (X, Z, Y) para que los deslizamientos laterales funcionen. */

export class Box {
  constructor({ x, y, z, w, h, d, solid = true, tag = '', mat = null }) {
    this.pos = { x, y, z };      // centro
    this.half = { x: w / 2, y: h / 2, z: d / 2 };
    this.base = { x, y, z };
    this.prevPos = { x, y, z };  // posición del frame anterior (plataformas móviles)
    this.solid = solid;
    this.tag = tag;
    this.mat = mat;
    this.moving = null;          // { axis, amp, speed, phase }
    this.t = Math.random() * 100;
  }
  get min() { return { x: this.pos.x - this.half.x, y: this.pos.y - this.half.y, z: this.pos.z - this.half.z }; }
  get max() { return { x: this.pos.x + this.half.x, y: this.pos.y + this.half.y, z: this.pos.z + this.half.z }; }
  update(dt) {
    this.t += dt;
    if (this.moving) {
      const { axis, amp, speed, phase = 0 } = this.moving;
      this.prevPos.x = this.pos.x; this.prevPos.y = this.pos.y; this.prevPos.z = this.pos.z;
      const off = Math.sin(this.t * speed + phase) * amp;
      this.pos[axis] = this.base[axis] + off;
      if (this.mat) {
        this.mat.position.x = this.pos.x;
        this.mat.position.y = this.pos.y;
        this.mat.position.z = this.pos.z;
      }
    }
  }
}

/* ¿participa esta caja en la colisión? Las cajas ROTAS o REBOTANDO siguen en
   world.boxes (el item del CrateSystem ES una caja física y main.js añade un
   duplicado "crateBody" con crateRef): si no se filtran, dejan un colisionador
   fantasma invisible con el que el jugador choca o sobre el que se queda
   flotando. */
function collides(b) {
  if (!b.solid) return false;
  if (b.dead || b.bouncing) return false;                                       // item de caja rota / rebotando
  if (b.crateRef && (b.crateRef.dead || b.crateRef.bouncing)) return false;     // duplicado crateBody de main.js
  return true;
}

/* Depenetración: si el actor arranca DENTRO de un sólido (teleport de QA, una
   plataforma que sube, una explosión), lo saca por el lado más cercano. Sin
   esto el resolutor por ejes lo expulsaba al lado CONTRARIO (p. ej. empujar +Z
   dentro de un muro teletransportaba 6 m hacia atrás, al vacío). */
const DEPEN_EPS = 0.015;
function depenetrate(actor, world, r, h) {
  for (let pass = 0; pass < 3; pass++) {
    let fixed = false;
    for (const b of world.boxes) {
      if (!collides(b)) continue;
      const mn = b.min, mx = b.max, p = actor.pos;
      const penXL = (p.x + r) - mn.x;    // salir por la izquierda (x menor)
      const penXR = mx.x - (p.x - r);    // salir por la derecha
      const penZL = (p.z + r) - mn.z;
      const penZR = mx.z - (p.z - r);
      const penYU = mx.y - p.y;          // subir (pies al tope)
      const penYD = (p.y + h) - mn.y;    // bajar (cabeza al suelo)
      if (penXL <= 0 || penXR <= 0 || penZL <= 0 || penZR <= 0 || penYU <= 0 || penYD <= 0) continue;
      const ax = Math.min(penXL, penXR), az = Math.min(penZL, penZR), ay = Math.min(penYU, penYD);
      if (Math.min(ax, az, ay) <= DEPEN_EPS) continue;
      // candidatos de salida; empate → el que deje suelo debajo (así un muro
      // te saca a la calle, no al vacío exterior)
      const cands = [
        { axis: 'y', v: mx.y, d: penYU },
        { axis: 'y', v: mn.y - h, d: penYD },
        { axis: 'x', v: mn.x - r, d: penXL },
        { axis: 'x', v: mx.x + r, d: penXR },
        { axis: 'z', v: mn.z - r, d: penZL },
        { axis: 'z', v: mx.z + r, d: penZR }
      ];
      cands.sort((a, c) => a.d - c.d);
      // candidato preferido: el más cercano que deje suelo bajo los pies y no
      // sea mucho más largo que el mínimo (banda de 0.6 m) → un muro te saca a
      // la calle y un tranvía que te barre te empuja al lado o te sube encima,
      // pero nunca te lanza al vacío.
      const d0 = cands[0].d;
      let pick = cands[0];
      for (const c of cands) {
        if (c.d > d0 + 0.6) break;
        const nx = c.axis === 'x' ? c.v : p.x;
        const ny = c.axis === 'y' ? c.v : p.y;
        const nz = c.axis === 'z' ? c.v : p.z;
        const sup = world.groundUnder({ minX: nx - 0.1, maxX: nx + 0.1, minZ: nz - 0.1, maxZ: nz + 0.1, minY: -50, maxY: ny + 0.05 });
        if (sup) { pick = c; break; }
      }
      if (pick.axis === 'x') p.x = pick.v;
      else if (pick.axis === 'z') p.z = pick.v;
      else p.y = pick.v;
      fixed = true;
    }
    if (!fixed) break;
  }
}

export class World {
  constructor() {
    this.boxes = [];
    this.decor = [];
    this.killY = -18;
  }
  add(box) { this.boxes.push(box); return box; }
  update(dt) { for (const b of this.boxes) b.update(dt); }

  /* Devuelve la caja con la que solapa el AABB dado (opcionalmente filtrando) */
  overlap(aabb, filter) {
    for (const b of this.boxes) {
      if (!collides(b)) continue;
      if (filter && !filter(b)) continue;
      const mn = b.min, mx = b.max;
      if (aabb.maxX > mn.x && aabb.minX < mx.x &&
          aabb.maxY > mn.y && aabb.minY < mx.y &&
          aabb.maxZ > mn.z && aabb.minZ < mx.z) return b;
    }
    return null;
  }
  /* Suelo bajo un AABB. `aabb.maxY` (o `at` si se pasa) es la altura de
     referencia: devuelve la caja sólida más alta cuyo techo queda a esa altura
     o por debajo (+0.14 de tolerancia). ANTES comparaba contra `minY`, así que
     las llamadas con minY:-50 (sombra del jugador, suelo pulido del Casino,
     comprobaciones del bot) devolvían SIEMPRE null y esas funciones quedaban
     muertas en silencio. */
  groundUnder(aabb, at = null) {
    let best = null, bestTop = -Infinity;
    const ref = at != null ? at : aabb.maxY;
    for (const b of this.boxes) {
      if (!collides(b)) continue;
      const mn = b.min, mx = b.max;
      if (aabb.maxX > mn.x && aabb.minX < mx.x && aabb.maxZ > mn.z && aabb.minZ < mx.z) {
        const top = mx.y;
        if (top <= ref + 0.14 && top > bestTop) { bestTop = top; best = b; }
      }
    }
    return best ? { box: best, top: bestTop } : null;
  }
}

/* ---------- colisión y resolución del actor contra el mundo ---------- */
export function resolveActor(actor, world, dt, { onLand = null, onHitWall = null } = {}) {
  const r = actor.radius, h = actor.height;
  const prevGround = actor.grounded;

  // 1) plataforma móvil: arrastra al actor ANTES de resolver.
  //    Antes se aplicaba el delta DESPUÉS de apoyar los pies en el techo de la
  //    plataforma -> se contaba dos veces y generaba temblor de ±1 frame.
  //    (nada de arrastre en el frame del salto: vel.y>0 ⇒ el actor se suelta)
  if (actor.grounded && actor.groundBox && actor.groundBox.moving && actor.vel.y <= 0.01) {
    const b = actor.groundBox;
    actor.pos.x += b.pos.x - b.prevPos.x;
    actor.pos.y += b.pos.y - b.prevPos.y;
    actor.pos.z += b.pos.z - b.prevPos.z;
  }

  // 0) si arranca DENTRO de un sólido (teleport, plataforma que sube, caja que
  //    se materializa), sácalo por el lado más cercano ANTES de resolver
  //    (DESPUÉS del arrastre: así la plataforma que te sostiene no cuenta dos veces)
  depenetrate(actor, world, r, h);

  const feetY = actor.pos.y;
  const aabb = {
    minX: actor.pos.x - r, maxX: actor.pos.x + r,
    minZ: actor.pos.z - r, maxZ: actor.pos.z + r,
    minY: feetY, maxY: feetY + h
  };

  // ---- Eje Y: subir/bajar ---- (elige el techo MÁS ALTO al aterrizar: con
  // pilas de cajas y plataformas superpuestas el orden no debe importar)
  let grounded = false, groundBox = null;
  const dy = actor.vel.y * dt;
  const nextY = feetY + dy;
  const yBox = { ...aabb, minY: nextY, maxY: nextY + h };
  let landTop = -Infinity, ceilBase = Infinity, ceilBox = null;
  for (const b of world.boxes) {
    if (!collides(b)) continue;
    const mn = b.min, mx = b.max;
    if (yBox.maxX <= mn.x || yBox.minX >= mx.x || yBox.maxZ <= mn.z || yBox.minZ >= mx.z) continue;
    if (dy <= 0 && feetY >= mx.y - 0.02 && nextY <= mx.y) {
      // aterrizaje encima (se guarda el más alto)
      if (mx.y > landTop) { landTop = mx.y; groundBox = b; }
      grounded = true;
    } else if (dy > 0 && feetY + h <= mn.y + 0.02 && nextY + h >= mn.y) {
      // cabezazo (se guarda el techo más bajo)
      if (mn.y < ceilBase) { ceilBase = mn.y; ceilBox = b; }
    }
  }
  if (grounded) { actor.pos.y = landTop; actor.vel.y = 0; }
  else if (ceilBox) { actor.pos.y = ceilBase - h; actor.vel.y = Math.min(0, actor.vel.y); actor.hitCeiling = true; }
  else {
    actor.pos.y = nextY;
    if (actor.pos.y <= world.killY) actor.fell = true;
  }

  // ---- Eje X ----
  actor.pos.x += actor.vel.x * dt;
  const xAabb = { minX: actor.pos.x - r, maxX: actor.pos.x + r, minZ: actor.pos.z - r, maxZ: actor.pos.z + r, minY: actor.pos.y, maxY: actor.pos.y + h };
  for (const b of world.boxes) {
    if (!collides(b)) continue;
    const mn = b.min, mx = b.max;
    if (xAabb.maxY <= mn.y + 0.02 || xAabb.minY >= mx.y - 0.02) continue;
    if (xAabb.maxZ <= mn.z || xAabb.minZ >= mx.z) continue;
    if (xAabb.maxX > mn.x && xAabb.minX < mx.x) {
      // si la caja está justo bajo los pies, no bloquea
      if (actor.pos.y >= mx.y - 0.12) continue;
      if (actor.vel.x > 0) actor.pos.x = mn.x - r; else if (actor.vel.x < 0) actor.pos.x = mx.x + r;
      actor.vel.x = 0;
      if (onHitWall) onHitWall(b);
      break;
    }
  }
  // ---- Eje Z ----
  actor.pos.z += actor.vel.z * dt;
  const zAabb = { minX: actor.pos.x - r, maxX: actor.pos.x + r, minZ: actor.pos.z - r, maxZ: actor.pos.z + r, minY: actor.pos.y, maxY: actor.pos.y + h };
  for (const b of world.boxes) {
    if (!collides(b)) continue;
    const mn = b.min, mx = b.max;
    if (zAabb.maxY <= mn.y + 0.02 || zAabb.minY >= mx.y - 0.02) continue;
    if (zAabb.maxX <= mn.x || zAabb.minX >= mx.x) continue;
    if (zAabb.maxZ > mn.z && zAabb.minZ < mx.z) {
      if (actor.pos.y >= mx.y - 0.12) continue;
      if (actor.vel.z > 0) actor.pos.z = mn.z - r; else if (actor.vel.z < 0) actor.pos.z = mx.z + r;
      actor.vel.z = 0;
      if (onHitWall) onHitWall(b);
      break;
    }
  }

  actor.grounded = grounded;
  actor.groundBox = groundBox;
  if (grounded && !prevGround && onLand) onLand(groundBox);
  return grounded;
}
