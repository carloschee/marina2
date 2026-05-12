/* ============================================================
   Dótir 2 — modules/ajustes/module.js
   ============================================================ */

import { init, destroy, onEnter, onLeave } from './ajustes.js';

export default {
  id:          'ajustes',
  label:       'Ajustes',
  desc:        'Configuración',
  emoji:       '⚙️',
  color:       '#7C3AED',

  orden:       99,
  habilitado:  true,
  requierePin: true,

  init,
  destroy,
  onEnter,
  onLeave,
  // Ajustes no se pausa — siempre arranca fresco
  pause:       undefined,
  resume:      undefined,

  cache: [],
};
