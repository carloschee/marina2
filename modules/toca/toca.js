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
// Opciones por nivel (índice 0-4)
const NIVELES         = [3, 4, 5, 6, 8];
// Aciertos CONSECUTIVOS requeridos para subir de nivel
const ACIERTOS_POR_NIVEL = [3, 4, 5, 6, 8];

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

export function onEnter() { _abrirModalTemas(); }

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

  // El botón de tema solo dice 'Temas' — no hay label dinámico que restaurar

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
  window.removeEventListener('lang-change', _onLangChange);
  window.addEventListener('lang-change', _onLangChange);

  // Al regresar al módulo, siempre mostrar el modal de temas —
  // igual que al entrar por primera vez. La usuaria elige tema y
  // _seleccionarTema() arranca el juego. No llamar _nuevaRonda() aquí
  // porque dispara las instrucciones por debajo del modal abierto.
  _abrirModalTemas();
}

// ─── Render ───────────────────────────────────────────────────────────────────
function _render() {
  _el.style.cssText =
    'position:absolute;inset:0;display:flex;flex-direction:column;' +
    'overflow:hidden;background:transparent;padding:0;';

  _el.innerHTML = `
  <style>
    /* ── Header único: [Temas] [stats] ... en un solo renglón ── */
    #tc-header {
      flex-shrink:0; display:flex; align-items:center; gap:10px;
      padding:10px 14px; min-height:56px;
    }
    #tc-btn-tema {
      display:flex; align-items:center;
      min-height:44px; padding:8px 16px; border-radius:99px;
      background:rgba(0,229,176,0.12);
      border:1.5px solid rgba(0,229,176,0.35);
      color:#fff; font-family:inherit; font-weight:900; font-size:.95rem;
      cursor:pointer; transition:transform .12s, background .2s;
      flex-shrink:0;
    }
    #tc-btn-tema:active { transform:scale(.97); background:rgba(0,229,176,0.22); }
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
    /* ── Modal de temas — mosaico ── */
    #tc-modal-temas {
      position:fixed; inset:0; z-index:200;
      background:rgba(5,18,48,0.72); backdrop-filter:blur(6px);
      display:flex; align-items:flex-end; justify-content:center;
      opacity:0; pointer-events:none; transition:opacity .22s;
    }
    #tc-modal-temas.visible { opacity:1; pointer-events:all; }
    #tc-modal-box {
      width:100%; max-width:620px; max-height:88vh;
      background:#0d2249; border-radius:24px 24px 0 0;
      display:flex; flex-direction:column;
      transform:translateY(32px); transition:transform .28s cubic-bezier(.4,0,.2,1);
      overflow:hidden;
    }
    #tc-modal-temas.visible #tc-modal-box { transform:translateY(0); }
    #tc-modal-header { display:flex; align-items:center; justify-content:space-between; padding:18px 20px 14px; flex-shrink:0; }
    #tc-modal-titulo { font-size:1rem; font-weight:900; letter-spacing:.08em; text-transform:uppercase; color:#00e5b0; }
    #tc-modal-cerrar {
      width:36px; height:36px; border-radius:50%; border:none; cursor:pointer;
      background:rgba(255,255,255,0.10); color:#fff; font-size:1rem;
      display:flex; align-items:center; justify-content:center; transition:background .15s;
    }
    #tc-modal-cerrar:active { background:rgba(255,255,255,0.20); }
    #tc-modal-lista { flex:1; overflow-y:auto; padding:0 16px 24px; -webkit-overflow-scrolling:touch; }
    .tc-mosaico { display:grid; grid-template-columns:repeat(auto-fill,minmax(88px,1fr)); gap:10px; padding:4px 0; }
    .tc-mosaico-tile {
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:4px; padding:10px 6px 8px; border-radius:16px;
      border:2px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.06);
      cursor:pointer; transition:transform .12s, background .15s, border-color .15s; min-height:84px;
    }
    .tc-mosaico-tile:active { transform:scale(.93); }
    .tc-mosaico-tile.activo { background:rgba(255,255,255,0.12); border-color:#00e5b0; box-shadow:0 0 0 1px #00e5b044; }
    .tc-mosaico-emoji { font-size:2rem; line-height:1; pointer-events:none; }
    .tc-mosaico-label {
      font-size:.62rem; font-weight:800; text-align:center; color:rgba(255,255,255,0.75);
      line-height:1.2; pointer-events:none; max-width:80px;
      overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
    }
    .tc-mosaico-tile.activo .tc-mosaico-label { color:#fff; }
    .tc-tile-todas { grid-column:1/-1; flex-direction:row; justify-content:flex-start; gap:14px; padding:12px 18px; min-height:auto; }
    .tc-tile-todas .tc-mosaico-emoji { font-size:1.8rem; }
    .tc-tile-todas .tc-mosaico-label { font-size:.85rem; font-weight:900; max-width:none; -webkit-line-clamp:1; }
    .tc-mosaico-divisor { grid-column:1/-1; height:1px; background:rgba(255,255,255,0.12); margin:6px 0; }

    /* ── Vacío ── */
    #tc-vacio {
      display:none; flex:1; flex-direction:column;
      align-items:center; justify-content:center; gap:12px;
      color:rgba(255,255,255,.30); font-size:1rem; font-weight:700;
    }
  </style>

  <div id="tc-header">
    <button id="tc-btn-tema">Temas</button>
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
// ─── Modal de temas — mosaico ────────────────────────────────────────────────
const TC_TEMAS_PRIO = ['transportes','frutas','verduras','alimentos','animales'];

function _abrirModalTemas() {
  const lista = _el.querySelector('#tc-modal-lista');
  lista.innerHTML = '';

  const activoId = _tema?.id ?? null;
  const prio = [], resto = [];
  _temas.forEach(t => (TC_TEMAS_PRIO.includes(t.id) ? prio : resto).push(t));
  prio.sort((a,b) => TC_TEMAS_PRIO.indexOf(a.id) - TC_TEMAS_PRIO.indexOf(b.id));

  const grid = document.createElement('div');
  grid.className = 'tc-mosaico';

  const tileTodas = _tc_crearTile(null, '🌊', 'Todas las palabras', activoId === null);
  tileTodas.classList.add('tc-tile-todas');
  grid.appendChild(tileTodas);

  const sep1 = document.createElement('div'); sep1.className = 'tc-mosaico-divisor';
  grid.appendChild(sep1);

  prio.forEach(t => grid.appendChild(_tc_crearTile(t.id, t.emoji||'📚', t.label, t.id===activoId)));

  if (resto.length) {
    const sep2 = document.createElement('div'); sep2.className = 'tc-mosaico-divisor';
    grid.appendChild(sep2);
    resto.forEach(t => grid.appendChild(_tc_crearTile(t.id, t.emoji||'📚', t.label, t.id===activoId)));
  }

  lista.appendChild(grid);
  const box = _el.querySelector('#tc-modal-box'); if (box) box.scrollTop = 0;
  _el.querySelector('#tc-modal-temas').classList.add('visible');
}

function _tc_crearTile(id, emoji, label, activo) {
  const tile = document.createElement('button');
  tile.className = 'tc-mosaico-tile' + (activo ? ' activo' : '');
  tile.innerHTML = `<span class="tc-mosaico-emoji">${emoji}</span><span class="tc-mosaico-label">${label}</span>`;
  tile.addEventListener('click', () => { haptic(10); _seleccionarTema(id); });
  return tile;
}

function _cerrarModalTemas() {
  _el.querySelector('#tc-modal-temas')?.classList.remove('visible');
}

function _seleccionarTema(id) {
  _tema = id === null ? null : (_temas.find(t => t.id === id) || null);
  _cerrarModalTemas();
  // El botón solo dice 'Temas' — no hay label dinámico
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