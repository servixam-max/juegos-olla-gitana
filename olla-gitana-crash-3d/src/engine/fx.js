/* Efectos: partículas con pool, sacudida de cámara, confeti y textos flotantes */
import * as THREE from 'three';
import confetti from 'canvas-confetti';

export class FX {
  constructor(scene, { pool = 260 } = {}) {
    this.scene = scene;
    this.shake = 0;
    this.items = [];
    this.geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
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

  burst(pos, { count = 10, color = 0xffffff, speed = 4, up = 4, size = 1, life = 0.8, colors = null } = {}) {
    const c = new THREE.Color();
    for (let n = 0; n < count; n++) {
      const i = this._free();
      if (i < 0) return;
      const it = this.items[i];
      it.alive = true;
      it.x = pos.x + (Math.random() - 0.5) * 0.4;
      it.y = pos.y + Math.random() * 0.4;
      it.z = pos.z + (Math.random() - 0.5) * 0.4;
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
  }

  confettiBurst() {
    try {
      confetti({ particleCount: 90, spread: 78, origin: { y: 0.72 }, colors: ['#ffbe0b', '#e63946', '#38b000', '#8338ec', '#4cc9f0'] });
    } catch (_) {}
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
      it.vy -= 16 * dt;
      it.x += it.vx * dt; it.y += it.vy * dt; it.z += it.vz * dt;
      if (it.y < 0.05) { it.y = 0.05; it.vy = Math.abs(it.vy) * 0.3; it.vx *= 0.7; it.vz *= 0.7; }
      const k = Math.max(0.001, it.life / it.max);
      d.position.set(it.x, it.y, it.z);
      d.rotation.set(it.life * it.spin, it.life * it.spin * 0.7, 0);
      d.scale.setScalar(it.size * (0.4 + k * 0.6));
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
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
