/* modules/toca/toca.js
   Módulo "Escucha y Toca" — Marina 2

   Mecánica:
   · Voz dice "Toca la fresa" — 3/4/5/6/8 pictogramas en pantalla
   · Toca el correcto → anillo verde + pop + eco de la palabra
   · Toca el incorrecto → wiggle + repite la instrucción
   · 3 aciertos consecutivos → sube de nivel
   · 5 niveles: 3 → 4 → 5 → 6 → 8 opciones

   Idioma gobernado por el pill global (lang-change).
   Fuente: data/pictos.json (modo aleatorio).
   Preparado para leer data/toca-temas.json cuando exista.
*/

import { TTS }                   from '../../core/tts.js';
import { haptic, lanzarConfeti } from '../../core/ui.js';
import { Telemetry }             from '../../core/telemetry.js';

const PICTO_URL  = (ruta)        => `assets/pictogramas/${ruta}.png`;
const AUDIO_URL  = (ruta, lang)  => `assets/audio/${lang}/${ruta}.mp3`;

// Niveles: cantidad de opciones por nivel
const NIVELES     = [3, 4, 5, 6, 8];
const ACIERTOS_UP = 3;   // aciertos consecutivos para subir

// ─── Estado ───────────────────────────────────────────────────────────────────
let _el          = null;
let _catalogo    = [];   // pictos.json completo (solo los que tienen art o son sustantivos)
let _pool        = [];   // palabras disponibles para esta sesión
let _langConfig  = { es: true, en: false };
let _lang        = 'es';

let _nivel       = 0;   // índice en NIVELES (0 = 3 opciones)
let _aciertos    = 0;   // aciertos consecutivos
let _objetivo    = null; // picto objetivo actual
let _opciones    = [];  // pictos mostrados (incluye objetivo)
let _esperando   = false; // bloqueo durante animación
let _audioEl     = null;

// ─── API pública ──────────────────────────────────────────────────────────────
export async function init(container) {
  _el         = container;
  _langConfig = window._langConfig ? { ..._langConfig, ...window._langConfig } : { es: true, en: false };
  _lang       = (_langConfig.en && !_langConfig.es) ? 'en' : 'es';
  _nivel      = 0;
  _aciertos   = 0;
  _esperando  = false;

  try {
    const res  = await fetch('./data/pictos.json');
    const cat  = await res.json();
    // Solo palabras con pictograma y que no son verbos/adjetivos puros (art !== undefined)
    _catalogo = cat.filter(e => e.ruta_img && e.es && e.art !== undefined);
  } catch (e) {
    console.error('[toca] No se pudo cargar pictos.json', e);
    _catalogo = [];
  }

  _pool = _shuffle([..._catalogo]);
  _render();
  _nuevaRonda();

  window.addEventListener('lang-change', _onLangChange);
}

export function destroy() {
  window.removeEventListener('lang-change', _onLangChange);
  TTS.stop();
  if (_audioEl) { _audioEl.pause(); _audioEl.src = ''; _audioEl = null; }
  _el = null; _catalogo = []; _pool = [];
}

export function onEnter() {}
export function onLeave() {
  TTS.stop();
  if (_audioEl) _audioEl.pause();
  Telemetry.track('toca_sesion', {
    _modulo: 'toca',
    nivel_alcanzado: _nivel + 1,
    opciones_nivel:  NIVELES[_nivel],
  });
}

export async function pause() {
  TTS.stop(); if (_audioEl) _audioEl.pause();
}

export async function resume(container) {
  _el = container;
  _langConfig = window._langConfig ? { ..._langConfig, ...window._langConfig } : _langConfig;
  _lang = (_langConfig.en && !_langConfig.es) ? 'en' : 'es';
  _render();
  _renderRonda();
  window.removeEventListener('lang-change', _onLangChange);
  window.addEventListener('lang-change', _onLangChange);
}

