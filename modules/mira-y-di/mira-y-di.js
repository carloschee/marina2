/* modules/mira-y-di/mira-y-di.js
   Lee vocabulario.json y pictos.json.
   Con catálogo: vocabulario.json tiene IDs → lookup en pictos.json
   Legacy: vocabulario.json tiene strings directos
*/

import { TTS } from '../../core/tts.js';
import { haptic } from '../../core/ui.js';

const LETRAS = 'A B C D E F G H I J K L M N Ñ O P Q R S T U V W X Y Z'.split(' ');

const pictoURL = (ruta_img) => `assets/pictogramas/${ruta_img.toLowerCase()}.png`;

// ─── Estado ───────────────────────────────────────────────────────────────────
let _el = null;
let _vocab = null;
let _pictos = {};
let _lang = 'es';
let _letra = null;
let _lista = [];
let _idx = 0;
let _audioEl = null;
let _langConfig = { es: true, en: false };

// ─── API pública ──────────────────────────────────────────────────────────────
export async function init(container) {
  _el = container;
  _langConfig = window._langConfig ? { ...window._langConfig } : { es: true, en: false };
  _lang = (_langConfig.en && !_langConfig.es) ? 'en' : 'es';

  try {
    const res = await fetch('./data/vocabulario.json');
    _vocab = await res.json();
  } catch (e) {
    console.error('[mira-y-di] No se pudo cargar vocabulario.json', e);
    _vocab = {};
  }

  try {
    const res2 = await fetch('./data/pictos.json');
    const cat = await res2.json();
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
  _detenerMic();
  TTS.stop();
  if (_audioEl) { _audioEl.pause(); _audioEl.src = ''; _audioEl = null; }
  _el = null; _vocab = null; _pictos = {}; _letra = null;
}

export function onEnter() { }
export function onLeave() { _detenerMic(); TTS.stop(); if (_audioEl) _audioEl.pause(); }

export async function pause() {
  _detenerMic(); TTS.stop(); if (_audioEl) _audioEl.pause();
}

export async function resume(container) {
  _el = container;
  _langConfig = window._langConfig ? { ...window._langConfig } : _langConfig;
  _lang = (_langConfig.en && !_langConfig.es) ? 'en' : 'es';
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
    #md-card-bg { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }

    #md-picto {
      position:relative; z-index:1;
      width:75%; height:75%; object-fit:contain;
      filter:drop-shadow(0 12px 24px rgba(0,0,0,.22));
      transition:opacity .22s; transform-origin:center bottom;
    }
    #md-picto.cargando { opacity:0; }
    #md-picto.hablando { animation:picto-wobble .5s ease-in-out infinite alternate; }
    /* Spring drag — el picto sigue el dedo con resistencia */
    #md-picto.dragging { transition: none !important; cursor: grab; }

    /* Partículas flotantes en la tarjeta */
    .md-particula {
      position: absolute; border-radius: 50%;
      pointer-events: none; opacity: 0;
      animation: md-flotar linear infinite;
    }
    @keyframes md-flotar {
      0%   { transform: translateY(0)   scale(1);    opacity: 0; }
      15%  { opacity: 0.35; }
      85%  { opacity: 0.20; }
      100% { transform: translateY(-120%) scale(0.6); opacity: 0; }
    }
    @keyframes picto-wobble {
      0%   { transform:rotate(-2deg) scale(1.02); }
      25%  { transform:rotate(1.5deg) scale(1.04) translateY(-3px); }
      50%  { transform:rotate(-1deg) scale(1.03) translateY(-1px); }
      75%  { transform:rotate(2deg) scale(1.05) translateY(-4px); }
      100% { transform:rotate(-1.5deg) scale(1.02) translateY(-2px); }
    }

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

    #md-letras-panel {
      background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.10);
      border-radius:16px; padding:12px;
      display:grid; grid-template-columns:repeat(9,1fr); gap:6px; width:100%;
    }
    #md-letras-panel .md-letra-btn { width:100%; aspect-ratio:1; font-size:1.1rem; font-weight:900; }

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

    #md-btn-mic {
      width:52px; height:52px; border-radius:50%; border:none; cursor:pointer;
      background:rgba(255,255,255,.10); color:#fff; font-size:1.3rem;
      display:flex; align-items:center; justify-content:center;
      transition:background .15s, transform .12s, box-shadow .15s; flex-shrink:0;
    }
    #md-btn-mic:active { transform:scale(.88); }
    #md-btn-mic.activo {
      background:rgba(251,113,133,.25); box-shadow:0 0 0 3px rgba(251,113,133,.50);
      animation:mic-pulse 1.4s ease-in-out infinite;
    }
    @keyframes mic-pulse {
      0%,100% { box-shadow:0 0 0 3px rgba(251,113,133,.50); }
      50%      { box-shadow:0 0 0 7px rgba(251,113,133,.15); }
    }

    #md-medidor-wrap { margin-top:10px; display:none; flex-direction:column; gap:5px; }
    #md-medidor-wrap.visible { display:flex; }
    #md-medidor-label {
      display:flex; justify-content:space-between; align-items:center;
      font-size:.68rem; font-weight:700; letter-spacing:.08em;
      text-transform:uppercase; color:rgba(255,255,255,.45);
    }
    #md-medidor-pct   { font-size:.8rem; font-weight:900; transition:color .3s; }
    #md-medidor-track { height:8px; border-radius:99px; background:rgba(255,255,255,.10); overflow:hidden; }
    #md-medidor-bar   { height:100%; border-radius:99px; width:0%; transition:width .25s ease, background .35s ease; }
    #md-medidor-texto { font-size:.72rem; color:rgba(255,255,255,.35); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-height:1em; }

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
      <div>
        <div id="md-meta"></div>
        <div id="md-palabra">—</div>
      </div>
      <div id="md-letras-panel"></div>
      <div>
        <div id="md-controles">
          <button class="md-nav-btn" id="md-prev">‹</button>
          <button id="md-btn-escucha"><span style="font-size:1.3rem">🔊</span> escucha</button>
          <button id="md-btn-mic" title="Pronunciar">🎙️</button>
          <button class="md-nav-btn" id="md-next">›</button>
        </div>
        <div id="md-medidor-wrap">
          <div id="md-medidor-label">
            <span>Pronunciación</span>
            <span id="md-medidor-pct">0%</span>
          </div>
          <div id="md-medidor-track"><div id="md-medidor-bar"></div></div>
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
    btn.className = 'md-letra-btn' + (vacia ? ' vacia' : '');
    btn.textContent = letra;
    btn.dataset.letra = letra;
    btn.addEventListener('click', () => { haptic(8); _seleccionarLetra(letra); });
    wrap.appendChild(btn);
  }
}

