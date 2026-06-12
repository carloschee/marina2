/* modules/toca/toca.js — Marina 2
   Módulo "Escucha y toca".
   Escucha una instrucción de voz y toca el pictograma correcto.
   Selector de tema estandarizado: pill en barra superior, bottom-sheet
   con agrupación Vocabulario / Lenguaje, igual que Sílabas y Simón.
*/

import { TTS }           from '../../core/tts.js';
import { haptic, lanzarConfeti } from '../../core/ui.js';
import { Telemetry }     from '../../core/telemetry.js';

const PICTO_URL      = (r) => `assets/pictogramas/${r.toLowerCase()}`;
const AUDIO_URL      = (r, lang = 'es') =>
  `assets/audio/${lang}/${r.replace(/\.png$/i, '').toLowerCase()}.mp3`;
const MEJOR_RACHA_KEY = 'marina2-toca-mejor-racha';
const MOSAIC_SIZE     = 260;
const NIVELES         = [2, 3, 4, 6];
const ACIERTOS_POR_NIVEL = [3, 3, 4, 4];

let _el           = null;
let _catalogo     = [];
let _temas        = [];
let _tema         = null;
let _pool         = [];
let _opciones     = [];
let _objetivo     = null;
let _nivel        = 0;
let _aciertos     = 0;
let _modoInfinito = false;
let _racha        = 0;
let _mejorRacha   = 0;
let _esperando    = false;
let _lang         = 'es';
let _langConfig   = { es: true, en: false };
let _audioEl      = null;
let _gridW        = 0;
let _gridH        = 0;
let _resizeObs    = null;

// ─── API pública ──────────────────────────────────────────────────────────────
export async function init(container) {
  _el           = container;
  _langConfig   = window._langConfig ? { ...window._langConfig } : { es: true, en: false };
  _lang         = (_langConfig.en && !_langConfig.es) ? 'en' : 'es';
  _nivel        = 0; _aciertos = 0; _modoInfinito = false;
  _racha        = 0; _esperando = false; _tema = null;

  try { _mejorRacha = parseInt(localStorage.getItem(MEJOR_RACHA_KEY) || '0', 10) || 0; }
  catch { _mejorRacha = 0; }

  try {
    const res = await fetch('./data/pictos.json');
    const cat = await res.json();
    _catalogo = cat.filter(e => e.ruta_img && e.es && e.art !== undefined);
  } catch (e) { console.error('[toca] pictos.json', e); _catalogo = []; }

  try { const r = await fetch('./data/temas.json'); _temas = await r.json(); }
  catch { _temas = []; }

  _pool = _shuffle([..._catalogo]);
  _render();
  _abrirModalTemas();
  window.addEventListener('lang-change', _onLangChange);
}

export function destroy() {
  window.removeEventListener('lang-change', _onLangChange);
  _resizeObs?.disconnect(); _resizeObs = null; _gridW = 0; _gridH = 0;
  TTS.stop();
  if (_audioEl) { _audioEl.pause(); _audioEl.src = ''; _audioEl = null; }
  _el = null; _catalogo = []; _pool = []; _temas = [];
}

export function onEnter() {}

export function onLeave() {
  TTS.stop(); if (_audioEl) _audioEl.pause();
  Telemetry.track('toca_sesion', {
    _modulo: 'toca', nivel_alcanzado: _nivel + 1,
    opciones_nivel: NIVELES[Math.min(_nivel, NIVELES.length - 1)],
    modo_infinito: _modoInfinito, mejor_racha: _mejorRacha,
    tema: _tema?.id || 'todos',
  });
}

export async function pause() {
  TTS.stop(); if (_audioEl) _audioEl.pause(); _esperando = true;
}

export async function resume(container) {
  _el         = container;
  _langConfig = window._langConfig ? { ...window._langConfig } : _langConfig;
  _lang       = (_langConfig.en && !_langConfig.es) ? 'en' : 'es';
  _render();

  const label   = _el.querySelector('#tc-tema-label');
  const emojiEl = _el.querySelector('#tc-tema-emoji');
  if (label)   label.textContent   = _tema ? _tema.label             : 'Todas las palabras';
  if (emojiEl) emojiEl.textContent = _tema ? (_tema.emoji || '📚')   : '🌊';

  if (_modoInfinito) {
    const nivelValor = _el.querySelector('#tc-nivel-valor');
    if (nivelValor) nivelValor.textContent = '∞';
    _el.querySelector('#tc-racha-wrap')?.classList.add('visible');
    _el.querySelector('#tc-dots').style.display = 'none';
    if (_mejorRacha > 0) {
      _el.querySelector('#tc-record-wrap')?.classList.add('visible');
      const rv = _el.querySelector('#tc-record-valor');
      if (rv) rv.textContent = _mejorRacha;
    }
    _actualizarRacha();
  }

  _esperando = false;
  requestAnimationFrame(() => { requestAnimationFrame(() => { if (_el) _nuevaRonda(); }); });
  window.removeEventListener('lang-change', _onLangChange);
  window.addEventListener('lang-change', _onLangChange);
}

