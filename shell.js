// shell.js — design tokens y componentes de layout base
// Sin JSX. Todo React.createElement puro.
// Exporta al window: tokens, MarinaShell, MarinaTopBar.

'use strict';

const { createElement: h, useEffect } = React;

// ─── Inyectar keyframes una sola vez ─────────────────────────────────────────
(function injectStyles() {
  if (document.getElementById('marina-shell-styles')) return;
  const el = document.createElement('style');
  el.id = 'marina-shell-styles';
  el.textContent = `
    @keyframes marina-glow {
      0%   { transform: translate(0,0) scale(1); }
      100% { transform: translate(80px,40px) scale(1.15); }
    }
  `;
  document.head.appendChild(el);
})();

// ─── Design tokens ────────────────────────────────────────────────────────────
// Para cambiar la paleta de la app, editar primary y green aquí,
// o dejar que app.js los sobreescriba via AppContext.
const T = {
  bg:           '#062a35',
  bgGrad:       'radial-gradient(ellipse at 30% 0%, #0d4858 0%, #062a35 60%, #03161c 100%)',
  surface:      '#0e3a48',
  surfaceLight: '#fff',
  ink:          '#f7f1e3',
  inkOnLight:   '#0a1f27',
  inkSoft:      'rgba(247,241,227,0.62)',
  primary:      '#ff6b8b',
  green:        '#38d9a9',
  gold:         '#ffd166',
  coral:        '#ff9b71',
  shadow:       '0 10px 30px rgba(0,0,0,0.35)',
  shadowDeep:   '0 20px 60px rgba(0,0,0,0.5)',
  display:      '"Outfit","Bricolage Grotesque",system-ui,sans-serif',
  body:         '"Lexend",system-ui,sans-serif',
  radiusLg:     28,
  radiusMd:     20,
};

// ─── MarinaWaves ──────────────────────────────────────────────────────────────
function MarinaWaves() {
  return h(React.Fragment, null,
    h('div', { style: {
      position: 'absolute', top: -120, left: '20%', width: 520, height: 520,
      borderRadius: '50%',
      background: 'radial-gradient(circle at 50% 50%, rgba(56,217,169,0.25) 0%, transparent 60%)',
      filter: 'blur(20px)',
      animation: 'marina-glow 26s ease-in-out infinite alternate',
    }}),
    h('div', { style: {
      position: 'absolute', bottom: -60, right: -80, width: 420, height: 420,
      borderRadius: '50%',
      background: 'radial-gradient(circle at 50% 50%, rgba(255,107,139,0.22) 0%, transparent 60%)',
      filter: 'blur(20px)',
      animation: 'marina-glow 30s ease-in-out infinite alternate-reverse',
    }}),
    h('svg', {
      style: { position: 'absolute', bottom: 0, left: 0, width: '100%', height: 120, opacity: 0.18, pointerEvents: 'none' },
      viewBox: '0 0 1180 120', preserveAspectRatio: 'none',
    },
      h('path', { d: 'M0,60 Q295,20 590,60 T1180,60 L1180,120 L0,120 Z', fill: '#38d9a9' }),
      h('path', { d: 'M0,80 Q295,50 590,80 T1180,80 L1180,120 L0,120 Z', fill: '#38d9a9', opacity: 0.5 })
    )
  );
}

// ─── MarinaShell ──────────────────────────────────────────────────────────────
// Wrapper de pantalla completa con fondo y olas animadas.
// Props:
//   children   — contenido de la pantalla
//   noPadding  — true para pantallas que manejan su propio padding
function MarinaShell({ children, noPadding = false }) {
  return h('div', {
    style: {
      width: '100%', height: '100%',
      background: T.bgGrad,
      fontFamily: T.body,
      color: T.ink,
      position: 'relative', overflow: 'hidden',
    },
  },
    h(MarinaWaves),
    h('div', {
      style: {
        position: 'relative', zIndex: 1,
        height: '100%',
        padding: noPadding ? 0 : 36,
      },
    }, children)
  );
}

// ─── MarinaTopBar ─────────────────────────────────────────────────────────────
// Barra superior con botón de regreso, título y slot derecho opcional.
// Props:
//   onBack  — callback al tocar ←
//   title   — string del título
//   right   — nodo React opcional (botones, contadores, etc.)
function MarinaTopBar({ onBack, title, right }) {
  return h('header', {
    style: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, height: 72 },
  },
    h('button', {
      onClick: onBack,
      'aria-label': 'volver',
      style: {
        width: 64, height: 64, borderRadius: 32,
        border: 'none', cursor: 'pointer',
        background: 'rgba(255,255,255,0.08)', color: T.ink,
        fontFamily: T.display, fontWeight: 700, fontSize: 32,
      },
    }, '←'),
    h('h1', {
      style: {
        margin: 0, fontFamily: T.display,
        fontWeight: 700, fontSize: 38, letterSpacing: -1, color: T.ink,
      },
    }, title),
    h('div', { style: { flex: 1 } }),
    right || null
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────
Object.assign(window, { T, MarinaShell, MarinaWaves, MarinaTopBar });
