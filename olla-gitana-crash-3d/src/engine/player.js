/* Controlador de la olla (Worker 1): aceleración, salto de gravedad variable,
   doble salto, giro (spin attack) con ventana activa de 0.4 s, barrida (slide),
   salto largo tras barrida y sombra proyectada. */
import * as THREE from 'three';
import { makeOlla } from '../game/art.js';
import { resolveActor } from './physics.js';

const ACCEL = 26;
const MAX_SPEED = 8.4;
const FRICTION = 26;
const AIR_ACCEL = 14;
const JUMP_V = 10.6;
const JUMP_CUT = 0.42;      // gravedad extra al soltar
const GRAV_UP = 21;
const GRAV_DOWN = 30;
const SLIDE_SPEED = 13.5;
const SLIDE_TIME = 0.55;
const SPIN_TIME = 0.4;
const COYOTE = 0.12;
const JUMP_BUFFER = 0.16;

export class Player {
  constructor(scene) {
    this.obj = makeOlla({ color: 0xd62828, rim: 0xffbe0b, band: true });
    this.obj.scale.setScalar(0.92);
    scene.add(this.obj);

    // sombra proyectada (blob shadow)
    const shTex = makeBlobTexture();
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({ map: shTex, transparent: true, opacity: 0.55, depthWrite: false })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    scene.add(this.shadow);

    // aura de giro
    this.spinRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.08, 6, 22),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 })
    );
    this.spinRing.rotation.x = Math.PI / 2;
    scene.add(this.spinRing);

    this.pos = { x: 0, y: 1.2, z: 0 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.radius = 0.42;
    this.height = 1.25;
    this.grounded = false;
    this.facing = 0;             // radianes (mundo)
    this.jumps = 0;
    this.maxJumps = 2;
    this.spinT = 0;
    this.spinCd = 0;
    this.slideT = 0;
    this.slideCd = 0;
    this.longJumpWindow = 0;
    this.coyote = 0;
    this.buffer = 0;
    this.animT = 0;
    this.dead = false;
    this.fell = false;
    this.hurtT = 0;
    this.invulnT = 0;
    this.aura = false;
    this.ghost = 0;
    this.shield = 0;
    this.speedBoost = 1;
    this.runDust = 0;
  }

  reset(x, y, z) {
    this.pos = { x, y, z };
    this.vel = { x: 0, y: 0, z: 0 };
    this.jumps = 0; this.spinT = 0; this.slideT = 0;
    this.dead = false; this.fell = false; this.animT = 0;
    this.grounded = false; this.hurtT = 0;
    this.obj.position.set(x, y, z);
    this.obj.visible = true;
  }

  get spinning() { return this.spinT > 0; }
  get sliding() { return this.slideT > 0; }
  get hitRadius() { return this.spinT > 0 ? 1.15 : 0.55; }
  get hitHeight() { return this.slideT > 0 ? 0.62 : 1.25; }

  /* El giro rompe cajas: caja de daño delante y alrededor */
  spinHits(targetPos, extra = 0.55) {
    if (!this.spinning) return false;
    const dx = targetPos.x - this.pos.x, dz = targetPos.z - this.pos.z, dy = targetPos.y - (this.pos.y + 0.6);
    return Math.hypot(dx, dz) < this.hitRadius + extra && Math.abs(dy) < 1.25;
  }

  canBeHit() { return !this.aura && this.invulnT <= 0; }

  hurt() {
    if (this.aura) return false;                 // aura rumbera = invencible
    if (this.invulnT > 0) return false;
    if (this.shield > 0) { this.shield = 0; this.invulnT = 1.0; return 'shield'; }
    this.invulnT = 1.6;
    this.hurtT = 0.5;
    return 'hurt';
  }

  update(dt, input, world, camYaw) {
    if (this.dead) return;
    this.animT += dt;
    this.spinCd = Math.max(0, this.spinCd - dt);
    this.slideCd = Math.max(0, this.slideCd - dt);
    this.invulnT = Math.max(0, this.invulnT - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.ghost = Math.max(0, this.ghost - dt);
    this.longJumpWindow = Math.max(0, this.longJumpWindow - dt);

    // ---- ataque: giro ----
    if (input.spinP && this.spinCd <= 0) {
      this.spinT = SPIN_TIME;
      this.spinCd = SPIN_TIME + 0.18;
      if (this.slideT > 0) this.slideT = 0;
      this.onSpin && this.onSpin();
    }
    this.spinT = Math.max(0, this.spinT - dt);

    // ---- barrida ----
    if (input.slideP && this.slideCd <= 0 && this.grounded) {
      this.slideT = SLIDE_TIME;
      this.slideCd = SLIDE_TIME + 0.25;
      this.longJumpWindow = SLIDE_TIME + 0.28;
      this.onSlide && this.onSlide();
    }
    if (this.slideT > 0) {
      this.slideT -= dt;
      if (this.slideT <= 0) this.longJumpWindow = Math.max(this.longJumpWindow, 0.2);
    }

    // ---- movimiento (relativo a la cámara) ----
    // Con yaw=0 la cámara mira hacia +Z y la derecha de la PANTALLA es -X,
    // así que input.x (derecha en pantalla) debe mapear a -X. Antes iba al revés
    // y los controles izquierda/derecha salían invertidos en el juego.
    const cos = Math.cos(camYaw), sin = Math.sin(camYaw);
    let wx = -input.x * cos + input.z * sin;
    let wz = input.x * sin + input.z * cos;
    const wlen = Math.hypot(wx, wz);
    const boost = this.speedBoost * (this.aura ? 1.22 : 1);
    const maxS = MAX_SPEED * boost;
    const accel = this.grounded ? ACCEL : AIR_ACCEL;
    const ctrl = this.slideT > 0 ? 0.25 : 1;

    if (wlen > 0.05) {
      const tx = (wx / (wlen || 1)) * maxS;
      const tz = (wz / (wlen || 1)) * maxS;
      this.vel.x += (tx - this.vel.x) * Math.min(1, accel * ctrl * dt / maxS * 1.4);
      this.vel.z += (tz - this.vel.z) * Math.min(1, accel * ctrl * dt / maxS * 1.4);
      // orientar a donde va
      const target = Math.atan2(wx, wz);
      let diff = target - this.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turnRate = this.spinT > 0 ? 18 : 12;
      this.facing += diff * Math.min(1, turnRate * dt);
    } else if (this.grounded) {
      const sp = Math.hypot(this.vel.x, this.vel.z);
      if (sp > 0) {
        const drop = Math.min(sp, FRICTION * dt);
        this.vel.x -= (this.vel.x / sp) * drop;
        this.vel.z -= (this.vel.z / sp) * drop;
      }
    }

    // barrida: impulso fuerte
    if (this.slideT > 0 && wlen < 0.2) {
      this.vel.x = Math.sin(this.facing) * SLIDE_SPEED;
      this.vel.z = Math.cos(this.facing) * SLIDE_SPEED;
    } else if (this.slideT > 0) {
      const sp = Math.hypot(this.vel.x, this.vel.z) || 1;
      this.vel.x += (this.vel.x / sp) * 16 * dt;
      this.vel.z += (this.vel.z / sp) * 16 * dt;
      const sp2 = Math.hypot(this.vel.x, this.vel.z);
      if (sp2 > SLIDE_SPEED * boost) { this.vel.x *= (SLIDE_SPEED * boost) / sp2; this.vel.z *= (SLIDE_SPEED * boost) / sp2; }
    }

    // ---- salto ----
    if (this.grounded) { this.coyote = COYOTE; this.jumps = 0; }
    else this.coyote = Math.max(0, this.coyote - dt);
    if (input.jumpP) this.buffer = JUMP_BUFFER;
    else this.buffer = Math.max(0, this.buffer - dt);

    if (this.buffer > 0) {
      const longJump = this.longJumpWindow > 0 && (this.vel.x || this.vel.z);
      if (this.coyote > 0 && this.jumps === 0) {
        this.jumps = 1;
        this.vel.y = JUMP_V * (longJump ? 1.06 : 1);
        if (longJump) {
          const sp = Math.hypot(this.vel.x, this.vel.z) || 1;
          this.vel.x = (this.vel.x / sp) * maxS * 1.35;
          this.vel.z = (this.vel.z / sp) * maxS * 1.35;
          this.onLongJump && this.onLongJump();
        }
        this.buffer = 0; this.coyote = 0;
        this.onJump && this.onJump(false);
      } else if (this.jumps === 1 && this.maxJumps > 1) {
        this.jumps = 2;
        this.vel.y = JUMP_V * 0.94;
        this.buffer = 0;
        this.onJump && this.onJump(true);
      }
    }
    if (!input.jump && this.vel.y > 0 && this.jumps > 0) this.vel.y -= GRAV_UP * JUMP_CUT * 1.4 * dt;

    // ---- gravedad ----
    const g = this.vel.y > 0 ? GRAV_UP : GRAV_DOWN;
    this.vel.y -= g * dt;
    this.vel.y = Math.max(this.vel.y, -30);

    // ---- física ----
    resolveActor(this, world, dt, {
      onLand: () => { this.onLand && this.onLand(); },
      onHitWall: () => {}
    });
    if (this.fell) { this.fell = false; this.onFall && this.onFall(); }

    // ---- presentación ----
    const sq = this.slideT > 0 ? 0.5 : 1;
    this.obj.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.obj.rotation.y = this.facing;
    let tilt = 0;
    if (this.slideT > 0) tilt = 0.9;
    const hop = this.grounded ? Math.abs(Math.sin(this.animT * 11)) * 0.08 * Math.min(1, Math.hypot(this.vel.x, this.vel.z) / MAX_SPEED) : 0;
    this.obj.rotation.x = tilt;
    this.obj.scale.set(0.92, 0.92 * sq, 0.92);
    if (this.spinT > 0) {
      const k = 1 - this.spinT / SPIN_TIME;
      this.obj.rotation.y = this.facing + k * Math.PI * 2;
      this.obj.position.y = this.pos.y + 0.12 + Math.sin(k * Math.PI) * 0.1;
    } else {
      this.obj.position.y = this.pos.y + hop;
    }

    // brazos y piernas
    const ud = this.obj.userData;
    const runK = Math.min(1, Math.hypot(this.vel.x, this.vel.z) / MAX_SPEED);
    const swing = Math.sin(this.animT * 12) * 0.9 * runK;
    if (ud.legL) { ud.legL.rotation.x = swing; ud.legR.rotation.x = -swing; }
    if (ud.armL) {
      if (this.spinT > 0) { ud.armL.rotation.z = 1.5; ud.armR.rotation.z = -1.5; ud.armL.rotation.x = ud.armR.rotation.x = 0; }
      else if (this.slideT > 0) { ud.armL.rotation.z = 0.5; ud.armR.rotation.z = -0.5; }
      else { ud.armL.rotation.z = 0.25 + Math.sin(this.animT * 12) * 0.3 * runK; ud.armR.rotation.z = -0.25 - Math.sin(this.animT * 12 + Math.PI) * 0.3 * runK; ud.armL.rotation.x = -swing; ud.armR.rotation.x = swing; }
    }

    // parpadeo de invulnerabilidad / herido
    if (this.invulnT > 0 && !this.aura) this.obj.visible = Math.floor(this.animT * 16) % 2 === 0;
    else if (this.ghost > 0) this.obj.visible = Math.floor(this.animT * 9) % 2 === 0;
    else this.obj.visible = true;
    if (this.aura) {
      const glow = 0.6 + Math.sin(this.animT * 9) * 0.25;
      this.obj.traverse((c) => { if (c.isMesh && c.material && c.material.emissive) c.material.emissiveIntensity = glow * 0.35; });
    }

    // sombra proyectada
    const g2 = world.groundUnder({ minX: this.pos.x - 0.3, maxX: this.pos.x + 0.3, minZ: this.pos.z - 0.3, maxZ: this.pos.z + 0.3, minY: -50, maxY: 0 });
    let sy = 0.02;
    if (g2) sy = g2.top + 0.02;
    const height = Math.max(0, this.pos.y - sy);
    this.shadow.position.set(this.pos.x, sy + 0.01, this.pos.z);
    const shScale = Math.max(0.45, 1 - height * 0.06);
    this.shadow.scale.setScalar(shScale);
    this.shadow.material.opacity = Math.max(0.12, 0.55 - height * 0.03);

    // aro del giro
    this.spinRing.position.set(this.pos.x, this.pos.y + 0.62, this.pos.z);
    this.spinRing.material.opacity = this.spinT > 0 ? 0.85 : 0;
    this.spinRing.scale.setScalar(this.spinT > 0 ? 1 + Math.sin(this.spinT * 30) * 0.08 : 0.6);

    // polvo al correr
    this.runDust -= dt;
    if (this.grounded && runK > 0.6 && this.runDust <= 0 && this.onDust) { this.runDust = 0.12; this.onDust(); }
  }
}

function makeBlobTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, 'rgba(10,4,16,0.85)');
  grd.addColorStop(0.6, 'rgba(10,4,16,0.45)');
  grd.addColorStop(1, 'rgba(10,4,16,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  return tex;
}
