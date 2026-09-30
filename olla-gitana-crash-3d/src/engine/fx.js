/* Efectos: partículas con pool, destellos, anillos de impacto, sacudida de
   cámara, confeti y textos flotantes.
   API pública estable: burst/addShake/ambient/confettiBurst/update se mantienen
   con la MISMA firma (solo se añaden opciones opcionales y métodos nuevos:
   impact/flash/ring/poolLibre). */
import * as THREE from 'three';
import confetti from 'canvas-confetti';

/* Partículas ambientales por mundo (colores de la paleta del juego).
   Ritmo lentísimo: 1-2 partículas cada ~0.3-0.55 s, reutilizando el pool de burst().
   grav/drag son opcionales y suaves: hojas/pétalos caen flotando, chispas suben, polvo se posa.
   (El polvo "de baja opacidad" se emula con color apagado + tamaño pequeño: el InstancedMesh no admite alpha por instancia.)
   `n` = partículas por emisión y `rate` = rango de segundos entre emisiones. */
const AMBIENT = {
  hojas:   { colors: [0x38b000, 0x2d8a00], speed: 0.5,  up: -0.8, life: 3.0, size: 1.15, grav: 0.9,  drag: 1.4, n: 1, rate: [0.30, 0.55] }, // huerta: caen flotando
  petalos: { colors: [0xfff5e1, 0xffd6a5], speed: 0.4,  up: -0.55, life: 3.2, size: 1.05, grav: 0.7,  drag: 1.8, n: 2, rate: [0.30, 0.55] }, // procesión: pétalos claros
  confeti: { colors: [0xe63946, 0xffbe0b, 0x38b000, 0x8338ec], speed: 0.9, up: 0.35, life: 2.2, size: 1.0, grav: 1.6, drag: 1.0, n: 2, rate: [0.32, 0.58] }, // festi
  chispas: { colors: [0xffbe0b, 0xff8800], speed: 0.4,  up: 3.4,  life: 1.1, size: 0.7,  grav: 0.5,  drag: 0.4, n: 1, rate: [0.26, 0.46] }, // entierro/casino: ascienden
  polvo:   { colors: [0xcbb9a0],           speed: 0.25, up: -0.1, life: 3.6, size: 0.7,  grav: 0.18, drag: 2.2, n: 1, rate: [0.34, 0.60] }, // calle: motas suaves
  ceniza:  { colors: [0xcbb9a0, 0x9a9aa8, 0xb0a89a], speed: 0.55, up: 0.2, life: 2.6, size: 0.65, grav: 0.25, drag: 1.6, n: 1, rate: [0.28, 0.5] }, // furgo: polvo levantado
  humo:    { colors: [0x6b6b7a, 0x8f8f9c, 0x4a4a58], speed: 0.35, up: 1.0, life: 3.0, size: 1.5,  grav: 0.05, drag: 1.9, n: 1, rate: [0.32, 0.6] },  // entierro: humo que sube
  polen:   { colors: [0xffe066, 0xfff5e1, 0xd8f3a4], speed: 0.5,  up: 0.25, life: 3.4, size: 0.55, grav: 0.12, drag: 2.4, n: 1, rate: [0.3, 0.55] }, // huerta: motas doradas
  destellos: { colors: [0xffe9a8, 0xffbe0b, 0xffffff], speed: 0.7, up: 0.8, life: 2.0, size: 0.8, grav: 0.5, drag: 1.2, n: 1, rate: [0.26, 0.48] }  // casino: oropel que brilla
};

/* kind ambiental por defecto según el mundo (si el llamador no pasa kind) */
const WORLD_KIND = { 1: 'polvo', 2: 'confeti', 3: 'ceniza', 4: 'petalos', 5: 'humo', 6: 'polen', 7: 'destellos' };

/* Paleta murciana reutilizable por los efectos de juego */
export const FX_PALETA = {
  rojo: 0xe63946, dorado: 0xffbe0b, verde: 0x38b000, morado: 0x8338ec,
  crema: 0xfff5e1, naranja: 0xfb8500, azul: 0x4cc9f0, madera: 0xb5651d
};

