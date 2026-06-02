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
      '#0a1f4a 0%,' +
      '#1a4a8a 18%,' +
      '#2e6fb5 38%,' +
      '#4a90d9 55%,' +
      '#6ab0e8 68%,' +
      '#a8d4f5 80%,' +
      '#d4eaf8 90%,' +
      '#e8f4fc 100%);';

  // ── Genera un path ondulante único para cada ráfaga ──────────
  // Cada ráfaga tiene su propio perfil de onda — ninguna igual a otra.
  // El path va de x=0 a x=1000 con amplitud y fase únicas.
  function _path(h, amp, fase) {
    const y = h / 2;
    // Tres crestas cúbicas con fases distintas — trayecto natural
    return [
      `M0,${y}`,
      `C${150},${y - amp * Math.sin(fase)}       ${250},${y + amp * Math.cos(fase)}       ${400},${y + amp * 0.3 * Math.sin(fase * 1.3)}`,
      `C${550},${y - amp * Math.cos(fase * 0.8)} ${680},${y + amp * Math.sin(fase * 1.7)} ${800},${y - amp * 0.4 * Math.cos(fase)}`,
      `C${880},${y + amp * 0.2} ${950},${y - amp * 0.15} 1000,${y}`,
      `L1000,${h} L0,${h} Z`,
    ].join(' ');
  }

  // ── Genera una ráfaga completa con SMIL ──────────────────────
  // dur     = duración del viaje completo (s)
  // begin   = cuándo arranca (s desde inicio, usando indefinite + delay JS)
  // top     = posición vertical (%)
  // grosor  = altura de la banda (px)
  // opMax   = opacidad máxima en el pico
  // amp     = amplitud de la onda (px)
  function _rafaga({ id, top, grosor, dur, begin, opMax, amp }) {
    const gid   = `vg-${id}`;
    const fase  = id * 1.31;                 // fase única por ráfaga
    const h     = grosor;

    // Path inicial (plano) y final (ondulado) — la onda se "dibuja" durante el viaje
    const pathFlat = `M0,${h/2} L1000,${h/2} L1000,${h} L0,${h} Z`;
    const pathWave = _path(h, amp, fase);

    // Morphing: empieza plano, se ondula a mitad del trayecto, vuelve a plano
    const pathMid  = _path(h, amp * 1.4, fase + 0.5);

    return `
  <svg style="position:absolute; top:${top}; left:0; width:100%; height:${grosor}px; overflow:visible;"
       viewBox="0 0 1000 ${grosor}" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="${gid}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%"   stop-color="white" stop-opacity="0"/>
        <stop offset="8%"   stop-color="white" stop-opacity="${opMax}"/>
        <stop offset="45%"  stop-color="white" stop-opacity="${(opMax * 0.9).toFixed(2)}"/>
        <stop offset="82%"  stop-color="white" stop-opacity="${(opMax * 0.5).toFixed(2)}"/>
        <stop offset="100%" stop-color="white" stop-opacity="0"/>
      </linearGradient>
    </defs>

    <!-- Ráfaga: viaja de izquierda (-100%) a derecha (+100%) -->
    <g>
      <!-- Traslación horizontal: entra desde la izquierda, sale por la derecha -->
      <animateTransform attributeName="transform" type="translate"
        from="-1000 0" to="2000 0"
        dur="${dur}s" begin="${begin}s" fill="freeze" repeatCount="1"/>

      <!-- Path morphing: plano → ondulado → plano, sincronizado con el viaje -->
      <path fill="url(#${gid})">
        <animate attributeName="d"
          values="${pathFlat}; ${pathWave}; ${pathMid}; ${pathWave}; ${pathFlat}"
          keyTimes="0; 0.2; 0.5; 0.8; 1"
          dur="${dur}s" begin="${begin}s" fill="freeze" repeatCount="1"
          calcMode="spline"
          keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"/>
        <!-- Opacidad: aparece, se mantiene, desaparece -->
        <animate attributeName="opacity"
          values="0; 0; 1; 1; 0"
          keyTimes="0; 0.05; 0.15; 0.85; 1"
          dur="${dur}s" begin="${begin}s" fill="freeze" repeatCount="1"/>
      </path>
    </g>
  </svg>`;
  }

  // ── Definición de ráfagas — pocas, esporádicas, distribuidas ─
  // Cada ráfaga tiene un 'begin' en segundos distinto — no arrancan juntas.
  // Los ciclos son largos (dur + pausa) para que se sientan esporádicas.
  // Se usan repeatCount="1" + begin escalonado para simular esporadicidad
  // sin loops, usando el truco de begin="Xs; prevRafaga.end+Ys"
  const rafagas = [
    // { id, top, grosor, dur, begin, opMax, amp }
    // — Ráfagas tenues, fondo —
    { id:0,  top:'6%',  grosor:14, dur:9,  begin:2,   opMax:.16, amp:18 },
    { id:1,  top:'32%', grosor:10, dur:11, begin:18,  opMax:.12, amp:14 },
    { id:2,  top:'61%', grosor:12, dur:8,  begin:35,  opMax:.14, amp:16 },
    { id:3,  top:'78%', grosor:9,  dur:10, begin:52,  opMax:.11, amp:12 },

    // — Ráfagas medias —
    { id:4,  top:'18%', grosor:22, dur:8,  begin:7,   opMax:.28, amp:28 },
    { id:5,  top:'47%', grosor:18, dur:10, begin:24,  opMax:.24, amp:24 },
    { id:6,  top:'70%', grosor:20, dur:9,  begin:41,  opMax:.26, amp:26 },

    // — Ráfagas principales —
    { id:7,  top:'12%', grosor:32, dur:7,  begin:13,  opMax:.38, amp:36 },
    { id:8,  top:'55%', grosor:28, dur:8,  begin:30,  opMax:.34, amp:32 },
    { id:9,  top:'85%', grosor:30, dur:7,  begin:47,  opMax:.36, amp:34 },
  ];

  // Intervalo de repetición: cada ráfaga se repite cada ~60s
  // usando begin="Xs; id-N.end+Ys" — las ráfagas se encadenan a sí mismas
  // con una pausa variable para que no se sincronicen.
  function _rafagaRepetida(r) {
    const pausa = 45 + (r.id * 7) % 30;  // pausa entre 45s y 75s
    const gid   = `vg-${r.id}`;
    const fase  = r.id * 1.31;
    const h     = r.grosor;

    const pathFlat = `M0,${h/2} L1000,${h/2} L1000,${h} L0,${h} Z`;
    const pathWave = _path(h, r.amp, fase);
    const pathMid  = _path(h, r.amp * 1.4, fase + 0.5);

    // begin encadenado: primera vez en r.begin, luego cada (dur + pausa)s
    const beginStr = `${r.begin}s; vg-path-${r.id}.end+${pausa}s`;

    return `
  <svg style="position:absolute; top:${r.top}; left:0; width:100%; height:${r.grosor}px; overflow:visible;"
       viewBox="0 0 1000 ${r.grosor}" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="${gid}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%"   stop-color="white" stop-opacity="0"/>
        <stop offset="8%"   stop-color="white" stop-opacity="${r.opMax}"/>
        <stop offset="45%"  stop-color="white" stop-opacity="${(r.opMax * 0.9).toFixed(2)}"/>
        <stop offset="82%"  stop-color="white" stop-opacity="${(r.opMax * 0.5).toFixed(2)}"/>
        <stop offset="100%" stop-color="white" stop-opacity="0"/>
      </linearGradient>
    </defs>

    <g>
      <animateTransform attributeName="transform" type="translate"
        from="-1000 0" to="2000 0"
        dur="${r.dur}s" begin="${beginStr}" fill="remove" repeatCount="indefinite"/>

      <path id="vg-path-${r.id}" fill="url(#${gid})" opacity="0">
        <animate attributeName="d"
          values="${pathFlat}; ${pathWave}; ${pathMid}; ${pathWave}; ${pathFlat}"
          keyTimes="0; 0.2; 0.5; 0.8; 1"
          dur="${r.dur}s" begin="${beginStr}" fill="remove" repeatCount="indefinite"
          calcMode="spline"
          keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"/>
        <animate attributeName="opacity"
          values="0; 0; 1; 1; 0"
          keyTimes="0; 0.05; 0.18; 0.84; 1"
          dur="${r.dur}s" begin="${beginStr}" fill="remove" repeatCount="indefinite"/>
      </path>
    </g>
  </svg>`;
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

    <!-- ══ RÁFAGAS DE VIENTO — esporádicas, con morfología propia ══ -->
    ${rafagas.map(_rafagaRepetida).join('\n')}

    <!-- ══ VELO DE CIELO ══════════════════════════════════════════ -->
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