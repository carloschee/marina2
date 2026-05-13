/* modules/mira-y-di/mira-y-di.js
   Lee vocabulario.json.
   Pictogramas en assets/pictogramas/es/{palabra}.png
                  assets/pictogramas/en/{palabra}.png
   El nombre del archivo = texto a pronunciar.
   Ñ solo tiene español.
*/

import { TTS } from '../../core/tts.js';

const LETRAS = 'A B C D E F G H I J K L M N Ñ O P Q R S T U V W X Y Z'.split(' ');

const pictoURL = (palabra, lang) =>
  `assets/pictogramas/${lang}/${palabra}.png`;

// ─── Estado ───────────────────────────────────────────────────────────────────
let _el    = null;
let _vocab = null;
let _lang  = 'es';
let _letra = null;
let _lista = [];
let _idx   = 0;

// ─── API pública ──────────────────────────────────────────────────────────────
export async function init(container) {
  _el   = container;
  _lang = 'es';

  try {
    const res = await fetch('./data/vocabulario.json');
    _vocab = await res.json();
  } catch (e) {
    console.error('[mira-y-di] No se pudo cargar vocabulario.json', e);
    _vocab = {};
  }

  _render();

  const disponibles = LETRAS.filter(l => _vocab[l]?.es?.length);
  _seleccionarLetra(disponibles[Math.floor(Math.random() * disponibles.length)]);
}

export function destroy() { _el = null; _vocab = null; _letra = null; }
export function onEnter()  {}
export function onLeave()  { _detenerMic(); window.speechSynthesis?.cancel(); }