export class FX {
  constructor(scene, { pool = 260 } = {}) {
    this.scene = scene;
    this.shake = 0;
    this.items = [];
    this._ambT = 0;          // acumulador del emisor ambiental
    this._ambNext = 0.4;     // segundos hasta la siguiente partícula ambiental (0.3-0.6)
    this.geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    // atributo color BLANCO por vértice: con vertexColors:true el shader hace
    // vColor.rgb *= color, y si la geometría no trae atributo `color` este vale
    // (0,0,0) → TODAS las partículas salían NEGRAS (bug cazado con QA visual:
    // se veían cuadros negros en vez de chispas). Con el atributo a 1, el color
    // por instancia (instanceColor) manda.
    const nv = this.geo.attributes.position.count;
    this.geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nv * 3).fill(1), 3));
    const mat = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true });
    this.mesh = new THREE.InstancedMesh(this.geo, mat, pool);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.colors = new Float32Array(pool * 3);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(this.colors, 3);
    scene.add(this.mesh);
    this.pool = pool;
    for (let i = 0; i < pool; i++) this.items.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1, spin: 0 });
    this._dummy = new THREE.Object3D();
    this._hideAll();

    /* ---------- destellos (billboards aditivos) para impactos y recogidas ---------- */
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.32, 'rgba(255,255,255,.78)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    this._flashTex = new THREE.CanvasTexture(cv);
    this._flashTex.colorSpace = THREE.SRGBColorSpace;
    this.flashes = [];
    for (let i = 0; i < 14; i++) {
      const m = new THREE.SpriteMaterial({ map: this._flashTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const s = new THREE.Sprite(m);
      s.visible = false;
      s.renderOrder = 900;
      scene.add(s);
      this.flashes.push({ s, mat: m, life: 0, max: 1, size: 1, grow: 1 });
    }

    /* ---------- anillos de impacto (ondas a ras de suelo) ---------- */
    const ringGeo = new THREE.RingGeometry(0.74, 1, 30);
    this.rings = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      const r = new THREE.Mesh(ringGeo, m);
      r.rotation.x = -Math.PI / 2;
      r.visible = false;
      r.renderOrder = 880;
      scene.add(r);
      this.rings.push({ m: r, mat: m, life: 0, max: 1, r0: 0.3, r1: 2.0 });
    }
  }

  _hideAll() {
    this._dummy.position.set(0, -9999, 0); this._dummy.scale.setScalar(0.0001);
    this._dummy.updateMatrix();
    for (let i = 0; i < this.pool; i++) this.mesh.setMatrixAt(i, this._dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  _free() {
    for (let i = 0; i < this.pool; i++) if (!this.items[i].alive) return i;
    return -1;
  }

  /* partículas libres del pool (QA/perf) */
  poolLibre() { let n = 0; for (let i = 0; i < this.pool; i++) if (!this.items[i].alive) n++; return n; }

  burst(pos, { count = 10, color = 0xffffff, speed = 4, up = 4, size = 1, life = 0.8, colors = null, grav = undefined, drag = 0, puff = 0, spread = 0.4, sizeTo = 1 } = {}) {
    const c = new THREE.Color();
    let last = -1;
    for (let n = 0; n < count; n++) {
      const i = this._free();
      if (i < 0) return last;
      const it = this.items[i];
      last = i;
      it.alive = true;
      it.grav = grav; it.drag = drag;      // física opcional (undefined = gravedad de juego)
      it.puff = puff; it.sizeTo = sizeTo;
      it.x = pos.x + (Math.random() - 0.5) * spread * 2;
      it.y = pos.y + Math.random() * spread;
      it.z = pos.z + (Math.random() - 0.5) * spread * 2;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * speed;
      it.vx = Math.cos(a) * r; it.vz = Math.sin(a) * r;
      it.vy = up * (0.4 + Math.random() * 0.9);
      it.life = it.max = life * (0.7 + Math.random() * 0.6);
      it.size = size * (0.7 + Math.random() * 0.7);
      it.spin = (Math.random() - 0.5) * 12;
      c.set(colors ? colors[(Math.random() * colors.length) | 0] : color);
      this.mesh.setColorAt(i, c);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    return last;
  }

  /* Destello de impacto: billboard aditivo que nace grande y se apaga rápido.
     Posición {x,y,z}, color hex, size en metros (radio aprox.), life en segundos. */
  flash(pos, { color = 0xffe9a8, size = 1.6, life = 0.26, grow = 1.5 } = {}) {
    for (const f of this.flashes) {
      if (f.life > 0) continue;
      f.life = f.max = life;
      f.size = size; f.grow = grow;
      f.s.position.set(pos.x, pos.y + 0.15, pos.z);
      f.mat.color.setHex(color);
      f.mat.opacity = 1;
      f.s.scale.setScalar(size * 0.35);
      f.s.visible = true;
      return true;
    }
    return false;
  }

  /* Anillo de impacto en el suelo: onda que se expande y se desvanece. */
  ring(pos, { color = FX_PALETA.dorado, r0 = 0.28, r1 = 2.2, life = 0.42, y = 0.06 } = {}) {
    for (const r of this.rings) {
      if (r.life > 0) continue;
      r.life = r.max = life;
      r.r0 = r0; r.r1 = r1;
      r.m.position.set(pos.x, y != null ? y : Math.max(0.05, pos.y - 0.45), pos.z);
      r.mat.color.setHex(color);
      r.mat.opacity = 0.9;
      r.m.scale.setScalar(r0);
      r.m.visible = true;
      return true;
    }
    return false;
  }

  /* Impacto compuesto: chispas + destello + onda + sacudida. Un sitio para
     calibrar el "juice" de cada acción (rotura, daño, recogida, pisotón…). */
  impact(pos, {
    count = 16, colors = [FX_PALETA.dorado, FX_PALETA.crema, 0xffffff],
    speed = 5, up = 5, life = 0.8, size = 1, spread = 0.4,
    shake = 0.18, flash = null, flashSize = 1.6, ring = null, ringSize = 2.2, ringY = 0.06, puff = 0
  } = {}) {
    this.burst(pos, { count, colors, speed, up, life, size, spread, puff });
    if (flash != null) this.flash(pos, { color: flash, size: flashSize });
    if (ring != null) this.ring(pos, { color: ring, r1: ringSize, y: ringY });
    if (shake) this.addShake(shake);
  }

  confettiBurst() {
    try {
      confetti({ particleCount: 90, spread: 78, origin: { y: 0.72 }, colors: ['#ffbe0b', '#e63946', '#38b000', '#8338ec', '#4cc9f0'] });
    } catch (_) {}
  }

  /* confeti 3D dentro de la escena (victoria/celebración, no depende del DOM) */
  confettiScene(pos, n = 26) {
    this.burst({ x: pos.x, y: pos.y + 2.4, z: pos.z }, {
      count: n, speed: 4.5, up: 6.5, life: 1.8, size: 0.85, spread: 1.7,
      colors: [FX_PALETA.rojo, FX_PALETA.dorado, FX_PALETA.verde, FX_PALETA.morado, FX_PALETA.azul],
      grav: 7, drag: 1.1
    });
  }

  /* Emisor ambiental: como máximo 1 emisión cada ~0.3-0.6 s (n partículas), reutilizando el pool.
     kind: 'hojas' | 'petalos' | 'confeti' | 'chispas' | 'polvo' | 'ceniza' | 'humo' | 'polen' | 'destellos'
     (si falta, se deduce del level).
     Posición: dentro del frustum aproximado de la cámara (x ±8, z +2..+14, y 3..8).
     Devuelve el nº de partículas emitidas (0 si aún no toca; barato: sin loops). */
  ambient(kind, dt, camera, level) {
    this._ambT += dt;
    if (this._ambT < this._ambNext) return 0;
    this._ambT = 0;
    if (!kind) kind = (level && level.arena) ? 'chispas' : ((level && WORLD_KIND[level.id]) || 'polvo');
    const cfg = AMBIENT[kind] || AMBIENT.polvo;
    this._ambNext = cfg.rate[0] + Math.random() * (cfg.rate[1] - cfg.rate[0]);
    const cam = (camera && camera.position) || { x: 0, z: 0 };
    let emitidas = 0;
    for (let k = 0; k < (cfg.n || 1); k++) {
      const idx = this.burst(
        { x: cam.x + (Math.random() - 0.5) * 16, y: 3 + Math.random() * 5, z: cam.z + 2 + Math.random() * 12 },
        { count: 1, colors: cfg.colors, speed: cfg.speed, up: cfg.up, life: cfg.life, size: cfg.size }
      );
      if (idx < 0) break;                             // pool lleno: reintenta en la próxima
      const it = this.items[idx];
      it.grav = cfg.grav; it.drag = cfg.drag;         // física suave propia de cada kind
      emitidas++;
    }
    return emitidas;
  }

  addShake(amount) { this.shake = Math.min(1.6, this.shake + amount); }

  update(dt) {
    const d = this._dummy;
    let any = false;
    for (let i = 0; i < this.pool; i++) {
      const it = this.items[i];
      if (!it.alive) continue;
      any = true;
      it.life -= dt;
      if (it.life <= 0) { it.alive = false; continue; }
      it.vy -= (it.grav === undefined ? 16 : it.grav) * dt;   // gravedad por partícula (ambientales suaves)
      it.x += it.vx * dt; it.y += it.vy * dt; it.z += it.vz * dt;
      if (it.drag) { const f = Math.max(0, 1 - it.drag * dt); it.vx *= f; it.vz *= f; }  // frenado de hojas/pétalos
      if (it.y < 0.05) { it.y = 0.05; it.vy = Math.abs(it.vy) * 0.3; it.vx *= 0.7; it.vz *= 0.7; }
      const k = Math.max(0.001, it.life / it.max);
      d.position.set(it.x, it.y, it.z);
      d.rotation.set(it.life * it.spin, it.life * it.spin * 0.7, 0);
      // puff: nace grande y encoge (humo/polvo); el resto mantiene el latido habitual
      const puffK = it.puff ? (1 + (1 - k) * 2.4 * it.puff) : 1;
      d.scale.setScalar(it.size * (0.4 + k * 0.6) * puffK * (it.sizeTo != null ? 1 + (1 - k) * (it.sizeTo - 1) : 1));
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;

    /* destellos: nacen pequeños, se abren y se apagan */
    for (const f of this.flashes) {
      if (f.life <= 0) continue;
      f.life -= dt;
      if (f.life <= 0) { f.life = 0; f.s.visible = false; continue; }
      const k = f.life / f.max;                 // 1 → 0
      f.mat.opacity = k * k;                    // cae rápido al final
      f.s.scale.setScalar(f.size * (0.35 + (1 - k) * f.grow));
    }
    /* anillos: se expanden y se desvanecen */
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      if (r.life <= 0) { r.life = 0; r.m.visible = false; continue; }
      const k = 1 - r.life / r.max;             // 0 → 1
      r.m.scale.setScalar(r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k)));   // ease-out
      r.mat.opacity = 0.9 * (1 - k) * (1 - k);
    }

    this.shake = Math.max(0, this.shake - dt * 2.2);
  }
}

/* Texto flotante en mundo 3D (sprites con canvas) */
const textCache = new Map();
export function makeTextSprite(text, { color = '#ffbe0b', size = 64, stroke = '#3a1c00' } = {}) {
  const key = `${text}|${color}|${size}`;
  let tex = textCache.get(key);
  if (!tex) {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 160;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    g.font = `900 ${size}px "Luckiest Guy", Nunito, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 12; g.strokeStyle = stroke;
    g.strokeText(text, cv.width / 2, cv.height / 2);
    g.fillStyle = color;
    g.fillText(text, cv.width / 2, cv.height / 2);
    tex = new THREE.CanvasTexture(cv);
    tex.needsUpdate = true;
    textCache.set(key, tex);
  }
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(3.2, 1.0, 1);
  return sp;
}