// ─── Selección de letra ───────────────────────────────────────────────────────
const COLORES = {
  A: '#f87171', B: '#fb923c', C: '#fbbf24', D: '#a3e635', E: '#34d399',
  F: '#22d3ee', G: '#60a5fa', H: '#a78bfa', I: '#f472b6', J: '#f87171',
  K: '#fb923c', L: '#fbbf24', M: '#34d399', N: '#22d3ee', Ñ: '#60a5fa',
  O: '#a78bfa', P: '#f472b6', Q: '#f87171', R: '#fb923c', S: '#fbbf24',
  T: '#34d399', U: '#22d3ee', V: '#60a5fa', W: '#a78bfa', X: '#f472b6',
  Y: '#f87171', Z: '#fb923c',
};

function _seleccionarLetra(letra) {
  _letra = letra;
  _idx = 0;

  _construirLista();
  _el.querySelectorAll('.md-letra-btn').forEach(b =>
    b.classList.toggle('activa', b.dataset.letra === letra)
  );
  _actualizarVista();
}

function _construirLista() {
  const ids = _vocab[_letra]?.es || [];  // siempre el set ES
  _lista = _shuffle(ids.map(item => {
    if (typeof item === 'number') {
      const entrada = _pictos[item];
      if (!entrada) return null;
      return {
        picto: (entrada.ruta_img || '').replace('.png', ''),
        texto: _lang === 'en' ? (entrada.en || entrada.es || '') : (entrada.es || ''),
        tts_es: entrada.es || '',
        tts_en: entrada.en || entrada.es || '',
      };
    }
    // Legacy: string directo
    return { picto: item, texto: item, tts_es: item, tts_en: item };
  }).filter(Boolean));
  _idx = 0;
}

