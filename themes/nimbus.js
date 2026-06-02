/* themes/nimbus.js — Marina 2
   Tema "Nimbus" — cielo de cumulonimbus al atardecer amenazante.
   Torres de nubes de 15km, base oscura morada, cima blanca iluminada,
   relámpagos internos, lluvia diagonal y el azul-pizarra del cielo entre nubes.
*/

export const tokens = {
  /* Fondos — cielo pizarra oscuro, amenazante */
  '--t-bg':          '#151a28',   /* cielo nocturno de tormenta */
  '--t-bg-mid':      '#1e2a42',   /* azul-pizarra profundo */
  '--t-surface':     'rgba(255,255,255,0.10)',

  /* Texto — blanco frío, azulado */
  '--t-ink':         '#e8f0ff',   /* blanco con tinte de cielo */
  '--t-ink-soft':    'rgba(232,240,255,0.65)',
  '--t-ink-dark':    '#0a0e1a',   /* noche de tormenta */

  /* Colores principales */
  '--t-primary':     '#4fc3f7',   /* azul cielo entre nubes */
  '--t-primary-dk':  '#039be5',
  '--t-accent':      '#ffe066',   /* amarillo relámpago */
  '--t-secondary':   '#9c8fc0',   /* lavanda nube de tormenta */
  '--t-warn':        '#ff6b6b',   /* rojo alerta */
  '--t-gold':        '#ffd54f',   /* ámbar de relámpago lejano */
  '--t-purple':      '#ce93d8',   /* violeta nube iluminada */
  '--t-coral':       '#ff8a65',   /* naranja de puesta tras la tormenta */

  /* Nav */
  '--t-nav-bg':      'linear-gradient(180deg, rgba(10,14,26,0.95) 0%, rgba(21,26,40,0.70) 100%)',

  /* Sombras — frías, azuladas */
  '--t-shadow':      '0 8px 24px rgba(10,20,60,0.45)',
  '--t-shadow-deep': '0 16px 48px rgba(5,10,40,0.60)',

  /* Radios */
  '--t-radius-sm':   '12px',
  '--t-radius-md':   '18px',
  '--t-radius-lg':   '26px',
  '--t-radius-xl':   '36px',
};

export const manifest = {
  background_color: '#151a28',
  theme_color:      '#1e2a42',
};

export function injectStyles() {
  if (document.getElementById('tema-tormenta-styles')) return;

  const vars = Object.entries(tokens).map(([k, v]) => `  ${k}: ${v};`).join('\n');

  const style = document.createElement('style');
  style.id = 'tema-tormenta-styles';
  style.textContent = `
    :root {
    ${vars}
    }

    body { background: var(--t-bg); color: var(--t-ink); }

    /* ── Nubes cumulonimbus moviéndose lentamente ── */
    @keyframes nube-izq {
      0%,100% { transform: translateX(0)    scaleX(1); }
      50%      { transform: translateX(3%)   scaleX(1.04); }
    }
    @keyframes nube-der {
      0%,100% { transform: translateX(0)    scaleX(1); }
      50%      { transform: translateX(-4%)  scaleX(1.06); }
    }
    @keyframes nube-centro {
      0%,100% { transform: translateX(0)   translateY(0);  }
      40%      { transform: translateX(2%)  translateY(-8px); }
      80%      { transform: translateX(-1%) translateY(4px); }
    }

    /* ── Iluminación interna de nube — glow que pulsa ── */
    @keyframes glow-nube-a {
      0%,100% { opacity: 0;    filter: blur(30px); }
      8%       { opacity: .55; filter: blur(22px); }
      14%      { opacity: .20; filter: blur(28px); }
      18%      { opacity: .45; filter: blur(20px); }
      24%      { opacity: 0;   filter: blur(30px); }
    }
    @keyframes glow-nube-b {
      0%,100% { opacity: 0;    filter: blur(35px); }
      5%       { opacity: .40; filter: blur(25px); }
      10%      { opacity: 0;   filter: blur(35px); }
    }

    /* ── Relámpago — destello total de pantalla ── */
    @keyframes destello-rayo {
      0%,100% { opacity: 0; }
      2%       { opacity: .18; }
      4%       { opacity: 0; }
      6%       { opacity: .28; }
      8%       { opacity: 0; }
    }

    /* ── Rayo ramificado SVG ── */
    @keyframes rayo-svg {
      0%,100% { opacity: 0; }
      3%       { opacity: 1; }
      7%       { opacity: 0; }
    }

    /* ── Gotas de lluvia diagonal ── */
    @keyframes lluvia {
      0%   { transform: translateY(-10px) translateX(0);   opacity: 0; }
      10%  { opacity: .55; }
      90%  { opacity: .35; }
      100% { transform: translateY(110vh) translateX(-30px); opacity: 0; }
    }

    /* ── Velo de niebla de tormenta ── */
    @keyframes niebla {
      0%,100% { opacity: .08; transform: translateX(0); }
      50%      { opacity: .14; transform: translateX(2%); }
    }
  `;
  document.head.appendChild(style);
}

