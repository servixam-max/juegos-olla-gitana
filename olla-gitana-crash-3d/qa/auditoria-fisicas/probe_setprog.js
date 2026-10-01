/* Prepara localStorage del progreso para el probe de vidas. */
localStorage.setItem('olla3d_progreso_v1', JSON.stringify({ desbloqueados: 8, superVidas: 1, continues: 1, nivelActual: 0, mejorNivel: 0 }));
return { ok: true, prog: localStorage.getItem('olla3d_progreso_v1') };