// ─── Cambio de idioma desde pill global ───────────────────────────────────────
function _onLangChange(e) {
  const cfg = e.detail?.langConfig;
  if (!cfg) return;
  _langConfig = { ...cfg };
  _lang = (cfg.en && !cfg.es) ? 'en' : 'es';
  // Solo actualizar texto y meta — sin shuffle ni reset de índice
  if (_lista.length) _actualizarTexto();
}

// ─── Vista ────────────────────────────────────────────────────────────────────
function _actualizarVista() {
  const main = _el.querySelector('#md-main');
  const vacio = _el.querySelector('#md-vacio');

  _mejorScore = 0;
  _actualizarBarra(0, '…');

  if (!_lista.length) {
    main.style.display = 'none';
    vacio.style.display = 'flex';
    return;
  }
  main.style.display = 'grid';
  vacio.style.display = 'none';

  const item = _lista[_idx];
  const color = COLORES[_letra] || '#0ea5c9';

  _el.querySelector('#md-card').style.background = color;
  _renderCardBg(color);

  const img = _el.querySelector('#md-picto');
  img.classList.add('cargando');
  img.alt = item.texto;
  img.src = pictoURL(item.picto);
  img.onload = () => img.classList.remove('cargando');
  img.onerror = () => img.classList.remove('cargando');

  _actualizarTexto();

  _renderDots();
}

function _renderDots() {
  const wrap = _el.querySelector('#md-dots');
  const total = Math.min(_lista.length, 8);
  wrap.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const d = document.createElement('span');
    d.className = 'md-dot' + (i === _idx % total ? ' activo' : '');
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
    const item = _lista[_idx];
    const { es, en } = _langConfig;
    const reproducirEn = (es && en) ? Math.random() < 0.5 : !!en;
    const lang = reproducirEn ? 'en-US' : 'es-MX';
    const texto = reproducirEn ? (item.tts_en || item.tts_es) : item.tts_es;
    const archivo = item.picto;  // mismo nombre en es/ y en/
    _hablar(texto, lang, archivo);
  });
  _el.querySelector('#md-btn-mic').addEventListener('click', _toggleMic);
  // Spring drag en el pictograma
  const picto = _el.querySelector('#md-picto');
  if (picto) _initSpringDrag(picto);
}

// ─── Audio ────────────────────────────────────────────────────────────────────
// archivo = ruta_img sin .png (mismo nombre en ambas carpetas)
// texto   = palabra a pronunciar (varía según idioma)
// lang    = 'es-MX' | 'en-US'
function _hablar(texto, lang = 'es-MX', archivo = null) {
  const langCode = lang.slice(0, 2);                             // 'es' | 'en'
  const url = `assets/audio/${langCode}/${(archivo || texto).toLowerCase()}.mp3`;

  const img = _el?.querySelector('#md-picto');
  const _animar = () => {
    if (!img) return;
    img.classList.add('hablando');
    setTimeout(() => img.classList.remove('hablando'), Math.max(800, texto.length * 70));
  };

  if (!_audioEl) {
    _audioEl = document.createElement('audio');
    _audioEl.preload = 'none';
  }

  _audioEl.pause();
  _audioEl.onerror = null;  // limpiar handler previo

  // Flag para evitar TTS doble (onerror + catch pueden dispararse juntos)
  let _fallbackUsado = false;
  const _fallback = () => {
    if (_fallbackUsado) return;
    _fallbackUsado = true;
    TTS.speak(texto, { lang, rate: 0.92, pitch: 1.2 });
    _animar();
  };

  _audioEl.onerror = _fallback;
  _audioEl.src = url;
  _audioEl.play().then(() => _animar()).catch(_fallback);
}

// ─── Micrófono ────────────────────────────────────────────────────────────────
let _recog = null;
let _micActivo = false;
let _mejorScore = 0;