// ─── Render ───────────────────────────────────────────────────────────────────
function _render() {
  _el.style.cssText =
    'position:absolute;inset:0;display:flex;flex-direction:column;' +
    'overflow:hidden;background:transparent;padding:0;';

  _el.innerHTML = `
  <style>
    /* ── Barra superior: selector de tema ── */
    #tc-top {
      flex-shrink:0; display:flex; align-items:center;
      padding:10px 14px 0; gap:10px;
    }
    #tc-btn-tema {
      display:flex; align-items:center; gap:8px;
      min-height:48px; padding:8px 16px; border-radius:99px;
      background:rgba(0,229,176,0.12);
      border:1.5px solid rgba(0,229,176,0.35);
      color:#fff; font-family:inherit; font-weight:900; font-size:.95rem;
      cursor:pointer; transition:transform .12s, background .2s;
    }
    #tc-btn-tema:active { transform:scale(.97); background:rgba(0,229,176,0.22); }
    #tc-tema-emoji { font-size:1.2rem; }

    /* ── Header de stats ── */
    #tc-header {
      flex-shrink:0; display:flex; align-items:center; gap:10px;
      padding:8px 14px; min-height:48px;
    }
    #tc-nivel-wrap {
      display:flex; align-items:baseline; gap:5px;
      background:rgba(255,255,255,0.10); border-radius:99px;
      padding:5px 14px; flex-shrink:0;
    }
    #tc-nivel-label {
      font-size:.70rem; font-weight:900; letter-spacing:.12em;
      text-transform:uppercase; color:rgba(255,255,255,0.55);
    }
    #tc-nivel-valor {
      font-size:1.1rem; font-weight:900; color:#ffe566;
      text-shadow:0 0 12px rgba(255,229,102,0.60);
    }
    #tc-racha-wrap {
      display:none; align-items:baseline; gap:5px;
      background:rgba(0,229,176,0.15); border-radius:99px;
      padding:5px 14px; border:1px solid rgba(0,229,176,0.35); flex-shrink:0;
    }
    #tc-racha-wrap.visible { display:flex; }
    #tc-racha-label {
      font-size:.70rem; font-weight:900; letter-spacing:.12em;
      text-transform:uppercase; color:rgba(0,229,176,0.70);
    }
    #tc-racha-valor {
      font-size:1.1rem; font-weight:900; color:#00e5b0;
      text-shadow:0 0 12px rgba(0,229,176,0.60);
    }
    #tc-record-wrap { display:none; align-items:baseline; gap:4px; flex-shrink:0; }
    #tc-record-wrap.visible { display:flex; }
    #tc-record-label {
      font-size:.65rem; font-weight:900; letter-spacing:.10em;
      text-transform:uppercase; color:rgba(255,229,102,0.60);
    }
    #tc-record-valor { font-size:.95rem; font-weight:900; color:#ffe566; opacity:.80; }
    #tc-dots { display:flex; gap:6px; align-items:center; flex-shrink:0; margin-left:auto; }
    .tc-dot {
      width:10px; height:10px; border-radius:50%;
      background:rgba(255,255,255,0.20);
      transition:background .25s, transform .2s;
    }
    .tc-dot.lleno {
      background:#00e5b0; box-shadow:0 0 8px rgba(0,229,176,0.60); transform:scale(1.2);
    }

    /* ── Instrucción ── */
    #tc-instruccion {
      flex-shrink:0; display:flex; align-items:center; gap:12px;
      padding:8px 16px 10px;
    }
    #tc-instruccion-texto { flex:1; }
    #tc-label-sup {
      display:block; font-size:.68rem; font-weight:900;
      letter-spacing:.14em; text-transform:uppercase;
      color:rgba(255,255,255,0.40); margin-bottom:2px;
    }
    #tc-prompt {
      font-size:clamp(1.1rem,3.5vw,1.5rem); font-weight:900; color:#fff;
      text-shadow:0 2px 10px rgba(0,0,0,0.40);
    }
    #tc-prompt strong { color:#ffe566; }
    #tc-btn-repetir {
      width:48px; height:48px; border-radius:50%; border:none;
      background:#00e5b0; font-size:1.3rem; cursor:pointer;
      box-shadow:0 4px 16px rgba(0,229,176,0.45); transition:transform .12s;
    }
    #tc-btn-repetir:active { transform:scale(.88); }

    /* ── Grid ── */
    #tc-grid {
      flex:1; min-height:0;
      display:flex; flex-wrap:wrap;
      align-content:center; justify-content:center;
      gap:12px; padding:8px 12px; overflow:hidden;
    }
    .tc-opcion {
      border-radius:22px; border:3px solid rgba(255,255,255,0.30); background:#fff;
      cursor:pointer; display:flex; flex-direction:column;
      align-items:center; justify-content:center; gap:8px;
      padding:10px; transition:transform .15s, border-color .2s, box-shadow .2s;
      overflow:hidden; position:relative; box-shadow:0 4px 16px rgba(0,0,0,0.25);
    }
    .tc-opcion:active { transform:scale(.93); }
    .tc-opcion img {
      width:62%; height:62%; object-fit:contain;
      border-radius:12px; pointer-events:none;
    }
    .tc-opcion-label {
      font-size:clamp(1rem,3vw,1.3rem); font-weight:900; color:#07212e;
      text-align:center; padding:0 4px;
    }
    .tc-opcion.correcto {
      border-color:#00e5b0; box-shadow:0 0 0 4px rgba(0,229,176,0.30);
      animation:tc-pop .3s cubic-bezier(.34,1.56,.64,1);
    }
    .tc-opcion.incorrecto { border-color:#ff6b6b; animation:tc-shake .35s ease; }
    @keyframes tc-pop { from { transform:scale(.85); } to { transform:scale(1); } }
    @keyframes tc-shake {
      0%,100% { transform:translateX(0); }
      20% { transform:translateX(-8px); } 40% { transform:translateX(8px); }
      60% { transform:translateX(-5px); } 80% { transform:translateX(5px); }
    }

    /* ── Overlay subida de nivel ── */
    #tc-nivel-up {
      position:absolute; inset:0; display:flex; flex-direction:column;
      align-items:center; justify-content:center; gap:10px;
      background:rgba(5,25,60,0.85);
      backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
      opacity:0; pointer-events:none; transition:opacity .3s; z-index:10;
    }
    #tc-nivel-up.visible { opacity:1; pointer-events:all; }
    #tc-nivel-up-emoji { font-size:3.5rem; animation:tc-pop .4s ease; }
    #tc-nivel-up-texto {
      font-size:2rem; font-weight:900; color:#fff;
      text-shadow:0 2px 20px rgba(255,229,102,0.60);
    }
    #tc-nivel-up-sub { font-size:1rem; font-weight:800; color:rgba(255,255,255,0.65); }

    /* ── Overlay fallo modo infinito ── */
    #tc-fallo-infinito {
      position:absolute; inset:0; display:flex; flex-direction:column;
      align-items:center; justify-content:center; gap:14px;
      background:rgba(5,25,60,0.90);
      backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
      opacity:0; pointer-events:none; transition:opacity .3s; z-index:10;
    }
    #tc-fallo-infinito.visible { opacity:1; pointer-events:all; }
    #tc-fallo-emoji { font-size:3rem; }
    #tc-fallo-racha {
      font-size:3.5rem; font-weight:900; color:#00e5b0;
      text-shadow:0 2px 20px rgba(0,229,176,0.50); line-height:1;
    }
    #tc-fallo-label { font-size:1rem; font-weight:800; color:rgba(255,255,255,0.60); letter-spacing:.05em; }
    #tc-fallo-record {
      font-size:1rem; font-weight:900; color:#ffe566;
      text-shadow:0 0 12px rgba(255,229,102,0.50); min-height:1.4em;
    }
    #tc-fallo-btn {
      margin-top:8px; padding:14px 32px; border-radius:99px; border:none;
      background:#00e5b0; color:#032340;
      font-family:inherit; font-size:1.1rem; font-weight:900;
      cursor:pointer; transition:transform .12s;
    }
    #tc-fallo-btn:active { transform:scale(.93); }

    /* ── Modal de temas — bottom-sheet estándar ── */
    #tc-modal-temas {
      position:absolute; inset:0; z-index:20;
      background:rgba(5,20,50,0.80);
      backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
      display:flex; align-items:flex-end;
      opacity:0; pointer-events:none; transition:opacity .25s;
    }
    #tc-modal-temas.visible { opacity:1; pointer-events:all; }
    #tc-modal-box {
      width:100%; max-height:78vh; overflow-y:auto; -webkit-overflow-scrolling:touch;
      background:rgba(10,20,50,0.98); border-radius:24px 24px 0 0;
      padding:20px 16px calc(28px + env(safe-area-inset-bottom,0px));
      border-top:2px solid rgba(0,229,176,0.30);
      transform:translateY(20px); transition:transform .3s cubic-bezier(.34,1.1,.64,1);
    }
    #tc-modal-temas.visible #tc-modal-box { transform:translateY(0); }
    #tc-modal-header {
      display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;
    }
    #tc-modal-titulo {
      font-size:.82rem; font-weight:900; letter-spacing:.10em;
      text-transform:uppercase; color:rgba(0,229,176,0.85); margin:0;
    }
    #tc-modal-cerrar {
      width:42px; height:42px; border-radius:50%; border:none;
      background:rgba(255,255,255,0.12); color:#fff; font-size:1.3rem;
      cursor:pointer; display:flex; align-items:center; justify-content:center;
      transition:transform .12s;
    }
    #tc-modal-cerrar:active { transform:scale(.88); }
    #tc-modal-lista { display:flex; flex-direction:column; gap:8px; }
    .tc-grupo-label {
      font-size:.70rem; font-weight:900; letter-spacing:.10em;
      text-transform:uppercase; color:rgba(255,255,255,0.40); margin:12px 0 6px;
    }
    .tc-tema-opcion {
      display:flex; align-items:center; gap:14px; min-height:56px;
      padding:12px 16px; border-radius:16px; cursor:pointer;
      background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.10);
      font-family:inherit; color:#fff; text-align:left; width:100%;
      transition:background .15s, transform .12s;
    }
    .tc-tema-opcion:active { transform:scale(.97); }
    .tc-tema-opcion.activo { background:rgba(0,229,176,0.15); border-color:rgba(0,229,176,0.40); }
    .tc-tema-emoji  { font-size:1.5rem; flex-shrink:0; }
    .tc-tema-info   { display:flex; flex-direction:column; gap:2px; }
    .tc-tema-nombre { font-size:1rem; font-weight:900; }
    .tc-tema-desc   { font-size:.72rem; color:rgba(255,255,255,.45); font-weight:700; }

    /* ── Vacío ── */
    #tc-vacio {
      display:none; flex:1; flex-direction:column;
      align-items:center; justify-content:center; gap:12px;
      color:rgba(255,255,255,.30); font-size:1rem; font-weight:700;
    }
  </style>

  <div id="tc-top">
    <button id="tc-btn-tema">
      <span id="tc-tema-emoji">🌊</span>
      <span id="tc-tema-label">Todas las palabras</span>
    </button>
  </div>

  <div id="tc-header">
    <div id="tc-nivel-wrap">
      <span id="tc-nivel-label">NIVEL</span>
      <span id="tc-nivel-valor">1</span>
    </div>
    <div id="tc-racha-wrap">
      <span id="tc-racha-label">RACHA</span>
      <span id="tc-racha-valor">0</span>
    </div>
    <div id="tc-record-wrap">
      <span id="tc-record-label">🏆</span>
      <span id="tc-record-valor">0</span>
    </div>
    <div id="tc-dots"></div>
  </div>

  <div id="tc-instruccion">
    <div id="tc-instruccion-texto">
      <span id="tc-label-sup">ESCUCHA Y TOCA</span>
      <div id="tc-prompt">…</div>
    </div>
    <button id="tc-btn-repetir" title="Repetir">🔊</button>
  </div>

  <div id="tc-grid"></div>

  <div id="tc-nivel-up">
    <div id="tc-nivel-up-emoji">⭐</div>
    <div id="tc-nivel-up-texto"></div>
    <div id="tc-nivel-up-sub"></div>
  </div>

  <div id="tc-fallo-infinito">
    <div id="tc-fallo-emoji">💫</div>
    <div id="tc-fallo-racha">0</div>
    <div id="tc-fallo-label">aciertos consecutivos</div>
    <div id="tc-fallo-record"></div>
    <button id="tc-fallo-btn">Seguir jugando</button>
  </div>

  <div id="tc-modal-temas">
    <div id="tc-modal-box">
      <div id="tc-modal-header">
        <span id="tc-modal-titulo">Elige una categoría</span>
        <button id="tc-modal-cerrar" aria-label="Cerrar">✕</button>
      </div>
      <div id="tc-modal-lista"></div>
    </div>
  </div>

  <div id="tc-vacio">
    <span style="font-size:3rem">🔤</span>
    No hay pictogramas disponibles.
  </div>
  `;

  _el.querySelector('#tc-btn-repetir').addEventListener('click', () => { haptic(10); _reproducirInstruccion(); });
  _el.querySelector('#tc-btn-tema').addEventListener('click', () => { haptic(8); _abrirModalTemas(); });
  _el.querySelector('#tc-modal-cerrar').addEventListener('click', () => _cerrarModalTemas());
  _el.querySelector('#tc-modal-temas').addEventListener('click', e => {
    if (e.target.id === 'tc-modal-temas') _cerrarModalTemas();
  });
  _el.querySelector('#tc-fallo-btn').addEventListener('click', () => {
    haptic(10);
    _el.querySelector('#tc-fallo-infinito').classList.remove('visible');
    _racha = 0; _actualizarRacha(); _nuevaRonda();
  });

  _observarGrid();
}

