/* modules/memorama/memorama.js — Marina 2
   Selector de tema estandarizado: pill en barra superior, bottom-sheet
   con agrupación Vocabulario / Lenguaje, igual que Toca, Sílabas y Simón.
   El resto de la lógica de juego (grid, flip, stack) no cambia.
*/

import { TTS }           from '../../core/tts.js';
import { lanzarConfeti, haptic, toast } from '../../core/ui.js';
import { Telemetry }     from '../../core/telemetry.js';

const TEMAS_URL  = './data/temas.json';
const PICTO_BASE = './assets/pictogramas/';
const AUDIO_BASE = './assets/audio/';
const PARES      = 24;

let _container  = null;
let _temas      = [];
let _temaActivo = null;
let _cartas     = [];
let _volteadas  = [];
let _bloqueado  = false;
let _pares      = 0;
let _lang       = 'es';
let _audioEl    = null;
let _pictos     = {};

const DIFICULTADES = [
  { id: 'facil',    label: '⭐',     pares: 6  },
  { id: 'medio',    label: '⭐⭐',   pares: 12 },
  { id: 'avanzado', label: '⭐⭐⭐', pares: 24 },
];
let _dificultad = DIFICULTADES[2];

const _q = sel => _container?.querySelector(sel);

// ─── API pública ──────────────────────────────────────────────────────────────
export async function init(container) {
  _container = container;
  _lang      = window._langActivo || 'es';
  _cartas = []; _volteadas = []; _pares = 0;

  try { const r = await fetch(TEMAS_URL); _temas = await r.json(); }
  catch (e) { console.error('[memorama]', e); _temas = []; }

  try {
    const r2  = await fetch('./data/pictos.json');
    const cat = await r2.json();
    _pictos   = Object.fromEntries(cat.map(e => [e.id, e]));
  } catch { console.warn('[memorama] pictos.json no disponible'); _pictos = {}; }

  if (window.innerWidth <= 375 && window.innerHeight < 700) _dificultad = DIFICULTADES[0];

  _renderShell();
  // Preseleccionar "Animales" como tema activo sin iniciar el juego todavía:
  // el modal se abrirá en onEnter() con Animales ya marcado como activo.
  _temaActivo = _temas.find(t => t.id === 'animales') || null;
  _renderListaTemas();
  window.addEventListener('lang-change', _onLangChange);
}

export function destroy() {
  window.removeEventListener('lang-change', _onLangChange);
  if (_audioEl) { _audioEl.pause(); _audioEl.src = ''; _audioEl = null; }
  TTS.stop();
  _cartas = []; _temaActivo = null; _container = null; _pictos = {};
}

export function onEnter() { if (!(_temaActivo && _cartas.length)) _mostrarModal(); }
export function onLeave() { if (_audioEl) _audioEl.pause(); TTS.stop(); }
export async function pause() { if (_audioEl) _audioEl.pause(); TTS.stop(); }

export async function resume(container) {
  _container = container;
  _lang      = window._langActivo || 'es';
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

    _renderGrid();

    _cartas.forEach((carta, idx) => {
      const el = _q(`[data-idx="${idx}"]`); if (!el) return;
      if (carta.encontrada) {
        el.classList.add('volteada', 'encontrada');
        el.style.animationDuration = '0s'; el.style.opacity = '0'; el.style.pointerEvents = 'none';
      } else if (carta.volteada) { el.classList.add('volteada'); }
    });

    _renderStack();
    _q('#mem-grid-wrap')?.classList.remove('oculto');
    _q('#mem-modal')?.classList.add('oculto');
    if (_pares === _dificultad.pares) setTimeout(() => lanzarConfeti({ count: 80, container: _q('#mem-wrap') }), 300);
  } else {
    _mostrarModal();
  }

  window.removeEventListener('lang-change', _onLangChange);
  window.addEventListener('lang-change', _onLangChange);
}

