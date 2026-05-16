/* modules/memorama/memorama.js — Marina 2
   Grid 4x12, 24 pares, victoria con confeti + toast.
*/

import { TTS }                          from '../../core/tts.js';
import { lanzarConfeti, haptic, toast } from '../../core/ui.js';
import { Telemetry }                    from '../../core/telemetry.js';

const AUDIO_URL = (palabra, lang = 'es') => `assets/audio/${lang}/${palabra}.mp3`;
const PICTO_URL = (palabra)              => `assets/pictogramas/es/${palabra}.png`;
const PARES     = 24;
const FLIP_MS   = 1000;

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
  } catch {}
}

// ─── Estado ───────────────────────────────────────────────────────────────────
let _el           = null;
let _temas        = [];
let _temaActivo   = null;
let _cartas       = [];
let _voltadas     = [];
let _descubiertas = new Set();
let _bloqueado    = false;
let _audioEl      = null;
let _lang         = 'es';

// ─── API pública ──────────────────────────────────────────────────────────────
export async function init(container) {
  _el   = container;
  _lang = window._langActivo || 'es';
  _resetEstado();
  try {
    const res = await fetch('./data/memorama.json');
    _temas = await res.json();
  } catch (e) {
    console.error('[memorama] No se pudo cargar memorama.json', e);
    _temas = [];
  }
  _render();
  window.addEventListener('lang-change', _onLangChange);
  if (_temas.length) _iniciarTema(_temas[0]);
}

export function destroy() {
  window.removeEventListener('lang-change', _onLangChange);
  if (_audioEl) { _audioEl.pause(); _audioEl.src = ''; _audioEl = null; }
  TTS.stop();
  _el = null; _temas = []; _cartas = [];
}

export function onEnter() {}
export function onLeave() { if (_audioEl) _audioEl.pause(); TTS.stop(); }

export async function pause() {
  if (_audioEl) _audioEl.pause();
  TTS.stop();
}

export async function resume(container) {
  _el = container;
  _lang = window._langActivo || 'es';
  _render();
  if (_temaActivo) {
    _el.querySelector('#mm-tema-emoji').textContent = _temaActivo.emoji;
    _el.querySelector('#mm-tema-label').textContent = _temaActivo.label;
    _actualizarContador();
    _dibujarTablero();
    _actualizarTira();
    _renderModalTemas();
    [..._descubiertas].forEach(i => {
      const el = _el.querySelector(`.mm-carta[data-idx="${i}"]`);
      if (el) {
        el.classList.add('encontrada');
        el.style.animationDuration = '0s'; // sin animación al restaurar
      }
    });
    if (_descubiertas.size === _cartas.length && _cartas.length > 0) {
      setTimeout(() => lanzarConfeti({ count: 120, container: _el }), 300);
    }
  }
  window.removeEventListener('lang-change', _onLangChange);
  window.addEventListener('lang-change', _onLangChange);
}

function _resetEstado() {
  _cartas = []; _voltadas = []; _descubiertas = new Set(); _bloqueado = false;
}

