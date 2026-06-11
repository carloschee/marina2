/* modules/simon/module.js */

import { init, destroy, onEnter, onLeave, pause, resume } from './simon.js';

export default {
  id:          'simon',
  label:       'Simón',
  desc:        'Observa la secuencia y repítela',
  emoji:       '🧠',
  color:       '#f43f5e',

  orden:       6,
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