// ─── ResizeObserver ───────────────────────────────────────────────────────────
function _observarGrid() {
  const grid = _el.querySelector('#tc-grid');
  if (!grid) return;
  _resizeObs?.disconnect();
  if (typeof ResizeObserver === 'undefined') {
    requestAnimationFrame(() => { requestAnimationFrame(() => {
      if (!_el) return;
      const g = _el.querySelector('#tc-grid');
      if (g && g.clientWidth > 50 && g.clientHeight > 50) {
        _gridW = g.clientWidth; _gridH = g.clientHeight; _ajustarTamanos();
      }
    }); });
    return;
  }
  _resizeObs = new ResizeObserver(entries => {
    for (const e of entries) {
      const w = e.contentRect.width, h = e.contentRect.height;
      if (w > 50 && h > 50) {
        const cambio = Math.abs(w - _gridW) > 1 || Math.abs(h - _gridH) > 1;
        _gridW = w; _gridH = h; if (cambio) _ajustarTamanos();
      }
    }
  });
  _resizeObs.observe(grid);
}

// ─── Ronda ────────────────────────────────────────────────────────────────────
function _nuevaRonda() {
  if (!_el) return;
  const n = _modoInfinito ? NIVELES[NIVELES.length - 1] : NIVELES[_nivel];
  if (_catalogo.length < n) {
    _el.querySelector('#tc-grid').style.display      = 'none';
    _el.querySelector('#tc-instruccion').style.display = 'none';
    _el.querySelector('#tc-vacio').style.display     = 'flex';
    return;
  }
  _esperando = false;
  if (_pool.length < n) {
    const base = _tema?.palabras?.length ? _catalogo.filter(e => _tema.palabras.includes(e.id)) : _catalogo;
    _pool = _shuffle([...base]);
  }
  _objetivo = _pool.shift();
  const base = _tema?.palabras?.length ? _catalogo.filter(e => _tema.palabras.includes(e.id)) : _catalogo;
  const tmpPool = _shuffle(base.filter(e => e.id !== _objetivo.id));
  const distractores = [];
  while (distractores.length < n - 1 && tmpPool.length) distractores.push(tmpPool.shift());
  _opciones = _shuffle([_objetivo, ...distractores]);
  _renderRonda();
  if (_audioEl && !_audioEl.paused) {
    _audioEl.addEventListener('ended', () => { if (_el) setTimeout(() => _reproducirInstruccion(), 150); }, { once: true });
    _audioEl.addEventListener('error', () => { if (_el) _reproducirInstruccion(); }, { once: true });
  } else {
    setTimeout(() => { if (_el) _reproducirInstruccion(); }, 400);
  }
}

