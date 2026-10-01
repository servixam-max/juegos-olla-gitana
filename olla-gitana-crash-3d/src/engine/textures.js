/* ============================================================================
   Olla Gitana 3D · src/engine/textures.js   (Sprint 3 · Worker C1)
   ----------------------------------------------------------------------------
   Biblioteca de TEXTURAS PROCEDURALES CACHEADAS generadas 100% en runtime con
   canvas 2D: no hay imágenes externas, ni fetch, ni assets. Cada función
   exportada pinta el canvas la primera vez y guarda la THREE.CanvasTexture en
   un Map interno; a partir de ahí devuelve SIEMPRE la misma instancia para la
   misma clave (familia + variante de tono/color).

   Convenciones de la biblioteca:
   · Canvas de 256×256 como máximo (coste bajo para mantener 60 FPS).
   · Patrones TILEABLES (sin costuras) y deterministas (PRNG con semilla fija,
     el mismo build pinta siempre lo mismo).
   · RepeatWrapping + filtros de la familia LINEAR (nunca NearestFilter).
   · colorSpace en sRGB porque se usan como `map` de MeshToonMaterial.
   · (repX, repY) NO forman parte de la clave de caché: al devolver la textura
     se actualiza `texture.repeat.set(repX, repY)` para ajustarla a cada
     superficie (suelos, muros, cajas…).

   Uso típico:
     const suelo = new THREE.MeshToonMaterial({ color: 0xffffff, map: texTierra('', 8, 8) });
   ============================================================================ */
import * as THREE from 'three';

/* =============================== INTERNOS ================================ */

const CACHE = new Map(); // clave -> THREE.CanvasTexture (caché única del módulo)
const TAM = 256;         // lado del canvas (el máximo permitido por el sprint)