// ─── Shell ────────────────────────────────────────────────────────────────────
function _render() {
  _el.style.cssText =
    'position:absolute;inset:0;display:flex;flex-direction:column;' +
    'overflow:hidden;background:transparent;';

  _el.innerHTML = `
  <style>
    /* ── Header de nivel ── */
    #tc-header {
      flex-shrink:0;
      display:flex; align-items:center; justify-content:space-between;
      padding:14px 24px 10px;
    }
    #tc-nivel-label {
      font-size:.72rem; font-weight:900; letter-spacing:.12em;
      text-transform:uppercase; color:rgba(255,255,255,0.50);
    }
    #tc-nivel-valor {
      font-size:.72rem; font-weight:900; color:#00e5b0;
      margin-left:6px;
    }
    #tc-dots {
      display:flex; gap:6px; align-items:center;
    }
    .tc-dot {
      width:10px; height:10px; border-radius:50%;
      background:rgba(255,255,255,0.18);
      transition:background .3s, transform .3s;
    }
    .tc-dot.lleno {
      background:#00e5b0;
      transform:scale(1.2);
    }

    /* ── Instrucción ── */
    #tc-instruccion {
      flex-shrink:0;
      margin:0 20px 16px;
      background:rgba(0,0,0,0.35);
      backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
      border:1px solid rgba(255,255,255,0.10);
      border-radius:20px; padding:16px 20px;
      display:flex; align-items:center; justify-content:space-between; gap:16px;
    }
    #tc-instruccion-texto {
      display:flex; flex-direction:column; gap:4px;
    }
    #tc-label-sup {
      font-size:.68rem; font-weight:900; letter-spacing:.12em;
      text-transform:uppercase; color:#00e5b0;
    }
    #tc-prompt {
      font-size:clamp(1.6rem,4vw,2.4rem); font-weight:900;
      color:#fff; line-height:1.1;
    }
    #tc-prompt strong {
      color:#ffe566;
    }
    #tc-btn-repetir {
      width:52px; height:52px; border-radius:50%; border:none; cursor:pointer;
      background:#fb7185; color:#fff; font-size:1.3rem; flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 6px 20px rgba(251,113,133,0.45);
      transition:transform .12s, box-shadow .15s;
    }
    #tc-btn-repetir:active { transform:scale(.88); box-shadow:0 3px 10px rgba(251,113,133,.3); }

    /* ── Grid de opciones ── */
    #tc-grid {
      flex:1; min-height:0;
      display:grid; gap:14px;
      padding:0 20px 20px;
    }

    /* Columnas según cantidad de opciones */
    #tc-grid.cols-3 { grid-template-columns:repeat(3,1fr); }
    #tc-grid.cols-4 { grid-template-columns:repeat(4,1fr); }
    #tc-grid.cols-5 { grid-template-columns:repeat(5,1fr); }
    #tc-grid.cols-6 { grid-template-columns:repeat(6,1fr); }
    #tc-grid.cols-8 { grid-template-columns:repeat(4,1fr); grid-template-rows:repeat(2,1fr); }

    .tc-opcion {
      background:#fff; border-radius:22px;
      display:flex; flex-direction:column;
      align-items:center; justify-content:flex-end;
      padding:12px 8px 14px;
      cursor:pointer; border:3px solid transparent;
      box-shadow:0 6px 20px rgba(0,20,60,0.20);
      transition:transform .14s, box-shadow .14s, border-color .2s;
      position:relative; overflow:hidden;
      -webkit-tap-highlight-color:transparent;
      user-select:none;
    }
    .tc-opcion:active { transform:scale(.93); }

    .tc-opcion img {
      width:70%; aspect-ratio:1; object-fit:contain;
      flex:1; min-height:0;
      pointer-events:none;
    }

    .tc-opcion-label {
      font-size:clamp(.75rem,1.8vw,1rem); font-weight:900;
      color:#07212e; text-align:center; margin-top:8px;
      line-height:1.1; word-break:break-word;
    }

    /* Estado correcto */
    .tc-opcion.correcto {
      border-color:#22c55e;
      box-shadow:0 0 0 4px rgba(34,197,94,0.35), 0 6px 20px rgba(0,20,60,0.20);
      animation:tc-pop .35s cubic-bezier(.34,1.56,.64,1) both;
    }
    @keyframes tc-pop {
      from { transform:scale(.9); }
      to   { transform:scale(1); }
    }

    /* Estado incorrecto */
    .tc-opcion.incorrecto {
      animation:tc-wiggle .4s ease both;
    }
    @keyframes tc-wiggle {
      0%,100% { transform:translateX(0) rotate(0deg); }
      20%      { transform:translateX(-8px) rotate(-2deg); }
      40%      { transform:translateX(8px) rotate(2deg); }
      60%      { transform:translateX(-5px) rotate(-1deg); }
      80%      { transform:translateX(5px) rotate(1deg); }
    }

    /* Subida de nivel */
    #tc-nivel-up {
      display:none; position:absolute; inset:0;
      align-items:center; justify-content:center; flex-direction:column;
      gap:12px; z-index:10;
      background:rgba(3,17,26,0.75);
      backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
      animation:tc-fadein .25s ease both;
    }
    #tc-nivel-up.visible { display:flex; }
    @keyframes tc-fadein {
      from { opacity:0; } to { opacity:1; }
    }
    #tc-nivel-up-emoji { font-size:4rem; animation:tc-flotar 1.2s ease-in-out infinite alternate; }
    @keyframes tc-flotar {
      from { transform:translateY(0); }
      to   { transform:translateY(-12px); }
    }
    #tc-nivel-up-texto {
      font-size:2rem; font-weight:900; color:#fff;
      text-shadow:0 4px 20px rgba(0,229,176,0.60);
    }
    #tc-nivel-up-sub {
      font-size:1rem; font-weight:700; color:rgba(255,255,255,0.60);
    }

    /* Sin pictos */
    #tc-vacio {
      display:none; flex:1; flex-direction:column;
      align-items:center; justify-content:center; gap:12px;
      color:rgba(255,255,255,.30); font-size:1rem; font-weight:700;
    }
  </style>

  <!-- Header nivel + progreso -->
  <div id="tc-header">
    <div>
      <span id="tc-nivel-label">NIVEL</span>
      <span id="tc-nivel-valor">1</span>
    </div>
    <div id="tc-dots"></div>
  </div>

  <!-- Instrucción + botón repetir -->
  <div id="tc-instruccion">
    <div id="tc-instruccion-texto">
      <span id="tc-label-sup">ESCUCHA Y TOCA</span>
      <div id="tc-prompt">…</div>
    </div>
    <button id="tc-btn-repetir" title="Repetir">🔊</button>
  </div>

  <!-- Grid de opciones -->
  <div id="tc-grid"></div>

  <!-- Overlay subida de nivel -->
  <div id="tc-nivel-up">
    <div id="tc-nivel-up-emoji">⭐</div>
    <div id="tc-nivel-up-texto"></div>
    <div id="tc-nivel-up-sub"></div>
  </div>

  <!-- Sin pictos disponibles -->
  <div id="tc-vacio">
    <span style="font-size:3rem">🔤</span>
    No hay pictogramas disponibles.
  </div>
  `;

  _el.querySelector('#tc-btn-repetir').addEventListener('click', () => {
    haptic(10);
    _reproducirInstruccion();
  });
}

