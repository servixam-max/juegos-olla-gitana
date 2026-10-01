/* ============================================================================
   Olla Gitana 3D · src/engine/surfaces.js   (Sprint 3 · paso C2)
   ----------------------------------------------------------------------------
   Puente entre la biblioteca de texturas procedurales (textures.js) y el
   mundo del juego: devuelve materiales toon CON textura para suelos, muros,
   plataformas, agua, etc. según el MUNDO y el TAG del bloque.

   IMPORTANTE — la caché de textures.js devuelve SIEMPRE la misma instancia de
   textura por clave, y `texture.repeat` es una propiedad de la instancia: si
   se comparte, el último repeat pisa a los demás. Por eso aquí CLONAMOS la
   textura por uso (`tex.clone()`), que reutiliza la misma imagen de canvas
   (coste casi nulo) pero permite repeat independiente por superficie.
   ============================================================================ */
import * as THREE from 'three';
import { toonGradient } from '../game/art.js';
import {
  texTierra, texLadrillo, texMadera, texMetal, texAgua, texFollaje, texTapiz, texNoche
} from './textures.js';

/* clon con repeat propio (comparte el canvas: barato) */
function conRepeat(tex, rx, ry) {
  const t = tex.clone();
  t.needsUpdate = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  return t;
}

const cache = new Map();

/* Textura + repetición por MUNDO y tipo de superficie.
   mundo: 1 callejón · 2 festi · 3 carretera · 4 procesión · 5 sardina (noche)
          6 huerta · 7 casino · 8 arena (escenario) */
function receta(mundo, clase) {
  const M = mundo || 1;
  switch (clase) {
    case 'suelo':
      if (M === 6) return { tex: texTierra('#6f5a3a'), rx: 3, ry: 8, color: 0xffffff };
      if (M === 7) return { tex: texTapiz('#3a2a55'), rx: 3, ry: 8, color: 0xffffff };
      if (M === 8) return { tex: texMadera(), rx: 3, ry: 8, color: 0xffe0b8 };
      if (M === 5) return { tex: texTierra('#4a3b2e', 1, 1), rx: 3, ry: 8, color: 0xb9a8c9 };
      return { tex: texTierra(), rx: 3, ry: 8, color: 0xffffff };
    case 'muro':
      if (M === 7) return { tex: texTapiz('#4a2f6b'), rx: 2, ry: 3, color: 0xffffff };
      if (M === 5) return { tex: texLadrillo('#5a4a70'), rx: 2, ry: 3, color: 0xd9c7ef };
      if (M === 6) return { tex: texLadrillo('#6b4f35'), rx: 2, ry: 3, color: 0xd8c9a8 };
      return { tex: texLadrillo(), rx: 2, ry: 3, color: 0xffffff };
    case 'plataforma': return { tex: texMadera(), rx: 2, ry: 2, color: 0xffffff };
    case 'movil': return { tex: texMetal(), rx: 2, ry: 2, color: 0xffffff };
    case 'agua': return { tex: texAgua(), rx: 3, ry: 2, color: 0xffffff };
    case 'cesped': return { tex: texFollaje(), rx: 3, ry: 3, color: 0xffffff };
    case 'arena': return { tex: texNoche(), rx: 3, ry: 3, color: 0xffffff };
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
  const map = conRepeat(r.tex, r.rx, r.ry);
  const opts = { map, color: r.color, gradientMap: toonGradient() };
  if (opacidad != null) { opts.transparent = true; opts.opacity = opacidad; }
  const m = new THREE.MeshToonMaterial(opts);
  cache.set(key, m);
  return m;
}

/* Traduce el tag de un bloque a su clase de superficie */
export function claseDeTag(tag, y, h) {
  if (tag === 'wall' || tag === 'rail' || tag === 'pole' || tag === 'speakerBase') return 'muro';
  if (tag === 'mover') return 'movil';
  if (tag === 'platform') return 'plataforma';
  if (tag === 'ground') return 'suelo';
  if (tag === 'floor') return (h && h < 0.7 && y != null && y + h <= 0.05) ? 'suelo' : 'suelo';
  if (tag === 'water' || tag === 'acequia') return 'agua';
  if (tag === 'grass' || tag === 'cesped') return 'cesped';
  return null;
}
