/* PUROS voladores (sustituyen a la máscara compañera, petición del usuario):
   "la máscara cámbiala por cigarros que te sigan volando, y cuando obtengas
    dos pues se lo pones en la boca a la olla y que sea invulnerable durante
    30 segundos y vaya algo más rápido y salte más".

   - PURO 1: te sigue VOLANDO por el nivel (puro compañero flotante).
   - PURO 2: la olla se lo pone EN LA BOCA y arranca el BUFF de 30 s:
       · invulnerable (no te quitan vidas)
       · speedBoost 1.35 (más rápido)
       · jumpBoost 1.22 (salta más)
       · humo continuo saliendo del puro
   - Al acabar el buff, todo vuelve a la normalidad (y hay que volver a coger).
   El objeto y la clase mantienen el nombre viejo para no romper main.js. */
import * as THREE from 'three';
import { toonMat, PALETA } from './art.js';

const DURACION_BUFF = 30;      // segundos de invulnerabilidad + mejoras
const SPEED_BOOST = 1.35;      // más rápido
const JUMP_BOOST = 1.22;       // salta más alto

function puroMesh(encendido) {
  const g = new THREE.Group();
  // cuerpo del puro (capa marrón)
  const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.5, 12), toonMat(0x6b4423));
  cuerpo.rotation.z = Math.PI / 2 - 0.2;
  g.add(cuerpo);
  // anilla dorada (vitola)
  const anilla = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.018, 6, 14), toonMat(PALETA.dorado));
  anilla.rotation.y = Math.PI / 2 - 0.2;
  anilla.position.set(0.09, 0.02, 0);
  g.add(anilla);
  // brasa encendida (brilla sola: se ve en los niveles oscuros)
  const brasa = new THREE.Mesh(new THREE.SphereGeometry(encendido ? 0.075 : 0.06, 8, 6),
    new THREE.MeshBasicMaterial({ color: encendido ? 0xff3d00 : 0xff7b3a }));
  brasa.position.set(-0.26, 0.06, 0);
  g.add(brasa);
  // ceniza
  const ceniza = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.07, 0.05, 12), toonMat(0x2a2a2a));
  ceniza.rotation.z = Math.PI / 2 - 0.2;
  ceniza.position.set(-0.29, 0.07, 0);
  g.add(ceniza);
  // humo (bolas translúcidas que suben) — más con el buff activo
  const humoMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f5, transparent: true, opacity: 0.35, depthWrite: false });
  const humo = new THREE.Group();
  const nBolas = encendido ? 4 : 2;
  for (let i = 0; i < nBolas; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.07 + i * 0.02, 8, 6), humoMat.clone());
    b.position.set(-0.36 - i * 0.09, 0.13 + i * 0.1, 0);
    humo.add(b);
  }
  g.add(humo);
  g.userData.humo = humo;
  // aura de premio
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.026, 6, 16),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.5 }));
  halo.rotation.x = Math.PI / 2; halo.position.y = -0.02;
  g.add(halo);
  g.userData.halo = halo;
  g.scale.setScalar(1.25);
  return g;
}

export class MaskCompanion {
  constructor(scene) {
    this.scene = scene;
    this.nivel = 0;             // nº de puros cogidos (0, 1, 2)
    this.invT = 0;              // tiempo restante del buff (invulnerabilidad)
    this.obj = null;
    this.t = 0;
    this.hideT = 0;
    this.onChange = null;
  }

  /* construye el puro del nivel pedido: 1 = volador, 2 = en la boca */
  build(nivel) {
    if (this.obj) { this.scene.remove(this.obj); this.obj = null; }
    if (nivel <= 0) return;
    const g = puroMesh(nivel >= 2);
    this.obj = g;
    this.scene.add(g);
  }

  /* coge un puro: nivel 1 = te sigue volando; nivel 2 = a la boca + BUFF 30 s */
  add() {
    if (this.invT > 0) return 2;              // ya con buff: no acumula más
    this.nivel = Math.min(2, this.nivel + 1);
    this.build(this.nivel);
    if (this.nivel >= 2) this.invT = DURACION_BUFF;
    if (this.onChange) this.onChange(this.nivel);
    return this.nivel;
  }

  /* un golpe: con el buff activo no pasa nada; sin buff, el puro se pierde */
  hit() {
    if (this.invT > 0) return false;          // buff activo: invulnerable
    if (this.nivel <= 0) return false;
    this.nivel = 0;
    this.hideT = 0.45;
    this.build(0);
    if (this.onChange) this.onChange(0);
    return true;
  }

  get invulnerable() { return this.invT > 0; }
  /* multiplicadores para el jugador (los aplica main.js en el update) */
  get velocidadExtra() { return this.invT > 0 ? SPEED_BOOST : 1; }
  get saltoExtra() { return this.invT > 0 ? JUMP_BOOST : 1; }

  reset() {
    this.nivel = 0;
    this.invT = 0;
    this.hideT = 0;
    this.build(0);
  }

  update(dt, player, camera) {
    this.t += dt;
    if (this.invT > 0) {
      this.invT -= dt;
      if (this.invT <= 0) { this.nivel = 0; this.build(0); if (this.onChange) this.onChange(0); }
    }
    if (!this.obj) return;
    const p = player.pos;
    const f = player.facing;
    const bob = Math.sin(this.t * 2.8) * 0.1;
    let tx, ty, tz;
    if (this.nivel >= 2) {
      // EN LA BOCA: delante de la cara de la olla
      tx = p.x + Math.sin(f) * 0.62;
      tz = p.z + Math.cos(f) * 0.62;
      ty = p.y + 0.62 + bob * 0.4;
      this.obj.rotation.y = f;
    } else {
      // VOLANDO a su lado, un poco por detrás y arriba (puro compañero)
      tx = p.x - Math.sin(f) * 0.75 + Math.cos(f) * 0.5;
      tz = p.z - Math.cos(f) * 0.75 - Math.sin(f) * 0.5;
      ty = p.y + 1.45 + bob;
      // mira hacia la cámara (se ve el puro entero)
      if (camera) {
        const dx = camera.position.x - this.obj.position.x;
        const dz = camera.position.z - this.obj.position.z;
        this.obj.rotation.y = Math.atan2(dx, dz);
      }
    }
    const lerp = this.nivel >= 2 ? 14 : 7;      // en la boca va más pegado
    this.obj.position.x += (tx - this.obj.position.x) * Math.min(1, dt * lerp);
    this.obj.position.z += (tz - this.obj.position.z) * Math.min(1, dt * lerp);
    this.obj.position.y += (ty - this.obj.position.y) * Math.min(1, dt * lerp);
    // balanceo (más suave pegado a la boca)
    this.obj.rotation.z = Math.sin(this.t * (this.nivel >= 2 ? 3.4 : 2.2)) * (this.nivel >= 2 ? 0.06 : 0.12);
    // humo subiendo en bucle
    if (this.obj.userData.humo) {
      const h = this.obj.userData.humo;
      h.children.forEach((b, i) => {
        const k = (this.t * 0.5 + i * 0.25) % 1;
        b.position.y = 0.13 + k * 0.42;
        b.material.opacity = 0.35 * (1 - k);
      });
    }
    if (this.obj.userData.halo) {
      this.obj.userData.halo.scale.setScalar(1 + Math.sin(this.t * 5) * 0.12);
    }
    if (this.hideT > 0) this.hideT -= dt;
  }
}