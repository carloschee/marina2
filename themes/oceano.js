/* themes/oceano.js
   Tema "Océano" — azul profundo, corrientes submarinas.
   Exporta: tokens (variables CSS), injectStyles(), MarinaWaves component.

   Uso en app.config.json: "ui": { "tema": "oceano" }
*/

export const tokens = {
  '--t-bg':          '#03111a',
  '--t-bg-mid':      '#041e2e',
  '--t-surface':     '#062a3e',
  '--t-ink':         '#e8f4f8',
  '--t-ink-soft':    'rgba(200,230,240,0.55)',
  '--t-ink-dark':    '#07212e',
  '--t-primary':     '#0ea5c9',
  '--t-primary-dk':  '#0369a1',
  '--t-accent':      '#38bdf8',
  '--t-secondary':   '#14b8a6',
  '--t-warn':        '#fb7185',
  '--t-gold':        '#fbbf24',
  '--t-nav-bg':      'linear-gradient(135deg,#03111a 0%,#041e2e 50%,#03111a 100%)',
  '--t-shadow':      '0 10px 30px rgba(0,0,0,0.40)',
  '--t-shadow-deep': '0 20px 60px rgba(0,0,0,0.55)',
  '--t-radius-sm':   '10px',
  '--t-radius-md':   '16px',
  '--t-radius-lg':   '22px',
  '--t-radius-xl':   '30px',
};

/** Inyecta las variables CSS del tema en :root y los keyframes de corrientes. */
export function injectStyles() {
  if (document.getElementById('tema-oceano-styles')) return;

  // Variables CSS
  const vars = Object.entries(tokens).map(([k, v]) => `  ${k}: ${v};`).join('\n');

  const style = document.createElement('style');
  style.id = 'tema-oceano-styles';
  style.textContent = `
    :root {
    ${vars}
    }

    body { background: var(--t-bg); color: var(--t-ink); }

    @keyframes corriente-a {
  0%   { transform: translateX(0)    scaleY(1)    skewY(0deg); }
  33%  { transform: translateX(8vw)  scaleY(1.15) skewY(-1deg); }
  66%  { transform: translateX(14vw) scaleY(0.9)  skewY(1.5deg); }
  100% { transform: translateX(20vw) scaleY(1.1)  skewY(-0.5deg); }
}
@keyframes corriente-b {
  0%   { transform: translateX(0)     scaleY(1)    skewY(0deg); }
  33%  { transform: translateX(-10vw) scaleY(1.2)  skewY(1deg); }
  66%  { transform: translateX(-6vw)  scaleY(0.85) skewY(-1.5deg); }
  100% { transform: translateX(-18vw) scaleY(1.1)  skewY(0.8deg); }
}
@keyframes corriente-c {
  0%   { transform: translateX(0);    }
  50%  { transform: translateX(12vw); }
  100% { transform: translateX(5vw);  }
}
@keyframes corriente-d {
  0%   { transform: translateX(0);     }
  50%  { transform: translateX(-14vw); }
  100% { transform: translateX(-8vw);  }
}
@keyframes corriente-e {
  0%   { transform: translateX(0);   opacity:.16; }
  50%  { transform: translateX(8vw); opacity:.22; }
  100% { transform: translateX(3vw); opacity:.14; }
}
  `;
  document.head.appendChild(style);
}

/**
 * Crea el elemento de fondo animado (corrientes).
 * Insertar como primer hijo de #app antes del header.
 * @returns {HTMLElement}
 */
export function crearFondo() {
  const div = document.createElement('div');
  div.id = 'app-fondo';
  div.style.cssText =
    'position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;';

  div.innerHTML = `
    <!-- Corriente principal -->
<div style="
  position:absolute; border-radius:50% 50% 50% 50% / 12% 12% 12% 12%;
  filter:blur(55px); opacity:.48; width:110vw; height:28vw; top:6vw; left:-15vw;
  background:radial-gradient(ellipse at 45% 50%,#0ea5c9 0%,#0369a1 38%,#041e2e 65%,transparent 80%);
  animation:corriente-a 20s ease-in-out infinite alternate; will-change:transform;">
</div>
<!-- Corriente secundaria -->
<div style="
  position:absolute; border-radius:50% 50% 50% 50% / 14% 14% 14% 14%;
  filter:blur(62px); opacity:.36; width:120vw; height:24vw; bottom:10vw; right:-25vw;
  background:radial-gradient(ellipse at 55% 50%,#14b8a6 0%,#0369a1 42%,transparent 72%);
  animation:corriente-b 26s ease-in-out infinite alternate; will-change:transform;">
</div>
<!-- Filamento 1 -->
<div style="
  position:absolute; border-radius:50% 50% 50% 50% / 18% 18% 18% 18%;
  width:90vw; height:18vw; top:38%; left:-10%;
  filter:blur(46px); opacity:.26;
  background:radial-gradient(ellipse at 40% 50%,#38bdf8 0%,#0ea5c9 45%,transparent 70%);
  animation:corriente-c 15s ease-in-out infinite alternate;">
</div>
<!-- Filamento 2 -->
<div style="
  position:absolute; border-radius:50% 50% 50% 50% / 16% 16% 16% 16%;
  width:80vw; height:15vw; top:62%; right:-15%;
  filter:blur(52px); opacity:.22;
  background:radial-gradient(ellipse at 60% 50%,#14b8a6 0%,#0369a1 50%,transparent 72%);
  animation:corriente-d 22s ease-in-out infinite alternate;">
</div>
<!-- Filamento 3 -->
<div style="
  position:absolute; border-radius:50% 50% 50% 50% / 14% 14% 14% 14%;
  width:70vw; height:12vw; top:20%; right:-5%;
  filter:blur(40px); opacity:.16;
  background:radial-gradient(ellipse at 50% 50%,#7dd3fc 0%,#0ea5c9 55%,transparent 75%);
  animation:corriente-e 12s ease-in-out infinite alternate;">
</div>
    <!-- Caustica SVG -->
    <svg style="position:absolute;bottom:0;left:0;width:100%;height:80px;opacity:.08;pointer-events:none;"
         viewBox="0 0 1180 80" preserveAspectRatio="none">
      <path d="M0,40 Q295,15 590,40 T1180,40 L1180,80 L0,80 Z" fill="#38bdf8"/>
      <path d="M0,55 Q295,35 590,55 T1180,55 L1180,80 L0,80 Z" fill="#14b8a6" opacity=".6"/>
    </svg>
  `;
  return div;
}