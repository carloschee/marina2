/* modules/_plantilla/module.js
   Copia esta carpeta, renómbrala y edita los TODOs.
   Borra este archivo del repo antes de publicar.
*/

import { init, destroy, onEnter, onLeave } from './plantilla.js';

export default {
  id:          'plantilla',        // TODO: id único, minúsculas con guiones
  label:       'Módulo',           // TODO: nombre en el tile del home
  desc:        'Descripción',      // TODO: descripción corta
  emoji:       '🌟',               // TODO: emoji de respaldo si no hay imagen
  color:       '#0ea5c9',          // TODO: color de acento

  orden:       10,                 // TODO: posición en el home (menor = primero)
  habilitado:  true,               // false = no aparece en ningún lado
  requierePin: false,              // true = pide PIN antes de abrir

  init,      // (container: HTMLElement) => Promise<void>
  destroy,   // () => void  — limpiar timers, listeners, etc.
  onEnter,   // () => void  — se llama al mostrar el módulo
  onLeave,   // () => void  — se llama al salir (ej: parar TTS)
  pause:    undefined,  // () => void  — opcional, pausar si hay otra app encima
  resume:   undefined,  // () => void  — opcional, reanudar

  cache: [],  // URLs a precachear (para offline)
};