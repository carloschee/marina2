// modules/_plantilla-modulo.js
// Copia este archivo, renómbralo y edita las secciones marcadas con TODO.
// Borra este archivo del repo antes de publicar.

'use strict';

const { createElement: h, useState } = React;

// TODO: renombrar la función
function PlantillaModulo({ onNavigate, speak }) {
  return h(MarinaShell, null,
    h(MarinaTopBar, {
      onBack: () => onNavigate('home'),
      title: 'TODO: título',
      // right: h('button', { ... }, 'acción opcional')
    }),

    // TODO: contenido del módulo
    h('div', {
      style: {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 'calc(100% - 96px)',
        fontFamily: T.display, fontWeight: 700, fontSize: 48, color: T.inkSoft,
      },
    }, 'Módulo en construcción 🚧')
  );
}

// Registro en el home — TODO: editar todos los campos
window.MARINA_MODULES.push({
  id:        'plantilla',           // TODO: id único, minúsculas con guiones
  label:     'Plantilla',           // TODO: nombre en el tile del home
  sub:       'descripción corta',   // TODO: subtítulo del tile
  emoji:     '🌟',                  // TODO: emoji del tile
  accent:    T.primary,             // TODO: color de acento (hex o T.primary / T.green / T.gold)
  active:    true,                  // false = tile visible pero deshabilitado ("próximamente")
  component: PlantillaModulo,       // TODO: apuntar a la función del módulo
});