// ─── Ronda ────────────────────────────────────────────────────────────────────
function _nuevaRonda() {
  if (_catalogo.length < NIVELES[_nivel]) {
    _el.querySelector('#tc-grid').style.display     = 'none';
    _el.querySelector('#tc-instruccion').style.display = 'none';
    _el.querySelector('#tc-vacio').style.display    = 'flex';
    return;
  }

  _esperando = false;

  // Elegir objetivo y distractores del pool
  const n = NIVELES[_nivel];

  // Rellenar pool si se agota
  if (_pool.length < n) _pool = _shuffle([..._catalogo]);

  // Objetivo: primero del pool
  _objetivo = _pool.shift();

  // Distractores: siguientes n-1 del pool
  const distractores = [];
  while (distractores.length < n - 1) {
    if (!_pool.length) _pool = _shuffle([..._catalogo]);
    const candidato = _pool.shift();
    if (candidato.id !== _objetivo.id) distractores.push(candidato);
  }

  _opciones = _shuffle([_objetivo, ...distractores]);

  _renderRonda();

  // Reproducir instrucción con delay breve
  setTimeout(() => _reproducirInstruccion(), 400);
}

function _renderRonda() {
  const n = NIVELES[_nivel];

  // Header
  _el.querySelector('#tc-nivel-valor').textContent = _nivel + 1;
  _renderDots();

  // Prompt
  _actualizarPrompt();

  // Grid
  const grid = _el.querySelector('#tc-grid');
  grid.className = `cols-${n}`;
  grid.innerHTML = '';

  _opciones.forEach(picto => {
    const btn = document.createElement('button');
    btn.className    = 'tc-opcion';
    btn.dataset.id   = picto.id;

    const img        = document.createElement('img');
    img.src          = PICTO_URL(picto.ruta_img);
    img.alt          = picto.es;
    img.onerror      = () => img.style.opacity = '0.3';

    const label      = document.createElement('span');
    label.className  = 'tc-opcion-label';
    label.textContent = _lang === 'en' ? (picto.en || picto.es) : picto.es;

    btn.appendChild(img);
    btn.appendChild(label);
    btn.addEventListener('click', () => _tocar(picto, btn));
    grid.appendChild(btn);
  });
}

