/* ============================================================================
   Olla Gitana 3D · src/engine/surfaces.js   (Sprint 3 · paso C2 · ronda texturas)
   ----------------------------------------------------------------------------
   Puente entre la biblioteca de texturas procedurales (textures.js) y el
   mundo del juego: devuelve materiales toon CON textura para suelos, muros,
   plataformas, agua, etc. según el MUNDO y el TAG del bloque.

   CLAVE DE LA RONDA (anti-estirón): las texturas ya NO se ajustan con
   `repeat` (que en una caja larga y estrecha estira el patrón por la cara
   lateral). Se usa `uvPorCara(material, escalaMetros)`: el UV se mide en
   METROS sobre la propia cara, así el grano es idéntico en un suelo de 16×9,
   en un muro de 1,2×6,4 o en una losa de 5,4×6,6. `esc` = lado en metros de
   una repetición de la textura.

   IMPORTANTE — la caché de textures.js devuelve SIEMPRE la misma instancia de
   textura por clave, y `texture.repeat` es propiedad de la instancia: se clona
   por material (`tex.clone()`, comparte el canvas: coste casi nulo) y se fija
   repeat(1,1) porque la escala vive ya en el UV.
   ============================================================================ */
import * as THREE from 'three';
import { toonGradient } from '../game/art.js';
import {
  texTierra, texLadrillo, texMadera, texMetal, texAgua, texFollaje, texTapiz, texNoche,
  texCesped, texMarmol, texArena, uvPorCara
} from './textures.js';

/* Textura cacheada compartida, con repeat neutro: la escala va en el UV por
   cara, así que TODOS los materiales pueden compartir la misma instancia de
   textura (una sola subida a GPU por textura, ~11 en total). */
function base(tex) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  tex.needsUpdate = true;
  return tex;
}

const cache = new Map();

/* Textura + escala (metros por repetición) por MUNDO y tipo de superficie.
   mundo: 1 callejón · 2 festi · 3 carretera · 4 procesión · 5 sardina (noche)
          6 huerta · 7 casino · 8 arena (escenario) */
function receta(mundo, clase) {
  const M = mundo || 1;
  switch (clase) {
    /* --- SUELOS: la calzada de cada mundo con su material propio ------------ */
    case 'suelo':
      if (M === 2) return { tex: texArena(), esc: 2.4, color: 0xe8dcc0 };            // albero del recinto
      if (M === 3) return { tex: texTierra('#4a4e55'), esc: 2.0, color: 0xffffff };  // asfalto de carretera
      if (M === 4) return { tex: texMarmol('gris'), esc: 1.6, color: 0xb9a8c9 };     // adoquín nocturno
      if (M === 5) return { tex: texTierra('#4a3b2e'), esc: 2.0, color: 0xb9a8c9 };  // tierra de la noche
      if (M === 6) return { tex: texCesped(), esc: 2.2, color: 0xffffff };           // hierba de huerta
      if (M === 7) return { tex: texMarmol('crema'), esc: 2.0, color: 0xffffff };    // mármol del casino
      if (M === 8) return { tex: texTierra('#3d3550'), esc: 2.4, color: 0xffffff };  // recinto del duelo
      return { tex: texTierra('#57575c'), esc: 2.0, color: 0xffffff };               // callejón (M1)
    /* --- MUROS: ladrillo/tapia por mundo ------------------------------------ */
    case 'muro':
      if (M === 2) return { tex: texLadrillo('#c9a06a'), esc: 2.2, color: 0xffffff };
      if (M === 3) return { tex: texLadrillo('#9aa5b1'), esc: 2.2, color: 0xcfd4d9 }; // bloque de hormigón
      if (M === 4) return { tex: texLadrillo('#5b3a78'), esc: 2.2, color: 0xd9c7ef };
      if (M === 5) return { tex: texLadrillo('#5a4a70'), esc: 2.2, color: 0xd9c7ef };
      if (M === 6) return { tex: texLadrillo('#6b4f35'), esc: 2.2, color: 0xd8c9a8 }; // tapia de tierra
      if (M === 7) return { tex: texMarmol('gris'), esc: 2.4, color: 0xe6dcc8 };      // piedra del salón
      if (M === 8) return { tex: texLadrillo('#3f3560'), esc: 2.4, color: 0xbfa8e6 }; // vallas del ring
      return { tex: texLadrillo(), esc: 2.0, color: 0xffffff };                       // ladrillo murciano
    /* --- PLATAFORMAS: madera en todo el juego ------------------------------- */
    case 'plataforma':
      if (M === 7) return { tex: texMarmol('crema'), esc: 2.0, color: 0xffffff };    // losas del salón
      return { tex: texMadera(), esc: 2.2, color: 0xe8d6c0 };
    case 'movil': return { tex: texMetal(), esc: 1.6, color: 0xd8dde3 };             // vagonetas/ascensores
    case 'agua': return { tex: texAgua(), esc: 3.0, color: 0xffffff, opacidad: 0.72 };
    case 'cesped': return { tex: texCesped(), esc: 2.2, color: 0xffffff };
    case 'arena': return { tex: texNoche(), esc: 3.0, color: 0xffffff };
    /* --- PIEZAS SUELTAS ----------------------------------------------------- */
    case 'pilar': return { tex: texMarmol('gris'), esc: 2.2, color: 0xc9bff0 };      // pilares del ring/salón
    case 'metal': return { tex: texMetal(), esc: 1.8, color: 0xffffff };             // postes, torretas
    case 'curb': return { tex: texLadrillo('#9aa5b1'), esc: 3.0, color: 0xb9bec4 };  // bordillos
    default: return null;
  }
}

/* Material toon con textura para una superficie del mundo dado.
   Devuelve null si no hay receta (el llamador usa toonMat normal). */
export function matSuperficie(mundo, clase, opacidad = null) {
  const r = receta(mundo, clase);
  if (!r) return null;
  const key = `${mundo}|${clase}|${opacidad ?? ''}`;
  if (cache.has(key)) return cache.get(key);
  const map = base(r.tex);
  const opts = { map, color: r.color, gradientMap: toonGradient() };
  const op = opacidad != null ? opacidad : r.opacidad;
  if (op != null) { opts.transparent = true; opts.opacity = op; }
  const m = new THREE.MeshToonMaterial(opts);
  uvPorCara(m, r.esc);
  cache.set(key, m);
  return m;
}

/* Traduce el tag de un bloque a su clase de superficie */
export function claseDeTag(tag) {
  if (tag === 'wall' || tag === 'rail' || tag === 'pole' || tag === 'speakerBase') return 'muro';
  if (tag === 'pillar') return 'pilar';
  if (tag === 'sign') return 'metal';
  if (tag === 'curb') return 'curb';
  if (tag === 'mover') return 'movil';
  if (tag === 'platform' || tag === 'ruina' || tag === 'tabla' || tag === 'rama') return 'plataforma';
  if (tag === 'ground' || tag === 'floor') return 'suelo';
  if (tag === 'pulido') return 'suelo';
  if (tag === 'water' || tag === 'acequia') return 'agua';
  if (tag === 'grass' || tag === 'cesped') return 'cesped';
  return null;
}

/* Resumen para QA: escala (metros por repetición) de cada receta conocida */
export function resumenRecetas() {
  const out = {};
  for (const m of [1, 2, 3, 4, 5, 6, 7, 8]) {
    for (const c of ['suelo', 'muro', 'plataforma', 'movil', 'agua', 'pilar', 'metal', 'curb']) {
      const r = receta(m, c);
      if (r) out[m + '|' + c] = r.esc;
    }
  }
  return out;
}
