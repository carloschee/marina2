/* themes/tropical.js — Marina 2
   Tema "Tropical" — vegetación frondosa de isla tropical mexicana.
   Inspirado en Cozumel, Holbox e Isla Mujeres: palmas, helechos,
   bugambilia, hibisco y la luz del Caribe filtrándose entre las copas.
   Fondo: luz dappled entre follaje + siluetas de hojas que oscilan.
*/

export const tokens = {
  /* Fondos — verde selva húmeda, luminosa, no oscura */
  '--t-bg': '#163d25',   /* verde selva profundo */
  '--t-bg-mid': '#245e3a',   /* verde jungla medio */
  '--t-surface': 'rgba(255,255,255,0.12)', /* superficie de cards */

  /* Texto — blanco cálido, legible sobre verde */
  '--t-ink': '#f0fce8',   /* blanco verdoso cálido */
  '--t-ink-soft': 'rgba(240,252,232,0.68)',
  '--t-ink-dark': '#0a1f10',   /* verde muy oscuro para texto sobre claro */

  /* Colores principales — vibrantes, flora tropical */
  '--t-primary': '#00d4aa',   /* turquesa Caribe — el mar que se asoma */
  '--t-primary-dk': '#00a888',
  '--t-accent': '#c8e84a',   /* amarillo-lima, luz solar entre hojas */
  '--t-secondary': '#e91e8c',   /* magenta bugambilia */
  '--t-warn': '#ff5252',   /* hibisco rojo encendido */
  '--t-gold': '#ffcc02',   /* amarillo sol directo */
  '--t-purple': '#ce93d8',   /* flor de jacaranda */
  '--t-coral': '#ff7043',   /* flor de coral tropical */

  /* Nav */
  '--t-nav-bg': 'linear-gradient(180deg, rgba(10,25,15,0.94) 0%, rgba(22,61,37,0.65) 100%)',

  /* Sombras — verdes, no azuladas */
  '--t-shadow': '0 8px 24px rgba(0,40,15,0.40)',
  '--t-shadow-deep': '0 16px 48px rgba(0,30,10,0.55)',

  /* Radios — igual que los demás temas */
  '--t-radius-sm': '12px',
  '--t-radius-md': '18px',
  '--t-radius-lg': '26px',
  '--t-radius-xl': '36px',
};

export function injectStyles() {
  if (document.getElementById('tema-tropical-styles')) return;

  const vars = Object.entries(tokens).map(([k, v]) => `  ${k}: ${v};`).join('\n');

  const style = document.createElement('style');
  style.id = 'tema-tropical-styles';
  style.textContent = `
    :root {
    ${vars}
    }

    body { background: var(--t-bg); color: var(--t-ink); }

    /* ── Luz dappled — manchas de luz solar filtrándose entre hojas ── */
    @keyframes dappled-a {
      0%,100% { transform: translate(0, 0)     scale(1)    rotate(0deg);   opacity: .18; }
      30%      { transform: translate(3%, 2%)   scale(1.1)  rotate(3deg);   opacity: .28; }
      70%      { transform: translate(-2%, -1%) scale(0.95) rotate(-2deg);  opacity: .22; }
    }
    @keyframes dappled-b {
      0%,100% { transform: translate(0, 0)     scale(1)    rotate(0deg);   opacity: .14; }
      40%      { transform: translate(-4%, 3%)  scale(1.15) rotate(-4deg);  opacity: .24; }
      80%      { transform: translate(2%, -2%)  scale(0.92) rotate(2deg);   opacity: .18; }
    }
    @keyframes dappled-c {
      0%,100% { transform: translate(0, 0)   scale(1);    opacity: .12; }
      50%      { transform: translate(2%, 4%) scale(1.08); opacity: .20; }
    }

    /* ── Hoja que oscila — follaje de palma en los bordes ── */
    @keyframes hoja-izq {
      0%,100% { transform: rotate(-4deg)  skewX(-2deg); }
      50%      { transform: rotate(-10deg) skewX(-5deg); }
    }
    @keyframes hoja-der {
      0%,100% { transform: rotate(5deg)  skewX(2deg);  }
      50%      { transform: rotate(12deg) skewX(5deg);  }
    }
    @keyframes hoja-techo {
      0%,100% { transform: rotate(-2deg) translateY(0);   }
      50%      { transform: rotate(-6deg) translateY(4px); }
    }

    /* ── Destellos de luz — puntos de sol que traspasan ── */
    @keyframes destello-hoja {
      0%,100% { opacity: 0;    transform: scale(0.8); }
      40%      { opacity: .55; transform: scale(1.2); }
      60%      { opacity: .45; transform: scale(1.1); }
    }

    /* ── Partícula de polvo vegetal flotando ── */
    @keyframes polvo {
      0%   { opacity: 0;    transform: translateY(0)    translateX(0)   rotate(0deg); }
      20%  { opacity: .50; }
      80%  { opacity: .35; }
      100% { opacity: 0;    transform: translateY(-45px) translateX(12px) rotate(180deg); }
    }
  `;
  document.head.appendChild(style);
}