// ─── Shell ────────────────────────────────────────────────────────────────────
function _render() {
  _el.style.cssText =
    'position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;background:transparent;';

  _el.innerHTML = `
  <style>
    #md-letras-wrap {
      flex-shrink:0; overflow-x:auto; overflow-y:hidden;
      padding:10px 16px 6px; scrollbar-width:none;
      -webkit-overflow-scrolling:touch;
    }
    #md-letras-wrap::-webkit-scrollbar { display:none; }
    #md-letras { display:flex; gap:6px; width:max-content; }

    .md-letra-btn {
      width:38px; height:38px; border-radius:50%; border:none; cursor:pointer;
      font-family:inherit; font-weight:900; font-size:.9rem;
      background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.55);
      transition:background .15s, color .15s, transform .12s; flex-shrink:0;
    }
    .md-letra-btn:active  { transform:scale(.88); }
    .md-letra-btn.activa  { background:#0ea5c9; color:#fff; box-shadow:0 4px 14px rgba(14,165,201,.45); }
    .md-letra-btn.vacia   { opacity:.22; cursor:default; pointer-events:none; }

    #md-main {
      flex:1; min-height:0; display:grid;
      grid-template-columns:1fr 1fr; gap:16px; padding:10px 20px 16px;
    }

    #md-card {
      border-radius:24px; overflow:hidden;
      display:flex; align-items:center; justify-content:center;
      position:relative;
    }
    #md-card-bg {
      position:absolute; inset:0;
      width:100%; height:100%;
      pointer-events:none;
    }
    /* El pictograma va encima del SVG de fondo */
    #md-picto { position:relative; z-index:1; }
    #md-picto {
      width:75%; height:75%; object-fit:contain;
      filter:drop-shadow(0 12px 24px rgba(0,0,0,.22));
      transition:opacity .22s;
      transform-origin: center bottom;
    }
    #md-picto.cargando { opacity:0; }
    #md-picto.hablando {
      animation: picto-wobble 0.5s ease-in-out infinite alternate;
    }
    @keyframes picto-wobble {
      0%   { transform: rotate(-2deg) scale(1.02); }
      25%  { transform: rotate(1.5deg) scale(1.04) translateY(-3px); }
      50%  { transform: rotate(-1deg) scale(1.03) translateY(-1px); }
      75%  { transform: rotate(2deg) scale(1.05) translateY(-4px); }
      100% { transform: rotate(-1.5deg) scale(1.02) translateY(-2px); }
    }

    #md-panel {
      display:flex; flex-direction:column;
      justify-content:space-between; gap:0;
    }

    /* Pill ES / EN — solo abarca sus dos botones */
    #md-lang-pill {
      display:inline-flex; gap:3px; padding:3px;
      border-radius:99px;
      background:rgba(255,255,255,0.07);
      border:1px solid rgba(255,255,255,0.10);
      align-self:flex-start;         /* no se estira */
      width:fit-content;
    }
    .md-lang-btn {
      padding:5px 14px; border-radius:99px; border:none; cursor:pointer;
      font-family:inherit; font-size:.75rem; font-weight:900;
      background:transparent; color:rgba(255,255,255,.45);
      transition:all .18s; white-space:nowrap;
    }
    .md-lang-btn.activo        { background:#0ea5c9; color:#fff; }
    .md-lang-btn.deshabilitado { opacity:.25; pointer-events:none; }

    #md-meta {
      font-size:.72rem; font-weight:900; letter-spacing:.12em;
      text-transform:uppercase; color:#14b8a6; margin-top:8px;
    }
    #md-palabra {
      font-size:clamp(2.6rem,7vw,4.8rem); font-weight:900;
      letter-spacing:-1px; color:#fff; line-height:1;
      word-break:break-word; margin:6px 0 0;
    }

    /* Retícula de letras — grid que reparte el espacio horizontal exacto */
    #md-letras-panel {
      background:rgba(255,255,255,0.05);
      border:1px solid rgba(255,255,255,0.10);
      border-radius:16px;
      padding:12px;
      display:grid;
      grid-template-columns:repeat(9, 1fr);
      gap:6px;
      width:100%;
    }
    #md-letras-panel .md-letra-btn {
      width:100%; aspect-ratio:1;
      font-size:1.1rem; font-weight:900;
    }

    #md-controles { display:flex; align-items:center; gap:10px; }
    .md-nav-btn {
      width:52px; height:52px; border-radius:50%; border:none; cursor:pointer;
      background:rgba(255,255,255,.10); color:#fff;
      font-size:1.4rem; font-weight:900;
      display:flex; align-items:center; justify-content:center;
      transition:background .15s, transform .12s; flex-shrink:0;
    }
    .md-nav-btn:active { transform:scale(.88); background:rgba(255,255,255,.18); }

    #md-btn-escucha {
      flex:1; height:52px; border-radius:99px; border:none; cursor:pointer;
      background:#fb7185; color:#fff;
      font-family:inherit; font-weight:900; font-size:1.05rem;
      display:flex; align-items:center; justify-content:center; gap:10px;
      box-shadow:0 8px 24px rgba(251,113,133,.40);
      transition:transform .12s, box-shadow .15s;
    }
    #md-btn-escucha:active { transform:scale(.96); box-shadow:0 4px 12px rgba(251,113,133,.30); }

    /* Botón micrófono */
    #md-btn-mic {
      width:52px; height:52px; border-radius:50%; border:none; cursor:pointer;
      background:rgba(255,255,255,.10); color:#fff;
      font-size:1.3rem;
      display:flex; align-items:center; justify-content:center;
      transition:background .15s, transform .12s, box-shadow .15s;
      flex-shrink:0; position:relative;
    }
    #md-btn-mic:active  { transform:scale(.88); }
    #md-btn-mic.activo  {
      background:rgba(251,113,133,.25);
      box-shadow:0 0 0 3px rgba(251,113,133,.50);
      animation:mic-pulse 1.4s ease-in-out infinite;
    }
    @keyframes mic-pulse {
      0%,100% { box-shadow:0 0 0 3px rgba(251,113,133,.50); }
      50%      { box-shadow:0 0 0 7px rgba(251,113,133,.15); }
    }

    /* Medidor de pronunciación */
    #md-medidor-wrap {
      margin-top:10px;
      display:none; flex-direction:column; gap:5px;
    }
    #md-medidor-wrap.visible { display:flex; }
    #md-medidor-label {
      display:flex; justify-content:space-between; align-items:center;
      font-size:.68rem; font-weight:700; letter-spacing:.08em;
      text-transform:uppercase; color:rgba(255,255,255,.45);
    }
    #md-medidor-pct {
      font-size:.8rem; font-weight:900;
      transition:color .3s;
    }
    #md-medidor-track {
      height:8px; border-radius:99px;
      background:rgba(255,255,255,.10);
      overflow:hidden;
    }
    #md-medidor-bar {
      height:100%; border-radius:99px; width:0%;
      transition:width .25s ease, background .35s ease;
    }
    #md-medidor-texto {
      font-size:.72rem; color:rgba(255,255,255,.35);
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      min-height:1em;
    }

    #md-dots { display:flex; gap:5px; justify-content:center; margin-top:8px; }
    .md-dot  { height:5px; border-radius:99px; background:rgba(255,255,255,.18); transition:all .3s; }
    .md-dot.activo { background:#0ea5c9; }

    #md-vacio {
      display:none; flex:1; flex-direction:column;
      align-items:center; justify-content:center; gap:12px;
      color:rgba(255,255,255,.30); font-size:1rem; font-weight:700;
    }
  </style>

  <div id="md-main">
    <div id="md-card">
      <svg id="md-card-bg" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice"
           xmlns="http://www.w3.org/2000/svg"></svg>
      <img id="md-picto" src="" alt="" class="cargando" />
    </div>
    <div id="md-panel">
      <!-- Fila superior: pill idioma + meta -->
      <div>
        <div id="md-lang-pill">
          <button class="md-lang-btn activo" data-lang="es">ES</button>
          <button class="md-lang-btn"         data-lang="en">EN</button>
        </div>
        <div id="md-meta"></div>
        <div id="md-palabra">—</div>
      </div>
      <!-- Cintillo de letras — retícula en el panel -->
      <div id="md-letras-panel"></div>
      <!-- Controles -->
      <div>
        <div id="md-controles">
          <button class="md-nav-btn" id="md-prev">‹</button>
          <button id="md-btn-escucha"><span style="font-size:1.3rem">🔊</span> escucha</button>
          <button id="md-btn-mic" title="Pronunciar">🎙️</button>
          <button class="md-nav-btn" id="md-next">›</button>
        </div>
        <!-- Medidor de pronunciación -->
        <div id="md-medidor-wrap">
          <div id="md-medidor-label">
            <span>Pronunciación</span>
            <span id="md-medidor-pct">0%</span>
          </div>
          <div id="md-medidor-track">
            <div id="md-medidor-bar"></div>
          </div>
          <div id="md-medidor-texto">…</div>
        </div>
        <div id="md-dots"></div>
      </div>
    </div>
  </div>

  <div id="md-vacio">
    <span style="font-size:3rem">🔤</span>
    No hay palabras para esta combinación.
  </div>
  `;

  _renderLetras();
  _bindEvents();
}

