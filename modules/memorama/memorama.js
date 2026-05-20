/* modules/memorama/memorama.js — Marina 2
   Portado directamente de Dótir 2 memorama.js.
   Estructura de layout idéntica a Dótir para garantizar
   que el stack-wrap no empuje al tablero.
*/

import { TTS } from '../../core/tts.js';
import { lanzarConfeti, haptic, toast } from '../../core/ui.js';
import { Telemetry } from '../../core/telemetry.js';

const TEMAS_URL = './data/memorama.json';
const PICTO_BASE = './assets/pictogramas/';
const AUDIO_BASE = './assets/audio/';
const PARES = 24;

let _container = null;
let _temas = [];
let _temaActivo = null;
let _cartas = [];
let _volteadas = [];
let _bloqueado = false;
let _pares = 0;
let _lang = 'es';
let _audioEl = null;
let _pictos = {};
const DIFICULTADES = [
  { id: 'facil', label: '⭐', pares: 6 },
  { id: 'medio', label: '⭐⭐', pares: 12 },
  { id: 'avanzado', label: '⭐⭐⭐', pares: 24 },
];
let _dificultad = DIFICULTADES[2];

const _q = sel => _container?.querySelector(sel);

// ─── API pública ──────────────────────────────────────────────────────────────
export async function init(container) {
  _container = container;
  _lang = window._langActivo || 'es';
  _cartas = []; _volteadas = []; _pares = 0;

  try {
    const res = await fetch(TEMAS_URL);
    _temas = await res.json();
  } catch (e) {
    console.error('[memorama]', e);
    _temas = [];
  }

  try {
    const res2 = await fetch('./data/pictos.json');
    const cat = await res2.json();
    _pictos = Object.fromEntries(cat.map(e => [e.id, e]));
  } catch {
    console.warn('[memorama] pictos.json no disponible');
    _pictos = {};
  }

  _renderShell();
  _renderListaTemas();
  _mostrarModal();
  window.addEventListener('lang-change', _onLangChange);
}

export function destroy() {
  window.removeEventListener('lang-change', _onLangChange);
  if (_audioEl) { _audioEl.pause(); _audioEl.src = ''; _audioEl = null; }
  TTS.stop();
  _cartas = []; _temaActivo = null; _container = null; _pictos = {};
}

export function onEnter() { }
export function onLeave() {
  if (_audioEl) _audioEl.pause();
  TTS.stop();
}

export async function pause() {
  if (_audioEl) _audioEl.pause();
  TTS.stop();
}

export async function resume(container) {
  _container = container;
  _lang = window._langActivo || 'es';
  _renderShell();
  _renderListaTemas();

  if (_temaActivo && _cartas.length) {
    // Restaurar header
    const emojiEl = _q('#mem-tema-emoji');
    const labelEl = _q('#mem-tema-label');
    const countEl = _q('#mem-pares-count');
    if (emojiEl) emojiEl.textContent = _temaActivo.emoji;
    if (labelEl) labelEl.textContent = _temaActivo.label;
    if (countEl) countEl.textContent = _pares;

    // Reconstruir grid con el estado actual
    _renderGrid();

    // Restaurar estado visual de cada carta
    _cartas.forEach((carta, idx) => {
      const el = _q(`[data-idx="${idx}"]`);
      if (!el) return;
      if (carta.encontrada) {
        el.classList.add('volteada');
        el.classList.add('encontrada');
        el.style.animationDuration = '0s'; // sin animación al restaurar
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
      } else if (carta.volteada) {
        el.classList.add('volteada');
      }
    });

    // Restaurar stack de pares encontrados
    _renderStack();

    // Mostrar grid, ocultar modal
    _q('#mem-grid-wrap')?.classList.remove('oculto');
    _q('#mem-modal')?.classList.add('oculto');

    // Si la partida estaba terminada, celebrar de nuevo
    if (_pares === _dificultad.pares) {
      setTimeout(() => lanzarConfeti({ count: 80, container: _q('#mem-wrap') }), 300);
    }
  } else {
    _mostrarModal();
  }

  window.removeEventListener('lang-change', _onLangChange);
  window.addEventListener('lang-change', _onLangChange);
}

