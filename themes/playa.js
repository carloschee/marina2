/* themes/playa.js — Marina 2
   Tema "Playa" — arena dorada al mediodía, sol resplandeciente.
   Alternativa cálida a oceano.js: tierra, luz y calor en lugar de agua profunda.
   Fondo: horizonte playa con cielo, franja de mar, arena y destellos de sol.
*/

export const tokens = {
  /* Fondos — arena y tierra cálida bajo el sol */
  '--t-bg': '#7a4a1e',   /* arena oscura, sombra de palmera */
  '--t-bg-mid': '#a0622a',   /* arena mediodía cálida */
  '--t-surface': 'rgba(255,255,255,0.14)', /* superficie de cards */

  /* Texto */
  '--t-ink': '#fff8ee',   /* blanco cálido, no frío */
  '--t-ink-soft': 'rgba(255,248,238,0.68)',
  '--t-ink-dark': '#2a1200',   /* marrón muy oscuro para texto sobre claro */

  /* Colores principales */
  '--t-primary': '#00b4d8',   /* azul turquesa del mar */
  '--t-primary-dk': '#0096b4',
  '--t-accent': '#ffd60a',   /* amarillo sol intenso */
  '--t-secondary': '#f4845f',   /* naranja arena húmeda */
  '--t-warn': '#e63946',   /* rojo coral */
  '--t-gold': '#ffaa00',   /* dorado arena seca */
  '--t-purple': '#d4a5f5',   /* lavanda suave — contraste sobre arena */
  '--t-coral': '#ff6b6b',   /* coral vivo */

  /* Nav */
  '--t-nav-bg': 'linear-gradient(180deg, rgba(60,25,5,0.92) 0%, rgba(122,74,30,0.60) 100%)',

  /* Sombras — cálidas, no azuladas */
  '--t-shadow': '0 8px 24px rgba(80,30,0,0.35)',
  '--t-shadow-deep': '0 16px 48px rgba(60,20,0,0.50)',

  /* Radios — igual que oceano para compatibilidad */
  '--t-radius-sm': '12px',
  '--t-radius-md': '18px',
  '--t-radius-lg': '26px',
  '--t-radius-xl': '36px',
};

export function injectStyles() {
  if (document.getElementById('tema-playa-styles')) return;

  const vars = Object.entries(tokens).map(([k, v]) => `  ${k}: ${v};`).join('\n');

  const style = document.createElement('style');
  style.id = 'tema-playa-styles';
  style.textContent = `
    :root {
    ${vars}
    }

    body { background: var(--t-bg); color: var(--t-ink); }

    /* ── Rayos de sol directos (desde arriba, no submarinos) ── */
    @keyframes rayo-a {
      0%   { transform: translateX(0)    rotate(-6deg) scaleX(1);    opacity: .28; }
      45%  { transform: translateX(5vw)  rotate(-3deg) scaleX(1.12); opacity: .42; }
      100% { transform: translateX(11vw) rotate(-8deg) scaleX(0.92); opacity: .22; }
    }
    @keyframes rayo-b {
      0%   { transform: translateX(0)    rotate(5deg)  scaleX(1);    opacity: .22; }
      50%  { transform: translateX(-7vw) rotate(3deg)  scaleX(1.18); opacity: .35; }
      100% { transform: translateX(-3vw) rotate(7deg)  scaleX(0.88); opacity: .18; }
    }
    @keyframes rayo-c {
      0%   { transform: translateX(0)    rotate(-3deg); opacity: .18; }
      60%  { transform: translateX(8vw)  rotate(-6deg); opacity: .30; }
      100% { transform: translateX(4vw)  rotate(-2deg); opacity: .14; }
    }

    /* ── Destello de sol (corona superior) ── */
    @keyframes destello {
      0%,100% { opacity: .55; transform: scale(1);    filter: blur(32px); }
      50%      { opacity: .80; transform: scale(1.08); filter: blur(28px); }
    }

    /* ── Ondas de calor — haze sobre la arena ── */
    @keyframes calor-a {
      0%,100% { transform: translateX(0)   scaleY(1);    opacity: .12; }
      50%      { transform: translateX(3%)  scaleY(1.15); opacity: .20; }
    }
    @keyframes calor-b {
      0%,100% { transform: translateX(0)   scaleY(1);    opacity: .10; }
      50%      { transform: translateX(-4%) scaleY(1.20); opacity: .18; }
    }

    /* ── Partículas de arena — puntos brillantes ── */
    @keyframes grano {
      0%   { opacity: 0;    transform: translateY(0)   rotate(0deg);   }
      20%  { opacity: .80; }
      80%  { opacity: .60; }
      100% { opacity: 0;    transform: translateY(-30px) rotate(180deg); }
    }

    /* ── Ola del horizonte ── */
    @keyframes ola-playa {
      0%,100% { d: path('M0,35 Q360,10 720,35 T1440,35 L1440,60 L0,60 Z'); }
      50%      { d: path('M0,25 Q360,50 720,20 T1440,40 L1440,60 L0,60 Z'); }
    }
  `;
  document.head.appendChild(style);
}

