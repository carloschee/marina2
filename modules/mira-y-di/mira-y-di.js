/* modules/mira-y-di/mira-y-di.js
   Lee vocabulario.json y pictos.json.
   Con catálogo: vocabulario.json tiene IDs → lookup en pictos.json
   Legacy: vocabulario.json tiene strings directos

   Portrait (≤600px): layout vertical — card arriba, panel abajo
   SE3 (≤375px): card reducida, retícula de letras 7 columnas
*/

import { TTS }    from '../../core/tts.js';
import { haptic } from '../../core/ui.js';

const LETRAS = 'A B C D E F G H I J K L M N Ñ O P Q R S T U V W X Y Z'.split(' ');

const pictoURL = (ruta_img) => `assets/pictogramas/${ruta_img.toLowerCase()}.png`;

// ─── Estado ───────────────────────────────────────────────────────────────────
let _el         = null;
let _vocab      = null;
let _pictos     = {};
let _lang       = 'es';
let _letra      = null;
let _lista      = [];
let _idx        = 0;
let _audioEl    = null;
let _langConfig = { es: true, en: false };

// ─── API pública ──────────────────────────────────────────────────────────────
export async function init(container) {
  _el         = container;
  _langConfig = window._langConfig ? { ...window._langConfig } : { es: true, en: false };
  _lang       = (_langConfig.en && !_langConfig.es) ? 'en' : 'es';

  try {
    const res = await fetch('./data/vocabulario.json');
    _vocab = await res.json();
  } catch (e) {
    console.error('[mira-y-di] No se pudo cargar vocabulario.json', e);
    _vocab = {};
  }

  try {
    const res2 = await fetch('./data/pictos.json');
    const cat  = await res2.json();
    _pictos = Object.fromEntries(cat.map(e => [e.id, e]));
  } catch {
    console.warn('[mira-y-di] pictos.json no disponible — modo legacy');
    _pictos = {};
  }

  _render();

  const disponibles = LETRAS.filter(l => _vocab[l]?.es?.length);
  _seleccionarLetra(disponibles[Math.floor(Math.random() * disponibles.length)]);

  window.addEventListener('lang-change', _onLangChange);
}

export function destroy() {
  window.removeEventListener('lang-change', _onLangChange);
  TTS.stop();
  if (_audioEl) { _audioEl.pause(); _audioEl.src = ''; _audioEl = null; }
  _el = null; _vocab = null; _pictos = {}; _letra = null;
}

export function onEnter() {}
export function onLeave() { TTS.stop(); if (_audioEl) _audioEl.pause(); }

export async function pause() {
  TTS.stop(); if (_audioEl) _audioEl.pause();
}

export async function resume(container) {
  _el         = container;
  _langConfig = window._langConfig ? { ...window._langConfig } : _langConfig;
  _lang       = (_langConfig.en && !_langConfig.es) ? 'en' : 'es';
  _render();
  _renderLetras();
  if (_letra) {
    _el.querySelectorAll('.md-letra-btn').forEach(b =>
      b.classList.toggle('activa', b.dataset.letra === _letra)
    );
  }
  _actualizarVista();
  window.removeEventListener('lang-change', _onLangChange);
  window.addEventListener('lang-change', _onLangChange);
}