// ─── Shell — estructura idéntica a Dótir ──────────────────────────────────────
function _renderShell() {
  _container.style.cssText = 'position:absolute;inset:0;overflow:hidden;background:transparent;';

  _container.innerHTML = `
<style>
  #mem-wrap {
    display:flex; flex-direction:column;
    height:100%; overflow:hidden;
    background:transparent; position:relative;
  }

  /* Header interno */
  #mem-header {
    flex-shrink:0; display:flex; align-items:center;
    gap:10px; padding:8px 14px;
  }
  #mem-btn-tema {
    display:flex; align-items:center; gap:7px;
    padding:7px 14px; border-radius:99px;
    border:1.5px solid rgba(255,255,255,0.25);
    background:rgba(255,255,255,0.12); color:#fff;
    font-family:inherit; font-weight:800; font-size:.95rem;
    cursor:pointer; transition:background .15s; white-space:nowrap;
  }
  #mem-dificultad {
    display:flex; gap:5px; align-items:center; flex-shrink:0;
  }
  .mem-dif-btn {
    padding:6px 10px; border-radius:99px;
    border:1.5px solid rgba(255,255,255,0.18);
    background:rgba(255,255,255,0.08); color:#fff;
    font-family:inherit; font-size:.85rem; font-weight:800;
    cursor:pointer; transition:background .15s, border-color .15s;
    white-space:nowrap;
  }
  .mem-dif-btn:active { background:rgba(255,255,255,.20); }
  .mem-dif-btn.activo {
    background:rgba(0,194,255,0.25);
    border-color:#00c2ff;
    box-shadow:0 0 0 2px rgba(0,194,255,0.20);
  }
  #mem-btn-tema:active { background:rgba(255,255,255,.20); }
  #mem-contador {
    flex:1; text-align:center;
    font-size:.95rem; font-weight:900; color:rgba(255,255,255,0.70);
  }
  #mem-contador strong { color:#fff; font-size:1.1rem; }
  #mem-btn-nuevo {
    width:38px; height:38px; border-radius:50%;
    border:1.5px solid rgba(255,255,255,0.25);
    background:rgba(255,255,255,0.12); color:#fff;
    font-size:1rem; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    transition:transform .15s; flex-shrink:0;
  }
  #mem-btn-nuevo:active { transform:scale(.88) rotate(180deg); }

  /* Grid — igual que Dótir */
  #mem-grid-wrap {
    flex:1; min-height:0;
    padding:5px 8px 0;
    display:flex;
    opacity:1; transition:opacity 0.4s ease;
  }
  #mem-grid-wrap.oculto { opacity:0; pointer-events:none; }
  #mem-grid {
    width:100%;
    display:grid;
    gap:5px;
    grid-template-columns:repeat(12, 1fr);
    grid-template-rows:repeat(4, 1fr);
    transition:grid-template-columns .35s ease, grid-template-rows .35s ease;
  }

  /* Carta — igual que Dótir */
  .mem-celda { perspective:700px; min-height:0; }
  .mem-carta {
    width:100%; height:100%; position:relative;
    cursor:pointer; transform-style:preserve-3d;
    transition:transform .45s cubic-bezier(.4,.2,.2,1);
    will-change:transform, opacity;
  }
  .mem-carta.volteada  { transform:rotateY(180deg); }
  .mem-carta.encontrada {
    animation:mem-desaparecer 0.5s cubic-bezier(.55,.06,.68,.19) forwards;
    pointer-events:none;
  }
  @keyframes mem-desaparecer {
    0%   { opacity:1; transform:rotateY(180deg) scale(1); }
    40%  { opacity:1; transform:rotateY(180deg) scale(1.08) translateY(-4px); }
    100% { opacity:0; transform:rotateY(180deg) scale(0); }
  }
  .mem-cara {
    position:absolute; inset:0; border-radius:9px;
    backface-visibility:hidden; -webkit-backface-visibility:hidden;
    overflow:hidden; display:flex; align-items:center; justify-content:center;
  }
  .mem-dorso {
    background-image:url('assets/ui/dorso-memorama.png');
    background-size:cover; background-position:center;
    border:1.5px solid rgba(14,165,201,0.35);
  }
  .mem-frente {
    transform:rotateY(180deg); background:white;
    flex-direction:column; gap:2px; padding:3px;
    box-shadow:0 3px 12px rgba(0,0,0,.22);
  }
  .mem-frente img {
    width:100%; flex:1; min-height:0;
    object-fit:contain; pointer-events:none;
  }
  .mem-label {
    font-size:clamp(.42rem,.85vw,.68rem); font-weight:800;
    text-align:center; color:#1a1a2e; line-height:1;
    flex-shrink:0; pointer-events:none;
  }

  @keyframes mem-pop {
    from { opacity:0; transform:scale(.7) translateY(8px); }
    to   { opacity:1; transform:scale(1) translateY(0); }
  }
  .mem-celda { animation:mem-pop .32s cubic-bezier(.34,1.56,.64,1) both; }

  /* Stack — idéntico a Dótir */
  #mem-stack-wrap {
    flex-shrink:0; height:72px;
    padding:5px 8px;
    background:rgba(0,0,0,0.20);
    border-top:1px solid rgba(255,255,255,0.08);
    display:flex; align-items:center; gap:5px;
    overflow-x:auto; overflow-y:hidden;
    -webkit-overflow-scrolling:touch;
    scrollbar-width:none;
  }
  #mem-stack-wrap::-webkit-scrollbar { display:none; }

  .mem-par-tile {
    flex-shrink:0; width:56px; height:56px;
    border-radius:10px; overflow:hidden;
    background:white; cursor:pointer;
    box-shadow:0 2px 8px rgba(0,0,0,0.3);
    transition:transform .12s;
    animation:mem-pop .3s cubic-bezier(.34,1.56,.64,1) both;
    display:flex; align-items:center; justify-content:center;
  }
  .mem-par-tile:active { transform:scale(.88); }
  .mem-par-tile img {
    width:100%; height:100%; object-fit:contain;
    padding:4px; pointer-events:none;
  }

  /* Modal — position:absolute dentro de #mem-wrap como Dótir */
  #mem-modal {
    position:absolute; inset:0; z-index:40;
    background:rgba(2,20,50,0.85);
    backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
    display:flex; align-items:center; justify-content:center;
    opacity:1; transition:opacity .35s ease;
    pointer-events:auto;
  }
  #mem-modal.oculto { opacity:0; pointer-events:none; }
  .mem-modal-box {
    background:rgba(13,40,70,0.97);
    border:1.5px solid rgba(255,255,255,0.20);
    border-radius:28px; padding:24px;
    width:88%; max-width:640px;
    max-height:80vh; overflow-y:auto;
    -webkit-overflow-scrolling:touch;
    transform:translateY(0);
    transition:transform .35s cubic-bezier(.34,1.1,.64,1), opacity .35s;
  }
  #mem-modal.oculto .mem-modal-box { transform:translateY(20px); opacity:0; }
  .mem-modal-header {
    display:flex; align-items:center; justify-content:space-between;
    margin-bottom:18px;
  }
  .mem-modal-titulo {
    font-family:'Outfit',sans-serif; font-size:1.3rem; font-weight:900; color:#fff;
  }
  .mem-modal-cerrar {
    width:36px; height:36px; border-radius:50%; border:none;
    background:rgba(255,255,255,0.12); color:#fff; font-size:1.2rem;
    cursor:pointer; display:flex; align-items:center; justify-content:center;
  }
  .mem-grupo-label {
    font-size:.72rem; font-weight:900; letter-spacing:.10em;
    text-transform:uppercase; color:rgba(255,255,255,0.50); margin:12px 0 8px;
  }
  .mem-grupo-label:first-child { margin-top:0; }
  .mem-temas-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:4px; }
  .mem-tema-btn {
    display:flex; flex-direction:column; align-items:center; gap:6px;
    padding:14px 8px; border-radius:18px;
    border:1.5px solid rgba(255,255,255,0.15);
    background:rgba(255,255,255,0.08); color:#fff;
    font-family:inherit; font-weight:800; font-size:.88rem;
    cursor:pointer; transition:all .18s; text-align:center;
  }
  .mem-tema-btn:active { transform:scale(.93); }
  .mem-tema-btn.activo {
    background:rgba(0,194,255,0.20); border-color:#00c2ff;
    box-shadow:0 0 0 2px rgba(0,194,255,0.25);
  }
  .mem-tema-btn-emoji { font-size:1.8rem; }
</style>

<div id="mem-wrap">
  <div id="mem-header">
    <button id="mem-btn-tema">
      <span id="mem-tema-emoji">🃏</span>
      <span id="mem-tema-label">Elegir tema</span>
    </button>
    <div id="mem-dificultad">
      ${DIFICULTADES.map(d => `
        <button class="mem-dif-btn${d.id === _dificultad.id ? ' activo' : ''}"
                data-dif="${d.id}"
                title="${d.pares} pares">
          ${d.label}
        </button>`).join('')}
    </div>
    <div id="mem-contador">
      <strong id="mem-pares-count">0</strong> / ${PARES} pares
    </div>
    <button id="mem-btn-nuevo" title="Nueva partida">🔄</button>
  </div>

  <div id="mem-grid-wrap" class="oculto">
    <div id="mem-grid"></div>
  </div>

  <div id="mem-stack-wrap"></div>

  <div id="mem-modal">
    <div class="mem-modal-box">
      <div class="mem-modal-header">
        <span class="mem-modal-titulo">Elegir tema</span>
        <button class="mem-modal-cerrar" id="mem-modal-cerrar">×</button>
      </div>
      <div id="mem-lista-temas"></div>
    </div>
  </div>
</div>`;

  _bindEvents();
}