function _renderRonda() {
  const grid = _el.querySelector('#tc-grid');
  _el.querySelector('#tc-nivel-valor').textContent = _modoInfinito ? '∞' : (_nivel + 1);
  _renderDots(); _actualizarPrompt();
  grid.className = ''; grid.innerHTML = '';
  _opciones.forEach(picto => {
    const btn = document.createElement('button');
    btn.className = 'tc-opcion'; btn.dataset.id = picto.id;
    const img = document.createElement('img');
    img.src = PICTO_URL(picto.ruta_img); img.alt = picto.es;
    img.onerror = () => {
      if (!img.dataset.reintentado) { img.dataset.reintentado = '1'; img.src = PICTO_URL(picto.ruta_img) + '?r=' + Date.now(); }
      else img.style.opacity = '0.3';
    };
    const label = document.createElement('span');
    label.className = 'tc-opcion-label';
    label.textContent = _lang === 'en' ? (picto.en || picto.es) : picto.es;
    btn.appendChild(img); btn.appendChild(label);
    btn.addEventListener('click', () => _tocar(picto, btn));
    grid.appendChild(btn);
  });
  requestAnimationFrame(() => { if (_el) _ajustarTamanos(); });
}

// ─── Interacción ──────────────────────────────────────────────────────────────
function _tocar(picto, btn) {
  if (_esperando) return; haptic(12);
  picto.id === _objetivo.id ? _acierto(btn) : _error(btn);
}

