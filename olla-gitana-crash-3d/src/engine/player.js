/* Controlador de la olla (Worker 1): aceleración, salto de gravedad variable,
   doble salto, giro (spin attack) con ventana activa de 0.4 s e impulso corto,
   barrida (slide) cancelable con salto, salto largo tras barrida, frenada con
   inercia ("slide stop" suave), inclinación (roll) al girar y sombra. */
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
const SLIDE_SPEED = 15.0;   // 13.5 → 15: la barrida ahora corre de verdad
const SLIDE_TIME = 0.72;    // 0.55 → 0.72: dura más y sirve para pasillos/ataques
const SPIN_TIME = 0.4;
const COYOTE = 0.15;        // 0.12 → 0.15: salto más fiable al borde del suelo
const JUMP_BUFFER = 0.24;   // 0.20 → 0.24: el frame de aterrizaje consume uno,
                            // así el margen REAL es 6 frames (0.20 s medidos)
const STOP_GRACE = 0.15;    // al soltar: los primeros 0.15 s frenan más suave
const STOP_FRICTION = FRICTION * 0.75;
const TURN_GROUND = 14;     // giro al orientar en suelo
const TURN_AIR = 12;        // en aire más flojo (nada de giro robótico)
const ROLL_MAX = 0.12;      // inclinación visual al cambiar de dirección
const SPIN_IMPULSE_T = 0.15; // el giro sostiene la velocidad 0.15 s
const SPIN_IMPULSE_X = 1.15;
const DJUMP_V = 1.0;        // doble salto (con 0.94 quedaba flojo)

/* --- margen real de los saltos (auditoría de físicas) ---
   Los contadores de coyote/buffer se consumían ANTES de comprobar el salto, así
   que el margen nominal perdía un frame: con COYOTE 0.15 solo salvaba 4 frames
   (0.133 s) y el buffer 5 (0.167 s). Ahora se comprueba primero y se decrementa
   después. Además, caerse de un borde SIN haber saltado dejaba jumps=0 y ninguna
   rama aplicaba: el jugador perdía sus DOS saltos. */