// ─── Shell ────────────────────────────────────────────────────────────────────
function _renderShell() {
  _container.style.cssText = 'position:absolute;inset:0;overflow:hidden;background:transparent;';

  _container.innerHTML = `
<style>
  #mem-wrap {
    display:flex; flex-direction:column;
    height:100%; overflow:hidden;
    background:transparent; position:relative;
  }

  /* ── Header único: [Temas] [dificultad] ... [reiniciar] ── */
  #mem-header {
    flex-shrink:0; display:flex; align-items:center;
    gap:10px; padding:10px 14px; min-height:56px;
  }
  #mem-btn-tema-top {
    display:flex; align-items:center;
    min-height:44px; padding:8px 16px; border-radius:99px;
    background:rgba(0,194,255,0.12);
    border:1.5px solid rgba(0,194,255,0.35);
    color:#fff; font-family:inherit; font-weight:900; font-size:.95rem;
    cursor:pointer; transition:transform .12s, background .2s; flex-shrink:0;
  }
  #mem-btn-tema-top:active { transform:scale(.97); background:rgba(0,194,255,0.22); }
  #mem-dificultad { display:flex; gap:5px; align-items:center; flex-shrink:0; }
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
    background:rgba(0,194,255,0.25); border-color:#00c2ff;
    box-shadow:0 0 0 2px rgba(0,194,255,0.20);
  }
  #mem-contador {
    font-size:.95rem; font-weight:900; color:rgba(255,255,255,0.70); white-space:nowrap;
  }
  #mem-contador strong { color:#fff; font-size:1.1rem; }
  #mem-btn-nuevo {
    width:44px; height:44px; border-radius:50%;
    border:1.5px solid rgba(255,255,255,0.25);
    background:#fff; color:#1a1a2e;
    font-size:1rem; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    transition:transform .15s; flex-shrink:0; margin-left:auto;
  }
  #mem-btn-nuevo:active { transform:scale(.88); }
  #mem-btn-nuevo img {
    width:22px; height:22px; object-fit:contain;
    filter:invert(1); pointer-events:none;
    transition:transform .15s cubic-bezier(.34,1.56,.64,1);
  }
  #mem-btn-nuevo:active img { transform:rotate(180deg); }

  /* ── Grid ── */
  #mem-grid-wrap {
    flex:1; min-height:0; padding:5px 8px 0; display:flex;
    opacity:1; transition:opacity 0.4s ease;
    transform:translateZ(0); isolation:isolate;
  }
  #mem-grid-wrap.oculto { opacity:0; pointer-events:none; }
  #mem-grid {
    width:100%; display:grid; gap:5px;
    grid-template-columns:repeat(12,1fr); grid-template-rows:repeat(4,1fr);
    transition:grid-template-columns .35s ease, grid-template-rows .35s ease;
  }

  /* Carta */
  .mem-celda { perspective:700px; min-height:0; }
  .mem-carta {
    width:100%; height:100%; position:relative; cursor:pointer;
    transform-style:preserve-3d;
    transition:transform .45s cubic-bezier(.4,.2,.2,1);
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
    background-image:var(--mem-dorso-url, url('assets/ui/dorso-avanzado.png'));
    background-size:auto; background-repeat:repeat; background-position:center;
    border:1.5px solid rgba(14,165,201,0.35);
  }
  .mem-frente {
    transform:rotateY(180deg); background:white;
    flex-direction:column; gap:2px; padding:3px;
    box-shadow:0 3px 12px rgba(0,0,0,.22);
  }
  .mem-frente img { width:100%; flex:1; min-height:0; object-fit:contain; pointer-events:none; }
  .mem-label {
    font-size:clamp(.42rem,.85vw,.68rem); font-weight:800;
    text-align:center; color:#1a1a2e; line-height:1;
    flex-shrink:0; pointer-events:none;
  }
  @keyframes mem-pop { from { opacity:0; transform:scale(.7) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .mem-celda { animation:mem-pop .32s cubic-bezier(.34,1.56,.64,1) both; }

  /* Stack */
  #mem-stack-wrap {
    flex-shrink:0; height:72px; padding:5px 8px;
    background:rgba(0,0,0,0.20); border-top:1px solid rgba(255,255,255,0.08);
    display:flex; align-items:center; gap:5px;
    overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling:touch;
    scrollbar-width:none;
  }
  #mem-stack-wrap::-webkit-scrollbar { display:none; }
  .mem-par-tile {
    flex-shrink:0; width:56px; height:56px; border-radius:10px; overflow:hidden;
    background:white; cursor:pointer;
    box-shadow:0 2px 8px rgba(0,0,0,0.3); transition:transform .12s;
    animation:mem-pop .3s cubic-bezier(.34,1.56,.64,1) both;
    display:flex; align-items:center; justify-content:center;
  }
  .mem-par-tile:active { transform:scale(.88); }
  .mem-par-tile img { width:100%; height:100%; object-fit:contain; padding:4px; pointer-events:none; }

  /* ── Modal de temas — bottom-sheet estándar ── */
  /* ── Modal de temas — mosaico ── */
  #mem-modal {
    position:absolute; inset:0; z-index:40;
    background:rgba(5,20,50,0.80);
    backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
    display:flex; align-items:flex-end; justify-content:center;
    opacity:1; transition:opacity .35s ease; pointer-events:auto;
  }
  #mem-modal.oculto { opacity:0; pointer-events:none; }
  .mem-modal-box {
    width:100%; max-width:620px; max-height:88vh;
    background:rgba(10,20,50,0.98); border-radius:24px 24px 0 0;
    display:flex; flex-direction:column;
    border-top:2px solid rgba(0,194,255,0.30);
    transform:translateY(20px);
    transition:transform .35s cubic-bezier(.34,1.1,.64,1), opacity .35s;
    overflow:hidden;
  }
  #mem-modal.oculto .mem-modal-box { transform:translateY(20px); opacity:0; }
  .mem-modal-header {
    display:flex; align-items:center; justify-content:space-between;
    padding:18px 20px 14px; flex-shrink:0;
  }
  .mem-modal-titulo { font-size:1rem; font-weight:900; letter-spacing:.08em; text-transform:uppercase; color:#00c2ff; }
  .mem-modal-cerrar {
    width:36px; height:36px; border-radius:50%; border:none; cursor:pointer;
    background:rgba(255,255,255,0.10); color:#fff; font-size:1rem;
    display:flex; align-items:center; justify-content:center; transition:background .15s;
  }
  .mem-modal-cerrar:active { background:rgba(255,255,255,0.20); }
  #mem-lista-temas { flex:1; overflow-y:auto; padding:0 16px 24px; -webkit-overflow-scrolling:touch; }
  .mem-mosaico { display:grid; grid-template-columns:repeat(auto-fill,minmax(88px,1fr)); gap:10px; padding:4px 0; }
  .mem-mosaico-tile {
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    gap:4px; padding:10px 6px 8px; border-radius:16px;
    border:2px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.06);
    cursor:pointer; transition:transform .12s, background .15s, border-color .15s; min-height:84px;
  }
  .mem-mosaico-tile:active { transform:scale(.93); }
  .mem-mosaico-tile.activo { background:rgba(255,255,255,0.12); border-color:#00c2ff; box-shadow:0 0 0 1px #00c2ff44; }
  .mem-mosaico-emoji { font-size:2rem; line-height:1; pointer-events:none; }
  .mem-mosaico-label {
    font-size:.62rem; font-weight:800; text-align:center; color:rgba(255,255,255,0.75);
    line-height:1.2; pointer-events:none; max-width:80px;
    overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
  }
  .mem-mosaico-tile.activo .mem-mosaico-label { color:#fff; }
  .mem-tile-todas { grid-column:1/-1; flex-direction:row; justify-content:flex-start; gap:14px; padding:12px 18px; min-height:auto; }
  .mem-tile-todas .mem-mosaico-emoji { font-size:1.8rem; }
  .mem-tile-todas .mem-mosaico-label { font-size:.85rem; font-weight:900; max-width:none; -webkit-line-clamp:1; }
  .mem-mosaico-divisor { grid-column:1/-1; height:1px; background:rgba(255,255,255,0.12); margin:6px 0; }

  /* Portrait / small screen */
  @media (max-width:600px) and (orientation:portrait) {
    #mem-header { padding:6px 10px; gap:7px; }
    .mem-dif-btn { padding:5px 8px; font-size:.78rem; }
    #mem-contador { font-size:.82rem; }
    #mem-btn-nuevo { width:32px; height:32px; }
    #mem-stack-wrap { height:60px; }
    .mem-par-tile { width:46px; height:46px; }
  }
  @media (max-width:375px) and (orientation:portrait) {
    #mem-header { padding:5px 8px; gap:5px; flex-wrap:wrap; }
    .mem-dif-btn { padding:4px 7px; font-size:.72rem; }
    .mem-dif-btn[data-dif="medio"], .mem-dif-btn[data-dif="avanzado"] { display:none !important; }
    #mem-stack-wrap { height:52px; }
    .mem-par-tile { width:40px; height:40px; }
  }
</style>

<div id="mem-wrap">
  <div id="mem-header">
    <button id="mem-btn-tema-top">Temas</button>
    <div id="mem-dificultad">
      ${DIFICULTADES.map(d => `
        <button class="mem-dif-btn${d.id === _dificultad.id ? ' activo' : ''}"
                data-dif="${d.id}" title="${d.pares} pares">
          ${d.label}
        </button>`).join('')}
    </div>
    <div id="mem-contador">
      <strong id="mem-pares-count">0</strong> / ${_dificultad.pares} pares
    </div>
    <button id="mem-btn-nuevo" title="Nueva partida">
      <img src="assets/ui/reiniciar.svg" alt="Nueva partida" aria-hidden="true">
    </button>
  </div>

  <div id="mem-grid-wrap" class="oculto">
    <div id="mem-grid"></div>
  </div>

  <div id="mem-stack-wrap"></div>

  <div id="mem-modal">
    <div class="mem-modal-box">
      <div class="mem-modal-header">
        <span class="mem-modal-titulo">Elige un tema</span>
        <button class="mem-modal-cerrar" id="mem-modal-cerrar" aria-label="Cerrar">✕</button>
      </div>
      <div id="mem-lista-temas"></div>
    </div>
  </div>
</div>`;

  _bindEvents();
}