function _toggleMic() {
  if (_micActivo) { _detenerMic(); return; }
  _iniciarMic();
}

function _iniciarMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { _mostrarMedidor(0, 'Micrófono no disponible en este navegador'); return; }

  _recog = new SR();
  _recog.lang = _lang === 'es' ? 'es-MX' : 'en-US';
  _recog.interimResults = true;
  _recog.continuous = true;
  _recog.maxAlternatives = 3;

  _mejorScore = 0;
  _micActivo = true;
  _el.querySelector('#md-btn-mic').classList.add('activo');
  _el.querySelector('#md-medidor-wrap').classList.add('visible');
  _actualizarBarra(0, '…');

  _recog.onresult = (e) => {
    let textoMejor = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      for (let a = 0; a < res.length; a++) {
        const transcripcion = res[a].transcript.trim().toLowerCase();
        const objetivo = (_lista[_idx]?.texto || '').toLowerCase();
        const score = _similitud(transcripcion, objetivo);
        if (score > _mejorScore) { _mejorScore = score; textoMejor = transcripcion; }
      }
    }
    _actualizarBarra(_mejorScore, textoMejor);
  };

  _recog.onerror = (e) => {
    if (e.error !== 'no-speech') {
      _actualizarBarra(_mejorScore, `Error: ${e.error}`);
      _detenerMic();
    }
  };

  _recog.onend = () => { if (_micActivo) { try { _recog.start(); } catch { } } };

  try { _recog.start(); } catch (e) { console.warn('[mic]', e); }
}

function _detenerMic() {
  _micActivo = false;
  try { _recog?.stop(); } catch { }
  _recog = null;
  _el?.querySelector('#md-btn-mic')?.classList.remove('activo');
}

function _actualizarBarra(score, texto) {
  const pct = Math.round(score * 100);
  const color = score < 0.40 ? '#f87171' : score < 0.70 ? '#fbbf24' : '#34d399';
  const bar = _el.querySelector('#md-medidor-bar');
  const pctEl = _el.querySelector('#md-medidor-pct');
  const txtEl = _el.querySelector('#md-medidor-texto');
  if (bar) { bar.style.width = pct + '%'; bar.style.background = color; }
  if (pctEl) { pctEl.textContent = pct + '%'; pctEl.style.color = color; }
  if (txtEl) txtEl.textContent = texto || '…';
}

