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
      0%   { transform: translate(0,0) skewX(0deg) scale(1);
             border-radius: 40% 60% 55% 45% / 50% 45% 55% 50%; }
      30%  { transform: translate(6vw,5vh) skewX(1.4deg) scale(1.07);
             border-radius: 50% 50% 45% 55% / 46% 54% 50% 50%; }
      65%  { transform: translate(11vw,10vh) skewX(-0.9deg) scale(1.12);
             border-radius: 46% 54% 60% 40% / 55% 45% 46% 54%; }
      100% { transform: translate(17vw,14vh) skewX(-0.4deg) scale(1.17);
             border-radius: 42% 58% 52% 48% / 48% 52% 55% 45%; }
    }
    @keyframes corriente-b {
      0%   { transform: translate(0,0) skewX(0deg) scale(1.05);
             border-radius: 55% 45% 40% 60% / 45% 55% 50% 50%; }
      35%  { transform: translate(-6vw,-5vh) skewX(1.4deg) scale(0.98); }
      100% { transform: translate(-14vw,-12vh) skewX(-0.7deg) scale(0.90);
             border-radius: 50% 50% 40% 60% / 42% 58% 48% 52%; }
    }
    @keyframes corriente-c {
      0%   { transform: translate(0,0) skewY(0deg) scale(1); }
      45%  { transform: translate(5vw,-4vh) skewY(1.1deg) scale(1.06); }
      100% { transform: translate(10vw,-8vh) skewY(-0.7deg) scale(1.11); }
    }
    @keyframes corriente-d {
      0%   { transform: translate(0,0) skewY(0deg) scale(1); }
      38%  { transform: translate(-3vw,4vh) skewY(-1.4deg) scale(1.06); }
      100% { transform: translate(-8vw,9vh) skewY(0.9deg) scale(0.95); }
    }
    @keyframes corriente-e {
      0%   { transform: translate(0,0) scale(1); opacity:.16; }
      50%  { transform: translate(-5vw,4vh) scale(1.09); opacity:.22; }
      100% { transform: translate(4vw,7vh) scale(0.93); opacity:.12; }
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
      position:absolute; border-radius:40% 60% 55% 45% / 50% 45% 55% 50%;
      filter:blur(55px); opacity:.48; width:90vw; height:70vw; top:-25vw; left:-15vw;
      background:radial-gradient(ellipse at 45% 35%,#0ea5c9 0%,#0369a1 38%,#041e2e 65%,transparent 80%);
      animation:corriente-a 20s ease-in-out infinite alternate; will-change:transform;">
    </div>
    <!-- Corriente secundaria -->
    <div style="
      position:absolute; border-radius:55% 45% 40% 60% / 45% 55% 50% 50%;
      filter:blur(62px); opacity:.36; width:80vw; height:60vw; bottom:-20vw; right:-10vw;
      background:radial-gradient(ellipse at 55% 60%,#14b8a6 0%,#0369a1 42%,transparent 72%);
      animation:corriente-b 26s ease-in-out infinite alternate; will-change:transform;">
    </div>
    <!-- Filamento 1 -->
    <div style="
      position:absolute; border-radius:40% 60% 65% 35% / 55% 40% 60% 45%;
      width:62vw; height:28vw; top:28%; left:-4%;
      filter:blur(46px); opacity:.26;
      background:radial-gradient(ellipse at 40% 50%,#38bdf8 0%,#0ea5c9 45%,transparent 70%);
      animation:corriente-c 15s ease-in-out infinite alternate;">
    </div>
    <!-- Filamento 2 -->
    <div style="
      position:absolute; border-radius:40% 60% 65% 35% / 55% 40% 60% 45%;
      width:52vw; height:24vw; top:54%; right:-2%;
      filter:blur(52px); opacity:.22;
      background:radial-gradient(ellipse at 60% 50%,#14b8a6 0%,#0369a1 50%,transparent 72%);
      animation:corriente-d 22s ease-in-out infinite alternate;">
    </div>
    <!-- Filamento 3 -->
    <div style="
      position:absolute; border-radius:40% 60% 65% 35% / 55% 40% 60% 45%;
      width:38vw; height:18vw; top:6%; right:8%;
      filter:blur(40px); opacity:.16;
      background:radial-gradient(ellipse at 50% 40%,#7dd3fc 0%,#0ea5c9 55%,transparent 75%);
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