// ─── Shell ────────────────────────────────────────────────────────────────────
function _render() {
  _el.style.cssText =
    'position:absolute;inset:0;overflow:hidden;background:transparent;isolation:isolate;';

  _el.innerHTML = `
<style>
  #mm-wrap {
    display:flex; flex-direction:column;
    height:100%; overflow:hidden;
    background:transparent; position:relative;
  }
  #mm-header {
    flex-shrink:0;
    display:flex; align-items:center; gap:12px; padding:10px 16px 8px;
  }
  #mm-btn-tema {
    display:flex; align-items:center; gap:8px; padding:8px 16px;
    border-radius:99px; border:1.5px solid rgba(255,255,255,0.25);
    background:rgba(255,255,255,0.12); color:#fff;
    font-family:inherit; font-weight:800; font-size:1rem;
    cursor:pointer; transition:background .15s, transform .12s; white-space:nowrap;
  }
  #mm-btn-tema:active { transform:scale(.94); }
  #mm-contador { flex:1; text-align:center; font-size:1rem; font-weight:900; color:rgba(255,255,255,0.70); }
  #mm-contador strong { color:#fff; font-size:1.2rem; }
  #mm-btn-reiniciar {
    width:40px; height:40px; border-radius:50%;
    border:1.5px solid rgba(255,255,255,0.25);
    background:rgba(255,255,255,0.12); color:#fff; font-size:1.1rem;
    cursor:pointer; display:flex; align-items:center; justify-content:center;
    transition:background .15s, transform .15s; flex-shrink:0;
  }
  #mm-btn-reiniciar:active { transform:scale(.88) rotate(180deg); }

  #mm-tablero-wrap {
    flex:1; min-height:0;
    padding:5px 10px 0;
    display:flex;
    opacity:1; transition:opacity 0.35s ease;
  }
  #mm-tablero-wrap.oculto { opacity:0; }
  #mm-tablero {
    width:100%;
    display:grid;
    grid-template-columns:repeat(12, 1fr);
    grid-template-rows:repeat(4, 1fr);
    gap:5px;
  }

  .mm-carta {
    position:relative; cursor:pointer; border-radius:9px;
    overflow:hidden; transition:transform .15s ease;
  }
  .mm-carta:active { transform:scale(.93); }
  .mm-carta.descubierta { cursor:default; pointer-events:none; }

  .mm-carta-inner {
    position:relative; width:100%; height:100%;
    transform-style:preserve-3d;
    transition:transform .35s cubic-bezier(.4,0,.2,1);
  }
  .mm-carta.volteada .mm-carta-inner { transform:rotateY(180deg); }

  .mm-carta-frente, .mm-carta-dorso {
    position:absolute; inset:0;
    backface-visibility:hidden; -webkit-backface-visibility:hidden;
    border-radius:9px; display:flex; flex-direction:column;
    align-items:center; justify-content:center;
  }
  .mm-carta-dorso {
    background-image:url('assets/ui/dorso-memorama.png');
    background-size:cover; background-position:center;
    border:1.5px solid rgba(14,165,201,0.30);
  }
  .mm-carta-frente {
    background:#fff; transform:rotateY(180deg);
    border:2px solid transparent; gap:3px; padding:3px;
  }
  .mm-carta.descubierta .mm-carta-frente {
    border-color:#22c55e; box-shadow:0 0 0 2px rgba(34,197,94,0.35);
  }
  .mm-carta-frente img { width:68%; height:54%; object-fit:contain; }
  .mm-carta-frente span {
    font-size:clamp(.45rem, 1.2vw, .75rem); font-weight:800; color:#07212e;
    text-align:center; line-height:1.1; word-break:break-word; padding:0 2px;
  }

  #mm-tira-wrap {
    flex-shrink:0; height:76px;
    padding:4px 12px 8px;
    overflow-x:auto; overflow-y:hidden; scrollbar-width:none;
    -webkit-overflow-scrolling:touch;
    display:flex; align-items:center; gap:8px;
    background:rgba(0,0,0,0.25); border-top:1px solid rgba(255,255,255,0.08);
  }
  #mm-tira-wrap::-webkit-scrollbar { display:none; }
  #mm-tira-placeholder {
    color:rgba(255,255,255,0.30); font-size:.85rem; font-weight:600;
    font-style:italic; white-space:nowrap; width:100%; text-align:center;
  }
  .mm-par-descubierto {
    flex-shrink:0; width:50px; height:50px; border-radius:11px;
    background:#fff; border:2px solid rgba(34,197,94,0.50);
    cursor:pointer; transition:transform .12s; overflow:hidden; padding:3px;
    display:flex; align-items:center; justify-content:center;
  }
  .mm-par-descubierto:active { transform:scale(.90); }
  .mm-par-descubierto img { width:100%; height:100%; object-fit:contain; }

  #mm-modal {
    position:fixed; inset:0; background:rgba(2,20,50,0.85);
    display:none; align-items:center; justify-content:center;
    z-index:9000; backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
  }
  #mm-modal.visible { display:flex; }
  .mm-modal-box {
    background:rgba(13,40,70,0.97); border:1.5px solid rgba(255,255,255,0.20);
    border-radius:28px; padding:24px; width:88%; max-width:640px;
    max-height:85vh; overflow-y:auto; -webkit-overflow-scrolling:touch;
  }
  .mm-modal-header {
    display:flex; align-items:center; justify-content:space-between; margin-bottom:18px;
  }
  .mm-modal-titulo {
    font-family:'Outfit',sans-serif; font-size:1.3rem; font-weight:900; color:#fff;
  }
  .mm-modal-cerrar {
    width:36px; height:36px; border-radius:50%; border:none;
    background:rgba(255,255,255,0.12); color:#fff; font-size:1.2rem; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
  }
  .mm-grupo-label {
    font-size:.72rem; font-weight:900; letter-spacing:.10em;
    text-transform:uppercase; color:rgba(255,255,255,0.50); margin:12px 0 8px;
  }
  .mm-grupo-label:first-child { margin-top:0; }
  .mm-temas-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:4px; }
  .mm-tema-btn {
    display:flex; flex-direction:column; align-items:center; gap:6px;
    padding:14px 8px; border-radius:18px; border:1.5px solid rgba(255,255,255,0.15);
    background:rgba(255,255,255,0.08); color:#fff;
    font-family:inherit; font-weight:800; font-size:.88rem;
    cursor:pointer; transition:all .18s; text-align:center;
  }
  .mm-tema-btn:active { transform:scale(.93); }
  .mm-tema-btn.activo {
    background:rgba(0,194,255,0.20); border-color:#00c2ff;
    box-shadow:0 0 0 2px rgba(0,194,255,0.25);
  }
  .mm-tema-btn-emoji { font-size:1.8rem; }

  @keyframes mm-pop {
    from { transform:scale(0.7); opacity:0; }
    to   { transform:scale(1);   opacity:1; }
  }
  @keyframes mm-desaparecer {
    0%   { opacity:1; transform:rotateY(180deg) scale(1); }
    40%  { opacity:1; transform:rotateY(180deg) scale(1.08) translateY(-4px); }
    100% { opacity:0; transform:rotateY(180deg) scale(0); }
  }
  .mm-carta.encontrada {
    animation:mm-desaparecer 0.5s cubic-bezier(.55,.06,.68,.19) forwards;
    pointer-events:none;
  }
</style>

<div id="mm-wrap">
  <div id="mm-header">
    <button id="mm-btn-tema">
      <span id="mm-tema-emoji">🃏</span>
      <span id="mm-tema-label">Elegir tema</span>
    </button>
    <div id="mm-contador">
      <strong id="mm-pares-count">0</strong> / ${PARES} pares
    </div>
    <button id="mm-btn-reiniciar" title="Reiniciar">🔄</button>
  </div>

  <div id="mm-tablero-wrap">
    <div id="mm-tablero"></div>
  </div>

  <div id="mm-tira-wrap">
    <span id="mm-tira-placeholder">Los pares que encuentres aparecerán aquí…</span>
  </div>
</div>

<div id="mm-modal">
  <div class="mm-modal-box">
    <div class="mm-modal-header">
      <span class="mm-modal-titulo">Elegir tema</span>
      <button class="mm-modal-cerrar" id="mm-modal-cerrar">×</button>
    </div>
    <div id="mm-temas-lista"></div>
  </div>
</div>`;

  _bindEvents();
  _renderModalTemas();
}