// ─── Letras ───────────────────────────────────────────────────────────────────
function _renderLetras() {
  const wrap = _el.querySelector('#md-letras-panel');
  wrap.innerHTML = '';
  for (const letra of LETRAS) {
    const vacia = !_vocab[letra]?.es?.length && !_vocab[letra]?.en?.length;
    const btn = document.createElement('button');
    btn.className     = 'md-letra-btn' + (vacia ? ' vacia' : '');
    btn.textContent   = letra;
    btn.dataset.letra = letra;
    btn.addEventListener('click', () => _seleccionarLetra(letra));
    wrap.appendChild(btn);
  }
}

// ─── Selección de letra ───────────────────────────────────────────────────────
const COLORES = {
  A:'#f87171',B:'#fb923c',C:'#fbbf24',D:'#a3e635',E:'#34d399',
  F:'#22d3ee',G:'#60a5fa',H:'#a78bfa',I:'#f472b6',J:'#f87171',
  K:'#fb923c',L:'#fbbf24',M:'#34d399',N:'#22d3ee',Ñ:'#60a5fa',
  O:'#a78bfa',P:'#f472b6',Q:'#f87171',R:'#fb923c',S:'#fbbf24',
  T:'#34d399',U:'#22d3ee',V:'#60a5fa',W:'#a78bfa',X:'#f472b6',
  Y:'#f87171',Z:'#fb923c',
};

function _seleccionarLetra(letra) {
  _letra = letra;
  _idx   = 0;

  // Si el idioma activo no tiene palabras para esta letra, cambiar al otro
  if (!_vocab[letra]?.[_lang]?.length) {
    _lang = _lang === 'es' ? 'en' : 'es';
  }

  _construirLista();

  _el.querySelectorAll('.md-letra-btn').forEach(b =>
    b.classList.toggle('activa', b.dataset.letra === letra)
  );

  _actualizarPill();
  _actualizarVista();
}

