/* core/telemetry.js
   Registro local de eventos de uso por perfil.
   Las keys de localStorage usan el prefijo de app.config.json.

   API pública:
     Telemetry.track(evento, datos)  → registrar evento
     Telemetry.getReporte(perfilId)  → datos agregados
     Telemetry.exportar(perfilId)    → descarga JSON
     Telemetry.limpiar(perfilId)     → borrar eventos del perfil
     Telemetry.contarEventos(id)     → número de eventos
*/

import { Perfiles } from './perfiles.js';
import { cfg }      from './config.js';

const _lsKey     = () => `${cfg('storage.prefijo', 'app')}-telemetria`;
const MAX_EVENTOS = 500;

function _uuid() {
  return 'e-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

function _cargar() {
  try { return JSON.parse(localStorage.getItem(_lsKey()) || '[]'); }
  catch { return []; }
}

function _guardar(eventos) {
  try {
    localStorage.setItem(_lsKey(), JSON.stringify(eventos));
  } catch {
    // localStorage lleno — eliminar los más antiguos y reintentar
    try { localStorage.setItem(_lsKey(), JSON.stringify(eventos.slice(50))); } catch {}
  }
}

export const Telemetry = {

  track(evento, datos = {}) {
    const perfil = Perfiles.getActivo();
    if (!perfil) return;
    let todos = _cargar();
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

  getReporte(perfilId) {
    const eventos = _cargar().filter(e => e.perfil === perfilId);
    const _freq   = (arr, key) => {
      const map = {};
      arr.forEach(e => { const k = e.datos[key]; map[k] = (map[k] || 0) + 1; });
      return map;
    };
    return {
      totalEventos: eventos.length,
      primerEvento: eventos.length ? new Date(eventos[0].ts) : null,
      ultimoEvento: eventos.length ? new Date(eventos.at(-1).ts) : null,
      porModulo:    _freq(eventos, '_modulo'),
      eventos,
    };
  },

  exportar(perfilId) {
    const appId  = cfg('app.id', 'app');
    const perfil = Perfiles.listar().find(p => p.id === perfilId);
    const eventos = _cargar().filter(e => e.perfil === perfilId);
    const payload = {
      perfil: perfil?.apodo || perfilId,
      exportadoEn: new Date().toISOString(),
      version: `${appId}-telemetria-v1`,
      totalEventos: eventos.length,
      eventos,
    };
    const blob   = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url    = URL.createObjectURL(blob);
    const fecha  = new Date().toISOString().slice(0, 10);
    const nombre = `${appId}-telemetria-${(perfil?.apodo || perfilId).toLowerCase().replace(/\s+/g, '-')}-${fecha}.json`;
    const a      = Object.assign(document.createElement('a'), { href: url, download: nombre });
    a.click();
    URL.revokeObjectURL(url);
  },

  limpiar(perfilId) {
    _guardar(_cargar().filter(e => e.perfil !== perfilId));
  },

  contarEventos(perfilId) {
    return _cargar().filter(e => e.perfil === perfilId).length;
  },
};