function _mostrarMedidor(score, texto) {
  _el.querySelector('#md-medidor-wrap')?.classList.add('visible');
  _actualizarBarra(score, texto);
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
      <radialGradient id="md-rg2" cx="${r(1, 10, 90)}%" cy="${r(2, 10, 90)}%" r="55%">
        <stop offset="0%"   stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c2}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="400" height="500" fill="${c0}"/>
    <rect width="400" height="500" fill="url(#md-rg1)"/>
    <ellipse cx="${r(3, 60, 340)}" cy="${r(4, 60, 440)}" rx="${r(5, 80, 160)}" ry="${r(6, 60, 130)}"
             fill="${c3}" opacity="0.22" transform="rotate(${r(7, 0, 360)} ${r(3, 60, 340)} ${r(4, 60, 440)})"/>
    <ellipse cx="${r(8, 60, 340)}" cy="${r(9, 60, 440)}" rx="${r(10, 60, 120)}" ry="${r(11, 40, 100)}"
             fill="${c1}" opacity="0.18" transform="rotate(${r(12, 0, 360)} ${r(8, 60, 340)} ${r(9, 60, 440)})"/>
    <circle cx="${r(13, 0, 80)}" cy="${r(14, 380, 500)}" r="${r(15, 60, 110)}" fill="${c2}" opacity="0.35"/>
    <path d="M0,${r(16, 180, 320)} Q${r(17, 60, 160)},${r(18, 100, 260)} 200,${r(19, 180, 320)} T400,${r(20, 180, 320)}"
          stroke="${c3}" stroke-width="${r(21, 30, 70)}" fill="none" opacity="0.12"/>
    <ellipse cx="${r(22, 120, 280)}" cy="${r(23, 20, 80)}" rx="${r(24, 50, 100)}" ry="${r(25, 20, 50)}"
             fill="white" opacity="0.08"/>
    <rect width="400" height="500" fill="${c0}" opacity="0.05" filter="url(#md-grain)"/>
    <rect width="400" height="500" fill="url(#md-rg2)" opacity="0.3"/>

    <!-- Luz rotatoria sutil -->
    <ellipse cx="${200 + r(26, -60, 60)}" cy="${r(27, 80, 200)}"
             rx="${r(28, 60, 120)}" ry="${r(29, 30, 70)}"
             fill="white" opacity="0.06"
             transform="rotate(${r(30, 0, 360)} 200 250)"/>

    <!-- Destellos puntales -->
    ${[1, 2, 3, 4, 5].map(i => `
    <circle cx="${r(30 + i, 30, 370)}" cy="${r(35 + i, 40, 460)}"
            r="${r(40 + i, 2, 5)}"
            fill="white" opacity="${(r(45 + i, 1, 4) / 10).toFixed(1)}">
      <animate attributeName="opacity"
               values="0;${(r(45 + i, 2, 5) / 10).toFixed(1)};0"
               dur="${(r(50 + i, 25, 45) / 10).toFixed(1)}s"
               begin="${(r(55 + i, 0, 30) / 10).toFixed(1)}s"
               repeatCount="indefinite"/>
    </circle>`).join('')}
  `;
}

function _mezclarBlanco(hex, t) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.round(((n >> 16) & 255) + (255 - ((n >> 16) & 255)) * t);
  const g = Math.round(((n >> 8) & 255) + (255 - ((n >> 8) & 255)) * t);
  const b = Math.round((n & 255) + (255 - (n & 255)) * t);
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function _oscurecer(hex, t) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - t));
  const g = Math.round(((n >> 8) & 255) * (1 - t));
  const b = Math.round((n & 255) * (1 - t));
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

// ─── Similitud fonética ───────────────────────────────────────────────────────
function _similitud(a, b) {
  const norm = s => s.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').trim();
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.split(' ').includes(nb)) return 0.95;
  return Math.max(0, 1 - _levenshtein(na, nb) / Math.max(na.length, nb.length));
}

function _levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

// ─── Spring drag del pictograma ────────────────────────────────────────────────
function _initSpringDrag(img) {
  let startX = 0, startY = 0, isDragging = false;
  const MAX = 52;   // máximo desplazamiento en px
  const K = 0.55;  // resistencia — más alto = más movimiento

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
    const t = e.touches[0];
    const dx = _clamp((t.clientX - startX) * K, -MAX, MAX);
    const dy = _clamp((t.clientY - startY) * K, -MAX, MAX);
    // Leve rotación proporcional al desplazamiento horizontal
    const rot = dx * 0.15;
    img.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(1.04)`;
  }, { passive: false });

  const _release = () => {
    if (!isDragging) return;
    isDragging = false;
    img.classList.remove('dragging');
    // Rebote elástico de vuelta al centro
    img.style.transition = 'transform 0.65s cubic-bezier(0.34, 2.2, 0.64, 1)';
    img.style.transform = 'translate(0,0) rotate(0deg) scale(1)';
    setTimeout(() => { img.style.transition = ''; img.style.transform = ''; }, 520);
  };

  img.addEventListener('touchend', _release, { passive: true });
  img.addEventListener('touchcancel', _release, { passive: true });
}

function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function _actualizarTexto() {
  const item = _lista[_idx];
  if (!item) return;
  const { es, en } = _langConfig;
  let display;
  if (es && en) {
    display = `${item.tts_es} / ${item.tts_en}`;
  } else if (en) {
    display = item.tts_en || item.tts_es;
  } else {
    display = item.tts_es;
  }
  _el.querySelector('#md-palabra').textContent = display;
  _el.querySelector('#md-meta').textContent =
    `${_idx + 1} · ${_lista.length} · ${es && en ? 'ES / EN' : en ? 'INGLÉS' : 'ESPAÑOL'}`;
}