export function crearFondo() {
  const div = document.createElement('div');
  div.id = 'app-fondo';
  div.style.cssText =
    'position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;' +
    /* Gradiente: cielo-pizarra oscuro arriba → base de nube morada → oscuridad */
    'background: linear-gradient(180deg,' +
      '#0d1220 0%,' +       /* cénit oscuro, casi negro */
      '#1a2540 12%,' +      /* azul pizarra alto */
      '#2a3060 28%,' +      /* azul-morado de tormenta */
      '#3a2850 42%,' +      /* morado base de cumulonimbus */
      '#1e1e35 58%,' +      /* transición oscura */
      '#151525 75%,' +      /* casi negro, suelo de tormenta */
      '#0a0a18 100%);';     /* negro noche */

  // Generar gotas de lluvia
  const gotas = Array.from({length: 35}, (_, i) => {
    const x   = (i * 2.9) % 100;
    const dur = 0.6 + (i * 0.18) % 0.9;
    const del = (i * 0.31) % 2.5;
    const op  = (0.25 + (i * 0.02) % 0.35).toFixed(2);
    const h   = 12 + (i * 4) % 22;
    return `<line
      x1="${x}%" y1="0"
      x2="${x - 1.5}%" y2="${h}px"
      stroke="rgba(180,210,255,${op})"
      stroke-width="${0.8 + (i * 0.05) % 0.8}"
      style="animation: lluvia ${dur.toFixed(2)}s ${del.toFixed(2)}s linear infinite"/>`;
  }).join('\n      ');

  div.innerHTML = `

    <!-- ══ NUBES CUMULONIMBUS ═══════════════════════════════════ -->

    <!-- Torre principal — cumulonimbus centro-izquierda -->
    <svg style="
        position:absolute; top:-8%; left:-5%; width:65%; height:80%;
        transform-origin: 50% 100%;
        animation: nube-izq 18s ease-in-out infinite;"
      viewBox="0 0 400 500" aria-hidden="true">
      <!-- Cuerpo principal oscuro de la nube -->
      <ellipse cx="200" cy="420" rx="200" ry="80"
        fill="rgba(25,20,50,0.80)"/>
      <!-- Torre media -->
      <ellipse cx="160" cy="320" rx="130" ry="110"
        fill="rgba(35,28,65,0.75)"/>
      <!-- Torre alta izquierda -->
      <ellipse cx="110" cy="200" rx="90" ry="95"
        fill="rgba(45,38,80,0.70)"/>
      <!-- Cima brillante (iluminada por sol desde arriba) -->
      <ellipse cx="130" cy="120" rx="75" ry="65"
        fill="rgba(200,210,240,0.18)"/>
      <ellipse cx="160" cy="80" rx="55" ry="50"
        fill="rgba(220,225,255,0.22)"/>
      <!-- Yunque de la cima — característico del cumulonimbus -->
      <ellipse cx="180" cy="55" rx="80" ry="30"
        fill="rgba(230,235,255,0.15)"/>
      <!-- Detalle de bordes iluminados -->
      <ellipse cx="120" cy="110" rx="40" ry="35"
        fill="rgba(255,255,255,0.08)"/>
    </svg>

    <!-- Torre secundaria — derecha, más alta -->
    <svg style="
        position:absolute; top:-12%; right:-8%; width:60%; height:85%;
        transform-origin: 50% 100%;
        animation: nube-der 22s ease-in-out 2s infinite;"
      viewBox="0 0 380 520" aria-hidden="true">
      <ellipse cx="190" cy="440" rx="190" ry="75"
        fill="rgba(20,15,45,0.82)"/>
      <ellipse cx="220" cy="330" rx="140" ry="120"
        fill="rgba(30,24,60,0.76)"/>
      <ellipse cx="250" cy="200" rx="110" ry="115"
        fill="rgba(40,32,75,0.70)"/>
      <ellipse cx="230" cy="100" rx="85" ry="80"
        fill="rgba(50,42,88,0.65)"/>
      <!-- Cima iluminada -->
      <ellipse cx="240" cy="55" rx="70" ry="55"
        fill="rgba(210,215,245,0.20)"/>
      <ellipse cx="255" cy="25" rx="50" ry="35"
        fill="rgba(225,230,255,0.18)"/>
      <!-- Yunque extendido hacia la izquierda -->
      <ellipse cx="210" cy="15" rx="90" ry="25"
        fill="rgba(235,238,255,0.12)"/>
    </svg>

    <!-- Masa de nubes baja — base oscura amenazante -->
    <svg style="
        position:absolute; top:25%; left:-2%; width:104%; height:50%;
        animation: nube-centro 25s ease-in-out 1s infinite;"
      viewBox="0 0 1100 300" aria-hidden="true">
      <path d="M0,150 Q80,80 160,130 Q240,60 340,100 Q440,40 540,90
               Q640,50 740,95 Q840,55 940,100 Q1020,75 1100,120
               L1100,300 L0,300 Z"
        fill="rgba(20,15,45,0.70)"/>
      <path d="M0,180 Q100,130 200,160 Q320,110 420,150
               Q540,120 640,155 Q760,125 860,158
               Q980,130 1100,160 L1100,300 L0,300 Z"
        fill="rgba(15,10,38,0.60)"/>
    </svg>


    <!-- ══ ILUMINACIÓN INTERNA — glow que pulsa como relámpago en nube ══ -->

    <!-- Glow nube izquierda -->
    <div style="
      position:absolute; top:5%; left:2%; width:45%; height:55%;
      background: radial-gradient(ellipse at 40% 60%,
        rgba(180,200,255,0.60) 0%,
        rgba(120,140,255,0.30) 35%,
        transparent 68%);
      filter: blur(30px);
      animation: glow-nube-a 8s ease-in-out 1s infinite;">
    </div>

    <!-- Glow nube derecha -->
    <div style="
      position:absolute; top:2%; right:0%; width:50%; height:60%;
      background: radial-gradient(ellipse at 60% 55%,
        rgba(160,180,255,0.55) 0%,
        rgba(200,160,255,0.25) 40%,
        transparent 70%);
      filter: blur(35px);
      animation: glow-nube-b 11s ease-in-out 3.5s infinite;">
    </div>

    <!-- Glow morado — base oscura de nube iluminada -->
    <div style="
      position:absolute; top:30%; left:15%; width:70%; height:40%;
      background: radial-gradient(ellipse at 50% 40%,
        rgba(140,100,200,0.30) 0%,
        rgba(80,60,160,0.15)  50%,
        transparent 75%);
      filter: blur(40px);
      animation: glow-nube-a 13s ease-in-out 6s infinite;">
    </div>


    <!-- ══ DESTELLO TOTAL DE RELÁMPAGO ══════════════════════════ -->
    <div style="
      position:absolute; inset:0;
      background: rgba(200,220,255,1);
      animation: destello-rayo 9s ease-in-out 4s infinite;
      pointer-events:none;">
    </div>
    <div style="
      position:absolute; inset:0;
      background: rgba(220,230,255,1);
      animation: destello-rayo 14s ease-in-out 11s infinite;
      pointer-events:none;">
    </div>


    <!-- ══ RAYOS RAMIFICADOS SVG ═════════════════════════════════ -->
    <svg style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;" aria-hidden="true">

      <!-- Rayo principal izquierda -->
      <g style="animation: rayo-svg 9s ease-in-out 4s infinite;">
        <polyline points="28%,12% 25%,28% 27%,28% 22%,48% 24%,48% 18%,72%"
          stroke="rgba(255,245,180,0.95)" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <!-- Ramificación 1 -->
        <polyline points="25%,28% 20%,40%"
          stroke="rgba(255,245,180,0.60)" stroke-width="1.5"
          stroke-linecap="round" fill="none"/>
        <!-- Ramificación 2 -->
        <polyline points="22%,48% 17%,58%"
          stroke="rgba(255,245,180,0.50)" stroke-width="1.2"
          stroke-linecap="round" fill="none"/>
        <!-- Glow del rayo -->
        <polyline points="28%,12% 25%,28% 27%,28% 22%,48% 24%,48% 18%,72%"
          stroke="rgba(180,210,255,0.40)" stroke-width="8"
          stroke-linecap="round" stroke-linejoin="round" fill="none"
          style="filter:blur(4px)"/>
      </g>

      <!-- Rayo secundario derecha — timing diferente -->
      <g style="animation: rayo-svg 14s ease-in-out 11s infinite;">
        <polyline points="72%,8% 75%,22% 73%,22% 78%,40% 76%,40% 80%,62%"
          stroke="rgba(255,248,190,0.90)" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <polyline points="75%,22% 80%,34%"
          stroke="rgba(255,248,190,0.55)" stroke-width="1.3"
          stroke-linecap="round" fill="none"/>
        <polyline points="76%,40% 82%,52%"
          stroke="rgba(255,248,190,0.45)" stroke-width="1.1"
          stroke-linecap="round" fill="none"/>
        <polyline points="72%,8% 75%,22% 73%,22% 78%,40% 76%,40% 80%,62%"
          stroke="rgba(180,210,255,0.35)" stroke-width="7"
          stroke-linecap="round" stroke-linejoin="round" fill="none"
          style="filter:blur(4px)"/>
      </g>
    </svg>


    <!-- ══ LLUVIA DIAGONAL ════════════════════════════════════════ -->
    <svg style="
        position:absolute; inset:0; width:100%; height:100%;
        overflow:visible; opacity:0.7;"
      aria-hidden="true">
      ${gotas}
    </svg>


    <!-- ══ VELO DE NIEBLA Y HUMEDAD ══════════════════════════════ -->
    <div style="
      position:absolute; inset:0;
      background: linear-gradient(160deg,
        transparent 0%,
        rgba(100,120,180,0.06) 40%,
        rgba(80,100,160,0.10) 70%,
        rgba(60,80,140,0.15) 100%);
      animation: niebla 12s ease-in-out infinite;">
    </div>

    <!-- Resplandor azul-violeta inferior — reflexión en suelo mojado -->
    <div style="
      position:absolute; bottom:-5%; left:50%; transform:translateX(-50%);
      width:120%; height:35%;
      background: radial-gradient(ellipse at 50% 100%,
        rgba(80,100,200,0.18) 0%,
        rgba(60,80,180,0.08)  45%,
        transparent 72%);
      filter: blur(40px);">
    </div>

  `;
  return div;
}