// ─── Shell ────────────────────────────────────────────────────────────────────
function _render() {
  _el.style.cssText =
    'position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;background:transparent;';

  _el.innerHTML = `
  <style>
    /* ── Letra btn ── */
    .md-letra-btn {
      width:38px; height:38px; border-radius:50%; border:none; cursor:pointer;
      font-family:inherit; font-weight:900; font-size:.9rem;
      background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.55);
      transition:background .15s, color .15s, transform .12s; flex-shrink:0;
    }
    .md-letra-btn:active  { transform:scale(.88); }
    .md-letra-btn.activa  { background:#0ea5c9; color:#fff; box-shadow:0 4px 14px rgba(14,165,201,.45); }
    .md-letra-btn.vacia   { opacity:.22; cursor:default; pointer-events:none; }

    /* ── Layout principal — landscape/tablet: columnas ── */
    #md-main {
      flex:1; min-height:0; display:grid;
      grid-template-columns:1fr 1fr; gap:16px; padding:10px 20px 16px;
    }

    /* ── Card del pictograma ── */
    #md-card {
      border-radius:24px; overflow:hidden;
      display:flex; align-items:center; justify-content:center;
      position:relative;
    }
    #md-card-bg { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }

    #md-picto {
      position:relative; z-index:1;
      width:75%; height:75%; object-fit:contain;
      filter:drop-shadow(0 12px 24px rgba(0,0,0,.22));
      transition:opacity .22s; transform-origin:center bottom;
    }
    #md-picto.cargando { opacity:0; }
    #md-picto.hablando { animation:picto-wobble .5s ease-in-out infinite alternate; }
    #md-picto.dragging { transition:none !important; cursor:grab; }
    .md-particula {
      position:absolute; border-radius:50%;
      pointer-events:none; opacity:0;
      animation:md-flotar linear infinite;
    }
    @keyframes md-flotar {
      0%   { transform:translateY(0)   scale(1);   opacity:0; }
      15%  { opacity:0.35; }
      85%  { opacity:0.20; }
      100% { transform:translateY(-120%) scale(0.6); opacity:0; }
    }
    @keyframes picto-wobble {
      0%   { transform:rotate(-2deg) scale(1.02); }
      25%  { transform:rotate(1.5deg) scale(1.04) translateY(-3px); }
      50%  { transform:rotate(-1deg) scale(1.03) translateY(-1px); }
      75%  { transform:rotate(2deg) scale(1.05) translateY(-4px); }
      100% { transform:rotate(-1.5deg) scale(1.02) translateY(-2px); }
    }

    /* ── Panel derecho ── */
    #md-panel { display:flex; flex-direction:column; justify-content:space-between; gap:0; }

    #md-meta {
      font-size:.72rem; font-weight:900; letter-spacing:.12em;
      text-transform:uppercase; color:#14b8a6; margin-top:8px;
    }
    #md-palabra {
      font-size:clamp(2.6rem,7vw,4.8rem); font-weight:900;
      letter-spacing:-1px; color:#fff; line-height:1;
      word-break:break-word; margin:6px 0 0;
    }

    /* ── Retícula de letras ── */
    #md-letras-panel {
      background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.10);
      border-radius:16px; padding:12px;
      display:grid; grid-template-columns:repeat(9,1fr); gap:6px; width:100%;
    }
    #md-letras-panel .md-letra-btn { width:100%; aspect-ratio:1; font-size:1.1rem; font-weight:900; }

    /* ── Controles ── */
    #md-controles { display:flex; align-items:center; gap:10px; }
    .md-nav-btn {
      width:52px; height:52px; border-radius:50%; border:none; cursor:pointer;
      background:rgba(255,255,255,.10); color:#fff; font-size:1.4rem; font-weight:900;
      display:flex; align-items:center; justify-content:center;
      transition:background .15s, transform .12s; flex-shrink:0;
    }
    .md-nav-btn:active { transform:scale(.88); background:rgba(255,255,255,.18); }

    #md-btn-escucha {
      flex:1; height:52px; border-radius:99px; border:none; cursor:pointer;
      background:#fb7185; color:#fff; font-family:inherit; font-weight:900; font-size:1.05rem;
      display:flex; align-items:center; justify-content:center; gap:10px;
      box-shadow:0 8px 24px rgba(251,113,133,.40); transition:transform .12s, box-shadow .15s;
    }
    #md-btn-escucha:active { transform:scale(.96); box-shadow:0 4px 12px rgba(251,113,133,.30); }

    /* ── Dots ── */
    #md-dots { display:flex; gap:5px; justify-content:center; margin-top:8px; }
    .md-dot  { height:5px; border-radius:99px; background:rgba(255,255,255,.18); transition:all .3s; }
    .md-dot.activo { background:#0ea5c9; }

    /* ── Vacío ── */
    #md-vacio {
      display:none; flex:1; flex-direction:column;
      align-items:center; justify-content:center; gap:12px;
      color:rgba(255,255,255,.30); font-size:1rem; font-weight:700;
    }

    /* ════════════════════════════════════════════════════════
       PORTRAIT — iPhone 13 (≤600px portrait)
       Card arriba · Panel abajo en columna única
    ════════════════════════════════════════════════════════ */
    @media (max-width:600px) and (orientation:portrait) {
      #md-main {
        grid-template-columns: 1fr;
        grid-template-rows: auto 1fr;
        padding: 8px 12px 12px;
        gap: 10px;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
      }

      /* Card cuadrada y compacta */
      #md-card {
        border-radius: 20px;
        width: 100%;
        height: 38vw;          /* ocupa ~38% del ancho — cuadrado generoso */
        min-height: 160px;
        max-height: 220px;
      }

      #md-panel {
        width: 100%;
        gap: 8px;
      }

      #md-picto { width:65%; height:65%; }

      /* Palabra grande → más pequeña */
      #md-palabra {
        font-size: clamp(1.8rem, 8vw, 2.8rem);
        margin: 2px 0 0;
      }

      #md-meta { font-size: .65rem; margin-top: 4px; }

      /* Retícula — mantener 9 cols pero botones más pequeños */
      #md-letras-panel {
        grid-template-columns: repeat(7, 1fr);
        gap: 5px;
        padding: 10px;
        width: 100%;
        box-sizing: border-box;
      }
      #md-letras-panel .md-letra-btn { font-size: .9rem; }

      .md-letra-btn {
        width: 100%;
        height: auto;
        aspect-ratio: 1;
        font-size: clamp(0.7rem, 3.5vw, 0.9rem);
        min-width: 0;
      }

      #md-controles {
        width: 100%;
        box-sizing: border-box;
        gap: 6px;
      }

      /* Controles compactos */
      .md-nav-btn {
        width: 44px;
        height: 44px;
        font-size: 1.2rem;
        flex-shrink: 0;
      }

      /* Botón escucha: ocupa el espacio restante sin romperse */
      #md-btn-escucha {
        height: 44px;
        font-size: 0.95rem;
        flex: 1;
        min-width: 0;
      }
    }

    /* ════════════════════════════════════════════════════════
       SE 3 — (≤375px portrait)
       Card más chica · Retícula 7 columnas
    ════════════════════════════════════════════════════════ */
    @media (max-width:375px) and (orientation:portrait) {
      #md-main {
        gap: 8px;
        padding: 6px 10px 10px;
      }

      #md-card { height: 170px; border-radius: 16px; }
      #md-picto { width:60%; height:60%; }

      #md-palabra { font-size: clamp(1.5rem, 7vw, 2.2rem); }

      /* 7 columnas en lugar de 9 — letras más grandes */
      #md-letras-panel {
        grid-template-columns: repeat(7, 1fr);
        padding: 6px;
        gap: 4px;
      }
      #md-letras-panel .md-letra-btn { font-size: .8rem; }

      .md-nav-btn { width:38px; height:38px; font-size:1.1rem; }
      #md-btn-escucha { height:40px; font-size:.85rem; gap:6px; }
    }

    /* ── iPhone SE / pantallas muy angostas (≤390px) ─────────────── */
    @media (max-width: 390px) and (orientation: portrait) {

      #md-card {
        height: 35vw;
        min-height: 140px;
      }

      #md-letras-panel {
        grid-template-columns: repeat(7, 1fr);
        gap: 4px;
        padding: 8px;
      }

      .md-letra-btn {
        font-size: clamp(0.62rem, 3vw, 0.8rem);
      }

      .md-nav-btn {
        width: 40px;
        height: 40px;
      }

      #md-btn-escucha {
        height: 40px;
        font-size: 0.88rem;
      }
    }
  </style>

  <div id="md-main">
    <div id="md-card">
      <svg id="md-card-bg" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice"
           xmlns="http://www.w3.org/2000/svg"></svg>
      <img id="md-picto" src="" alt="" class="cargando" />
    </div>
    <div id="md-panel">
      <div>
        <div id="md-meta"></div>
        <div id="md-palabra">—</div>
      </div>
      <div id="md-letras-panel"></div>
      <div>
        <div id="md-controles">
          <button class="md-nav-btn" id="md-prev">‹</button>
          <button id="md-btn-escucha"><span style="font-size:1.3rem">🔊</span> escucha</button>
          <button class="md-nav-btn" id="md-next">›</button>
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
    const btn   = document.createElement('button');
    btn.className     = 'md-letra-btn' + (vacia ? ' vacia' : '');
    btn.textContent   = letra;
    btn.dataset.letra = letra;
    btn.addEventListener('click', () => { haptic(8); _seleccionarLetra(letra); });
    wrap.appendChild(btn);
  }
}

// ─── Selección de letra ───────────────────────────────────────────────────────
const COLORES = {
  A:'#f87171', B:'#fb923c', C:'#fbbf24', D:'#a3e635', E:'#34d399',
  F:'#22d3ee', G:'#60a5fa', H:'#a78bfa', I:'#f472b6', J:'#f87171',
  K:'#fb923c', L:'#fbbf24', M:'#34d399', N:'#22d3ee', Ñ:'#60a5fa',
  O:'#a78bfa', P:'#f472b6', Q:'#f87171', R:'#fb923c', S:'#fbbf24',
  T:'#34d399', U:'#22d3ee', V:'#60a5fa', W:'#a78bfa', X:'#f472b6',
  Y:'#f87171', Z:'#fb923c',
};

function _seleccionarLetra(letra) {
  _letra = letra;
  _idx   = 0;
  _construirLista();
  _el.querySelectorAll('.md-letra-btn').forEach(b =>
    b.classList.toggle('activa', b.dataset.letra === letra)
  );
  _actualizarVista();
}

function _construirLista() {
  const ids = _vocab[_letra]?.es || [];
  _lista = _shuffle(ids.map(item => {
    if (typeof item === 'number') {
      const entrada = _pictos[item];
      if (!entrada) return null;
      return {
        picto:  (entrada.ruta_img || '').replace('.png', ''),
        texto:  _lang === 'en' ? (entrada.en || entrada.es || '') : (entrada.es || ''),
        tts_es: entrada.es || '',
        tts_en: entrada.en || entrada.es || '',
      };
    }
    return { picto: item, texto: item, tts_es: item, tts_en: item };
  }).filter(Boolean));
  _idx = 0;
}

// ─── Cambio de idioma ─────────────────────────────────────────────────────────
function _onLangChange(e) {
  const cfg = e.detail?.langConfig;
  if (!cfg) return;
  _langConfig = { ...cfg };
  _lang = (cfg.en && !cfg.es) ? 'en' : 'es';
  if (_lista.length) _actualizarTexto();
}

// ─── Vista ────────────────────────────────────────────────────────────────────
function _actualizarVista() {
  const main  = _el.querySelector('#md-main');
  const vacio = _el.querySelector('#md-vacio');

  if (!_lista.length) {
    main.style.display  = 'none';
    vacio.style.display = 'flex';
    return;
  }
  main.style.display  = 'grid';
  vacio.style.display = 'none';

  const item  = _lista[_idx];
  const color = COLORES[_letra] || '#0ea5c9';

  _el.querySelector('#md-card').style.background = color;
  _renderCardBg(color);

  const img = _el.querySelector('#md-picto');
  img.classList.add('cargando');
  img.alt = item.texto;
  img.src = pictoURL(item.picto);
  img.onload  = () => img.classList.remove('cargando');
  img.onerror = () => img.classList.remove('cargando');

  _actualizarTexto();
  _renderDots();
}

function _actualizarTexto() {
  const item = _lista[_idx];
  if (!item) return;
  const { es, en } = _langConfig;
  let display;
  if (es && en)   display = `${item.tts_es} / ${item.tts_en}`;
  else if (en)    display = item.tts_en || item.tts_es;
  else            display = item.tts_es;
  _el.querySelector('#md-palabra').textContent = display;
  _el.querySelector('#md-meta').textContent =
    `${_idx + 1} · ${_lista.length} · ${es && en ? 'ES / EN' : en ? 'INGLÉS' : 'ESPAÑOL'}`;
}

function _renderDots() {
  const wrap  = _el.querySelector('#md-dots');
  const total = Math.min(_lista.length, 8);
  wrap.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const d = document.createElement('span');
    d.className   = 'md-dot' + (i === _idx % total ? ' activo' : '');
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
    haptic(15);
    if (!_lista.length) return;
    const item       = _lista[_idx];
    const { es, en } = _langConfig;
    const reproducirEn = (es && en) ? Math.random() < 0.5 : !!en;
    const lang    = reproducirEn ? 'en-US' : 'es-MX';
    const texto   = reproducirEn ? (item.tts_en || item.tts_es) : item.tts_es;
    const archivo = item.picto;
    _hablar(texto, lang, archivo);
  });

  const picto = _el.querySelector('#md-picto');
  if (picto) _initSpringDrag(picto);
}

// ─── Audio ────────────────────────────────────────────────────────────────────
function _hablar(texto, lang = 'es-MX', archivo = null) {
  const langCode = lang.slice(0, 2);
  const url      = `assets/audio/${langCode}/${(archivo || texto).toLowerCase()}.mp3`;

  const img = _el?.querySelector('#md-picto');
  const _animar = () => {
    if (!img) return;
    img.classList.add('hablando');
    setTimeout(() => img.classList.remove('hablando'), Math.max(800, texto.length * 70));
  };

  if (!_audioEl) { _audioEl = document.createElement('audio'); _audioEl.preload = 'none'; }

  _audioEl.pause();
  _audioEl.onerror = null;

  let _fallbackUsado = false;
  const _fallback = () => {
    if (_fallbackUsado) return;
    _fallbackUsado = true;
    TTS.speak(texto, { lang, rate: 0.92, pitch: 1.2 });
    _animar();
  };

  _audioEl.onerror = _fallback;
  _audioEl.src     = url;
  _audioEl.play().then(() => _animar()).catch(_fallback);
}

// ─── Spring drag ──────────────────────────────────────────────────────────────
function _initSpringDrag(img) {
  let startX = 0, startY = 0, isDragging = false;
  const MAX = 52;
  const K   = 0.55;
  const _clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  img.addEventListener('touchstart', e => {
    if (img.classList.contains('hablando')) return;
    const t = e.touches[0];
    startX = t.clientX; startY = t.clientY;
    isDragging = true;
    img.classList.add('dragging');
  }, { passive: true });

  img.addEventListener('touchmove', e => {
    if (!isDragging) return;
    e.preventDefault();
    const t   = e.touches[0];
    const dx  = _clamp((t.clientX - startX) * K, -MAX, MAX);
    const dy  = _clamp((t.clientY - startY) * K, -MAX, MAX);
    const rot = dx * 0.15;
    img.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(1.04)`;
  }, { passive: false });

  const _release = () => {
    if (!isDragging) return;
    isDragging = false;
    img.classList.remove('dragging');
    img.style.transition = 'transform 0.65s cubic-bezier(0.34, 2.2, 0.64, 1)';
    img.style.transform  = 'translate(0,0) rotate(0deg) scale(1)';
    setTimeout(() => { img.style.transition = ''; img.style.transform = ''; }, 680);
  };

  img.addEventListener('touchend',   _release, { passive: true });
  img.addEventListener('touchcancel', _release, { passive: true });
}