/* PRNG determinista (mulberry32): mismo seed => mismo dibujo siempre */
function rnd(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* '#rgb' / '#rrggbb' -> 'rgba(r,g,b,a)'. Si no es hex, se devuelve tal cual */
function rgba(hex, a = 1) {
  const h = String(hex).trim();
  if (h[0] !== '#') return h;
  const n = parseInt(h.length === 4
    ? h[1] + h[1] + h[2] + h[2] + h[3] + h[3]
    : h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* aclara (f > 1) u oscurece (f < 1) un color hex */
function shade(hex, f) {
  const h = String(hex).trim();
  if (h[0] !== '#') return h;
  const n = parseInt(h.length === 4
    ? h[1] + h[1] + h[2] + h[2] + h[3] + h[3]
    : h.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

/* Elipse rellena TILEABLE: además de en (x,y) se pinta desplazada ±TAM en x
   e y, de modo que las formas que caen en el borde reaparecen por el otro
   lado y el patrón repite sin costuras. */
function blob(ctx, x, y, rx, ry, rot, color) {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const px = x + dx * TAM;
      const py = y + dy * TAM;
      if (px + rx < -2 || px - rx > TAM + 2 || py + ry < -2 || py - ry > TAM + 2) continue;
      ctx.save();
      ctx.translate(px, py);
      if (rot) ctx.rotate(rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    }
  }
}

/* Línea ondulada horizontal y(x) = y0 + sin(...) con periodos ENTEROS:
   recorre todo el ancho y empalma consigo misma (tileable en x). */
function onda(ctx, y0, amp, periodos, fase, color, grosor) {
  const k = (Math.PI * 2 * periodos) / TAM;
  ctx.beginPath();
  for (let x = 0; x <= TAM; x += 4) {
    const y = y0 + Math.sin(x * k + fase) * amp;
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.lineWidth = grosor;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.stroke();
}

/* Fábrica + caché: pinta una sola vez y configura la textura para el juego */
function crear(clave, pintar) {
  const guardada = CACHE.get(clave);
  if (guardada) return guardada;
  const cv = document.createElement('canvas');
  cv.width = cv.height = TAM;
  const ctx = cv.getContext('2d');
  pintar(ctx);
  const tex = new THREE.CanvasTexture(cv);
  tex.name = clave;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;             // familia LINEAR (nada de NearestFilter)
  tex.minFilter = THREE.LinearMipmapLinearFilter; // LINEAR + mipmaps: evita parpadeo a distancia
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;          // se usa como `map`
  tex.needsUpdate = true;
  CACHE.set(clave, tex);
  return tex;
}

/* Devuelve la textura cacheada ajustando su repetición a la superficie */
function servir(tex, repX, repY) {
  tex.repeat.set(repX, repY);
  return tex;
}

/* ============================ 1) TIERRA ================================== */

/* Tono -> color base. Admite clave con nombre o un color CSS directo (#...). */
const TONOS_TIERRA = {
  '': '#7a5b3a', base: '#7a5b3a', tierra: '#7a5b3a',
  roja: '#8a4b34', rojo: '#8a4b34', murciana: '#8a4b34',
  seca: '#a08a5e', arena: '#c2a878',
  huerta: '#5f6b34', verde: '#5f6b34',
  oscura: '#4a3826', noche: '#3d3550', azul: '#3d4a5c'
};
function colorTierra(tono) {
  const k = String(tono || '').trim().toLowerCase();
  if (TONOS_TIERRA[k]) return TONOS_TIERRA[k];
  if (k[0] === '#' || k.startsWith('rgb')) return k;
  return TONOS_TIERRA[''];
}

function pintarTierra(ctx, base) {
  const R = rnd(1010 + base.length * 7);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, TAM, TAM);

  // 1) moteado de arcilla: manchas suaves claras/oscuras
  for (let i = 0; i < 95; i++) {
    const c = R() < 0.5
      ? rgba(shade(base, 1.16), 0.10 + R() * 0.10)
      : rgba(shade(base, 0.72), 0.10 + R() * 0.13);
    blob(ctx, R() * TAM, R() * TAM, 6 + R() * 22, 4 + R() * 14, R() * Math.PI, c);
  }

  // 2) surcos de arado: pareja sombra + cresta iluminada, en filas
  const filas = 5;
  for (let f = 0; f < filas; f++) {
    const y0 = (f + 0.5) * (TAM / filas) - 4;
    const amp = 2.5 + R() * 3.5;
    const per = 1 + Math.floor(R() * 2);
    const fase = R() * Math.PI * 2;
    onda(ctx, y0 + 2.5, amp, per, fase, rgba(shade(base, 0.60), 0.55), 2.4); // fondo del surco
    onda(ctx, y0 + 4.5, amp, per, fase, rgba(shade(base, 1.28), 0.35), 1.5); // cresta con luz
  }

  // 3) motas finas de grava
  for (let i = 0; i < 300; i++) {
    const r = 0.6 + R() * 1.7;
    const c = R() < 0.6
      ? rgba(shade(base, 1.32), 0.30 + R() * 0.35)
      : rgba(shade(base, 0.55), 0.28 + R() * 0.30);
    blob(ctx, R() * TAM, R() * TAM, r, r * 0.8, 0, c);
  }

  // 4) alguna piedrecilla clara con su sombra
  for (let i = 0; i < 24; i++) {
    const x = R() * TAM, y = R() * TAM, r = 1.3 + R() * 2.6;
    blob(ctx, x + 0.9, y + 1.0, r, r * 0.75, R() * 3, 'rgba(0,0,0,0.20)');
    blob(ctx, x, y, r, r * 0.75, R() * 3, rgba('#cbbfa6', 0.7 + R() * 0.3));
  }
}

/* Suelo terroso (motas + surcos). tono: '', 'roja', 'seca', 'huerta', 'arena',
   'oscura', 'noche'… o un color CSS. Devuelve textura cacheada. */
export function texTierra(tono = '', repX = 1, repY = 1) {
  const base = colorTierra(tono);
  return servir(crear('tierra|' + base, (ctx) => pintarTierra(ctx, base)), repX, repY);
}

/* ============================ 2) LADRILLO ================================ */

const TONOS_LADRILLO = {
  '': '#b5432f', base: '#b5432f', rojo: '#b5432f', teja: '#a63c2c',
  cal: '#c2b49a', arena: '#c9a06a', morado: '#5b3a78',
  noche: '#4a4458', verde: '#4a6b3a'
};
function colorLadrillo(color) {
  const k = String(color || '').trim().toLowerCase();
  if (TONOS_LADRILLO[k]) return TONOS_LADRILLO[k];
  if (k[0] === '#' || k.startsWith('rgb')) return k;
  return TONOS_LADRILLO[''];
}

function pintarLadrillo(ctx, base) {
  const R = rnd(2020 + base.length * 11);
  const mortero = '#c9b79a';
  const filas = 4;                 // 4 hiladas => alto de hilada 64 px
  const alto = TAM / filas;
  const junta = 7;
  const ancho = TAM / 2;           // 2 ladrillos por hilada (128 px)

  // fondo = mortero, con su propia arenilla
  ctx.fillStyle = mortero;
  ctx.fillRect(0, 0, TAM, TAM);
  for (let i = 0; i < 420; i++) {
    ctx.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)';
    ctx.fillRect(R() * TAM, R() * TAM, 1 + R() * 2, 1 + R() * 2);
  }

  // hiladas con trabazón a soga (media pieza desplazada en las impares)
  for (let f = 0; f < filas; f++) {
    const y = f * alto + junta / 2;
    const altoLad = alto - junta;
    const desfase = (f % 2) ? ancho / 2 : 0;
    for (let i = -1; i <= 2; i++) {
      const x = i * ancho + desfase + junta / 2;
      const anchoLad = ancho - junta;
      const v = 0.86 + R() * 0.28;                 // cada ladrillo con su tono
      ctx.fillStyle = shade(base, v);
      ctx.fillRect(x, y, anchoLad, altoLad);
      // bisel: luz arriba / sombra abajo
      ctx.fillStyle = rgba(shade(base, 1.30), 0.50);
      ctx.fillRect(x, y, anchoLad, 2.5);
      ctx.fillStyle = rgba(shade(base, 0.52), 0.45);
      ctx.fillRect(x, y + altoLad - 3, anchoLad, 3);
      // arcilla: ruido de la cara + desconchones
      for (let n = 0; n < 95; n++) {
        const px = x + 2 + R() * (anchoLad - 4);
        const py = y + 3 + R() * (altoLad - 8);
        ctx.fillStyle = R() < 0.5
          ? rgba(shade(base, 1.22), 0.16)
          : rgba(shade(base, 0.68), 0.20);
        ctx.fillRect(px, py, 1 + R() * 2, 1 + R() * 1.6);
      }
      if (R() < 0.34) {
        blob(ctx, x + anchoLad * (0.2 + R() * 0.6), y + altoLad * (0.3 + R() * 0.4),
          3 + R() * 5, 2 + R() * 3, R() * 3, rgba('#d8c7a8', 0.45));
      }
    }
  }
}

/* Muros de ladrillo con mortero. color: '', 'teja', 'morado', 'noche'… o CSS */
export function texLadrillo(color = '', repX = 1, repY = 1) {
  const base = colorLadrillo(color);
  return servir(crear('ladrillo|' + base, (ctx) => pintarLadrillo(ctx, base)), repX, repY);
}

/* ============================= 3) MADERA ================================= */

function pintarMadera(ctx) {
  const R = rnd(3030);
  const base = '#a2703f';                     // madera cálida (cajas y cajones)
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, TAM, TAM);

  const tablas = 2, ancho = TAM / tablas;
  for (let t = 0; t < tablas; t++) {
    const x0 = t * ancho;
    // cada tabla con su veta general
    ctx.fillStyle = shade(base, 0.92 + R() * 0.16);
    ctx.fillRect(x0, 0, ancho, TAM);
    // junta entre tablas (sombra + labio iluminado)
    ctx.fillStyle = rgba(shade(base, 0.42), 0.85);
    ctx.fillRect(x0, 0, 3, TAM);
    ctx.fillStyle = rgba(shade(base, 1.28), 0.30);
    ctx.fillRect(x0 + 3, 0, 1.5, TAM);

    // vetas verticales: líneas sinusoidales (tileables en y)
    const n = 15 + Math.floor(R() * 9);
    for (let i = 0; i < n; i++) {
      const xc = x0 + 5 + R() * (ancho - 10);
      const amp = 0.8 + R() * 3.5;
      const per = 1 + Math.floor(R() * 3);
      const fase = R() * Math.PI * 2;
      const k = (Math.PI * 2 * per) / TAM;
      const oscura = R() < 0.62;
      const c = oscura
        ? rgba(shade(base, 0.58), 0.16 + R() * 0.26)
        : rgba(shade(base, 1.38), 0.14 + R() * 0.20);
      ctx.beginPath();
      for (let y = 0; y <= TAM; y += 4) {
        const x = xc + Math.sin(y * k + fase) * amp;
        if (y === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineWidth = 0.7 + R() * 1.7;
      ctx.strokeStyle = c;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // nudo de la madera (anillos concéntricos)
    const nx = x0 + ancho * (0.30 + R() * 0.40);
    const ny = R() * TAM;
    for (let a = 5; a >= 1; a--) {
      blob(ctx, nx, ny, a * 2.0, a * 3.3, 0, rgba(shade(base, 0.42 + a * 0.09), 0.5));
    }
    blob(ctx, nx, ny, 3, 5, 0, rgba(shade(base, 0.32), 0.92));
  }

  // poro fino de la madera
  for (let i = 0; i < 260; i++) {
    blob(ctx, R() * TAM, R() * TAM, 0.5 + R() * 1.2, 0.4 + R() * 0.8, 0,
      rgba(R() < 0.5 ? shade(base, 0.6) : shade(base, 1.3), 0.10 + R() * 0.14));
  }
}

/* Tablones con vetas verticales cálidas (cajas, escenario, suelos de madera) */
export function texMadera(repX = 1, repY = 1) {
  return servir(crear('madera', pintarMadera), repX, repY);
}

/* ============================== 4) METAL ================================= */

function pintarMetal(ctx) {
  const R = rnd(4040);
  const base = '#9aa5b1';                     // PALETA.metal
  ctx.fillStyle = shade(base, 0.78);          // juntas/sombra de fondo
  ctx.fillRect(0, 0, TAM, TAM);

  const n = 2, lado = TAM / n;                // 2×2 placas remachadas
  for (let fy = 0; fy < n; fy++) {
    for (let fx = 0; fx < n; fx++) {
      const x = fx * lado, y = fy * lado;
      ctx.fillStyle = shade(base, 0.90 + R() * 0.18);
      ctx.fillRect(x + 2, y + 2, lado - 4, lado - 4);
      // bisel de la placa
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.fillRect(x + 2, y + 2, lado - 4, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(x + 2, y + 2, 2, lado - 4);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x + 2, y + lado - 4, lado - 4, 2);
      // cepillado horizontal sutil
      for (let i = 0; i < 70; i++) {
        ctx.fillStyle = R() < 0.5
          ? `rgba(255,255,255,${(0.04 + R() * 0.06).toFixed(3)})`
          : `rgba(0,0,0,${(0.03 + R() * 0.05).toFixed(3)})`;
        ctx.fillRect(x + 4 + R() * (lado - 40), y + 6 + R() * (lado - 12),
          12 + R() * (lado - 44), 1);
      }
      // 4 remaches por placa (brillo + cuerpo + sombra + chispa)
      const pts = [[14, 14], [lado - 14, 14], [14, lado - 14], [lado - 14, lado - 14]];
      for (const [rx, ry] of pts) {
        const px = x + rx, py = y + ry, r = 5.5;
        blob(ctx, px + 0.8, py + 1.0, r, r, 0, 'rgba(0,0,0,0.28)');
        blob(ctx, px, py, r, r, 0, shade(base, 0.80));
        blob(ctx, px - 0.6, py - 0.8, r * 0.62, r * 0.62, 0, shade(base, 1.18));
        blob(ctx, px - 1.4, py - 1.8, r * 0.28, r * 0.28, 0, 'rgba(255,255,255,0.78)');
      }
    }
  }

  // rayones finos
  for (let i = 0; i < 26; i++) {
    const l = 6 + R() * 26;
    blob(ctx, R() * TAM, R() * TAM, l / 2, 0.3 + R() * 0.45, -0.35 + R() * 0.7,
      rgba(R() < 0.6 ? '#ffffff' : '#000000', 0.05 + R() * 0.06));
  }
}

/* Placas metálicas con remaches (altavoces, amplis, vagonetas, rejas) */
export function texMetal(repX = 1, repY = 1) {
  return servir(crear('metal', pintarMetal), repX, repY);
}

/* ============================== 5) AGUA ================================== */

function pintarAgua(ctx) {
  const R = rnd(5050);
  const base = '#1e7f92';                     // turquesa profundo
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, TAM, TAM);

  // fondos de acequia: manchas de profundidad y reflejos turquesa
  for (let i = 0; i < 46; i++) {
    const r = 16 + R() * 52;
    const c = R() < 0.5
      ? rgba('#0c5a6b', 0.16 + R() * 0.16)
      : rgba('#4cc9f0', 0.05 + R() * 0.09);
    blob(ctx, R() * TAM, R() * TAM, r, r * (0.35 + R() * 0.45), R() * 3, c);
  }

  // ondas: 6 crestas sinusoidales con sombra, luz y espuma
  const filas = 6, alto = TAM / filas;
  for (let f = 0; f < filas; f++) {
    const y0 = f * alto + 6 + R() * 8;
    const amp = 2 + R() * 5;
    const per = 2 + Math.floor(R() * 3);
    const fase = R() * Math.PI * 2;
    const k = (Math.PI * 2 * per) / TAM;
    onda(ctx, y0 + 2.5, amp, per, fase, rgba('#084352', 0.40), 2.8);          // panza
    onda(ctx, y0, amp, per, fase, rgba('#8fe8f5', 0.35 + R() * 0.35), 1.6);  // cresta con luz
    for (let i = 0; i < 9; i++) {                                            // espuma
      const x = R() * TAM;
      const y = y0 + Math.sin(x * k + fase) * amp;
      blob(ctx, x, y - 1.2, 1 + R() * 2.4, 0.8 + R() * 1.2, 0, rgba('#eafcff', 0.25 + R() * 0.35));
    }
  }

  // destellos sueltos
  for (let i = 0; i < 70; i++) {
    blob(ctx, R() * TAM, R() * TAM, 0.6 + R() * 1.6, 0.5 + R() * 1.0, 0,
      rgba('#ffffff', 0.08 + R() * 0.16));
  }
}

/* Ondas azul-turquesa (acequias, piscinas, charcas de la huerta) */
export function texAgua(repX = 1, repY = 1) {
  return servir(crear('agua', pintarAgua), repX, repY);
}

/* ============================= 6) FOLLAJE ================================ */

function pintarFollaje(ctx) {
  const R = rnd(6060);
  ctx.fillStyle = '#2c5426';                  // verde profundo: hojas en sombra
  ctx.fillRect(0, 0, TAM, TAM);

  // masas de vegetación a distintos niveles de luz
  const verdes = ['#1f4519', '#2d6a2d', '#38b000', '#4f8a2b', '#6aa83c'];
  for (let i = 0; i < 72; i++) {
    const r = 10 + R() * 30;
    blob(ctx, R() * TAM, R() * TAM, r, r * (0.5 + R() * 0.5), R() * 3,
      rgba(verdes[Math.floor(R() * verdes.length)], 0.18 + R() * 0.22));
  }

  // hojas: elipses rotadas con vena
  for (let i = 0; i < 140; i++) {
    const x = R() * TAM, y = R() * TAM;
    const rx = 6 + R() * 9;
    const ry = rx * (0.30 + R() * 0.20);
    const rot = R() < 0.6 ? -Math.PI / 2 + (R() - 0.5) * 1.3 : R() * Math.PI;
    const c = R() < 0.5 ? '#38b000' : (R() < 0.6 ? '#2d8a1f' : '#57a12b');
    blob(ctx, x, y, rx, ry, rot, rgba(c, 0.55 + R() * 0.40));
    blob(ctx, x, y, rx * 0.78, ry * 0.16, rot, rgba('#0e2a0a', 0.35)); // vena central
  }

  // brillos de sol entre las hojas
  for (let i = 0; i < 40; i++) {
    blob(ctx, R() * TAM, R() * TAM, 2 + R() * 6, 1.5 + R() * 4, R() * 3,
      rgba('#d8f3a0', 0.08 + R() * 0.10));
  }
}

/* Verde con hojas (setos, huerta, copas de árboles, jardineras) */
export function texFollaje(repX = 1, repY = 1) {
  return servir(crear('follaje', pintarFollaje), repX, repY);
}

/* ============================== 7) TAPIZ ================================= */

function pintarTapiz(ctx) {
  const R = rnd(7070);
  ctx.fillStyle = '#2a1747';                  // terciopelo morado profundo
  ctx.fillRect(0, 0, TAM, TAM);

  // trama del tejido (líneas finísimas cruzadas)
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = '#fff5e1';
  ctx.lineWidth = 1;
  for (let i = 0; i < TAM; i += 4) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, TAM); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(TAM, i); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // manchas de terciopelo (volumen)
  for (let i = 0; i < 30; i++) {
    const r = 20 + R() * 50;
    blob(ctx, R() * TAM, R() * TAM, r, r * (0.55 + R() * 0.4), R() * 3,
      rgba(R() < 0.5 ? '#3b2264' : '#1d1036', 0.25));
  }

  // retícula 4×4 de rombos dorados (nudos en los bordes => tileable)
  const celda = TAM / 4;
  for (let iy = 0; iy <= 4; iy++) {
    for (let ix = 0; ix <= 4; ix++) {
      const cx = ix * celda, cy = iy * celda;
      const rombo = (r, fill, stroke, lw) => {
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r, cy);
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
      };
      rombo(celda * 0.46, null, rgba('#ffbe0b', 0.90), 2.4);                       // rombo dorado
      rombo(celda * 0.30, rgba('#8338ec', 0.80), rgba('#ffbe0b', 0.50), 1.4);      // rombo morado
      rombo(celda * 0.13, rgba((ix + iy) % 2 ? '#e63946' : '#fff5e1', 0.90), null, 0); // punto central
      // chispas doradas alrededor
      for (let s = 0; s < 4; s++) {
        const a = (s / 4) * Math.PI * 2 + 0.4;
        blob(ctx, cx + Math.cos(a) * celda * 0.36, cy + Math.sin(a) * celda * 0.36,
          1.4, 1.4, 0, rgba('#ffbe0b', 0.7));
      }
    }
  }
}

/* Tapiz geométrico dorado/morado: cortinas y alfombras del casino */
export function texTapiz(repX = 1, repY = 1) {
  return servir(crear('tapiz', pintarTapiz), repX, repY);
}

/* ============================== 8) NOCHE ================================= */

function pintarNoche(ctx) {
  const R = rnd(8080);
  ctx.fillStyle = '#0a0f26';                  // azul noche casi negro
  ctx.fillRect(0, 0, TAM, TAM);

  // nebulosas suaves (volumen del cielo)
  for (let i = 0; i < 28; i++) {
    const r = 24 + R() * 70;
    const c = R() < 0.5 ? '#1b2350' : (R() < 0.5 ? '#3a2a66' : '#14264d');
    blob(ctx, R() * TAM, R() * TAM, r, r * (0.4 + R() * 0.5), R() * 3, rgba(c, 0.16 + R() * 0.20));
  }

  // estrellas menudas
  for (let i = 0; i < 190; i++) {
    const r = 0.5 + R() * 1.1;
    const c = R() < 0.75 ? '#fff5e1' : (R() < 0.5 ? '#cfe3ff' : '#ffd97a');
    blob(ctx, R() * TAM, R() * TAM, r, r, 0, rgba(c, 0.50 + R() * 0.50));
  }

  // estrellas brillantes con halo y destello en cruz
  for (let i = 0; i < 7; i++) {
    const x = R() * TAM, y = R() * TAM, r = 1.5 + R() * 1.2;
    blob(ctx, x, y, r * 4.5, r * 4.5, 0, 'rgba(255,245,225,0.06)');
    blob(ctx, x, y, r * 2.4, r * 2.4, 0, 'rgba(255,245,225,0.16)');
    blob(ctx, x, y, r, r, 0, 'rgba(255,255,255,0.95)');
    blob(ctx, x, y, r * 4.2, 0.5, 0, 'rgba(255,255,255,0.28)');  // brazo horizontal
    blob(ctx, x, y, 0.5, r * 4.2, 0, 'rgba(255,255,255,0.28)');  // brazo vertical
  }
}

/* Cielo nocturno con estrellas (niveles 5 y 7, fondo, cúpulas) */
export function texNoche(repX = 1, repY = 1) {
  return servir(crear('noche', pintarNoche), repX, repY);
}
