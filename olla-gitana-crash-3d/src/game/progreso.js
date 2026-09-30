/* Progreso de la partida (guardado en localStorage, por navegador/persona):
   - niveles DESBLOQUEADOS: se abre el siguiente al pasar uno
   - VIDAS de nivel (siempre 3): se pierden con los golpes; al gastarlas → super-vida
   - SUPER-VIDAS (empiezas con 5): se cogen más en los niveles; al gastarlas → continue
   - CONTINUES (3): gastado uno, vuelves a empezar el nivel con 3 vidas
   - sin continues → GAME OVER: se borra el progreso y se vuelve al nivel 1
   Igual que los logros: todo local, cada persona con su progreso. */
const KEY = 'olla3d_progreso_v1';
export const VIDAS_NIVEL = 3;
export const SUPER_VIDAS_INICIAL = 5;
export const CONTINUES = 3;

export class Progreso {
  constructor() {
    this.data = this.load();
  }

  load() {
    let d = {};
    try { d = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { d = {}; }
    return {
      desbloqueados: Math.max(1, Math.min(8, d.desbloqueados || 1)),
      superVidas: d.superVidas != null ? d.superVidas : SUPER_VIDAS_INICIAL,
      continues: d.continues != null ? d.continues : CONTINUES,
      // el nivel más alto alcanzado con su estado (para "seguir jugando")
      nivelActual: Math.max(0, Math.min(7, d.nivelActual || 0)),
      mejorNivel: Math.max(0, Math.min(7, d.mejorNivel || 0))
    };
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (_) {}
  }

  /* ¿nivel desbloqueado? (índice 0..7) */
  desbloqueado(i) { return i < this.data.desbloqueados; }

  completarNivel(i) {
    const n = Math.max(this.data.desbloqueados, Math.min(8, i + 2));
    this.data.desbloqueados = n;
    this.data.mejorNivel = Math.max(this.data.mejorNivel, i + 1);
    this.save();
  }

  /* guarda el nivel actual para poder continuar tras cerrar */
  setNivel(i) { this.data.nivelActual = i; this.save(); }

  addSuperVida(n = 1) { this.data.superVidas += n; this.save(); return this.data.superVidas; }
  gastarSuperVida() { this.data.superVidas = Math.max(0, this.data.superVidas - 1); this.save(); return this.data.superVidas; }
  get superVidas() { return this.data.superVidas; }
  get continues() { return this.data.continues; }
  get desbloqueados() { return this.data.desbloqueados; }
  get nivelActual() { return this.data.nivelActual; }

  gastarContinue() { this.data.continues = Math.max(0, this.data.continues - 1); this.save(); return this.data.continues; }
  addContinue(n = 1) { this.data.continues = Math.min(9, this.data.continues + n); this.save(); return this.data.continues; }

  /* GAME OVER: se borra lo guardado y a empezar del nivel 1 */
  reset() {
    this.data = { desbloqueados: 1, superVidas: SUPER_VIDAS_INICIAL, continues: CONTINUES, nivelActual: 0, mejorNivel: 0 };
    this.save();
  }
}
