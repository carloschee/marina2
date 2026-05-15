/* themes/oceano.js — Marina 2
   Tema "Océano Pixar" — agua tropical luminosa, colores vibrantes,
   gradientes cálidos. Inspirado en Finding Nemo / Finding Dory.
   Fondo: capas de luz submarina que se mueven como rayos de sol en agua.
*/

export const tokens = {
  /* Fondos — azul Caribe cálido, no abismo oscuro */
  '--t-bg':          '#0a3d6b',   /* azul océano mediano */
  '--t-bg-mid':      '#0d5a8f',   /* azul turquesa profundo */
  '--t-surface':     '#0e6ba8',   /* superficie de cards */

  /* Texto */
  '--t-ink':         '#ffffff',
  '--t-ink-soft':    'rgba(255,255,255,0.70)',
  '--t-ink-dark':    '#032340',

  /* Colores principales — vibrantes y saturados */
  '--t-primary':     '#00c2ff',   /* azul eléctrico Nemo */
  '--t-primary-dk':  '#0090cc',
  '--t-accent':      '#ffe566',   /* amarillo sol cálido */
  '--t-secondary':   '#00e5b0',   /* verde agua tropical */
  '--t-warn':        '#ff6b6b',   /* coral vivo */
  '--t-gold':        '#ffb800',   /* naranja pez payaso */
  '--t-purple':      '#c084fc',   /* violeta medusa */
  '--t-coral':       '#ff7043',   /* coral Nemo */

  /* Nav */
  '--t-nav-bg':      'linear-gradient(180deg, rgba(5,40,80,0.92) 0%, rgba(10,61,107,0.60) 100%)',

  /* Sombras */
  '--t-shadow':      '0 8px 24px rgba(0,30,80,0.35)',
  '--t-shadow-deep': '0 16px 48px rgba(0,20,60,0.50)',

  /* Radios */
  '--t-radius-sm':   '12px',
  '--t-radius-md':   '18px',
  '--t-radius-lg':   '26px',
  '--t-radius-xl':   '36px',
};

export function injectStyles() {
  if (document.getElementById('tema-oceano-styles')) return;

  const vars = Object.entries(tokens).map(([k, v]) => `  ${k}: ${v};`).join('\n');

  const style = document.createElement('style');
  style.id = 'tema-oceano-styles';
  style.textContent = `
    :root {
    ${vars}
    }

    body { background: var(--t-bg); color: var(--t-ink); }

    /* ── Rayos de sol submarinos ── */
    /* Más rápidos y luminosos que las corrientes — simulan luz filtrando desde la superficie */

    @keyframes rayo-a {
      0%   { transform: translateX(0)     rotate(-8deg)  scaleX(1);   opacity: .22; }
      40%  { transform: translateX(6vw)   rotate(-5deg)  scaleX(1.1); opacity: .32; }
      100% { transform: translateX(14vw)  rotate(-10deg) scaleX(0.9); opacity: .18; }
    }
    @keyframes rayo-b {
      0%   { transform: translateX(0)    rotate(6deg) scaleX(1);   opacity: .18; }
      50%  { transform: translateX(-8vw) rotate(4deg) scaleX(1.15); opacity: .28; }
      100% { transform: translateX(-4vw) rotate(8deg) scaleX(0.9); opacity: .14; }
    }
    @keyframes rayo-c {
      0%   { transform: translateX(0)   rotate(-4deg) opacity: .14; }
      60%  { transform: translateX(10vw) rotate(-7deg); opacity: .24; }
      100% { transform: translateX(6vw)  rotate(-3deg); opacity: .12; }
    }
    @keyframes burbuja {
      0%   { transform: translateY(0)   scale(1);    opacity: .70; }
      80%  { transform: translateY(-80vh) scale(1.3); opacity: .20; }
      100% { transform: translateY(-95vh) scale(1.4); opacity: 0;   }
    }
    @keyframes ondular {
      0%,100% { d: path('M0,40 Q295,15 590,40 T1180,40 L1180,80 L0,80 Z'); }
      50%      { d: path('M0,30 Q295,55 590,25 T1180,45 L1180,80 L0,80 Z'); }
    }
  `;
  document.head.appendChild(style);
}

