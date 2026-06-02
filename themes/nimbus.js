/* themes/nimbus.js — Marina 2
   Tema "Nimbus" — cielo de tarde con nubes cúmulos empujadas por la brisa.
   Azul cielo profundo, nubes blancas esponjosas en tres capas de profundidad,
   luz cálida de tarde y la sensación de aire limpio y movimiento suave.
*/

export const tokens = {
  /* Fondos — azul cielo diurno */
  '--t-bg':          '#1a4a8a',   /* azul cielo profundo */
  '--t-bg-mid':      '#2e6fb5',   /* azul cielo medio */
  '--t-surface':     'rgba(255,255,255,0.16)',

  /* Texto — blanco cálido */
  '--t-ink':         '#f0f8ff',   /* blanco cielo */
  '--t-ink-soft':    'rgba(240,248,255,0.68)',
  '--t-ink-dark':    '#0a1f3a',   /* azul noche para texto sobre claro */

  /* Colores principales */
  '--t-primary':     '#38bdf8',   /* azul cielo brillante */
  '--t-primary-dk':  '#0ea5c9',
  '--t-accent':      '#fde68a',   /* amarillo sol de tarde */
  '--t-secondary':   '#a5f3fc',   /* celeste suave */
  '--t-warn':        '#fb7185',   /* rosa atardecer */
  '--t-gold':        '#fcd34d',   /* dorado de sol */
  '--t-purple':      '#c4b5fd',   /* lavanda cielo */
  '--t-coral':       '#fdba74',   /* naranja de atardecer */

  /* Nav */
  '--t-nav-bg':      'linear-gradient(180deg, rgba(10,25,60,0.92) 0%, rgba(26,74,138,0.65) 100%)',

  /* Sombras */
  '--t-shadow':      '0 8px 24px rgba(10,30,80,0.30)',
  '--t-shadow-deep': '0 16px 48px rgba(5,20,60,0.45)',

  /* Radios */
  '--t-radius-sm':   '12px',
  '--t-radius-md':   '18px',
  '--t-radius-lg':   '26px',
  '--t-radius-xl':   '36px',
};

export const manifest = {
  background_color: '#1a4a8a',
  theme_color:      '#2e6fb5',
};

export function injectStyles() {
  if (document.getElementById('tema-viento-styles')) return;

  const vars = Object.entries(tokens).map(([k, v]) => `  ${k}: ${v};`).join('\n');

  const style = document.createElement('style');
  style.id = 'tema-viento-styles';
  style.textContent = `
    :root {
    ${vars}
    }

    body { background: var(--t-bg); color: var(--t-ink); }

    /* ── Nubes lejanas — lentas, grises, fondo ── */
    @keyframes nube-lenta {
      0%   { transform: translateX(-8%); }
      100% { transform: translateX(108%); }
    }

    /* ── Nubes medias — velocidad media ── */
    @keyframes nube-media {
      0%   { transform: translateX(-12%); }
      100% { transform: translateX(112%); }
    }

    /* ── Nubes cercanas — más rápidas, más blancas ── */
    @keyframes nube-rapida {
      0%   { transform: translateX(-15%); }
      100% { transform: translateX(115%); }
    }

    /* ── Sol — pulso suave de luz ── */
    @keyframes sol-pulso {
      0%,100% { opacity: .85; transform: scale(1);    filter: blur(28px); }
      50%      { opacity: 1;   transform: scale(1.06); filter: blur(24px); }
    }

    /* ── Resplandor de atardecer ── */
    @keyframes atardecer {
      0%,100% { opacity: .45; }
      50%      { opacity: .62; }
    }

    /* ── Destellos de luz en nubes ── */
    @keyframes brillo-nube {
      0%,100% { opacity: 0; }
      50%      { opacity: .18; }
    }
  `;
  document.head.appendChild(style);
}

