/* core/config.js
   Carga app.config.json una sola vez al arrancar.
   Todo el core lee la config desde aquí — nunca hardcodea valores.

   Uso en cualquier archivo de core:
     import { cfg } from './config.js';
     const prefijo = cfg('storage.prefijo');   // 'mi-app'
     const nombre  = cfg('app.nombre');        // 'Mi App'
*/

let _config = null;

/**
 * Carga la configuración desde app.config.json.
 * Se llama una sola vez desde app.js al arrancar.
 */
export async function cargarConfig() {
  if (_config) return _config;
  try {
    const res = await fetch('./app.config.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _config = await res.json();
  } catch (e) {
    console.warn('[Config] No se pudo cargar app.config.json, usando defaults:', e.message);
    _config = _defaults();
  }
  return _config;
}

/**
 * Accede a un valor de la config por ruta de puntos.
 * cfg('storage.prefijo')  →  'mi-app'
 * cfg('tts.rate')         →  0.92
 * @param {string} ruta
 * @param {*} fallback  Valor si la ruta no existe
 */
export function cfg(ruta, fallback = undefined) {
  if (!_config) {
    console.warn('[Config] cfg() llamado antes de cargarConfig(). Usa el fallback.');
    return fallback;
  }
  return ruta.split('.').reduce((obj, k) => obj?.[k], _config) ?? fallback;
}

/**
 * Devuelve la config completa (solo lectura).
 */
export function getConfig() {
  return _config;
}

function _defaults() {
  return {
    app:     { id: 'app', nombre: 'App', version: '1.0.0', idiomas: ['es'], idiomaPorDefecto: 'es' },
    ui:      { tema: 'oceano', saludo: 'Hola', mostrarPill: true },
    pin:     { valorDefecto: '1234' },
    tts:     { lang: 'es-MX', rate: 0.92, pitch: 1.2, volume: 1 },
    storage: { prefijo: 'app' },
  };
}