// ─── Eventos ──────────────────────────────────────────────────────────────────
function _bindEvents() {
  _q('#mem-btn-tema-top').addEventListener('click', () => { haptic(8); _mostrarModal(); });
  _q('#mem-btn-nuevo').addEventListener('click', () => { haptic(10); if (_temaActivo) _iniciarJuego(); });
  _q('#mem-dificultad').addEventListener('click', e => {
    const btn = e.target.closest('.mem-dif-btn'); if (!btn) return;
    haptic(8);
    _dificultad = DIFICULTADES.find(d => d.id === btn.dataset.dif) || _dificultad;
    _q('#mem-dificultad').querySelectorAll('.mem-dif-btn').forEach(b =>
      b.classList.toggle('activo', b.dataset.dif === _dificultad.id));
    const c = _q('#mem-contador');
    if (c) c.innerHTML = `<strong id="mem-pares-count">0</strong> / ${_dificultad.pares} pares`;
    if (_temaActivo) _iniciarJuego();
  });
  _q('#mem-modal-cerrar').addEventListener('click', () => { if (_cartas.length) _cerrarModal(); });
  _q('#mem-modal').addEventListener('click', e => {
    if (e.target === _q('#mem-modal') && _cartas.length) _cerrarModal();
  });
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function _mostrarModal() {
  _q('#mem-grid-wrap')?.classList.add('oculto');
  const modal  = _q('#mem-modal'); if (modal) modal.classList.remove('oculto');
  const cerrar = _q('#mem-modal-cerrar'); if (cerrar) cerrar.style.display = _cartas.length ? '' : 'none';
}

function _cerrarModal() {
  _q('#mem-modal')?.classList.add('oculto');
  setTimeout(() => _q('#mem-grid-wrap')?.classList.remove('oculto'), 350);
}

// ─── Lista de temas ───────────────────────────────────────────────────────────
// ─── Modal de temas — mosaico ────────────────────────────────────────────────
const MEM_TEMAS_PRIO = ['transportes','frutas','verduras','alimentos','animales'];

function _renderListaTemas() {
  const lista = _q('#mem-lista-temas'); if (!lista) return;
  lista.innerHTML = '';
  const activoId = _temaActivo?.id ?? null;
  const prio = [], resto = [];
  _temas.forEach(t => (MEM_TEMAS_PRIO.includes(t.id) ? prio : resto).push(t));
  prio.sort((a,b) => MEM_TEMAS_PRIO.indexOf(a.id) - MEM_TEMAS_PRIO.indexOf(b.id));
  const grid = document.createElement('div');
  grid.className = 'mem-mosaico';
  const tileTodas = _mem_crearTile(null, '🌊', 'Todas las palabras', activoId === null);
  tileTodas.classList.add('mem-tile-todas');
  grid.appendChild(tileTodas);
  const sep1 = document.createElement('div'); sep1.className = 'mem-mosaico-divisor';
  grid.appendChild(sep1);
  prio.forEach(t => grid.appendChild(_mem_crearTile(t.id, t.emoji||'📚', t.label, t.id===activoId)));
  if (resto.length) {
    const sep2 = document.createElement('div'); sep2.className = 'mem-mosaico-divisor';
    grid.appendChild(sep2);
    resto.forEach(t => grid.appendChild(_mem_crearTile(t.id, t.emoji||'📚', t.label, t.id===activoId)));
  }
  lista.appendChild(grid);
}

function _mem_crearTile(id, emoji, label, activo) {
  const tema = id === null ? null : (_temas.find(t => t.id === id) || null);
  const tile = document.createElement('button');
  tile.className = 'mem-mosaico-tile' + (activo ? ' activo' : '');
  tile.innerHTML = `<span class="mem-mosaico-emoji">${emoji}</span><span class="mem-mosaico-label">${label}</span>`;
  tile.addEventListener('click', () => { haptic(8); _activarTema(tema); });
  return tile;
}

function _activarTema(tema) {
  _temaActivo = tema;
  // El botón solo dice 'Temas' — no hay label dinámico
  _cerrarModal();
  setTimeout(() => _iniciarJuego(), 360);
}

// ─── Juego ────────────────────────────────────────────────────────────────────
function _iniciarJuego() {
  if (!_temaActivo) return;
  _cartas = []; _volteadas = []; _bloqueado = false; _pares = 0;

  const _normalizarPalabra = (p) => {
    if (typeof p === 'number') {
      const entrada = _pictos[p]; if (!entrada) return null;
      return { picto: (entrada.ruta_img || '').replace('.png', ''), tts_es: entrada.es || '', tts_en: entrada.en || entrada.es || '' };
    }
    if (typeof p === 'string') return { picto: p, tts_es: p, tts_en: p };
    const ruta = (p.ruta_img || '').replace('.png', '');
    return { picto: ruta || p.es || String(p.picto_id || ''), tts_es: p.es || '', tts_en: p.en || p.es || '' };
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

  const dorsoMap = { facil: "url('assets/ui/dorso-basico.png')", medio: "url('assets/ui/dorso-intermedio.png')", avanzado: "url('assets/ui/dorso-avanzado.png')" };
  _container.style.setProperty('--mem-dorso-url', dorsoMap[_dificultad.id] || dorsoMap.avanzado);

  _renderGrid();
  _q('#mem-stack-wrap').innerHTML = '';
  const totalEl = _q('#mem-pares-count'); if (totalEl) totalEl.textContent = `0`;

  const gw = _q('#mem-grid-wrap');
  if (gw) { gw.classList.add('oculto'); requestAnimationFrame(() => requestAnimationFrame(() => gw.classList.remove('oculto'))); }

  Telemetry.track('memorama_tema_iniciado', { _modulo: 'memorama', tema: _temaActivo.id, pares: PARES });
}

function _renderGrid() {
  const grid = _q('#mem-grid'); if (!grid) return;
  grid.innerHTML = '';
  const total  = _cartas.length;
  const layout = { 12: { cols: 4, filas: 3 }, 24: { cols: 6, filas: 4 }, 48: { cols: 12, filas: 4 } }[total] || { cols: 12, filas: 4 };
  grid.style.gridTemplateColumns = `repeat(${layout.cols}, 1fr)`;
  grid.style.gridTemplateRows    = `repeat(${layout.filas}, 1fr)`;

  _cartas.forEach((carta, i) => {
    const celda = document.createElement('div');
    celda.className = 'mem-celda'; celda.style.animationDelay = (i * 0.018) + 's';
    const picto   = carta.palabra.picto || carta.palabra;
    const label   = (_lang === 'en' ? carta.palabra.tts_en : carta.palabra.tts_es) || '';
    const imgPath = `${PICTO_BASE}${picto}.png`;
    celda.innerHTML = `
      <div class="mem-carta" data-idx="${carta.idx}">
        <div class="mem-cara mem-dorso"></div>
        <div class="mem-cara mem-frente">
          <img src="${imgPath}" alt="${label}" loading="lazy">
          <span class="mem-label">${label}</span>
        </div>
      </div>`;
    celda.querySelector('.mem-carta').addEventListener('click', () => _voltear(carta));
    grid.appendChild(celda);
  });
}

function _voltear(carta) {
  if (_bloqueado || carta.volteada || carta.encontrada) return;
  haptic(8);
  carta.volteada = true;
  _q(`[data-idx="${carta.idx}"]`)?.classList.add('volteada');
  _volteadas.push(carta);

  if (_volteadas.length < 2) return;
  _bloqueado = true;
  const [a, b] = _volteadas;
  _volteadas = [];

  if (a.id === b.id) {
    _pares++;
    const countEl = _q('#mem-pares-count'); if (countEl) countEl.textContent = _pares;
    const tts = _lang === 'en' ? a.palabra.tts_en : a.palabra.tts_es;
    _reproducirAudio(a.palabra.picto, _lang, tts);
    setTimeout(() => {
      [a, b].forEach(c => { c.encontrada = true; _q(`[data-idx="${c.idx}"]`)?.classList.add('encontrada'); });
      _renderStack();
      _bloqueado = false;
      if (_pares === _dificultad.pares) _ganar();
    }, 500);
  } else {
    setTimeout(() => {
      [a, b].forEach(c => { c.volteada = false; _q(`[data-idx="${c.idx}"]`)?.classList.remove('volteada'); });
      _bloqueado = false;
    }, 1000);
  }
}

function _ganar() {
  lanzarConfeti({ count: 80, container: _q('#mem-wrap') });
  Telemetry.track('memorama_completado', { _modulo: 'memorama', tema: _temaActivo?.id, pares: _pares });
}

function _renderStack() {
  const wrap = _q('#mem-stack-wrap'); if (!wrap) return;
  const encontradas = _cartas.filter((c, i) => c.encontrada && i % 2 === 0);
  wrap.innerHTML = '';
  encontradas.forEach(carta => {
    const tile = document.createElement('div'); tile.className = 'mem-par-tile';
    const imgPath = `${PICTO_BASE}${carta.palabra.picto || carta.palabra}.png`;
    tile.innerHTML = `<img src="${imgPath}" alt="" loading="lazy">`;
    tile.addEventListener('click', () => {
      const tts = _lang === 'en' ? carta.palabra.tts_en : carta.palabra.tts_es;
      _reproducirAudio(carta.palabra.picto, _lang, tts);
    });
    wrap.appendChild(tile);
  });
}

function _reproducirAudio(picto, lang, textoFallback) {
  if (!_audioEl) { _audioEl = document.createElement('audio'); _audioEl.preload = 'none'; }
  TTS.stop(); _audioEl.pause(); _audioEl.onerror = null;
  let _usado = false;
  const _fallback = () => { if (_usado) return; _usado = true; TTS.speak(textoFallback, { lang: lang === 'en' ? 'en-US' : 'es-MX', rate: 0.9, pitch: 1.1 }); };
  _audioEl.onerror = _fallback;
  _audioEl.src = `${AUDIO_BASE}${lang === 'en' ? 'en' : 'es'}/${picto}.mp3`;
  _audioEl.play().catch(_fallback);
}

// ─── Cambio de idioma ─────────────────────────────────────────────────────────
function _onLangChange(e) {
  const cfg = e.detail?.langConfig; if (!cfg) return;
  _lang = (cfg.en && !cfg.es) ? 'en' : 'es';
  if (_cartas.length) _renderGrid();
}

// ─── Util ─────────────────────────────────────────────────────────────────────
function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}