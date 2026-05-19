/* modules/toca/module.js */

import { init, destroy, onEnter, onLeave, pause, resume } from './toca.js';

export default {
  id:          'toca',
  label:       'Escucha y toca',
  desc:        'Escucha la palabra y toca el pictograma correcto',
  emoji:       '👆',
  color:       '#00e5b0',

  orden:       4,
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