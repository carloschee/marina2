/* modules/frases/module.js */

import { init, destroy, onEnter, onLeave, pause, resume } from './frases.js';

export default {
  id:          'frases',
  label:       'Frases',
  desc:        'Completa las frases basadas en pictogramas',
  emoji:       '💬',
  color:       '#14b8a6',

  orden:       2,
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