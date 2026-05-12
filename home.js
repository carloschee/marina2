// home.js — pantalla principal de Marina
// Lee MARINA_MODULES (poblado por app.js desde marina.config.json).
// Sin módulos registrados muestra una pantalla de bienvenida en blanco.
// Sin JSX. Todo React.createElement puro.

'use strict';

const { createElement: h, useState } = React;

// ─── HomeScreen ───────────────────────────────────────────────────────────────
// Props:
//   config     — objeto cargado desde marina.config.json
//   onNavigate — callback(moduleId)
function HomeScreen({ config, onNavigate }) {
  const modules = window.MARINA_MODULES || [];
  const { greeting = {} } = config;

  return h(MarinaShell, null,
    // Cabecera
    h('header', {
      style: { display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 36 },
    },
      h('h1', {
        style: {
          fontFamily: T.display, fontWeight: 800,
          fontSize: 60, letterSpacing: -2, margin: 0, color: T.ink,
        },
      }, `Hola, ${greeting.name || 'Emi'}`),
      h('span', {
        style: { fontFamily: T.body, fontWeight: 400, fontSize: 18, color: T.inkSoft },
      }, greeting.subtitle || ''),
      h('div', { style: { flex: 1 } })
    ),

    // Grid de módulos — o estado vacío si no hay ninguno
    modules.length === 0
      ? h(EmptyState)
      : h('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 22,
            height: 'calc(100% - 110px)',
          },
        }, modules.map((mod) => h(ModuleTile, { key: mod.id, mod, onNavigate })))
  );
}

// ─── ModuleTile ───────────────────────────────────────────────────────────────
// Cada módulo registrado en MARINA_MODULES tiene la forma:
//   { id, label, sub, emoji, accent, active }
function ModuleTile({ mod, onNavigate }) {
  const [pressed, setPressed] = useState(false);
  return h('button', {
    onClick:       () => mod.active && onNavigate(mod.id),
    disabled:      !mod.active,
    onPointerDown: () => mod.active && setPressed(true),
    onPointerUp:   () => setPressed(false),
    onPointerLeave:  () => setPressed(false),
    onPointerCancel: () => setPressed(false),
    style: {
      background:    T.surface,
      border:        'none',
      borderRadius:  T.radiusLg,
      boxShadow:     T.shadow,
      padding:       28,
      position:      'relative',
      overflow:      'hidden',
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'flex-start',
      justifyContent:'space-between',
      cursor:        mod.active ? 'pointer' : 'default',
      textAlign:     'left',
      fontFamily:    T.body,
      color:         T.ink,
      transition:    'transform .18s ease, opacity .18s ease',
      transform:     pressed ? 'scale(0.97)' : 'scale(1)',
      opacity:       mod.active ? 1 : 0.45,
    },
  },
    // Splash de color
    h('div', { style: {
      position: 'absolute', top: -60, right: -60, width: 200, height: 200,
      borderRadius: '50%', background: mod.accent, opacity: 0.18, filter: 'blur(8px)',
    }}),
    // Ícono
    h('div', { style: {
      width: 96, height: 96, borderRadius: 28,
      background: mod.accent,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 56, lineHeight: 1, position: 'relative',
      boxShadow: `0 12px 28px ${mod.accent}55`,
    }}, mod.emoji),
    // Texto
    h('div', { style: { position: 'relative' } },
      h('div', { style: {
        fontFamily: T.display, fontWeight: 700,
        fontSize: 40, lineHeight: 1.05, color: T.ink,
      }}, mod.label),
      h('div', { style: {
        fontWeight: 400, fontSize: 17, color: T.inkSoft, marginTop: 4,
      }}, mod.sub)
    )
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
// Se muestra cuando modules: [] en la config — blank slate intencional.
function EmptyState() {
  return h('div', {
    style: {
      height: 'calc(100% - 110px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 16, opacity: 0.35,
    },
  },
    h('div', { style: { fontSize: 72 } }, '🌊'),
    h('div', { style: {
      fontFamily: T.display, fontWeight: 700, fontSize: 28, color: T.ink,
    }}, 'Marina'),
    h('div', { style: {
      fontFamily: T.body, fontSize: 16, color: T.inkSoft, textAlign: 'center', maxWidth: 320,
    }}, 'Agrega módulos en marina.config.json para comenzar.')
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────
// MARINA_MODULES es el registro global que los módulos se auto-registran.
// Cada módulo llama: window.MARINA_MODULES.push({ id, label, ... })
window.MARINA_MODULES = window.MARINA_MODULES || [];

Object.assign(window, { HomeScreen });