// ─── Eventos ──────────────────────────────────────────────────────────────────
function _bindEvents() {
  _q('#mem-btn-tema').addEventListener('click', () => {
    haptic(8); _mostrarModal();
  });
  _q('#mem-btn-nuevo').addEventListener('click', () => {
    haptic(10); if (_temaActivo) _iniciarJuego();
  });
  _q('#mem-dificultad').addEventListener('click', e => {
    const btn = e.target.closest('.mem-dif-btn');
    if (!btn) return;
    haptic(8);
    _dificultad = DIFICULTADES.find(d => d.id === btn.dataset.dif) || _dificultad;
    _q('#mem-dificultad').querySelectorAll('.mem-dif-btn').forEach(b =>
      b.classList.toggle('activo', b.dataset.dif === _dificultad.id)
    );
    _q('#mem-pares-count').textContent = '0';
    if (_temaActivo) _iniciarJuego();
  });
  _q('#mem-modal-cerrar').addEventListener('click', () => {
    if (_cartas.length) _cerrarModal();
  });
  _q('#mem-modal').addEventListener('click', e => {
    if (e.target === _q('#mem-modal') && _cartas.length) _cerrarModal();
  });
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function _mostrarModal() {
  _q('#mem-grid-wrap')?.classList.add('oculto');
  const modal = _q('#mem-modal');
  if (modal) modal.classList.remove('oculto');
  // Ocultar cerrar si no hay partida activa
  const cerrar = _q('#mem-modal-cerrar');
  if (cerrar) cerrar.style.display = _cartas.length ? '' : 'none';
}

function _cerrarModal() {
  _q('#mem-modal')?.classList.add('oculto');
  setTimeout(() => _q('#mem-grid-wrap')?.classList.remove('oculto'), 350);
}

// ─── Lista de temas ───────────────────────────────────────────────────────────
function _renderListaTemas() {
  const lista = _q('#mem-lista-temas');
  if (!lista) return;
  lista.innerHTML = '';

  const grupos = {};
  _temas.forEach(t => {
    const tipo = t.tipo === 'lenguaje' ? 'Temarios de lenguaje' : 'Categorías de vocabulario';
    if (!grupos[tipo]) grupos[tipo] = [];
    grupos[tipo].push(t);
  });

  Object.entries(grupos).forEach(([grupo, temas]) => {
    const lbl = document.createElement('div');
    lbl.className = 'mem-grupo-label';
    lbl.textContent = grupo;
    lista.appendChild(lbl);

    const grid = document.createElement('div');
    grid.className = 'mem-temas-grid';
    temas.forEach(tema => {
      const btn = document.createElement('button');
      btn.className = 'mem-tema-btn' + (tema.id === _temaActivo?.id ? ' activo' : '');
      btn.innerHTML = `<span class="mem-tema-btn-emoji">${tema.emoji}</span>${tema.label}`;
      btn.addEventListener('click', () => {
        haptic(8);
        _lista.querySelectorAll?.('.mem-tema-btn').forEach(b => b.classList.remove('activo'));
        btn.classList.add('activo');
        _activarTema(tema);
      });
      grid.appendChild(btn);
    });
    lista.appendChild(grid);
  });
}

const _lista = { querySelectorAll: sel => _q('#mem-lista-temas')?.querySelectorAll(sel) };

function _activarTema(tema) {
  _temaActivo = tema;
  _q('#mem-tema-emoji').textContent = tema.emoji;
  _q('#mem-tema-label').textContent = tema.label;
  _cerrarModal();
  setTimeout(() => _iniciarJuego(), 360);
}

// ─── Juego ────────────────────────────────────────────────────────────────────
function _iniciarJuego() {
  if (!_temaActivo) return;
  _cartas = []; _volteadas = [];
  _bloqueado = false; _pares = 0;

  // Normalizar — palabras puede ser strings (legacy) u objetos {picto_id, es, en, tts_es, tts_en}
  const _normalizarPalabra = (p) => {
    // Nueva estructura: p es un ID numérico → resolver contra pictos.json
    if (typeof p === 'number') {
      const entrada = _pictos[p];
      if (!entrada) return null;
      return {
        picto: (entrada.ruta_img || '').replace('.png', ''),
        tts_es: entrada.es || '',
        tts_en: entrada.en || entrada.es || '',
      };
    }
    // Legacy: string directo
    if (typeof p === 'string') return { picto: p, tts_es: p, tts_en: p };
    // Legacy: objeto inline
    const ruta = (p.ruta_img || '').replace('.png', '');
    return {
      picto: ruta || p.es || String(p.picto_id || ''),
      tts_es: p.es || '',
      tts_en: p.en || p.es || '',
    };
  };

  const palabras = _shuffle([..._temaActivo.palabras])
    .slice(0, _dificultad.pares)
    .map(_normalizarPalabra)
    .filter(Boolean);

  _cartas = _shuffle(
    palabras.flatMap((palabra, i) => [
      { id: i, palabra, volteada: false, encontrada: false },
      { id: i, palabra, volteada: false, encontrada: false },
    ])
  ).map((c, idx) => ({ ...c, idx }));

  _renderGrid();
  _q('#mem-stack-wrap').innerHTML = '';
  const totalEl = _q('#mem-pares-count');
  if (totalEl) totalEl.textContent = `0 / ${_dificultad.pares}`;

  const gw = _q('#mem-grid-wrap');
  if (gw) {
    gw.classList.add('oculto');
    requestAnimationFrame(() => requestAnimationFrame(() => gw.classList.remove('oculto')));
  }

  Telemetry.track('memorama_tema_iniciado', { _modulo: 'memorama', tema: _temaActivo.id, pares: PARES });
}

function _renderGrid() {
  const grid = _q('#mem-grid');
  if (!grid) return;
  grid.innerHTML = '';

  // Layout dinámico según número de cartas totales
  const total = _cartas.length;
  const layout = {
    12: { cols: 4, filas: 3 },  // fácil: 6 pares × 2
    24: { cols: 6, filas: 4 },  // intermedio: 12 pares × 2
    48: { cols: 12, filas: 4 },  // avanzado: 24 pares × 2
  }[total] || { cols: 12, filas: 4 };

  grid.style.gridTemplateColumns = `repeat(${layout.cols}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${layout.filas}, 1fr)`;

  _cartas.forEach((carta, i) => {
    const celda = document.createElement('div');
    celda.className = 'mem-celda';
    celda.style.animationDelay = (i * 0.018) + 's';
    const picto = carta.palabra.picto || carta.palabra;
    const label = (_lang === 'en' ? carta.palabra.tts_en : carta.palabra.tts_es) || carta.palabra;
    celda.innerHTML = `
      <div class="mem-carta" data-idx="${i}">
        <div class="mem-cara mem-dorso"></div>
        <div class="mem-cara mem-frente">
          <img src="${PICTO_BASE}${picto}.png"
               alt="${label}"
               onerror="this.style.opacity='.15'">
          <span class="mem-label">${label}</span>
        </div>
      </div>`;
    celda.querySelector('.mem-carta').addEventListener('click', () => _voltear(i));
    grid.appendChild(celda);
  });
}

function _voltear(idx) {
  const carta = _cartas[idx];
  if (_bloqueado || carta.volteada || carta.encontrada) return;
  haptic(8);
  carta.volteada = true;
  _q(`[data-idx="${idx}"]`).classList.add('volteada');
  _volteadas.push(idx);

  // Reproducir nombre al voltear
  _reproducirNombre(carta.palabra);

  if (_volteadas.length < 2) return;
  _bloqueado = true;

  const [a, b] = _volteadas;
  if (_cartas[a].id === _cartas[b].id) {
    // Par encontrado
    setTimeout(() => {
      _tonoVictoria();
      _cartas[a].encontrada = _cartas[b].encontrada = true;
      _q(`[data-idx="${a}"]`).classList.add('encontrada');
      _q(`[data-idx="${b}"]`).classList.add('encontrada');
      _pares++;
      const el = _q('#mem-pares-count');
      if (el) el.textContent = `${_pares} / ${_dificultad.pares}`;
      _volteadas = []; _bloqueado = false;
      _agregarStack(_cartas[a].palabra);

      Telemetry.track('memorama_par_encontrado', { _modulo: 'memorama', tema: _temaActivo.id, palabra: _cartas[a].palabra });
      if (_pares === _dificultad.pares) setTimeout(_victoria, 600);
    }, 350);
  } else {
    // No es par
    setTimeout(() => {
      _q(`[data-idx="${a}"]`).classList.remove('volteada');
      _q(`[data-idx="${b}"]`).classList.remove('volteada');
      _cartas[a].volteada = _cartas[b].volteada = false;
      _volteadas = []; _bloqueado = false;
    }, 900);
  }
}

// ─── Stack ────────────────────────────────────────────────────────────────────
function _agregarStack(palabra) {
  const stack = _q('#mem-stack-wrap');
  if (!stack) return;
  const picto = (typeof palabra === 'object') ? (palabra.picto || palabra.es || '') : palabra;
  const tile = document.createElement('div');
  tile.className = 'mem-par-tile';
  const img = document.createElement('img');
  img.src = `${PICTO_BASE}${picto}.png`;
  img.alt = picto;
  img.onerror = () => { img.style.opacity = '.15'; };
  tile.appendChild(img);
  tile.addEventListener('click', () => { haptic(6); _reproducirNombre(palabra); });
  stack.appendChild(tile);
  requestAnimationFrame(() => { stack.scrollLeft = stack.scrollWidth; });
}

function _renderStack() {
  const stack = _q('#mem-stack-wrap');
  if (!stack) return;
  stack.innerHTML = '';
  const vistas = new Set();
  _cartas.forEach(c => {
    if (c.encontrada && !vistas.has(c.palabra)) {
      vistas.add(c.palabra);
      _agregarStack(c.palabra);
    }
  });
}

// ─── Victoria ─────────────────────────────────────────────────────────────────
function _victoria() {
  lanzarConfeti({ count: 120, container: _q('#mem-wrap') });
  toast('¡Encontraste todos los pares! 🎉', { duracion: 4000 });
  TTS.speak('¡Muy bien!', { lang: 'es-MX', pitch: 1.3, rate: .9 });
  Telemetry.track('memorama_completado', { _modulo: 'memorama', tema: _temaActivo?.id });
}

// ─── Audio ────────────────────────────────────────────────────────────────────
function _reproducirNombre(palabra) {
  if (!_audioEl) { _audioEl = document.createElement('audio'); _audioEl.preload = 'auto'; }
  _audioEl.pause();

  const audioLang = window.getLang?.() || 'es';
  const picto = (typeof palabra === 'object') ? (palabra.picto || palabra.es || '') : palabra;
  const ttsTexto = (typeof palabra === 'object')
    ? (audioLang === 'en' ? (palabra.tts_en || picto) : (palabra.tts_es || picto))
    : palabra;

  let _used = false;
  const _fb = () => {
    if (_used) return; _used = true;
    TTS.speak(ttsTexto, { lang: audioLang === 'en' ? 'en-US' : 'es-MX', rate: 0.90, pitch: 1.15 });
  };
  _audioEl.onerror = _fb;
  // El archivo MP3 siempre está en es/ con el nombre normalizado
  // (el audio en inglés pronuncia la palabra en inglés pero el archivo se llama igual)
  _audioEl.src = `${AUDIO_BASE}${audioLang}/${picto}.mp3`;
  _audioEl.play().catch(_fb);
}

function _tonoVictoria() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = 'sine';
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
      gain.gain.linearRampToValueAtTime(0, t + 0.18);
      osc.start(t); osc.stop(t + 0.20);
    });
  } catch { }
}

function _onLangChange(e) {
  const l = e.detail?.lang;
  if (!l || l === _lang) return;
  _lang = l;
}

function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}