function _construirLista() {
  _lista = _shuffle([...(_vocab[_letra]?.[_lang] || [])]);
  _idx   = 0;
}

// ─── Pill ─────────────────────────────────────────────────────────────────────
function _actualizarPill() {
  _el.querySelectorAll('.md-lang-btn').forEach(btn => {
    const l = btn.dataset.lang;
    btn.classList.toggle('activo', l === _lang);
    btn.classList.toggle('deshabilitado', !_vocab[_letra]?.[l]?.length);
  });
}

// ─── Vista ────────────────────────────────────────────────────────────────────
function _actualizarVista() {
  const main  = _el.querySelector('#md-main');
  const vacio = _el.querySelector('#md-vacio');

  // Resetear medidor al cambiar de palabra
  _mejorScore = 0;
  _actualizarBarra(0, '…');

  if (!_lista.length) {
    main.style.display  = 'none';
    vacio.style.display = 'flex';
    return;
  }
  main.style.display  = 'grid';
  vacio.style.display = 'none';

  const palabra = _lista[_idx];
  const color   = COLORES[_letra] || '#0ea5c9';

  // Fondo con textura SVG — variaciones del color base sin competir
  // con el pictograma. Se regenera en cada cambio de palabra/letra.
  _el.querySelector('#md-card').style.background = color;
  _renderCardBg(color);

  const img = _el.querySelector('#md-picto');
  img.classList.add('cargando');
  img.alt = palabra;
  img.src = pictoURL(palabra, _lang);
  img.onload  = () => img.classList.remove('cargando');
  img.onerror = () => img.classList.remove('cargando');

  _el.querySelector('#md-meta').textContent =
    `${_idx + 1} · ${_lista.length} · ${_lang === 'es' ? 'ESPAÑOL' : 'INGLÉS'}`;
  _el.querySelector('#md-palabra').textContent = palabra;

  _renderDots();
}