export function crearFondo() {
  const div = document.createElement('div');
  div.id = 'app-fondo';
  div.style.cssText =
    'position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;' +
    'background: linear-gradient(180deg, #0d5a8f 0%, #0a3d6b 45%, #063058 75%, #042040 100%);';

  div.innerHTML = `
    <!-- Brillo de superficie — luz que entra desde arriba -->
    <div style="
      position:absolute; top:-20%; left:-10%; width:120%; height:55%;
      background: radial-gradient(ellipse at 50% 0%,
        rgba(100,220,255,0.35) 0%,
        rgba(0,180,230,0.20) 30%,
        transparent 70%);
      filter: blur(30px);
      animation: rayo-a 8s ease-in-out infinite alternate;">
    </div>

    <!-- Rayo de sol 1 — diagonal izquierda -->
    <div style="
      position:absolute; top:-5%; left:15%; width:8%; height:100%;
      background: linear-gradient(180deg,
        rgba(255,240,100,0.22) 0%,
        rgba(100,220,255,0.12) 50%,
        transparent 100%);
      filter: blur(18px); border-radius: 50%;
      transform: rotate(-8deg);
      animation: rayo-a 10s ease-in-out infinite alternate;">
    </div>

    <!-- Rayo de sol 2 -->
    <div style="
      position:absolute; top:-5%; left:35%; width:6%; height:90%;
      background: linear-gradient(180deg,
        rgba(255,240,100,0.18) 0%,
        rgba(100,220,255,0.10) 50%,
        transparent 100%);
      filter: blur(14px); border-radius: 50%;
      transform: rotate(-4deg);
      animation: rayo-b 13s ease-in-out infinite alternate;">
    </div>

    <!-- Rayo de sol 3 -->
    <div style="
      position:absolute; top:-5%; left:60%; width:7%; height:85%;
      background: linear-gradient(180deg,
        rgba(255,240,100,0.16) 0%,
        rgba(0,200,200,0.08) 50%,
        transparent 100%);
      filter: blur(16px); border-radius: 50%;
      transform: rotate(5deg);
      animation: rayo-c 11s ease-in-out infinite alternate;">
    </div>

    <!-- Rayo de sol 4 -->
    <div style="
      position:absolute; top:-5%; right:12%; width:5%; height:75%;
      background: linear-gradient(180deg,
        rgba(255,230,80,0.15) 0%,
        transparent 100%);
      filter: blur(12px); border-radius: 50%;
      transform: rotate(8deg);
      animation: rayo-b 15s ease-in-out 2s infinite alternate;">
    </div>

    <!-- Resplandor de fondo — color cálido del arrecife -->
    <div style="
      position:absolute; bottom:-10%; left:50%; transform:translateX(-50%);
      width:140%; height:50%;
      background: radial-gradient(ellipse at 50% 100%,
        rgba(0,220,180,0.18) 0%,
        rgba(0,160,220,0.12) 40%,
        transparent 75%);
      filter: blur(40px);">
    </div>

    <!-- Burbujas SVG animadas -->
    <svg style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;" aria-hidden="true">
      <!-- 12 burbujas en posiciones y tamaños variados -->
      ${Array.from({length: 12}, (_, i) => {
        const x    = 5 + (i * 8.2) % 90;
        const size = 4 + (i * 3.7) % 14;
        const dur  = 8 + (i * 2.3) % 14;
        const del  = (i * 1.7) % 8;
        const op   = 0.25 + (i * 0.04) % 0.35;
        return `<circle cx="${x}%" cy="105%" r="${size}"
          fill="none" stroke="rgba(255,255,255,${op.toFixed(2)})" stroke-width="1.5"
          style="animation: burbuja ${dur.toFixed(1)}s ${del.toFixed(1)}s ease-in infinite"/>`;
      }).join('\n      ')}
    </svg>

    <!-- Ola inferior — superficie del agua -->
    <svg style="position:absolute;bottom:0;left:0;width:100%;height:100px;pointer-events:none;"
         viewBox="0 0 1440 100" preserveAspectRatio="none">
      <path d="M0,50 Q180,20 360,50 T720,50 T1080,50 T1440,50 L1440,100 L0,100 Z"
            fill="rgba(100,230,255,0.12)"/>
      <path d="M0,65 Q200,40 400,65 T800,65 T1200,65 T1440,65 L1440,100 L0,100 Z"
            fill="rgba(0,200,180,0.10)"/>
      <path d="M0,80 Q240,60 480,80 T960,80 T1440,80 L1440,100 L0,100 Z"
            fill="rgba(255,255,255,0.06)"/>
    </svg>
  `;
  return div;
}