function _acierto(btn) {
  _esperando = true; _aciertos++;
  btn.classList.add('correcto'); _confeti(30);
  _reproducirAudio(_objetivo.ruta_img, _lang, _lang === 'en' ? (_objetivo.en || _objetivo.es) : _objetivo.es);
  Telemetry.track('toca_acierto', { _modulo: 'toca', picto: _objetivo.es, nivel: _nivel + 1, modo_infinito: _modoInfinito, racha: _modoInfinito ? _racha + 1 : undefined });
  if (_modoInfinito) { _racha++; _actualizarRacha(); _renderDots(); setTimeout(() => { if (_el) _nuevaRonda(); }, 900); return; }
  _renderDots();
  if (_aciertos >= ACIERTOS_POR_NIVEL[_nivel]) {
    _aciertos = 0;
    if (_nivel < NIVELES.length - 1) setTimeout(() => _mostrarSubidaNivel(), 700);
    else setTimeout(() => _activarModoInfinito(), 700);
  } else {
    setTimeout(() => { if (_el) _nuevaRonda(); }, 900);
  }
}

function _error(btn) {
  btn.classList.add('incorrecto'); haptic([10, 50, 10]);
  Telemetry.track('toca_error', { _modulo: 'toca', picto: _objetivo.es, nivel: _nivel + 1, modo_infinito: _modoInfinito, racha_perdida: _modoInfinito ? _racha : _aciertos });
  if (_modoInfinito) { setTimeout(() => _mostrarFalloInfinito(), 400); }
  else { _aciertos = 0; _renderDots(); setTimeout(() => btn.classList.remove('incorrecto'), 450); setTimeout(() => _reproducirInstruccion(), 600); }
}