// ─── Iniciar tema ─────────────────────────────────────────────────────────────
function _iniciarTema(tema) {
  _temaActivo = tema;
  _resetEstado();
  _el.querySelector('#mm-tema-emoji').textContent = tema.emoji;
  _el.querySelector('#mm-tema-label').textContent = tema.label;
  _el.querySelector('#mm-pares-count').textContent = '0';

  const palabras = _shuffle([...tema.palabras]).slice(0, PARES);
  _cartas = _shuffle(
    palabras.flatMap((palabra, i) => [
      { id: i, palabra, volteada: false, descubierta: false },
      { id: i, palabra, volteada: false, descubierta: false },
    ])
  ).map((carta, idx) => ({ ...carta, idx }));

  _dibujarTablero();
  _actualizarTira();
  Telemetry.track('memorama_tema_iniciado', { _modulo: 'memorama', tema: tema.id, pares: PARES });
}

// ─── Tablero ──────────────────────────────────────────────────────────────────
function _dibujarTablero() {
  const tablero = _el.querySelector('#mm-tablero');
  tablero.innerHTML = '';
  _cartas.forEach((carta, idx) => {
    const div = document.createElement('div');
    div.className   = 'mm-carta' + (carta.volteada ? ' volteada' : '');
    div.dataset.idx = idx;
    div.innerHTML   = `
      <div class="mm-carta-inner">
        <div class="mm-carta-dorso"></div>
        <div class="mm-carta-frente">
          <img src="${PICTO_URL(carta.palabra)}"
               alt="${carta.palabra}"
               onerror="this.style.display='none'">
          <span>${carta.palabra}</span>
        </div>
      </div>`;
    div.addEventListener('click', () => _tocarCarta(idx));
    tablero.appendChild(div);
  });
}