export function crearFondo() {
  const div = document.createElement('div');
  div.id = 'app-fondo';
  div.style.cssText =
    'position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;' +
    /* Gradiente vertical: cielo arriba → mar → arena abajo */
    'background: linear-gradient(180deg,' +
    '#87ceeb 0%,' +       /* cielo azul claro */
    '#b8e8f5 8%,' +       /* cielo más suave */
    '#3aafcc 22%,' +      /* franja de mar turquesa */
    '#2a8fa8 28%,' +      /* mar más profundo */
    '#c8874a 40%,' +      /* línea de playa */
    '#d4935a 55%,' +      /* arena clara al sol */
    '#b87a3a 75%,' +      /* arena media */
    '#7a4a1e 100%);';     /* arena sombra, fondo base */

  div.innerHTML = `
    <!-- ── Corona del sol — resplandor desde la parte superior ── -->
    <div style="
      position:absolute; top:-18%; left:50%; transform:translateX(-50%);
      width:70%; height:55%;
      background: radial-gradient(ellipse at 50% 0%,
        rgba(255,230,80,0.65)  0%,
        rgba(255,180,30,0.38) 25%,
        rgba(255,140,0,0.18)  50%,
        transparent 72%);
      animation: destello 6s ease-in-out infinite;">
    </div>

    <!-- ── Rayo de sol 1 — diagonal izquierda ── -->
    <div style="
      position:absolute; top:-5%; left:20%; width:7%; height:95%;
      background: linear-gradient(180deg,
        rgba(255,235,80,0.30) 0%,
        rgba(255,200,50,0.14) 45%,
        transparent 100%);
      filter: blur(16px); border-radius: 50%;
      transform: rotate(-7deg);
      animation: rayo-a 11s ease-in-out infinite alternate;">
    </div>

    <!-- ── Rayo de sol 2 ── -->
    <div style="
      position:absolute; top:-5%; left:40%; width:5%; height:85%;
      background: linear-gradient(180deg,
        rgba(255,220,60,0.25) 0%,
        rgba(255,190,40,0.10) 50%,
        transparent 100%);
      filter: blur(12px); border-radius: 50%;
      transform: rotate(-2deg);
      animation: rayo-b 14s ease-in-out infinite alternate;">
    </div>

    <!-- ── Rayo de sol 3 ── -->
    <div style="
      position:absolute; top:-5%; left:62%; width:6%; height:88%;
      background: linear-gradient(180deg,
        rgba(255,225,70,0.22) 0%,
        rgba(255,170,30,0.08) 55%,
        transparent 100%);
      filter: blur(14px); border-radius: 50%;
      transform: rotate(6deg);
      animation: rayo-c 12s ease-in-out infinite alternate;">
    </div>

    <!-- ── Rayo de sol 4 — borde derecho ── -->
    <div style="
      position:absolute; top:-5%; right:10%; width:4%; height:75%;
      background: linear-gradient(180deg,
        rgba(255,210,50,0.18) 0%,
        transparent 100%);
      filter: blur(10px); border-radius: 50%;
      transform: rotate(9deg);
      animation: rayo-a 16s ease-in-out 3s infinite alternate;">
    </div>

    <!-- ── Haze de calor sobre la arena — capa baja ── -->
    <div style="
      position:absolute; bottom:10%; left:-5%; width:110%; height:30%;
      background: linear-gradient(0deg,
        rgba(255,180,60,0.16) 0%,
        rgba(255,220,100,0.08) 60%,
        transparent 100%);
      filter: blur(22px);
      animation: calor-a 7s ease-in-out infinite;">
    </div>
    <div style="
      position:absolute; bottom:5%; left:-5%; width:110%; height:22%;
      background: linear-gradient(0deg,
        rgba(255,160,40,0.13) 0%,
        transparent 100%);
      filter: blur(18px);
      animation: calor-b 9s ease-in-out 1.5s infinite;">
    </div>

    <!-- ── Partículas de arena (SVG punteado) ── -->
    <svg style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;" aria-hidden="true">
      ${Array.from({ length: 18 }, (_, i) => {
    const x = 3 + (i * 5.6) % 94;
    const y = 55 + (i * 3.1) % 40;    /* solo en la zona de arena */
    const size = 1.5 + (i * 0.9) % 3;
    const dur = 4 + (i * 1.8) % 6;
    const del = (i * 0.9) % 5;
    const op = 0.35 + (i * 0.03) % 0.40;
    return `<circle cx="${x}%" cy="${y}%" r="${size}"
          fill="rgba(255,230,130,${op.toFixed(2)})"
          style="animation: grano ${dur.toFixed(1)}s ${del.toFixed(1)}s ease-in-out infinite"/>`;
  }).join('\n      ')}
    </svg>

    <!-- ── Franja de mar — línea del horizonte ── -->
    <svg style="position:absolute;top:20%;left:0;width:100%;height:80px;pointer-events:none;"
         viewBox="0 0 1440 80" preserveAspectRatio="none">
      <path d="M0,40 Q360,18 720,40 T1440,40 L1440,80 L0,80 Z"
            fill="rgba(0,180,216,0.22)"/>
      <path d="M0,52 Q400,32 800,52 T1440,52 L1440,80 L0,80 Z"
            fill="rgba(58,175,204,0.16)"/>
      <path d="M0,64 Q480,48 960,64 T1440,64 L1440,80 L0,80 Z"
            fill="rgba(255,255,255,0.08)"/>
    </svg>

    <!-- ── Resplandor cálido inferior — reflexión del sol en arena ── -->
    <div style="
      position:absolute; bottom:-10%; left:50%; transform:translateX(-50%);
      width:130%; height:45%;
      background: radial-gradient(ellipse at 50% 100%,
        rgba(255,160,40,0.22) 0%,
        rgba(220,120,30,0.12) 40%,
        transparent 72%);
      filter: blur(38px);">
    </div>
  `;
  return div;
}

export const manifest = {
  background_color: '#7a4a1e',
  theme_color: '#a0622a',
};