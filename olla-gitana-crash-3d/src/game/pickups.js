/* Coleccionables: notas musicales, máscaras (3 = aura rumbera), checkpoints y meta. */
import * as THREE from 'three';

export class Pickups {
  constructor({ scene, fx, audio }) {
    this.scene = scene;
    this.fx = fx;
    this.audio = audio;
    this.notes = [];
    this.masks = [];
    this.noteCount = 0;
    this.maskCount = 0;
    this.onNote = null;
    this.onMask = null;
    this.onAura = null;
  }

  load(level) {
    for (const n of this.notes) if (n.obj) this.scene.remove(n.obj);
    for (const m of this.masks) if (m.obj) this.scene.remove(m.obj);
    this.notes = (level.notes || []).map((n) => ({ ...n, taken: false, t: Math.random() * 6 }));
    this.masks = (level.masks || []).map((m) => ({ ...m, taken: false, t: Math.random() * 6 }));
    this.noteCount = 0;
    this.maskCount = 0;
    this.totalNotes = this.notes.length + this.masks.length * 3;
  }

  reset() {
    for (const n of this.notes) {
      n.taken = false;
      if (n.obj) { n.obj.visible = true; n.obj.position.set(n.pos.x, n.pos.y, n.pos.z); }
    }
    for (const m of this.masks) {
      m.taken = false;
      if (m.obj) { m.obj.visible = true; m.obj.position.set(m.pos.x, m.pos.y, m.pos.z); }
    }
    this.noteCount = 0; this.maskCount = 0;
  }

  magnetTarget(pos) { return { x: pos.x, y: pos.y + 0.7, z: pos.z }; }

  update(dt, player, { aura = false } = {}) {
    const p = { x: player.pos.x, y: player.pos.y + 0.7, z: player.pos.z };
    const r = aura ? 2.4 : 1.35;
    for (const n of this.notes) {
      if (n.taken) continue;
      n.t += dt;
      n.obj.rotation.y += dt * 2.2;
      n.obj.position.y = n.pos.y + Math.sin(n.t * 3) * 0.14;
      if (n.obj.userData.halo) n.obj.userData.halo.scale.setScalar(1 + Math.sin(n.t * 4) * 0.1);
      const d = Math.hypot(n.pos.x - p.x, n.pos.y - p.y, n.pos.z - p.z);
      if (aura && d < 6) {
        // imán del aura
        n.obj.position.x += (p.x - n.obj.position.x) * Math.min(1, dt * 6);
        n.obj.position.z += (p.z - n.obj.position.z) * Math.min(1, dt * 6);
        n.pos.x = n.obj.position.x; n.pos.z = n.obj.position.z;
      }
      if (d < r) {
        n.taken = true;
        n.obj.visible = false;
        this.noteCount++;
        this.audio.sfx(aura ? 'noteHi' : 'note');
        this.fx.burst({ x: n.pos.x, y: n.pos.y, z: n.pos.z }, { count: 6, color: 0xffbe0b, speed: 3, up: 3.6, life: 0.55, size: 0.7 });
        if (this.onNote) this.onNote(this.noteCount, this.totalNotes);
      }
    }
    for (const m of this.masks) {
      if (m.taken) continue;
      m.t += dt;
      m.obj.rotation.y += dt * 1.6;
      m.obj.position.y = m.pos.y + Math.sin(m.t * 2.4) * 0.2;
      const d = Math.hypot(m.pos.x - p.x, m.pos.y - p.y, m.pos.z - p.z);
      if (aura && d < 7) {
        m.obj.position.x += (p.x - m.obj.position.x) * Math.min(1, dt * 5);
        m.obj.position.z += (p.z - m.obj.position.z) * Math.min(1, dt * 5);
        m.pos.x = m.obj.position.x; m.pos.z = m.obj.position.z;
      }
      if (d < r + 0.35) {
        m.taken = true;
        m.obj.visible = false;
        this.maskCount++;
        this.audio.sfx(maskLevel(this.maskCount) === 3 ? 'aura' : 'mask');
        if (this.onMask) this.onMask(this.maskCount);
      }
    }
  }
}

export function maskLevel(count) { return ((count - 1) % 3) + 1; }
export function auraActive(count) { return count > 0 && count % 3 === 0 ? 14 : 0; }