// ─── Tocar carta ──────────────────────────────────────────────────────────────
function _tocarCarta(idx) {
  if (_bloqueado) return;
  const carta = _cartas[idx];
  if (carta.volteada || carta.descubierta) return;
  haptic(8);

  carta.volteada = true;
  _voltadas.push(idx);
  _actualizarCarta(idx);
  _reproducirNombre(carta.palabra);

  if (_voltadas.length === 2) {
    _bloqueado = true;
    const [i1, i2] = _voltadas;
    const c1 = _cartas[i1], c2 = _cartas[i2];

    if (c1.id === c2.id) {
      setTimeout(() => {
        _tonoVictoria();
        c1.descubierta = c2.descubierta = true;
        _descubiertas.add(i1); _descubiertas.add(i2);
        [i1, i2].forEach(i => {
          const el = _el.querySelector(`.mm-carta[data-idx="${i}"]`);
          if (el) el.classList.add('encontrada');
        });
        _voltadas = [];
        _bloqueado = false;
        _actualizarContador();
        _actualizarTira();
        Telemetry.track('memorama_par_encontrado', {
          _modulo: 'memorama', tema: _temaActivo.id, palabra: c1.palabra
        });
        if (_descubiertas.size === _cartas.length) setTimeout(_mostrarVictoria, 800);
      }, 700);
    } else {
      setTimeout(() => {
        c1.volteada = c2.volteada = false;
        _actualizarCarta(i1); _actualizarCarta(i2);
        _voltadas = [];
        _bloqueado = false;
      }, FLIP_MS);
    }
  }
}

function _actualizarCarta(idx) {
  const el    = _el.querySelector(`.mm-carta[data-idx="${idx}"]`);
  const carta = _cartas[idx];
  if (!el || carta.descubierta) return;
  el.classList.toggle('volteada', carta.volteada);
}

function _actualizarContador() {
  const el = _el.querySelector('#mm-pares-count');
  if (el) el.textContent = _descubiertas.size / 2;
}