// ─── Fondo de la tarjeta ─────────────────────────────────────────────────────
// Genera un SVG con formas orgánicas en variaciones del color base.
// Usa una semilla basada en la palabra para que cada palabra tenga
// un patrón propio pero estable (no cambia con cada render).
function _renderCardBg(hex) {
  const svg = _el.querySelector('#md-card-bg');
  if (!svg) return;

  // Derivar colores: base, más claro, más oscuro, con opacidad
  const c0 = hex;                          // base
  const c1 = hex + '99';                   // 60% opacidad
  const c2 = hex + '44';                   // 27% opacidad
  const c3 = _mezclarBlanco(hex, 0.25);    // aclarado
  const c4 = _oscurecer(hex, 0.35);        // oscurecido

  // Semilla pseudo-aleatoria basada en la palabra actual
  const seed = (_lista[_idx] || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const r = (n, min, max) => min + ((seed * (n * 7919)) % (max - min + 1));

  svg.innerHTML = `
    <defs>
      <!-- Filtro de grano suave -->
      <filter id="md-grain" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4"
                      stitchTiles="stitch" result="noise"/>
        <feColorMatrix type="saturate" values="0" in="noise" result="gray"/>
        <feBlend in="SourceGraphic" in2="gray" mode="overlay" result="blend"/>
        <feComposite in="blend" in2="SourceGraphic" operator="in"/>
      </filter>
      <!-- Gradiente radial central que da profundidad -->
      <radialGradient id="md-rg1" cx="50%" cy="45%" r="60%">
        <stop offset="0%"   stop-color="${c3}" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="${c4}" stop-opacity="0"/>
      </radialGradient>
      <!-- Gradiente de esquina -->
      <radialGradient id="md-rg2" cx="${r(1,10,90)}%" cy="${r(2,10,90)}%" r="55%">
        <stop offset="0%"   stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c2}" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <!-- Base sólida del color de la letra -->
    <rect width="400" height="500" fill="${c0}"/>

    <!-- Mancha de luz central -->
    <rect width="400" height="500" fill="url(#md-rg1)"/>

    <!-- Blob orgánico 1 — esquina variable -->
    <ellipse cx="${r(3,60,340)}" cy="${r(4,60,440)}"
             rx="${r(5,80,160)}" ry="${r(6,60,130)}"
             fill="${c3}" opacity="0.22"
             transform="rotate(${r(7,0,360)} ${r(3,60,340)} ${r(4,60,440)})"/>

    <!-- Blob orgánico 2 — esquina opuesta -->
    <ellipse cx="${r(8,60,340)}" cy="${r(9,60,440)}"
             rx="${r(10,60,120)}" ry="${r(11,40,100)}"
             fill="${c1}" opacity="0.18"
             transform="rotate(${r(12,0,360)} ${r(8,60,340)} ${r(9,60,440)})"/>

    <!-- Mancha de acento — esquina inferior -->
    <circle cx="${r(13,0,80)}" cy="${r(14,380,500)}"
            r="${r(15,60,110)}"
            fill="${c2}" opacity="0.35"/>

    <!-- Línea orgánica de onda — sutil -->
    <path d="M0,${r(16,180,320)}
             Q${r(17,60,160)},${r(18,100,260)}
               200,${r(19,180,320)}
             T400,${r(20,180,320)}"
          stroke="${c3}" stroke-width="${r(21,30,70)}"
          fill="none" opacity="0.12"/>

    <!-- Mancha de reflejo de luz arriba -->
    <ellipse cx="${r(22,120,280)}" cy="${r(23,20,80)}"
             rx="${r(24,50,100)}" ry="${r(25,20,50)}"
             fill="white" opacity="0.08"/>

    <!-- Capa de grano encima de todo -->
    <rect width="400" height="500"
          fill="${c0}" opacity="0.05" filter="url(#md-grain)"/>

    <!-- Gradiente de acento variable -->
    <rect width="400" height="500" fill="url(#md-rg2)" opacity="0.3"/>
  `;
}

// Aclarar un hex mezclándolo con blanco (t: 0-1)
function _mezclarBlanco(hex, t) {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.round(((n>>16)&255) + (255 - ((n>>16)&255)) * t);
  const g = Math.round(((n>>8)&255)  + (255 - ((n>>8)&255))  * t);
  const b = Math.round((n&255)        + (255 - (n&255))        * t);
  return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
}

// Oscurecer un hex (t: 0-1)
function _oscurecer(hex, t) {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.round(((n>>16)&255) * (1-t));
  const g = Math.round(((n>>8)&255)  * (1-t));
  const b = Math.round((n&255)        * (1-t));
  return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
}

function _renderDots() {
  const wrap  = _el.querySelector('#md-dots');
  const total = Math.min(_lista.length, 8);
  wrap.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const d = document.createElement('span');
    d.className  = 'md-dot' + (i === _idx % total ? ' activo' : '');
    d.style.width = i === _idx % total ? '24px' : '8px';
    wrap.appendChild(d);
  }
}

// ─── Eventos ──────────────────────────────────────────────────────────────────
function _bindEvents() {
  _el.querySelector('#md-prev').addEventListener('click', () => {
    _idx = (_idx - 1 + _lista.length) % _lista.length;
    _actualizarVista();
  });
  _el.querySelector('#md-next').addEventListener('click', () => {
    _idx = (_idx + 1) % _lista.length;
    _actualizarVista();
  });
  _el.querySelector('#md-btn-escucha').addEventListener('click', () => {
    if (_lista.length) _hablar(_lista[_idx], _lang === 'es' ? 'es-MX' : 'en-US');
  });

  _el.querySelector('#md-btn-mic').addEventListener('click', _toggleMic);

  _el.querySelector('#md-lang-pill').addEventListener('click', e => {
    const btn = e.target.closest('.md-lang-btn');
    if (!btn || btn.classList.contains('deshabilitado')) return;
    _lang = btn.dataset.lang;
    _construirLista();
    _actualizarPill();
    _actualizarVista();
  });
}

// ─── Micrófono + medidor ──────────────────────────────────────────────────────
let _recog      = null;   // SpeechRecognition instance
let _micActivo  = false;
let _mejorScore = 0;      // el mejor score de la sesión no baja

function _toggleMic() {
  if (_micActivo) { _detenerMic(); return; }
  _iniciarMic();
}