// ─── Overlays ─────────────────────────────────────────────────────────────────
function _mostrarSubidaNivel() {
  _nivel++; _aciertos = 0;
  const emojis = ['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '🏆'];
  _el.querySelector('#tc-nivel-up-emoji').textContent = emojis[Math.min(_nivel, emojis.length - 1)];
  _el.querySelector('#tc-nivel-up-texto').textContent = _lang === 'en' ? `Level ${_nivel + 1}!` : `¡Nivel ${_nivel + 1}!`;
  _el.querySelector('#tc-nivel-up-sub').textContent   = _lang === 'en'
    ? `Now ${NIVELES[_nivel]} pictures — ${ACIERTOS_POR_NIVEL[_nivel]} in a row!`
    : `Ahora ${NIVELES[_nivel]} opciones — ¡${ACIERTOS_POR_NIVEL[_nivel]} seguidos!`;
  _el.querySelector('#tc-nivel-up').classList.add('visible'); _confeti(60);
  TTS.speak(_lang === 'en' ? `Level ${_nivel + 1}!` : `¡Nivel ${_nivel + 1}!`, { lang: _lang === 'en' ? 'en-US' : 'es-MX', pitch: 1.3, rate: 0.9 });
  setTimeout(() => { if (!_el) return; _el.querySelector('#tc-nivel-up').classList.remove('visible'); _nuevaRonda(); }, 2200);
}

function _activarModoInfinito() {
  _modoInfinito = true; _racha = 0; _aciertos = 0;
  _el.querySelector('#tc-racha-wrap').classList.add('visible');
  if (_mejorRacha > 0) { _el.querySelector('#tc-record-wrap').classList.add('visible'); _el.querySelector('#tc-record-valor').textContent = _mejorRacha; }
  _el.querySelector('#tc-dots').style.display = 'none';
  _el.querySelector('#tc-nivel-up-emoji').textContent = '🏆';
  _el.querySelector('#tc-nivel-up-texto').textContent = _lang === 'en' ? '∞ Champion!' : '∞ ¡Campeona!';
  _el.querySelector('#tc-nivel-up-sub').textContent   = _lang === 'en' ? 'Infinite challenge!' : '¡Reto infinito!';
  _el.querySelector('#tc-nivel-up').classList.add('visible'); _confeti(120);
  TTS.speak(_lang === 'en' ? 'Champion! Infinite challenge!' : '¡Campeona! ¡Reto infinito!', { lang: _lang === 'en' ? 'en-US' : 'es-MX', pitch: 1.3, rate: 0.9 });
  setTimeout(() => { if (!_el) return; _el.querySelector('#tc-nivel-up').classList.remove('visible'); _nuevaRonda(); }, 2800);
}

function _mostrarFalloInfinito() {
  const esRecord = _racha > _mejorRacha;
  if (esRecord && _racha > 0) {
    _mejorRacha = _racha;
    try { localStorage.setItem(MEJOR_RACHA_KEY, String(_mejorRacha)); } catch {}
    _el.querySelector('#tc-record-valor').textContent = _mejorRacha;
    _el.querySelector('#tc-record-wrap').classList.add('visible');
  }
  _el.querySelector('#tc-fallo-racha').textContent  = _racha;
  _el.querySelector('#tc-fallo-emoji').textContent  = _racha >= 10 ? '🌟' : '💫';
  _el.querySelector('#tc-fallo-label').textContent  = _lang === 'en' ? 'consecutive hits' : 'aciertos consecutivos';
  _el.querySelector('#tc-fallo-record').textContent = esRecord && _racha > 0
    ? (_lang === 'en' ? `🏆 New record!` : `🏆 ¡Nuevo récord!`)
    : (_mejorRacha > 0 ? (_lang === 'en' ? `Best: ${_mejorRacha}` : `Récord: ${_mejorRacha}`) : '');
  _el.querySelector('#tc-fallo-btn').textContent = _lang === 'en' ? 'Keep playing' : 'Seguir jugando';
  _el.querySelector('#tc-fallo-infinito').classList.add('visible');
  if (_racha >= 5) _confeti(40);
  TTS.speak(_lang === 'en' ? `${_racha} in a row!${esRecord ? ' New record!' : ''}` : `¡${_racha} seguidos!${esRecord ? ' ¡Nuevo récord!' : ''}`, { lang: _lang === 'en' ? 'en-US' : 'es-MX', pitch: 1.1, rate: 0.9 });
}

// ─── Modal de temas ───────────────────────────────────────────────────────────
function _abrirModalTemas() {
  const lista = _el.querySelector('#tc-modal-lista');
  lista.innerHTML = '';
  lista.appendChild(_crearOpcionTema(
    { id: null, emoji: '🌊', label: 'Todas las palabras', desc: `${_catalogo.length} pictogramas` },
    _tema === null
  ));
  const grupos = { vocabulario: [], lenguaje: [], otros: [] };
  _temas.forEach(t => (grupos[t.tipo] || grupos.otros).push(t));
  const _seccion = (titulo, arr) => {
    if (!arr.length) return;
    const h = document.createElement('div'); h.className = 'tc-grupo-label'; h.textContent = titulo;
    lista.appendChild(h);
    arr.forEach(t => lista.appendChild(_crearOpcionTema(
      { id: t.id, emoji: t.emoji || '📚', label: t.label, desc: `${t.palabras?.length || 0} pictogramas` },
      _tema?.id === t.id
    )));
  };
  _seccion('Vocabulario', grupos.vocabulario);
  _seccion('Lenguaje',    grupos.lenguaje);
  _seccion('Otros',       grupos.otros);
  const box = _el.querySelector('#tc-modal-box'); box.scrollTop = 0;
  _el.querySelector('#tc-modal-temas').classList.add('visible');
}

function _crearOpcionTema({ id, emoji, label, desc }, activo) {
  const btn = document.createElement('button');
  btn.className = 'tc-tema-opcion' + (activo ? ' activo' : '');
  btn.innerHTML = `
    <span class="tc-tema-emoji">${emoji}</span>
    <span class="tc-tema-info">
      <span class="tc-tema-nombre">${label}</span>
      <span class="tc-tema-desc">${desc}</span>
    </span>`;
  btn.addEventListener('click', () => { haptic(10); _seleccionarTema(id); });
  return btn;
}

function _cerrarModalTemas() {
  _el.querySelector('#tc-modal-temas')?.classList.remove('visible');
}

function _seleccionarTema(id) {
  _tema = id === null ? null : (_temas.find(t => t.id === id) || null);
  _cerrarModalTemas();
  const label   = _el.querySelector('#tc-tema-label');
  const emojiEl = _el.querySelector('#tc-tema-emoji');
  if (label)   label.textContent   = _tema ? _tema.label           : 'Todas las palabras';
  if (emojiEl) emojiEl.textContent = _tema ? (_tema.emoji || '📚') : '🌊';
  if (_tema?.palabras?.length) {
    const ids = new Set(_tema.palabras); _pool = _shuffle(_catalogo.filter(e => ids.has(e.id)));
  } else { _pool = _shuffle([..._catalogo]); }
  _nivel = 0; _aciertos = 0; _modoInfinito = false; _racha = 0;
  _el.querySelector('#tc-racha-wrap').classList.remove('visible');
  _el.querySelector('#tc-record-wrap').classList.remove('visible');
  _el.querySelector('#tc-dots').style.display = '';
  _nuevaRonda();
}

// ─── Audio e instrucción ──────────────────────────────────────────────────────
function _reproducirInstruccion() {
  if (!_objetivo) return;
  const lang  = _lang === 'en' ? 'en-US' : 'es-MX';
  const texto = _lang === 'en'
    ? `Touch the ${_objetivo.en || _objetivo.es}`
    : `Toca ${_objetivo.art ? _objetivo.art + ' ' : ''}${_objetivo.es}`;
  TTS.speak(texto, { lang, rate: 0.88, pitch: 1.1 });
}

function _reproducirAudio(ruta, lang, textoFallback) {
  if (!_audioEl) { _audioEl = document.createElement('audio'); _audioEl.preload = 'none'; }
  TTS.stop(); _audioEl.pause(); _audioEl.onerror = null;
  let _usado = false;
  const _fallback = () => { if (_usado) return; _usado = true; TTS.speak(textoFallback, { lang: lang === 'en' ? 'en-US' : 'es-MX', rate: 0.9, pitch: 1.2 }); };
  _audioEl.onerror = _fallback;
  _audioEl.src = AUDIO_URL(ruta, lang);
  _audioEl.play().catch(_fallback);
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function _actualizarPrompt() {
  if (!_objetivo) return;
  const prompt = _el.querySelector('#tc-prompt');
  if (_lang === 'en') {
    prompt.innerHTML = `Touch the <strong>${_objetivo.en || _objetivo.es}</strong>`;
    _el.querySelector('#tc-label-sup').textContent = 'LISTEN AND TOUCH';
  } else {
    const art = _objetivo.art || '';
    prompt.innerHTML = art ? `Toca ${art} <strong>${_objetivo.es}</strong>` : `Toca <strong>${_objetivo.es}</strong>`;
    _el.querySelector('#tc-label-sup').textContent = 'ESCUCHA Y TOCA';
  }
}

function _renderDots() {
  if (_modoInfinito) return;
  const wrap = _el.querySelector('#tc-dots');
  const aciertosNecesarios = ACIERTOS_POR_NIVEL[Math.min(_nivel, ACIERTOS_POR_NIVEL.length - 1)];
  wrap.innerHTML = '';
  for (let i = 0; i < aciertosNecesarios; i++) {
    const d = document.createElement('div');
    d.className = 'tc-dot' + (i < _aciertos ? ' lleno' : '');
    wrap.appendChild(d);
  }
}

function _actualizarRacha() { if (!_el) return; _el.querySelector('#tc-racha-valor').textContent = _racha; }

function _ajustarTamanos() {
  const grid = _el.querySelector('#tc-grid'); if (!grid) return;
  let W = _gridW, H = _gridH;
  if (W < 50 || H < 50) {
    W = grid.clientWidth; H = grid.clientHeight;
    if (W < 50 || H < 50) { requestAnimationFrame(() => { if (_el) _ajustarTamanos(); }); return; }
    _gridW = W; _gridH = H;
  }
  const n = _opciones.length;
  const cols = n <= 3 ? n : n <= 4 ? 2 : n <= 6 ? 3 : 4;
  const rows = Math.ceil(n / cols);
  const avW  = W - 24 - 12 * (cols - 1);
  const avH  = H - 24 - 12 * (rows - 1);
  const portrait = H > W;
  const size = Math.max(80, portrait
    ? Math.min(avW / cols, avH / rows, 200)
    : Math.min(avW / cols, avH / rows, MOSAIC_SIZE));
  grid.querySelectorAll('.tc-opcion').forEach(o => {
    o.style.width = o.style.height = o.style.flexBasis = size + 'px';
    o.style.flexGrow = o.style.flexShrink = '0';
  });
}

// ─── Cambio de idioma ─────────────────────────────────────────────────────────
function _onLangChange(e) {
  const c = e.detail?.langConfig; if (!c) return;
  _langConfig = { ...c }; _lang = (c.en && !c.es) ? 'en' : 'es';
  if (_objetivo) {
    _actualizarPrompt();
    _el.querySelectorAll('.tc-opcion-label').forEach((lbl, i) => {
      const p = _opciones[i]; if (p) lbl.textContent = _lang === 'en' ? (p.en || p.es) : p.es;
    });
  }
}

// ─── Util ─────────────────────────────────────────────────────────────────────
function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function _confeti(count) {
  if (!_el) return;
  lanzarConfeti({ count, container: _el });
  _el.style.position = 'absolute';
}