// ─── Tira ─────────────────────────────────────────────────────────────────────
function _actualizarTira() {
  const wrap = _el.querySelector('#mm-tira-wrap');
  if (!wrap) return;
  const palabrasDesc = [...new Set([..._descubiertas].map(i => _cartas[i].palabra))];
  if (!palabrasDesc.length) {
    wrap.innerHTML = '<span id="mm-tira-placeholder">Los pares que encuentres aparecerán aquí…</span>';
    return;
  }
  wrap.innerHTML = '';
  palabrasDesc.forEach(palabra => {
    const chip = document.createElement('div');
    chip.className = 'mm-par-descubierto';
    chip.innerHTML = `<img src="${PICTO_URL(palabra)}" alt="${palabra}" onerror="this.style.opacity='0'">`;
    chip.addEventListener('click', () => { haptic(6); _reproducirNombre(palabra); });
    chip.style.animation = 'mm-pop .25s cubic-bezier(.34,1.56,.64,1) both';
    wrap.appendChild(chip);
  });
  wrap.lastElementChild?.scrollIntoView({ behavior: 'smooth', inline: 'end' });
}

// ─── Victoria ─────────────────────────────────────────────────────────────────
function _mostrarVictoria() {
  lanzarConfeti({ count: 120, container: _el });
  toast('¡Encontraste todos los pares! 🎉', { duracion: 4000 });
  Telemetry.track('memorama_completado', { _modulo: 'memorama', tema: _temaActivo?.id });
}

// ─── Modal temas ──────────────────────────────────────────────────────────────
function _renderModalTemas() {
  const lista = _el.querySelector('#mm-temas-lista');
  if (!lista || !_temas.length) return;
  const grupos = {};
  _temas.forEach(t => {
    const tipo = t.tipo === 'lenguaje' ? 'Temarios de lenguaje' : 'Categorías de vocabulario';
    if (!grupos[tipo]) grupos[tipo] = [];
    grupos[tipo].push(t);
  });
  lista.innerHTML = '';
  Object.entries(grupos).forEach(([grupo, temas]) => {
    const lbl = document.createElement('div');
    lbl.className   = 'mm-grupo-label';
    lbl.textContent = grupo;
    lista.appendChild(lbl);
    const grid = document.createElement('div');
    grid.className = 'mm-temas-grid';
    temas.forEach(tema => {
      const btn = document.createElement('button');
      btn.className = 'mm-tema-btn' + (tema.id === _temaActivo?.id ? ' activo' : '');
      btn.innerHTML = `<span class="mm-tema-btn-emoji">${tema.emoji}</span>${tema.label}`;
      btn.addEventListener('click', () => {
        _cerrarModal();
        _iniciarTema(tema);
        _el.querySelectorAll('.mm-tema-btn').forEach(b => b.classList.toggle('activo', b === btn));
      });
      grid.appendChild(btn);
    });
    lista.appendChild(grid);
  });
}

function _abrirModal()  {
  _renderModalTemas();
  _el.querySelector('#mm-modal').classList.add('visible');
}
function _cerrarModal() {
  _el.querySelector('#mm-modal').classList.remove('visible');
}

// ─── Eventos ──────────────────────────────────────────────────────────────────
function _bindEvents() {
  _el.querySelector('#mm-btn-tema').addEventListener('click', _abrirModal);
  _el.querySelector('#mm-modal-cerrar').addEventListener('click', _cerrarModal);
  _el.querySelector('#mm-modal').addEventListener('click', e => {
    if (e.target === _el.querySelector('#mm-modal')) _cerrarModal();
  });
  _el.querySelector('#mm-btn-reiniciar').addEventListener('click', () => {
    haptic(10);
    if (_temaActivo) _iniciarTema(_temaActivo);
  });
}

// ─── Audio ────────────────────────────────────────────────────────────────────
function _reproducirNombre(palabra) {
  if (!_audioEl) { _audioEl = document.createElement('audio'); _audioEl.preload = 'auto'; }
  _audioEl.pause();
  let _used = false;
  const _fb = () => {
    if (_used) return;
    _used = true;
    TTS.speak(palabra, { lang: _lang === 'en' ? 'en-US' : 'es-MX', rate: 0.90, pitch: 1.15 });
  };
  _audioEl.onerror = _fb;
  _audioEl.src     = AUDIO_URL(palabra, _lang);
  _audioEl.play().catch(_fb);
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
