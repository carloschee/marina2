/* modules/mira-y-di/module.js */

import { init, destroy, onEnter, onLeave } from './mira-y-di.js';

export default {
  id:          'mira-y-di',
  label:       'Mira y di',
  desc:        'Aprende palabras por letra',
  emoji:       '👀',
  color:       '#0ea5c9',

  orden:       1,
  habilitado:  true,
  requierePin: false,

  init,
  destroy,
  onEnter,
  onLeave,
  pause:       undefined,
  resume:      undefined,

  cache: [],
};