function _actualizarPrompt() {
  if (!_objetivo) return;
  const prompt = _el.querySelector('#tc-prompt');
  if (_lang === 'en') {
    const word = _objetivo.en || _objetivo.es;
    prompt.innerHTML = `Touch the <strong>${word}</strong>`;
    _el.querySelector('#tc-label-sup').textContent = 'LISTEN AND TOUCH';
  } else {
    const art  = _objetivo.art || '';
    const word = _objetivo.es;
    const ins  = art ? `Toca ${art} <strong>${word}</strong>` : `Toca <strong>${word}</strong>`;
    prompt.innerHTML = ins;
    _el.querySelector('#tc-label-sup').textContent = 'ESCUCHA Y TOCA';
  }
}

function _renderDots() {
  const wrap = _el.querySelector('#tc-dots');
  wrap.innerHTML = '';
  for (let i = 0; i < ACIERTOS_UP; i++) {
    const d = document.createElement('div');
    d.className = 'tc-dot' + (i < _aciertos ? ' lleno' : '');
    wrap.appendChild(d);
  }
}

// ─── Interacción ──────────────────────────────────────────────────────────────
function _tocar(picto, btn) {
  if (_esperando) return;
  haptic(12);

  if (picto.id === _objetivo.id) {
    _acierto(btn);
  } else {
    _error(btn);
  }
}

function _acierto(btn) {
  _esperando = true;
  _aciertos++;

  btn.classList.add('correcto');
  lanzarConfeti({ count: 30, container: _el });

  // Eco de la palabra
  const texto  = _lang === 'en' ? (_objetivo.en || _objetivo.es) : _objetivo.es;
  const archivo = _objetivo.ruta_img.replace('.png', '');
  _reproducirAudio(archivo, _lang, texto);

  Telemetry.track('toca_acierto', {
    _modulo: 'toca', picto: _objetivo.es, nivel: _nivel + 1,
  });

  // ¿Subir de nivel?
  if (_aciertos >= ACIERTOS_UP) {
    _aciertos = 0;
    if (_nivel < NIVELES.length - 1) {
      setTimeout(() => _mostrarSubidaNivel(), 700);
    } else {
      // Nivel máximo — reiniciar conteo y seguir
      setTimeout(() => _nuevaRonda(), 900);
    }
  } else {
    _renderDots();
    setTimeout(() => _nuevaRonda(), 900);
  }
}