function _iniciarMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    _mostrarMedidor(0, 'Micrófono no disponible en este navegador');
    return;
  }

  _recog              = new SR();
  _recog.lang         = _lang === 'es' ? 'es-MX' : 'en-US';
  _recog.interimResults = true;   // resultados parciales en tiempo real
  _recog.continuous   = true;     // no se detiene solo al hacer pausa
  _recog.maxAlternatives = 3;

  _mejorScore = 0;
  _micActivo  = true;
  _el.querySelector('#md-btn-mic').classList.add('activo');
  _el.querySelector('#md-medidor-wrap').classList.add('visible');
  _actualizarBarra(0, '…');

  _recog.onresult = (e) => {
    // Recoger todos los resultados interim y finales disponibles
    let textoMejor = '';
    let esFinal    = false;

    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      // Revisar todas las alternativas — quedarse con la más parecida
      for (let a = 0; a < res.length; a++) {
        const transcripcion = res[a].transcript.trim().toLowerCase();
        const score = _similitud(transcripcion, _lista[_idx]?.toLowerCase() || '');
        if (score > _mejorScore || (!esFinal && res.isFinal)) {
          _mejorScore = Math.max(_mejorScore, score);
          textoMejor  = transcripcion;
        }
      }
      if (res.isFinal) esFinal = true;
    }

    _actualizarBarra(_mejorScore, textoMejor);
  };

  _recog.onerror = (e) => {
    // 'no-speech' es normal — no lo tratamos como error grave
    if (e.error !== 'no-speech') {
      _actualizarBarra(_mejorScore, `Error: ${e.error}`);
      _detenerMic();
    }
  };

  _recog.onend = () => {
    // Si sigue activo (no fue detenido manualmente) reiniciar para continuidad
    if (_micActivo) {
      try { _recog.start(); } catch {}
    }
  };

  try { _recog.start(); } catch (e) { console.warn('[mic]', e); }
}

function _detenerMic() {
  _micActivo = false;
  try { _recog?.stop(); } catch {}
  _recog = null;
  _el.querySelector('#md-btn-mic')?.classList.remove('activo');
}

function _actualizarBarra(score, texto) {
  const pct  = Math.round(score * 100);
  // Color: rojo < 40%, amarillo 40-70%, verde > 70%
  const color = score < 0.40 ? '#f87171'
              : score < 0.70 ? '#fbbf24'
              : '#34d399';

  const bar = _el.querySelector('#md-medidor-bar');
  const pctEl = _el.querySelector('#md-medidor-pct');
  const textoEl = _el.querySelector('#md-medidor-texto');

  if (bar)    { bar.style.width = pct + '%'; bar.style.background = color; }
  if (pctEl)  { pctEl.textContent = pct + '%'; pctEl.style.color = color; }
  if (textoEl) textoEl.textContent = texto || '…';
}

function _mostrarMedidor(score, texto) {
  _el.querySelector('#md-medidor-wrap')?.classList.add('visible');
  _actualizarBarra(score, texto);
}

// ─── Similitud fonética (Levenshtein normalizado) ─────────────────────────────
// Compara la transcripción recibida contra la palabra objetivo.
// Devuelve 0.0 (ninguna similitud) a 1.0 (coincidencia exacta).
// Normaliza tildes y mayúsculas para no penalizar diferencias de acento.
function _similitud(a, b) {
  // Normalizar: minúsculas, sin tildes, sin puntuación
  const norm = s => s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();

  const na = norm(a);
  const nb = norm(b);

  if (!na || !nb) return 0;
  if (na === nb)  return 1;

  // Si la transcripción contiene la palabra objetivo como token → alto score
  if (na.split(' ').includes(nb)) return 0.95;

  // Levenshtein
  const dist = _levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return Math.max(0, 1 - dist / maxLen);
}

function _levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

// ─── TTS (usa core/tts.js) ───────────────────────────────────────────────────
function _hablar(texto, lang = 'es-MX') {
  // Temblor del pictograma — arranca antes de hablar
  const img = _el?.querySelector('#md-picto');
  if (img) img.classList.add('hablando');

  // Estimar duración para quitar la animación (TTS no expone onend de forma
  // confiable en iOS, así que calculamos ~70ms por carácter como fallback)
  const duracionMs = Math.max(800, texto.length * 70);
  setTimeout(() => { if (img) img.classList.remove('hablando'); }, duracionMs);

  TTS.speak(texto, { lang, rate: 0.92, pitch: 1.2 });
}

function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}