const AIR_JUMP_V = 0.9;       // salto de recuperación tras caerse de un borde
const AIR_JUMP_MAXVY = 2;     // solo si no está subiendo ya (evita dobles usos)
const LONGJUMP_BOOST_T = 0.55; // el salto largo sostiene el ×1.35 en el aire
const LONGJUMP_BOOST_X = 1.35;
const SLIDE_MOMENTUM_T = 0.45; // tras la barrida el impulso se conserva (no se corta)
const MOMENTUM_FRICTION = 9;   // decaimiento suave del impulso conservado (m/s²)

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
    this.stopT = 0;              // "slide stop": tiempo restante de frenada suave
    this.roll = 0;               // inclinación visual actual (interpolada)
    this.spinImpulseT = 0;       // impulso hacia delante del giro
    this.hadInput = false;       // había input en la frame anterior (detecta "soltar")
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
    this.coyote = 0; this.buffer = 0; this.stopT = 0;
    this.spinImpulseT = 0; this.roll = 0; this.hadInput = false;
    this.longJumpWindow = 0; this.longJumpBoostT = 0; this.slideMomentumT = 0;
    this.dead = false; this.fell = false; this.animT = 0;
    this.grounded = false; this.hurtT = 0;
    this.obj.position.set(x, y, z);
    this.obj.visible = true;
  }

  get spinning() { return this.spinT > 0; }
  get sliding() { return this.slideT > 0; }
  // alcance del giro: 1.15 → 1.3 (auditoría: con 1.15 el giro solo rompía cajas
  // a ≤1.2 m del centro; a 1.5 m ya no llegaba y el jugador tenía que pegarse
  // mucho. Con 1.3 la banda rota llega a ~1.6 m, que es el borde visual del aro)
  get hitRadius() { return this.spinT > 0 ? 1.3 : 0.55; }
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
    if (this.shield > 0) { this.shield = 0; this.invulnT = 1.4; return 'shield'; }
    // 2.2 s (antes 1.6): en las peleas de jefe los daños se encadenaban y el
    // jugador moría sin margen para reaccionar (queja del usuario)
    this.invulnT = 2.2;
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
    this.longJumpBoostT = Math.max(0, (this.longJumpBoostT || 0) - dt);   // sostén ×1.35 en el aire
    this.slideMomentumT = Math.max(0, (this.slideMomentumT || 0) - dt);   // impulso conservado tras la barrida

    this.spinT = Math.max(0, this.spinT - dt);
    this.spinImpulseT = Math.max(0, this.spinImpulseT - dt);
    this.stopT = Math.max(0, this.stopT - dt);

    // velocidad máxima efectiva (boost del aura incluida): la usan el giro,
    // el movimiento y la barrida
    const boost = this.speedBoost * (this.aura ? 1.22 : 1);
    const maxS = MAX_SPEED * boost;

    // ---- ataque: giro ----
    if (input.spinP && this.spinCd <= 0) {
      this.spinT = SPIN_TIME;
      this.spinCd = SPIN_TIME + 0.18;
      if (this.slideT > 0) this.slideT = 0;
      // pequeño impulso hacia delante si ya se movía (encadenar giros se siente ágil):
      // ×1.15 durante 0.15 s, nunca frena y no acumula más allá del tope
      const spIn = Math.hypot(this.vel.x, this.vel.z);
      if (spIn > 0.5) {
        this.spinImpulseT = SPIN_IMPULSE_T;
        const newSp = Math.max(spIn, Math.min(maxS * SPIN_IMPULSE_X, spIn * SPIN_IMPULSE_X));
        const mult = newSp / spIn;
        this.vel.x *= mult;
        this.vel.z *= mult;
      }
      this.onSpin && this.onSpin();
    }

    // ---- barrida ----
    if (input.slideP && this.slideCd <= 0 && this.grounded) {
      this.slideT = SLIDE_TIME;
      this.slideCd = SLIDE_TIME + 0.25;
      this.longJumpWindow = SLIDE_TIME + 0.28;
      this.onSlide && this.onSlide();
    }
    if (this.slideT > 0) {
      this.slideT -= dt;
      if (this.slideT <= 0) {
        this.longJumpWindow = Math.max(this.longJumpWindow, 0.2);
        // la barrida mantiene el impulso al terminar: al dejar de deslizarse NO
        // se clava en seco (0.45 s de fricción suave conservando la velocidad)
        if (Math.hypot(this.vel.x, this.vel.z) > MAX_SPEED * 0.55) this.slideMomentumT = SLIDE_MOMENTUM_T;
      }
    }

    // ---- movimiento (relativo a la cámara) ----
    // Con yaw=0 la cámara mira hacia +Z y la derecha de la PANTALLA es -X,
    // así que input.x (derecha en pantalla) debe mapear a -X. Antes iba al revés
    // y los controles izquierda/derecha salían invertidos en el juego.
    const cos = Math.cos(camYaw), sin = Math.sin(camYaw);
    let wx = -input.x * cos + input.z * sin;
    let wz = input.x * sin + input.z * cos;
    const wlen = Math.hypot(wx, wz);
    const accel = this.grounded ? ACCEL : AIR_ACCEL;
    const ctrl = this.slideT > 0 ? 0.25 : 1;
    const hasInput = wlen > 0.05;
    // el giro empuja un poco hacia delante: objetivo ×1.15 durante 0.15 s.
    // El salto largo (barrida+salto) sostiene ×1.35 durante el vuelo: antes el
    // bloque de movimiento tiraba la velocidad del impulso de vuelta al tope
    // normal en ~0.2 s y el salto largo se quedaba en un salto normal.
    const spinPush = this.spinImpulseT > 0 ? SPIN_IMPULSE_X : 1;
    // El sostén ×1.35 solo aplica si se SIGUE empujando en la dirección del
    // impulso (dot>0.7): si el jugador gira 90° en el aire, el control normal
    // manda y no se convierte en un acelerador gratis en cualquier dirección.
    let ljPush = 1;
    if (this.longJumpBoostT > 0 && !this.grounded && wlen > 0.05) {
      const sp = Math.hypot(this.vel.x, this.vel.z);
      if (sp > 0.5 && ((this.vel.x * wx + this.vel.z * wz) / (sp * wlen)) > 0.7) ljPush = LONGJUMP_BOOST_X;
    }
    let rollTarget = 0;

    if (hasInput) {
      const tx = (wx / (wlen || 1)) * maxS * spinPush * ljPush;
      const tz = (wz / (wlen || 1)) * maxS * spinPush * ljPush;
      this.vel.x += (tx - this.vel.x) * Math.min(1, accel * ctrl * dt / maxS * 1.4);
      this.vel.z += (tz - this.vel.z) * Math.min(1, accel * ctrl * dt / maxS * 1.4);
      // orientar a donde va (en suelo gira más vivo; en aire, sin robotismo)
      const target = Math.atan2(wx, wz);
      let diff = target - this.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turnRate = this.spinT > 0 ? 18 : (this.grounded ? TURN_GROUND : TURN_AIR);
      this.facing += diff * Math.min(1, turnRate * dt);
      // roll visual hacia el lado del giro (solo presentación)
      rollTarget = Math.max(-1, Math.min(1, -diff * 1.8)) * ROLL_MAX;
    } else if (this.grounded) {
      // frenada con inercia: al soltar, 0.15 s de fricción suave y luego la
      // normal. Si venimos de una BARRIDA (slideMomentumT>0) la fricción es aún
      // más baja: el impulso se conserva y el cambio de barrida→carrera no
      // clava al jugador en seco (auditoría: frenaba 13.3→0 m/s en 0.6 s).
      if (this.hadInput) this.stopT = STOP_GRACE;
      const fr = this.slideMomentumT > 0 ? MOMENTUM_FRICTION : (this.stopT > 0 ? STOP_FRICTION : FRICTION);
      const sp = Math.hypot(this.vel.x, this.vel.z);
      if (sp > 0) {
        const drop = Math.min(sp, fr * dt);
        this.vel.x -= (this.vel.x / sp) * drop;
        this.vel.z -= (this.vel.z / sp) * drop;
      }
    }
    // el roll siempre se interpola (se endereza solo al dejar de girar)
    this.roll += (rollTarget - this.roll) * Math.min(1, 12 * dt);
    this.hadInput = hasInput;

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
    // ORDEN: primero se COMPRUEBA el salto (con el coyote/buffer acumulados del
    // frame anterior) y luego se decrementan. Al revés se perdía un frame de
    // margen en cada pulsación al borde de una plataforma.
    if (this.grounded) { this.coyote = COYOTE; this.jumps = 0; }
    if (input.jumpP) this.buffer = JUMP_BUFFER;

    if (this.buffer > 0) {
      const longJump = this.longJumpWindow > 0 && (this.vel.x || this.vel.z);
      if ((this.coyote > 0 || this.grounded) && this.jumps === 0) {
        this.jumps = 1;
        // jumpBoost: el buff del PURO (2 puros) hace saltar más alto
        this.vel.y = JUMP_V * (longJump ? 1.06 : 1) * (this.jumpBoost || 1);
        if (longJump) {
          const sp = Math.hypot(this.vel.x, this.vel.z) || 1;
          this.vel.x = (this.vel.x / sp) * maxS * LONGJUMP_BOOST_X;
          this.vel.z = (this.vel.z / sp) * maxS * LONGJUMP_BOOST_X;
          this.longJumpBoostT = LONGJUMP_BOOST_T;   // el impulso aguanta en el aire
          this.onLongJump && this.onLongJump();
        }
        // cancelar barrida con el salto (el salto largo de la ventana se mantiene)
        if (this.slideT > 0) this.slideT = 0;
        this.buffer = 0; this.coyote = 0;
        this.onJump && this.onJump(false);
      } else if (this.jumps === 1 && this.maxJumps > 1) {
        this.jumps = 2;
        this.vel.y = JUMP_V * DJUMP_V;
        this.buffer = 0;
        this.onJump && this.onJump(true);
      } else if (this.jumps === 0 && this.coyote <= 0 && this.vel.y <= AIR_JUMP_MAXVY && !this.grounded) {
        // RECUPERACIÓN: te caíste de un borde sin saltar (jumps seguía en 0).
        // Antes ninguna rama aplicaba y el jugador perdía sus DOS saltos: este
        // salto aéreo lo devuelve a la plataforma. Consume los dos saltos (el
        // doble ya no aplica) para no premiar más caerse que saltar bien.
        this.jumps = this.maxJumps;
        this.vel.y = JUMP_V * AIR_JUMP_V;
        this.buffer = 0;
        this.onJump && this.onJump(true);
      }
    }
    if (this.coyote > 0 && !this.grounded) this.coyote = Math.max(0, this.coyote - dt);
    if (this.buffer > 0) this.buffer = Math.max(0, this.buffer - dt);
    if (!input.jump && this.vel.y > 0 && this.jumps > 0) this.vel.y -= GRAV_UP * JUMP_CUT * 1.4 * dt;

    // ---- gravedad ----
    const g = this.vel.y > 0 ? GRAV_UP : GRAV_DOWN;
    this.vel.y -= g * dt;
    this.vel.y = Math.max(this.vel.y, -30);

    // ---- física ----
    this.landImpact = Math.max(0, -this.vel.y);   // velocidad de caída (para el golpe de aterrizaje)
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
    this.obj.rotation.z = this.roll;   // inclinación al girar (presentación)
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
    // el guiso está VIVO: los ingredientes burbujean (el vapor se retiró del
    // personaje en la limpieza final: eran manchas grises flotando sobre la cara)
    if (ud.ings) {
      for (const it of ud.ings) {
        it.position.y = it.userData.baseY + Math.sin(this.animT * 3.2 + it.userData.fase) * 0.022;
        it.rotation.y += dt * 0.6;
      }
    }
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

    // sombra proyectada: el sólido más alto a los pies del jugador (la
    // referencia es la altura de los pies, no maxY:0 como antes, que dejaba la
    // sombra siempre a nivel del suelo aunque estuvieras sobre un andamio)
    const g2 = world.groundUnder({ minX: this.pos.x - 0.3, maxX: this.pos.x + 0.3, minZ: this.pos.z - 0.3, maxZ: this.pos.z + 0.3, minY: -50, maxY: this.pos.y + 0.05 });
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
    // ESTELA de la barrida: chispas/raspado continuo mientras se desliza
    if (this.slideT > 0) {
      this.slideDust = (this.slideDust || 0) - dt;
      if (this.slideDust <= 0 && this.onDust) {
        this.slideDust = 0.035;
        this.onDust();
        this.onSlideTrail && this.onSlideTrail();
      }
    }
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