export function crearFondo() {
  const div = document.createElement('div');
  div.id = 'app-fondo';
  div.style.cssText =
    'position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;' +
    /* Gradiente vertical: cielo tropical arriba → dosel verde → selva oscura abajo */
    'background: linear-gradient(180deg,' +
    '#3eb8c8 0%,' +       /* cielo Caribe, arriba */
    '#5ac8a0 10%,' +      /* horizonte verde-turquesa */
    '#2e7d4f 22%,' +      /* copa de los árboles */
    '#245e3a 40%,' +      /* follaje medio */
    '#1a4a2e 62%,' +      /* sotobosque húmedo */
    '#112e1c 82%,' +      /* sombra de selva */
    '#0a1f10 100%);';     /* suelo oscuro */

  div.innerHTML = `

    <!-- ══ MANCHAS DE LUZ DAPPLED ══════════════════════════════ -->

    <!-- Mancha grande izquierda — luz filtrándose entre palmas -->
    <div style="
      position:absolute; top:5%; left:5%; width:35%; height:45%;
      background: radial-gradient(ellipse at 40% 30%,
        rgba(200,232,74,0.28)  0%,
        rgba(120,220,80,0.14) 40%,
        transparent 70%);
      filter: blur(28px); border-radius: 60% 40% 55% 45%;
      animation: dappled-a 9s ease-in-out infinite;">
    </div>

    <!-- Mancha central — haz de luz directo -->
    <div style="
      position:absolute; top:0%; left:38%; width:25%; height:60%;
      background: radial-gradient(ellipse at 50% 10%,
        rgba(255,220,80,0.30)  0%,
        rgba(180,240,100,0.16) 35%,
        transparent 68%);
      filter: blur(22px); border-radius: 50%;
      animation: dappled-b 12s ease-in-out 1s infinite;">
    </div>

    <!-- Mancha derecha — luz difusa entre helechos -->
    <div style="
      position:absolute; top:8%; right:4%; width:30%; height:40%;
      background: radial-gradient(ellipse at 60% 20%,
        rgba(160,240,120,0.22) 0%,
        rgba(100,200,80,0.10)  45%,
        transparent 72%);
      filter: blur(24px); border-radius: 45% 55% 50% 50%;
      animation: dappled-c 10s ease-in-out 2s infinite;">
    </div>

    <!-- Mancha baja — luz rebotada en suelo húmedo -->
    <div style="
      position:absolute; bottom:5%; left:20%; width:60%; height:30%;
      background: radial-gradient(ellipse at 50% 80%,
        rgba(0,212,160,0.14)  0%,
        rgba(40,160,80,0.08)  50%,
        transparent 75%);
      filter: blur(35px);">
    </div>


    <!-- ══ SILUETAS DE PALMA — bordes izquierdo y derecho ═══════ -->

    <!-- Palma izquierda — hojas que cuelgan desde arriba-izquierda -->
    <svg style="
        position:absolute; top:-4%; left:-6%; width:38%; height:55%;
        transform-origin: 30% 0%;
        animation: hoja-izq 7s ease-in-out infinite;"
      viewBox="0 0 200 280" aria-hidden="true">
      <!-- Nervadura central -->
      <path d="M60,0 Q80,80 30,180" stroke="rgba(20,70,30,0.70)" stroke-width="4" fill="none"/>
      <!-- Hoja 1 -->
      <path d="M60,0 Q130,40 110,110 Q80,80 60,0Z"
            fill="rgba(15,60,25,0.55)"/>
      <!-- Hoja 2 -->
      <path d="M60,0 Q10,60 5,140 Q30,100 60,0Z"
            fill="rgba(20,70,30,0.50)"/>
      <!-- Hoja 3 — más oscura, profundidad -->
      <path d="M60,0 Q140,80 160,160 Q100,100 60,0Z"
            fill="rgba(10,45,18,0.45)"/>
      <!-- Hoja 4 -->
      <path d="M60,0 Q-10,30 -15,110 Q20,70 60,0Z"
            fill="rgba(25,80,35,0.48)"/>
      <!-- Detalles de nervaduras -->
      <path d="M62,5 Q125,45 108,108" stroke="rgba(40,100,50,0.35)" stroke-width="1.5" fill="none"/>
      <path d="M60,3 Q12,62 8,138"    stroke="rgba(40,100,50,0.30)" stroke-width="1.5" fill="none"/>
    </svg>

    <!-- Palma derecha — espejo, desde arriba-derecha -->
    <svg style="
        position:absolute; top:-4%; right:-6%; width:38%; height:55%;
        transform-origin: 70% 0%;
        animation: hoja-der 8s ease-in-out 1s infinite;"
      viewBox="0 0 200 280" aria-hidden="true">
      <path d="M140,0 Q120,80 170,180" stroke="rgba(20,70,30,0.70)" stroke-width="4" fill="none"/>
      <path d="M140,0 Q70,40 90,110 Q120,80 140,0Z"
            fill="rgba(15,60,25,0.55)"/>
      <path d="M140,0 Q190,60 195,140 Q170,100 140,0Z"
            fill="rgba(20,70,30,0.50)"/>
      <path d="M140,0 Q60,80 40,160 Q100,100 140,0Z"
            fill="rgba(10,45,18,0.45)"/>
      <path d="M140,0 Q210,30 215,110 Q180,70 140,0Z"
            fill="rgba(25,80,35,0.48)"/>
      <path d="M138,5 Q75,45 92,108"  stroke="rgba(40,100,50,0.35)" stroke-width="1.5" fill="none"/>
      <path d="M140,3 Q188,62 192,138" stroke="rgba(40,100,50,0.30)" stroke-width="1.5" fill="none"/>
    </svg>

    <!-- Helechos inferiores izquierda — vegetación de sotobosque -->
    <svg style="
        position:absolute; bottom:-2%; left:-3%; width:30%; height:35%;
        transform-origin: 50% 100%;
        animation: hoja-techo 11s ease-in-out 0.5s infinite;"
      viewBox="0 0 180 200" aria-hidden="true">
      <path d="M40,200 Q60,120 20,60"  stroke="rgba(30,90,40,0.65)" stroke-width="3" fill="none"/>
      <path d="M40,200 Q80,130 100,70" stroke="rgba(25,80,35,0.60)" stroke-width="3" fill="none"/>
      <path d="M40,200 Q10,140 0,80"   stroke="rgba(20,70,30,0.55)" stroke-width="3" fill="none"/>
      <!-- Pinnas del helecho izquierdo -->
      ${Array.from({ length: 7 }, (_, i) => {
    const t = 0.2 + i * 0.11;
    const cx = Math.round(40 + (60 - 40) * t);
    const cy = Math.round(200 + (120 - 200) * t);
    const len = 12 + i * 3;
    return `<line x1="${cx}" y1="${cy}" x2="${cx - len}" y2="${cy - 8}"
          stroke="rgba(35,95,45,0.50)" stroke-width="2"/>
        <line x1="${cx}" y1="${cy}" x2="${cx + len}" y2="${cy - 8}"
          stroke="rgba(35,95,45,0.50)" stroke-width="2"/>`;
  }).join('\n      ')}
    </svg>

    <!-- Helechos inferiores derecha -->
    <svg style="
        position:absolute; bottom:-2%; right:-3%; width:30%; height:35%;
        transform-origin: 50% 100%;
        animation: hoja-techo 10s ease-in-out 2s infinite;"
      viewBox="0 0 180 200" aria-hidden="true">
      <path d="M140,200 Q120,120 160,60"  stroke="rgba(30,90,40,0.65)" stroke-width="3" fill="none"/>
      <path d="M140,200 Q100,130 80,70"   stroke="rgba(25,80,35,0.60)" stroke-width="3" fill="none"/>
      <path d="M140,200 Q170,140 180,80"  stroke="rgba(20,70,30,0.55)" stroke-width="3" fill="none"/>
      ${Array.from({ length: 7 }, (_, i) => {
    const t = 0.2 + i * 0.11;
    const cx = Math.round(140 + (120 - 140) * t);
    const cy = Math.round(200 + (120 - 200) * t);
    const len = 12 + i * 3;
    return `<line x1="${cx}" y1="${cy}" x2="${cx - len}" y2="${cy - 8}"
          stroke="rgba(35,95,45,0.50)" stroke-width="2"/>
        <line x1="${cx}" y1="${cy}" x2="${cx + len}" y2="${cy - 8}"
          stroke="rgba(35,95,45,0.50)" stroke-width="2"/>`;
  }).join('\n      ')}
    </svg>


    <!-- ══ DESTELLOS DE LUZ — puntos que traspasan el follaje ══ -->
    <svg style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;" aria-hidden="true">
      ${Array.from({ length: 14 }, (_, i) => {
    const x = 8 + (i * 6.8) % 84;
    const y = 5 + (i * 5.3) % 55;     /* zona de follaje, no toda la pantalla */
    const r = 2 + (i * 1.4) % 5;
    const dur = 3 + (i * 1.1) % 5;
    const del = (i * 0.7) % 6;
    return `<circle cx="${x}%" cy="${y}%" r="${r}"
          fill="rgba(220,255,140,0.70)"
          style="animation: destello-hoja ${dur.toFixed(1)}s ${del.toFixed(1)}s ease-in-out infinite"/>`;
  }).join('\n      ')}
    </svg>


    <!-- ══ PARTÍCULAS DE POLVO VEGETAL — flotando hacia arriba ══ -->
    <svg style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;" aria-hidden="true">
      ${Array.from({ length: 10 }, (_, i) => {
    const x = 10 + (i * 9.1) % 80;
    const y = 40 + (i * 4.7) % 50;     /* zona baja — el polvo sube */
    const r = 1 + (i * 0.6) % 2.5;
    const dur = 6 + (i * 1.5) % 8;
    const del = (i * 1.2) % 7;
    const op = (0.30 + (i * 0.04) % 0.35).toFixed(2);
    return `<circle cx="${x}%" cy="${y}%" r="${r}"
          fill="rgba(200,240,120,${op})"
          style="animation: polvo ${dur.toFixed(1)}s ${del.toFixed(1)}s ease-in-out infinite"/>`;
  }).join('\n      ')}
    </svg>


    <!-- ══ VELO DE HUMEDAD — bruma de selva tropical ═══════════ -->
    <div style="
      position:absolute; inset:0;
      background: linear-gradient(180deg,
        transparent 0%,
        rgba(0,200,120,0.04) 30%,
        rgba(0,160,80,0.07)  60%,
        rgba(0,80,30,0.12)   100%);
      pointer-events:none;">
    </div>

  `;
  return div;
}

export const manifest = {
  background_color: '#163d25',
  theme_color: '#245e3a',
};