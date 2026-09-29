/* Físicas propias: colisión AABB contra cajas estáticas y plataformas móviles.
   El jugador se trata como una cápsula aproximada por un cilindro -> AABB
   resuelta por ejes (X, Z, Y) para que los deslizamientos laterales funcionen. */

export class Box {
  constructor({ x, y, z, w, h, d, solid = true, tag = '', mat = null }) {
    this.pos = { x, y, z };      // centro
    this.half = { x: w / 2, y: h / 2, z: d / 2 };
    this.base = { x, y, z };
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
      if (!b.solid) continue;
      if (filter && !filter(b)) continue;
      const mn = b.min, mx = b.max;
      if (aabb.maxX > mn.x && aabb.minX < mx.x &&
          aabb.maxY > mn.y && aabb.minY < mx.y &&
          aabb.maxZ > mn.z && aabb.minZ < mx.z) return b;
    }
    return null;
  }
  groundUnder(aabb, at = null) {
    let best = null, bestTop = -Infinity;
    for (const b of this.boxes) {
      if (!b.solid) continue;
      const mn = b.min, mx = b.max;
      if (aabb.maxX > mn.x && aabb.minX < mx.x && aabb.maxZ > mn.z && aabb.minZ < mx.z) {
        const top = at != null ? at : mx.y;
        if (top <= aabb.minY + 0.14 && top > bestTop) { bestTop = top; best = b; }
      }
    }
    return best ? { box: best, top: bestTop } : null;
  }
}

/* ---------- colisión y resolución del actor contra el mundo ---------- */
export function resolveActor(actor, world, dt, { onLand = null, onHitWall = null } = {}) {
  const r = actor.radius, h = actor.height;
  const feetY = actor.pos.y;
  const aabb = {
    minX: actor.pos.x - r, maxX: actor.pos.x + r,
    minZ: actor.pos.z - r, maxZ: actor.pos.z + r,
    minY: feetY, maxY: feetY + h
  };
  const prevGround = actor.grounded;

  // ---- Eje Y: subir/bajar ----
  let grounded = false, groundBox = null;
  const dy = actor.vel.y * dt;
  const nextY = feetY + dy;
  const yBox = { ...aabb, minY: nextY, maxY: nextY + h };
  for (const b of world.boxes) {
    if (!b.solid) continue;
    const mn = b.min, mx = b.max;
    if (yBox.maxX <= mn.x || yBox.minX >= mx.x || yBox.maxZ <= mn.z || yBox.minZ >= mx.z) continue;
    if (dy <= 0 && feetY >= mx.y - 0.02 && nextY <= mx.y) {
      // aterrizaje encima
      actor.pos.y = mx.y; actor.vel.y = 0; grounded = true; groundBox = b;
    } else if (dy > 0 && feetY + h <= mn.y + 0.02 && nextY + h >= mn.y) {
      // cabezazo
      actor.pos.y = mn.y - h; actor.vel.y = Math.min(0, actor.vel.y); actor.hitCeiling = true;
    }
    if (grounded) break;
  }
  if (!grounded) {
    actor.pos.y = nextY;
    if (actor.pos.y <= world.killY) actor.fell = true;
  }
  // plataformas móviles: arrastran al actor
  if (grounded && groundBox && groundBox.moving) {
    const prev = groundBox.t;
    groundBox.t += dt * 0.0; // ya actualizado en world.update
    const { axis, amp, speed, phase = 0 } = groundBox.moving;
    const offNow = Math.sin(groundBox.t * speed + phase) * amp;
    const offPrev = Math.sin((groundBox.t - dt) * speed + phase) * amp;
    actor.pos[axis === 'x' ? 'x' : axis] += (offNow - offPrev);
  }

  // ---- Eje X ----
  actor.pos.x += actor.vel.x * dt;
  const xAabb = { minX: actor.pos.x - r, maxX: actor.pos.x + r, minZ: actor.pos.z - r, maxZ: actor.pos.z + r, minY: actor.pos.y, maxY: actor.pos.y + h };
  for (const b of world.boxes) {
    if (!b.solid) continue;
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
    if (!b.solid) continue;
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
