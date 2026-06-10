/* modules/silabas/module.js */

import { init, destroy, onEnter, onLeave, pause, resume } from './silabas.js';

export default {
  id:          'silabas',
  label:       'Sílabas',
  desc:        'Explora palabras sílaba por sílaba',
  emoji:       '🔤',
  color:       '#a78bfa',

  orden:       5,
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