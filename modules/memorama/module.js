/* modules/memorama/module.js */

import { init, destroy, onEnter, onLeave, pause, resume } from './memorama.js';

export default {
  id:          'memorama',
  label:       'Memorama',
  desc:        'Encuentra los pares de pictogramas',
  emoji:       '🃏',
  color:       '#f59e0b',

  orden:       3,
  habilitado:  true,
  requierePin: false,

  init,
  destroy,
  onEnter,
  onLeave,
  pause,
  resume,

  cache: [],
};
