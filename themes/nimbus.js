/* themes/viento.js — Marina 2
   Tema "Viento" — cielo de tarde con nubes cúmulos empujadas por la brisa.
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

    /* ── Ráfaga — traslación continua de izquierda a derecha ── */
    @keyframes rafaga {
      0%   { transform: translateX(-110%); }
      100% { transform: translateX(110vw); }
    }

    /* ── Ondulación vertical — la ráfaga sube y baja suavemente ── */
    @keyframes ondula-a {
      0%,100% { transform: translateY(0)    scaleY(1); }
      30%      { transform: translateY(-6px) scaleY(1.08); }
      65%      { transform: translateY(4px)  scaleY(0.94); }
    }
    @keyframes ondula-b {
      0%,100% { transform: translateY(0)    scaleY(1); }
      40%      { transform: translateY(8px)  scaleY(1.10); }
      75%      { transform: translateY(-4px) scaleY(0.92); }
    }
    @keyframes ondula-c {
      0%,100% { transform: translateY(0)    scaleY(1); }
      25%      { transform: translateY(-10px) scaleY(1.12); }
      60%      { transform: translateY(6px)   scaleY(0.90); }
    }

    /* ── Pulso de opacidad — la ráfaga aparece y se desvanece ── */
    @keyframes pulso-rafaga {
      0%,100% { opacity: 0; }
      15%      { opacity: 1; }
      85%      { opacity: 1; }
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

  // Genera una ráfaga SVG: path ondulante con degradado horizontal
  function _rafaga({ top, grosor, dur, delay, opMin, opMax, ondula, curva }) {
    const id = `rg-${Math.random().toString(36).slice(2,7)}`;
    // path: línea ondulante horizontal con curvas cúbicas
    const w = 900;
    const y = grosor / 2;
    const amp = grosor * curva;
    const path = `M0,${y}
      C${w*0.15},${y - amp} ${w*0.25},${y + amp} ${w*0.4},${y}
      C${w*0.55},${y - amp} ${w*0.65},${y + amp*0.7} ${w*0.78},${y}
      C${w*0.88},${y - amp*0.5} ${w*0.94},${y + amp*0.3} ${w},${y}
      L${w},${grosor} L0,${grosor} Z`;

    return `
    <div style="
        position:absolute; top:${top}; left:0; width:100%; height:${grosor}px;
        animation: rafaga ${dur}s linear ${delay}s infinite, ${ondula} infinite;
        animation-fill-mode: none;">
      <svg style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;" viewBox="0 0 900 ${grosor}" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stop-color="white" stop-opacity="0"/>
            <stop offset="12%"  stop-color="white" stop-opacity="${opMax}"/>
            <stop offset="50%"  stop-color="white" stop-opacity="${opMax * 0.85}"/>
            <stop offset="88%"  stop-color="white" stop-opacity="${opMin}"/>
            <stop offset="100%" stop-color="white" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${path}" fill="url(#${id})"/>
      </svg>
    </div>`;
  }

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


    <!-- ══ RÁFAGAS DE VIENTO ══════════════════════════════════════ -->

    ${/* Capa trasera — ráfagas tenues, lentas */ ''}

    ${_rafaga({ top:'8%',  grosor:18, dur:28, delay:0,    opMin:.04, opMax:.18, ondula:'ondula-b 9s ease-in-out infinite',  curva:0.9 })}
    ${_rafaga({ top:'15%', grosor:12, dur:32, delay:-8,   opMin:.03, opMax:.14, ondula:'ondula-a 11s ease-in-out infinite', curva:0.7 })}
    ${_rafaga({ top:'24%', grosor:22, dur:26, delay:-16,  opMin:.04, opMax:.16, ondula:'ondula-c 8s ease-in-out infinite',  curva:1.1 })}
    ${_rafaga({ top:'35%', grosor:10, dur:34, delay:-5,   opMin:.02, opMax:.12, ondula:'ondula-a 13s ease-in-out infinite', curva:0.6 })}
    ${_rafaga({ top:'44%', grosor:16, dur:30, delay:-22,  opMin:.03, opMax:.13, ondula:'ondula-b 10s ease-in-out infinite', curva:0.8 })}
    ${_rafaga({ top:'55%', grosor:14, dur:36, delay:-11,  opMin:.02, opMax:.10, ondula:'ondula-c 12s ease-in-out infinite', curva:0.7 })}
    ${_rafaga({ top:'66%', grosor:20, dur:29, delay:-19,  opMin:.03, opMax:.14, ondula:'ondula-a 9s ease-in-out infinite',  curva:1.0 })}
    ${_rafaga({ top:'76%', grosor:11, dur:38, delay:-7,   opMin:.02, opMax:.09, ondula:'ondula-b 14s ease-in-out infinite', curva:0.6 })}

    ${/* Capa media — ráfagas principales */ ''}

    ${_rafaga({ top:'5%',  grosor:28, dur:18, delay:0,    opMin:.08, opMax:.32, ondula:'ondula-a 7s ease-in-out infinite',  curva:1.2 })}
    ${_rafaga({ top:'19%', grosor:20, dur:22, delay:-6,   opMin:.06, opMax:.26, ondula:'ondula-c 9s ease-in-out infinite',  curva:1.0 })}
    ${_rafaga({ top:'30%', grosor:32, dur:16, delay:-10,  opMin:.07, opMax:.28, ondula:'ondula-b 8s ease-in-out infinite',  curva:1.3 })}
    ${_rafaga({ top:'42%', grosor:18, dur:24, delay:-3,   opMin:.05, opMax:.22, ondula:'ondula-a 11s ease-in-out infinite', curva:0.9 })}
    ${_rafaga({ top:'52%', grosor:26, dur:19, delay:-14,  opMin:.06, opMax:.24, ondula:'ondula-c 7s ease-in-out infinite',  curva:1.1 })}
    ${_rafaga({ top:'63%', grosor:16, dur:21, delay:-9,   opMin:.05, opMax:.20, ondula:'ondula-b 10s ease-in-out infinite', curva:0.8 })}
    ${_rafaga({ top:'73%', grosor:30, dur:17, delay:-17,  opMin:.07, opMax:.26, ondula:'ondula-a 8s ease-in-out infinite',  curva:1.2 })}
    ${_rafaga({ top:'84%', grosor:14, dur:25, delay:-4,   opMin:.04, opMax:.18, ondula:'ondula-c 12s ease-in-out infinite', curva:0.7 })}

    ${/* Capa delantera — ráfagas vivas, rápidas */ ''}

    ${_rafaga({ top:'2%',  grosor:38, dur:11, delay:0,    opMin:.10, opMax:.42, ondula:'ondula-c 5s ease-in-out infinite',  curva:1.5 })}
    ${_rafaga({ top:'22%', grosor:30, dur:13, delay:-4,   opMin:.09, opMax:.38, ondula:'ondula-a 6s ease-in-out infinite',  curva:1.4 })}
    ${_rafaga({ top:'38%', grosor:42, dur:10, delay:-7,   opMin:.10, opMax:.40, ondula:'ondula-b 5s ease-in-out infinite',  curva:1.6 })}
    ${_rafaga({ top:'57%', grosor:28, dur:14, delay:-2,   opMin:.08, opMax:.35, ondula:'ondula-c 7s ease-in-out infinite',  curva:1.3 })}
    ${_rafaga({ top:'70%', grosor:36, dur:12, delay:-9,   opMin:.09, opMax:.38, ondula:'ondula-a 5s ease-in-out infinite',  curva:1.5 })}
    ${_rafaga({ top:'88%', grosor:24, dur:15, delay:-5,   opMin:.07, opMax:.30, ondula:'ondula-b 8s ease-in-out infinite',  curva:1.2 })}


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