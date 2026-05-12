/* Dotir 2 - core/telemetry.js
   Registro local de eventos de uso por perfil.

   API publica:
     Telemetry.track(evento, datos)   -> registrar evento
     Telemetry.getReporte(perfilId)   -> datos agregados
     Telemetry.exportar(perfilId)     -> descarga JSON
     Telemetry.limpiar(perfilId)      -> borrar eventos del perfil
*/

import { Perfiles } from './perfiles.js';

const LS_KEY      = 'dotir2-telemetria';
const MAX_EVENTOS = 500;

// -- Utilidades internas ---

function _uuid() {
  return 'e-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

function _cargar() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) { return []; }
}

function _guardar(eventos) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(eventos));
  } catch (e) {
    // localStorage lleno — eliminar los 50 mas antiguos y reintentar
    const recortados = eventos.slice(50);
    try { localStorage.setItem(LS_KEY, JSON.stringify(recortados)); } catch (_) {}
  }
}

// -- API publica ---

export const Telemetry = {

  /**
   * Registra un evento asociado al perfil activo.
   * @param {string} evento  Nombre del evento (ej: 'picto_seleccionado')
   * @param {object} datos   Datos adicionales del evento
   */
  track(evento, datos = {}) {
    const perfil = Perfiles.getActivo();
    if (!perfil) return;

    let todos = _cargar();

    // Limitar a MAX_EVENTOS por perfil eliminando los mas antiguos
    const delPerfil = todos.filter(e => e.perfil === perfil.id);
    if (delPerfil.length >= MAX_EVENTOS) {
      const idsAEliminar = new Set(
        delPerfil.slice(0, delPerfil.length - MAX_EVENTOS + 1).map(e => e.id)
      );
      todos = todos.filter(e => !idsAEliminar.has(e.id));
    }

    todos.push({
      id:     _uuid(),
      perfil: perfil.id,
      modulo: datos._modulo || 'desconocido',
      evento,
      datos:  { ...datos, _modulo: undefined },
      ts:     Date.now(),
    });

    _guardar(todos);
  },

  /**
   * Retorna datos agregados para un perfil.
   * @param {string} perfilId
   */
  getReporte(perfilId) {
    const todos    = _cargar();
    const eventos  = todos.filter(e => e.perfil === perfilId);

    // -- SAAC ---
    const pictos   = eventos.filter(e => e.evento === 'picto_seleccionado');
    const frases   = eventos.filter(e => e.evento === 'frase_hablada');
    const favsAgg  = eventos.filter(e => e.evento === 'fav_agregado');

    // Frecuencia de pictogramas
    const pictoFreq = {};
    pictos.forEach(e => {
      const k = e.datos.id;
      pictoFreq[k] = (pictoFreq[k] || { id: k, label: e.datos.label, categoria: e.datos.categoria, count: 0 });
      pictoFreq[k].count++;
    });
    const topPictos = Object.values(pictoFreq)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // -- Memorama ---
    const temasIniciados   = eventos.filter(e => e.evento === 'tema_iniciado');
    const parejas          = eventos.filter(e => e.evento === 'pareja_encontrada');
    const partidasComp     = eventos.filter(e => e.evento === 'partida_completada');

    // Frecuencia de temas
    const temaFreq = {};
    temasIniciados.forEach(e => {
      const k = e.datos.tema;
      temaFreq[k] = (temaFreq[k] || { tema: k, veces: 0 });
      temaFreq[k].veces++;
    });

    // Tiempo promedio de partidas completadas
    const duraciones    = partidasComp.map(e => e.datos.duracion_seg).filter(Boolean);
    const duracionProm  = duraciones.length
      ? Math.round(duraciones.reduce((a, b) => a + b, 0) / duraciones.length)
      : null;

    // Idiomas usados en memorama
    const idiomaFreq = {};
    parejas.forEach(e => {
      const k = e.datos.idioma;
      idiomaFreq[k] = (idiomaFreq[k] || 0) + 1;
    });

    // -- Multimedia ---
    const medias    = eventos.filter(e => e.evento === 'media_reproducido');
    const mediaFreq = {};
    medias.forEach(e => {
      const k = e.datos.archivo;
      mediaFreq[k] = (mediaFreq[k] || { titulo: e.datos.titulo, tipo: e.datos.tipo, archivo: k, count: 0 });
      mediaFreq[k].count++;
    });
    const topMedia = Object.values(mediaFreq)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // -- Resumen general ---
    const primerEvento = eventos.length ? new Date(eventos[0].ts) : null;
    const ultimoEvento = eventos.length ? new Date(eventos[eventos.length - 1].ts) : null;

    return {
      totalEventos:    eventos.length,
      primerEvento,
      ultimoEvento,
      saac: {
        totalPictos:   pictos.length,
        topPictos,
        totalFrases:   frases.length,
        ultimasFrases: frases.slice(-5).reverse().map(e => ({
          texto:    e.datos.texto,
          cantidad: e.datos.cantidad,
          ts:       new Date(e.ts),
        })),
        totalFavs:     favsAgg.length,
      },
      memorama: {
        totalPartidas:    temasIniciados.length,
        partidasComp:     partidasComp.length,
        duracionPromSeg:  duracionProm,
        temas:            Object.values(temaFreq).sort((a, b) => b.veces - a.veces),
        idiomas:          idiomaFreq,
        totalParejas:     parejas.length,
      },
      multimedia: {
        totalReproducidos: medias.length,
        topMedia,
      },
    };
  },

  /**
   * Exporta todos los eventos de un perfil como JSON descargable.
   * @param {string} perfilId
   */
  exportar(perfilId) {
    const perfil  = Perfiles.listar().find(p => p.id === perfilId);
    const todos   = _cargar();
    const eventos = todos.filter(e => e.perfil === perfilId);
    const payload = {
      perfil:       perfil?.apodo || perfilId,
      exportadoEn:  new Date().toISOString(),
      version:      'dotir2-telemetria-v1',
      totalEventos: eventos.length,
      eventos,
    };
    const json   = JSON.stringify(payload, null, 2);
    const blob   = new Blob([json], { type: 'application/json' });
    const url    = URL.createObjectURL(blob);
    const fecha  = new Date().toISOString().slice(0, 10);
    const nombre = 'dotir2-telemetria-' + (perfil?.apodo || perfilId).toLowerCase().replace(/\s+/g, '-') + '-' + fecha + '.json';
    const a      = document.createElement('a');
    a.href = url; a.download = nombre; a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Elimina todos los eventos de un perfil.
   * @param {string} perfilId
   */
  limpiar(perfilId) {
    const todos     = _cargar();
    const restantes = todos.filter(e => e.perfil !== perfilId);
    _guardar(restantes);
  },

  /**
   * Retorna el numero de eventos registrados para un perfil.
   * @param {string} perfilId
   */
  contarEventos(perfilId) {
    return _cargar().filter(e => e.perfil === perfilId).length;
  },
};