// ─── Fondo SVG de la tarjeta ──────────────────────────────────────────────────
function _renderCardBg(hex) {
  const svg = _el.querySelector('#md-card-bg');
  if (!svg) return;
  const c0 = hex, c1 = hex + '99', c2 = hex + '44';
  const c3 = _mezclarBlanco(hex, 0.25), c4 = _oscurecer(hex, 0.35);
  const seed = (_lista[_idx]?.texto || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const r = (n, min, max) => min + ((seed * (n * 7919)) % (max - min + 1));
  svg.innerHTML = `
    <defs>
      <filter id="md-grain" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch" result="noise"/>
        <feColorMatrix type="saturate" values="0" in="noise" result="gray"/>
        <feBlend in="SourceGraphic" in2="gray" mode="overlay" result="blend"/>
        <feComposite in="blend" in2="SourceGraphic" operator="in"/>
      </filter>
      <radialGradient id="md-rg1" cx="50%" cy="45%" r="60%">
        <stop offset="0%"   stop-color="${c3}" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="${c4}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="md-rg2" cx="${r(1,10,90)}%" cy="${r(2,10,90)}%" r="55%">
        <stop offset="0%"   stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c2}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="400" height="500" fill="${c0}"/>
    <rect width="400" height="500" fill="url(#md-rg1)"/>
    <ellipse cx="${r(3,60,340)}" cy="${r(4,60,440)}" rx="${r(5,80,160)}" ry="${r(6,60,130)}"
             fill="${c3}" opacity="0.22" transform="rotate(${r(7,0,360)} ${r(3,60,340)} ${r(4,60,440)})"/>
    <ellipse cx="${r(8,60,340)}" cy="${r(9,60,440)}" rx="${r(10,60,120)}" ry="${r(11,40,100)}"
             fill="${c1}" opacity="0.18" transform="rotate(${r(12,0,360)} ${r(8,60,340)} ${r(9,60,440)})"/>
    <circle cx="${r(13,0,80)}" cy="${r(14,380,500)}" r="${r(15,60,110)}" fill="${c2}" opacity="0.35"/>
    <path d="M0,${r(16,180,320)} Q${r(17,60,160)},${r(18,100,260)} 200,${r(19,180,320)} T400,${r(20,180,320)}"
          stroke="${c3}" stroke-width="${r(21,30,70)}" fill="none" opacity="0.12"/>
    <ellipse cx="${r(22,120,280)}" cy="${r(23,20,80)}" rx="${r(24,50,100)}" ry="${r(25,20,50)}"
             fill="white" opacity="0.08"/>
    <rect width="400" height="500" fill="${c0}" opacity="0.05" filter="url(#md-grain)"/>
    <rect width="400" height="500" fill="url(#md-rg2)" opacity="0.3"/>
  `;
}

function _mezclarBlanco(hex, t) {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.round(((n>>16)&255) + (255-((n>>16)&255))*t);
  const g = Math.round(((n>>8)&255)  + (255-((n>>8)&255))*t);
  const b = Math.round((n&255)       + (255-(n&255))*t);
  return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
}

function _oscurecer(hex, t) {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.round(((n>>16)&255)*(1-t));
  const g = Math.round(((n>>8)&255)*(1-t));
  const b = Math.round((n&255)*(1-t));
  return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
}

function _shuffle(arr) {
  for (let i = arr.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
  return arr;
}