export function crearFondo() {
  const div = document.createElement('div');
  div.id = 'app-fondo';
  div.style.cssText =
    'position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;' +
    'background: linear-gradient(180deg,' +
      '#0a1f4a 0%,' +       /* cénit azul oscuro */
      '#1a4a8a 18%,' +      /* azul cielo alto */
      '#2e6fb5 38%,' +      /* azul cielo medio */
      '#4a90d9 55%,' +      /* azul claro hacia horizonte */
      '#6ab0e8 68%,' +      /* celeste horizonte */
      '#a8d4f5 80%,' +      /* casi blanco en horizonte */
      '#d4eaf8 90%,' +      /* neblina de horizonte */
      '#e8f4fc 100%);';     /* horizonte lejano */

  div.innerHTML = `

    <!-- ══ SOL — resplandor cálido en el horizonte ══════════════ -->
    <div style="
      position:absolute; bottom:12%; left:50%; transform:translateX(-50%);
      width:55%; height:40%;
      background: radial-gradient(ellipse at 50% 100%,
        rgba(255,210,80,0.55)  0%,
        rgba(255,180,60,0.28) 35%,
        rgba(255,140,40,0.10) 60%,
        transparent 78%);
      animation: atardecer 8s ease-in-out infinite;">
    </div>

    <!-- Corona del sol -->
    <div style="
      position:absolute; bottom:18%; left:50%; transform:translateX(-50%);
      width:28%; height:25%;
      background: radial-gradient(ellipse at 50% 80%,
        rgba(255,230,100,0.70) 0%,
        rgba(255,200,80,0.35)  35%,
        transparent 68%);
      filter: blur(28px);
      animation: sol-pulso 6s ease-in-out infinite;">
    </div>


    <!-- ══ CAPA 1 — nubes lejanas, grises, muy lentas ═══════════ -->

    <!-- Nube lejana 1 — sale desde izquierda, tarda 55s -->
    <svg style="
        position:absolute; top:18%; left:0; width:28%; height:14%;
        overflow:visible;
        animation: nube-lenta 55s linear 0s infinite;"
      viewBox="0 0 280 80" aria-hidden="true">
      <ellipse cx="100" cy="60" rx="100" ry="28" fill="rgba(180,200,230,0.35)"/>
      <ellipse cx="100" cy="45" rx="70"  ry="32" fill="rgba(190,210,235,0.30)"/>
      <ellipse cx="75"  cy="35" rx="45"  ry="30" fill="rgba(200,215,238,0.25)"/>
      <ellipse cx="140" cy="38" rx="50"  ry="28" fill="rgba(195,212,236,0.25)"/>
    </svg>

    <!-- Nube lejana 2 — sale desfasada 22s -->
    <svg style="
        position:absolute; top:22%; left:0; width:22%; height:11%;
        overflow:visible;
        animation: nube-lenta 55s linear -22s infinite;"
      viewBox="0 0 220 65" aria-hidden="true">
      <ellipse cx="80"  cy="50" rx="80"  ry="22" fill="rgba(175,195,228,0.32)"/>
      <ellipse cx="80"  cy="36" rx="55"  ry="26" fill="rgba(185,205,232,0.27)"/>
      <ellipse cx="130" cy="38" rx="48"  ry="22" fill="rgba(188,208,233,0.22)"/>
    </svg>

    <!-- Nube lejana 3 — desfasada 38s -->
    <svg style="
        position:absolute; top:14%; left:0; width:18%; height:9%;
        overflow:visible;
        animation: nube-lenta 55s linear -38s infinite;"
      viewBox="0 0 180 55" aria-hidden="true">
      <ellipse cx="70"  cy="42" rx="70"  ry="18" fill="rgba(178,198,228,0.28)"/>
      <ellipse cx="70"  cy="30" rx="48"  ry="22" fill="rgba(188,208,233,0.23)"/>
      <ellipse cx="110" cy="32" rx="42"  ry="19" fill="rgba(185,205,230,0.20)"/>
    </svg>


    <!-- ══ CAPA 2 — nubes medias, blancas, velocidad media ══════ -->

    <!-- Nube media 1 — sale desde izquierda, tarda 32s -->
    <svg style="
        position:absolute; top:10%; left:0; width:38%; height:20%;
        overflow:visible;
        animation: nube-media 32s linear 0s infinite;"
      viewBox="0 0 380 110" aria-hidden="true">
      <!-- Base -->
      <ellipse cx="165" cy="90"  rx="160" ry="30"  fill="rgba(230,240,255,0.55)"/>
      <!-- Cuerpo -->
      <ellipse cx="140" cy="70"  rx="110" ry="45"  fill="rgba(240,246,255,0.58)"/>
      <!-- Protuberancias superiores -->
      <ellipse cx="100" cy="48"  rx="70"  ry="48"  fill="rgba(245,250,255,0.60)"/>
      <ellipse cx="175" cy="42"  rx="80"  ry="52"  fill="rgba(248,252,255,0.62)"/>
      <ellipse cx="245" cy="52"  rx="65"  ry="44"  fill="rgba(245,250,255,0.58)"/>
      <!-- Cimas blancas -->
      <ellipse cx="155" cy="22"  rx="55"  ry="38"  fill="rgba(255,255,255,0.65)"/>
      <ellipse cx="205" cy="18"  rx="48"  ry="35"  fill="rgba(255,255,255,0.68)"/>
      <!-- Sombra base -->
      <ellipse cx="165" cy="94"  rx="145" ry="18"  fill="rgba(150,170,210,0.22)"/>
    </svg>

    <!-- Nube media 2 — desfasada 14s, más pequeña -->
    <svg style="
        position:absolute; top:6%; left:0; width:28%; height:16%;
        overflow:visible;
        animation: nube-media 32s linear -14s infinite;"
      viewBox="0 0 280 90" aria-hidden="true">
      <ellipse cx="120" cy="72"  rx="118" ry="24"  fill="rgba(228,240,255,0.52)"/>
      <ellipse cx="110" cy="55"  rx="85"  ry="38"  fill="rgba(238,246,255,0.55)"/>
      <ellipse cx="80"  cy="38"  rx="55"  ry="40"  fill="rgba(245,250,255,0.58)"/>
      <ellipse cx="145" cy="34"  rx="62"  ry="42"  fill="rgba(248,252,255,0.60)"/>
      <ellipse cx="120" cy="16"  rx="42"  ry="30"  fill="rgba(255,255,255,0.65)"/>
      <ellipse cx="120" cy="76"  rx="105" ry="14"  fill="rgba(155,175,215,0.20)"/>
    </svg>

    <!-- Nube media 3 — desfasada 25s -->
    <svg style="
        position:absolute; top:28%; left:0; width:24%; height:13%;
        overflow:visible;
        animation: nube-media 32s linear -25s infinite;"
      viewBox="0 0 240 78" aria-hidden="true">
      <ellipse cx="100" cy="62"  rx="98"  ry="20"  fill="rgba(225,238,255,0.48)"/>
      <ellipse cx="95"  cy="47"  rx="72"  ry="34"  fill="rgba(235,245,255,0.52)"/>
      <ellipse cx="70"  cy="32"  rx="48"  ry="36"  fill="rgba(242,250,255,0.55)"/>
      <ellipse cx="130" cy="30"  rx="55"  ry="35"  fill="rgba(245,251,255,0.57)"/>
      <ellipse cx="105" cy="12"  rx="38"  ry="26"  fill="rgba(255,255,255,0.62)"/>
    </svg>


    <!-- ══ CAPA 3 — nubes cercanas, muy blancas, más rápidas ════ -->

    <!-- Nube cercana 1 — tarda 20s -->
    <svg style="
        position:absolute; top:5%; left:0; width:42%; height:24%;
        overflow:visible;
        animation: nube-rapida 20s linear 0s infinite;"
      viewBox="0 0 420 130" aria-hidden="true">
      <ellipse cx="185" cy="108" rx="178" ry="30"  fill="rgba(235,245,255,0.60)"/>
      <ellipse cx="165" cy="85"  rx="130" ry="50"  fill="rgba(245,250,255,0.65)"/>
      <ellipse cx="115" cy="58"  rx="85"  ry="58"  fill="rgba(250,253,255,0.70)"/>
      <ellipse cx="200" cy="50"  rx="95"  ry="62"  fill="rgba(252,254,255,0.72)"/>
      <ellipse cx="280" cy="65"  rx="78"  ry="52"  fill="rgba(250,253,255,0.68)"/>
      <ellipse cx="175" cy="22"  rx="65"  ry="46"  fill="rgba(255,255,255,0.80)"/>
      <ellipse cx="225" cy="15"  rx="58"  ry="40"  fill="rgba(255,255,255,0.82)"/>
      <!-- Destellos blancos en cima -->
      <ellipse cx="195" cy="8"   rx="40"  ry="22"  fill="rgba(255,255,255,0.88)"/>
      <!-- Sombra base azulada -->
      <ellipse cx="190" cy="112" rx="162" ry="18"  fill="rgba(140,165,210,0.28)"/>
    </svg>

    <!-- Nube cercana 2 — desfasada 9s -->
    <svg style="
        position:absolute; top:8%; left:0; width:32%; height:18%;
        overflow:visible;
        animation: nube-rapida 20s linear -9s infinite;"
      viewBox="0 0 320 105" aria-hidden="true">
      <ellipse cx="140" cy="86"  rx="135" ry="24"  fill="rgba(232,244,255,0.58)"/>
      <ellipse cx="128" cy="66"  rx="98"  ry="42"  fill="rgba(242,250,255,0.62)"/>
      <ellipse cx="95"  cy="45"  rx="65"  ry="48"  fill="rgba(248,252,255,0.67)"/>
      <ellipse cx="165" cy="40"  rx="72"  ry="50"  fill="rgba(250,253,255,0.70)"/>
      <ellipse cx="135" cy="16"  rx="50"  ry="36"  fill="rgba(255,255,255,0.78)"/>
      <ellipse cx="135" cy="90"  rx="120" ry="15"  fill="rgba(145,168,212,0.24)"/>
    </svg>


    <!-- ══ BRILLO DIFUSO EN NUBES — efecto de sol tocando la cima ══ -->
    <div style="
      position:absolute; top:0%; left:30%; width:40%; height:35%;
      background: radial-gradient(ellipse at 50% 30%,
        rgba(255,245,200,0.22) 0%,
        rgba(255,230,150,0.10) 45%,
        transparent 72%);
      filter: blur(20px);
      animation: brillo-nube 10s ease-in-out infinite;">
    </div>


    <!-- ══ VELO DE CIELO — gradiente suave para profundidad ══════ -->
    <div style="
      position:absolute; inset:0;
      background: linear-gradient(180deg,
        rgba(10,30,80,0.12)  0%,
        transparent          40%,
        rgba(200,230,255,0.08) 80%,
        rgba(220,240,255,0.15) 100%);
      pointer-events:none;">
    </div>

  `;
  return div;
}