function _error(btn) {
  btn.classList.add('incorrecto');
  haptic([10, 50, 10]);

  setTimeout(() => btn.classList.remove('incorrecto'), 450);

  // Repetir instrucción con delay
  setTimeout(() => _reproducirInstruccion(), 600);

  Telemetry.track('toca_error', {
    _modulo: 'toca', picto: _objetivo.es, nivel: _nivel + 1,
  });
}

function _mostrarSubidaNivel() {
  _nivel++;
  const overlay = _el.querySelector('#tc-nivel-up');
  const emojis  = ['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '🏆'];
  _el.querySelector('#tc-nivel-up-emoji').textContent = emojis[Math.min(_nivel, emojis.length - 1)];
  _el.querySelector('#tc-nivel-up-texto').textContent =
    _lang === 'en' ? `Level ${_nivel + 1}!` : `¡Nivel ${_nivel + 1}!`;
  _el.querySelector('#tc-nivel-up-sub').textContent =
    _lang === 'en'
      ? `Now ${NIVELES[_nivel]} pictures`
      : `Ahora ${NIVELES[_nivel]} opciones`;

  overlay.classList.add('visible');
  lanzarConfeti({ count: 60, container: _el });

  // TTS
  const msg = _lang === 'en' ? `Level ${_nivel + 1}!` : `¡Nivel ${_nivel + 1}!`;
  TTS.speak(msg, { lang: _lang === 'en' ? 'en-US' : 'es-MX', pitch: 1.3, rate: 0.9 });

  setTimeout(() => {
    overlay.classList.remove('visible');
    _nuevaRonda();
  }, 2200);
}

// ─── Audio ────────────────────────────────────────────────────────────────────
function _reproducirInstruccion() {
  if (!_objetivo) return;

  const lang   = _lang === 'en' ? 'en-US' : 'es-MX';
  const texto  = _lang === 'en'
    ? `Touch the ${_objetivo.en || _objetivo.es}`
    : `Toca ${_objetivo.art ? _objetivo.art + ' ' : ''}${_objetivo.es}`;

  // Intentar MP3 primero, TTS como fallback
  const archivo = _objetivo.ruta_img.replace('.png', '');
  const urlAudio = AUDIO_URL(archivo, _lang);

  // Para la instrucción completa usamos TTS directamente
  // (no tenemos MP3 de instrucciones compuestas)
  TTS.speak(texto, { lang, rate: 0.88, pitch: 1.1 });
}

function _reproducirAudio(archivo, lang, textoFallback) {
  if (!_audioEl) {
    _audioEl = document.createElement('audio');
    _audioEl.preload = 'none';
  }
  TTS.stop();
  _audioEl.pause();

  const url = AUDIO_URL(archivo, lang);
  let _usado = false;
  const _fallback = () => {
    if (_usado) return; _usado = true;
    TTS.speak(textoFallback, {
      lang: lang === 'en' ? 'en-US' : 'es-MX',
      rate: 0.9, pitch: 1.2,
    });
  };

  _audioEl.onerror = _fallback;
  _audioEl.src     = url;
  _audioEl.play().catch(_fallback);
}

// ─── Idioma ───────────────────────────────────────────────────────────────────
function _onLangChange(e) {
  const cfg = e.detail?.langConfig;
  if (!cfg) return;
  _langConfig = { ...cfg };
  _lang = (cfg.en && !cfg.es) ? 'en' : 'es';
  // Actualizar labels sin reiniciar la ronda
  if (_objetivo) {
    _actualizarPrompt();
    _el.querySelectorAll('.tc-opcion-label').forEach((lbl, i) => {
      const p = _opciones[i];
      if (p) lbl.textContent = _lang === 'en' ? (p.en || p.es) : p.es;
    });
  }
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}