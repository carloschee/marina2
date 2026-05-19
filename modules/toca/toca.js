/* modules/toca/toca.js
   Módulo "Escucha y Toca" — Marina 2

   Mecánica:
   · Voz dice "Toca la fresa" — 3/4/5/6/8 pictogramas en pantalla
   · Toca el correcto → anillo verde + pop + eco de la palabra
   · Toca el incorrecto → wiggle + repite la instrucción
   · 3 aciertos consecutivos → sube de nivel
   · 5 niveles: 3 → 4 → 5 → 6 → 8 opciones

   Idioma gobernado por el pill global (lang-change).
   Fuente: data/pictos.json (modo aleatorio) o data/toca-temas.json (temas).
*/

import { TTS } from '../../core/tts.js';
import { haptic, lanzarConfeti } from '../../core/ui.js';
import { Telemetry } from '../../core/telemetry.js';

const PICTO_URL = (ruta) => `assets/pictogramas/${ruta}`;
const AUDIO_URL = (ruta, lang) => `assets/audio/${lang}/${ruta.replace('.png', '')}.mp3`;

const NIVELES = [3, 4, 5, 6, 8];
const ACIERTOS_UP = 3;

let _el = null;
let _catalogo = [];
let _temas = [];
let _tema = null;
let _pool = [];
let _langConfig = { es: true, en: false };
let _lang = 'es';
let _nivel = 0;
let _aciertos = 0;
let _objetivo = null;
let _opciones = [];
let _esperando = false;
let _audioEl = null;

export async function init(container) {
  _el = container;
  _langConfig = window._langConfig ? { ...window._langConfig } : { es: true, en: false };
  _lang = (_langConfig.en && !_langConfig.es) ? 'en' : 'es';
  _nivel = 0;
  _aciertos = 0;
  _esperando = false;
  _tema = null;

  try {
    const res = await fetch('./data/pictos.json');
    const cat = await res.json();
    _catalogo = cat.filter(e => e.ruta_img && e.es && e.art !== undefined);
  } catch (e) {
    console.error('[toca] No se pudo cargar pictos.json', e);
    _catalogo = [];
  }

  try {
    const res2 = await fetch('./data/toca-temas.json');
    _temas = await res2.json();
  } catch {
    _temas = [];
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
  _el = null; _catalogo = []; _pool = []; _temas = [];
}

export function onEnter() { }
export function onLeave() {
  TTS.stop();
  if (_audioEl) _audioEl.pause();
  Telemetry.track('toca_sesion', {
    _modulo: 'toca',
    nivel_alcanzado: _nivel + 1,
    opciones_nivel: NIVELES[_nivel],
    tema: _tema?.id || 'todos',
  });
}

export async function pause() {
  TTS.stop();
  if (_audioEl) _audioEl.pause();
  _esperando = true;
}

export async function resume(container) {
  _el = container;
  _langConfig = window._langConfig ? { ...window._langConfig } : _langConfig;
  _lang = (_langConfig.en && !_langConfig.es) ? 'en' : 'es';
  _render();
  if (_objetivo && _opciones.length) {
    _renderRonda();
    setTimeout(() => _reproducirInstruccion(), 500);
  } else {
    _nuevaRonda();
  }
  window.removeEventListener('lang-change', _onLangChange);
  window.addEventListener('lang-change', _onLangChange);
}

function _render() {
  // SIN contain:strict — rompe position:absolute de los hijos
  _el.style.cssText =
    'position:absolute;inset:0;display:flex;flex-direction:column;' +
    'overflow:hidden;background:transparent;';

  _el.innerHTML = `
  <style>
    #tc-header {
      flex-shrink:0;
      display:flex; align-items:center; justify-content:space-between;
      padding:14px 20px 10px; gap:12px;
    }
    #tc-nivel-wrap { display:flex; align-items:baseline; gap:4px; }
    #tc-nivel-label {
      font-size:.72rem; font-weight:900; letter-spacing:.12em;
      text-transform:uppercase; color:rgba(255,255,255,0.50);
    }
    #tc-nivel-valor { font-size:.72rem; font-weight:900; color:#00e5b0; margin-left:4px; }
    #tc-btn-tema {
      display:flex; align-items:center; gap:6px;
      padding:6px 14px; border-radius:99px; border:none; cursor:pointer;
      background:rgba(255,255,255,0.10);
      border:1.5px solid rgba(255,255,255,0.18);
      color:#fff; font-family:inherit; font-size:.8rem; font-weight:800;
      transition:background .15s, transform .12s; flex-shrink:0;
    }
    #tc-btn-tema:active { transform:scale(.93); background:rgba(255,255,255,.18); }
    #tc-tema-label { max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    #tc-dots { display:flex; gap:6px; align-items:center; flex-shrink:0; }
    .tc-dot {
      width:10px; height:10px; border-radius:50%;
      background:rgba(255,255,255,0.18);
      transition:background .3s, transform .3s;
    }
    .tc-dot.lleno { background:#00e5b0; transform:scale(1.2); }
    #tc-instruccion {
      flex-shrink:0; margin:0 20px 14px;
      background:rgba(0,0,0,0.35);
      backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
      border:1px solid rgba(255,255,255,0.10);
      border-radius:20px; padding:16px 20px;
      display:flex; align-items:center; justify-content:space-between; gap:16px;
    }
    #tc-instruccion-texto { display:flex; flex-direction:column; gap:4px; }
    #tc-label-sup {
      font-size:.68rem; font-weight:900; letter-spacing:.12em;
      text-transform:uppercase; color:#00e5b0;
    }
    #tc-prompt {
      font-size:clamp(1.6rem,4vw,2.4rem); font-weight:900;
      color:#fff; line-height:1.1;
    }
    #tc-prompt strong { color:#ffe566; }
    #tc-btn-repetir {
      width:52px; height:52px; border-radius:50%; border:none; cursor:pointer;
      background:#fb7185; color:#fff; font-size:1.3rem; flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 6px 20px rgba(251,113,133,0.45);
      transition:transform .12s, box-shadow .15s;
    }
    #tc-btn-repetir:active { transform:scale(.88); }
    #tc-grid {
      flex:1; min-height:0; display:grid; gap:12px; padding:0 20px 16px;
    }
    #tc-grid.cols-3 { grid-template-columns:repeat(3,1fr); grid-template-rows:1fr; }
    #tc-grid.cols-4 { grid-template-columns:repeat(4,1fr); grid-template-rows:1fr; }
    #tc-grid.cols-5 {
      grid-template-columns:repeat(6,1fr);
      grid-template-rows:repeat(2,1fr);
    }
    #tc-grid.cols-5 .tc-opcion:nth-child(1) { grid-column:1/3; }
    #tc-grid.cols-5 .tc-opcion:nth-child(2) { grid-column:3/5; }
    #tc-grid.cols-5 .tc-opcion:nth-child(3) { grid-column:5/7; }
    #tc-grid.cols-5 .tc-opcion:nth-child(4) { grid-column:2/4; }
    #tc-grid.cols-5 .tc-opcion:nth-child(5) { grid-column:4/6; }
    #tc-grid.cols-6 { grid-template-columns:repeat(3,1fr); grid-template-rows:repeat(2,1fr); }
    #tc-grid.cols-8 { grid-template-columns:repeat(4,1fr); grid-template-rows:repeat(2,1fr); }
    .tc-opcion {
      background:#fff; border-radius:20px;
      display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      padding:10px 8px 12px; cursor:pointer;
      border:3px solid transparent;
      box-shadow:0 4px 16px rgba(0,20,60,0.18);
      transition:transform .14s, box-shadow .14s, border-color .2s;
      position:relative; overflow:hidden;
      -webkit-tap-highlight-color:transparent; user-select:none;
      min-height:0;
    }
    .tc-opcion:active { transform:scale(.93); }
    .tc-opcion img {
      width:60%; height:60%; object-fit:contain;
      flex-shrink:0; pointer-events:none;
    }
    .tc-opcion-label {
      font-size:clamp(.7rem,1.6vw,.95rem); font-weight:900;
      color:#07212e; text-align:center; margin-top:6px;
      line-height:1.1; word-break:break-word; flex-shrink:0;
    }
    .tc-opcion.correcto {
      border-color:#22c55e;
      box-shadow:0 0 0 4px rgba(34,197,94,0.35), 0 6px 20px rgba(0,20,60,0.20);
      animation:tc-pop .35s cubic-bezier(.34,1.56,.64,1) both;
    }
    @keyframes tc-pop { from { transform:scale(.9); } to { transform:scale(1); } }
    .tc-opcion.incorrecto { animation:tc-wiggle .4s ease both; }
    @keyframes tc-wiggle {
      0%,100% { transform:translateX(0) rotate(0deg); }
      20%     { transform:translateX(-8px) rotate(-2deg); }
      40%     { transform:translateX(8px) rotate(2deg); }
      60%     { transform:translateX(-5px) rotate(-1deg); }
      80%     { transform:translateX(5px) rotate(1deg); }
    }
    #tc-nivel-up {
      display:none; position:absolute; inset:0; z-index:10;
      align-items:center; justify-content:center; flex-direction:column; gap:12px;
      background:rgba(3,17,26,0.75);
      backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
      animation:tc-fadein .25s ease both;
    }
    #tc-nivel-up.visible { display:flex; }
    @keyframes tc-fadein { from { opacity:0; } to { opacity:1; } }
    #tc-nivel-up-emoji { font-size:4rem; animation:tc-flotar 1.2s ease-in-out infinite alternate; }
    @keyframes tc-flotar { from { transform:translateY(0); } to { transform:translateY(-12px); } }
    #tc-nivel-up-texto { font-size:2rem; font-weight:900; color:#fff; text-shadow:0 4px 20px rgba(0,229,176,.60); }
    #tc-nivel-up-sub   { font-size:1rem; font-weight:700; color:rgba(255,255,255,0.60); }
    #tc-modal-temas {
      display:none; position:fixed; inset:0; z-index:20;
      align-items:center; justify-content:center;
      background:rgba(3,17,26,0.80);
      backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
    }
    #tc-modal-temas.visible { display:flex; }
    #tc-modal-box {
      background:rgba(6,42,62,0.98);
      border:1px solid rgba(14,165,201,0.20);
      border-radius:28px; padding:24px;
      width:88%; max-width:400px;
      display:flex; flex-direction:column; gap:12px;
      box-shadow:0 20px 60px rgba(0,0,0,0.5);
      max-height:80vh; overflow-y:auto;
    }
    #tc-modal-titulo {
      font-size:.72rem; font-weight:900; letter-spacing:.12em;
      text-transform:uppercase; color:rgba(255,255,255,0.50); margin:0;
    }
    .tc-tema-opcion {
      display:flex; align-items:center; gap:14px;
      padding:14px 16px; border-radius:16px; border:none; cursor:pointer;
      background:rgba(255,255,255,0.06);
      border:1px solid rgba(255,255,255,0.10);
      font-family:inherit; color:#fff; text-align:left;
      transition:background .15s, transform .12s; width:100%;
    }
    .tc-tema-opcion:active { transform:scale(.97); }
    .tc-tema-opcion.activo { background:rgba(0,229,176,0.15); border-color:rgba(0,229,176,0.40); }
    .tc-tema-emoji  { font-size:1.5rem; flex-shrink:0; }
    .tc-tema-info   { display:flex; flex-direction:column; gap:2px; }
    .tc-tema-nombre { font-size:1rem; font-weight:900; }
    .tc-tema-desc   { font-size:.72rem; color:rgba(255,255,255,.45); font-weight:700; }
    #tc-vacio {
      display:none; flex:1; flex-direction:column;
      align-items:center; justify-content:center; gap:12px;
      color:rgba(255,255,255,.30); font-size:1rem; font-weight:700;
    }
  </style>

  <div id="tc-header">
    <div id="tc-nivel-wrap">
      <span id="tc-nivel-label">NIVEL</span>
      <span id="tc-nivel-valor">1</span>
    </div>
    <button id="tc-btn-tema">
      <span id="tc-tema-label">Todos juegan</span>
      <span style="font-size:.75rem;opacity:.55">▾</span>
    </button>
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

  <div id="tc-modal-temas">
    <div id="tc-modal-box">
      <p id="tc-modal-titulo">Elige un tema</p>
      <div id="tc-modal-lista"></div>
    </div>
  </div>

  <div id="tc-vacio">
    <span style="font-size:3rem">🔤</span>
    No hay pictogramas disponibles.
  </div>
  `;

  _el.querySelector('#tc-btn-repetir').addEventListener('click', () => {
    haptic(10); _reproducirInstruccion();
  });
  _el.querySelector('#tc-btn-tema').addEventListener('click', () => {
    haptic(8); _abrirModalTemas();
  });
  _el.querySelector('#tc-modal-temas').addEventListener('click', e => {
    if (e.target === _el.querySelector('#tc-modal-temas')) _cerrarModalTemas();
  });
}

function _nuevaRonda() {
  if (!_el) return;  // proteger si el módulo fue destruido
  const n = NIVELES[_nivel];
  if (_catalogo.length < n) {
    _el.querySelector('#tc-grid').style.display = 'none';
    _el.querySelector('#tc-instruccion').style.display = 'none';
    _el.querySelector('#tc-vacio').style.display = 'flex';
    return;
  }
  _esperando = false;
  if (_pool.length < n) {
    const base = _tema?.palabras?.length
      ? _catalogo.filter(e => _tema.palabras.includes(e.id))
      : _catalogo;
    _pool = _shuffle([...base]);
  }
  _objetivo = _pool.shift();
  const base = _tema?.palabras?.length
    ? _catalogo.filter(e => _tema.palabras.includes(e.id))
    : _catalogo;
  const tmpPool = _shuffle(base.filter(e => e.id !== _objetivo.id));
  const distractores = [];
  while (distractores.length < n - 1 && tmpPool.length) {
    distractores.push(tmpPool.shift());
  }
  _opciones = _shuffle([_objetivo, ...distractores]);
  _renderRonda();

  // DIAGNÓSTICO TEMPORAL — remover después
  const el = _el;
  const grid = _el.querySelector('#tc-grid');
  console.log('[toca] contenedor:', el.offsetWidth, 'x', el.offsetHeight);
  console.log('[toca] grid:', grid.offsetWidth, 'x', grid.offsetHeight);
  console.log('[toca] el parent:', el.parentElement?.offsetWidth, 'x', el.parentElement?.offsetHeight);
  console.log('[toca] el style:', el.style.cssText);
  const header = _el.querySelector('#tc-header');
  const instruccion = _el.querySelector('#tc-instruccion');
  console.log('[toca] header h:', header.offsetHeight);
  console.log('[toca] instruccion h:', instruccion.offsetHeight);
  console.log('[toca] suma:', header.offsetHeight + instruccion.offsetHeight);
  console.log('[toca] diferencia:', el.offsetHeight - grid.offsetHeight - header.offsetHeight - instruccion.offsetHeight);

  setTimeout(() => {
    if (_el && !(_audioEl && !_audioEl.paused)) _reproducirInstruccion();
  }, 400);
}

function _renderRonda() {
  const n = NIVELES[_nivel];
  _el.querySelector('#tc-nivel-valor').textContent = _nivel + 1;
  _renderDots();
  _actualizarPrompt();
  const grid = _el.querySelector('#tc-grid');
  grid.className = `cols-${n}`;
  grid.innerHTML = '';
  _opciones.forEach(picto => {
    const btn = document.createElement('button');
    btn.className = 'tc-opcion';
    btn.dataset.id = picto.id;
    const img = document.createElement('img');
    img.src = PICTO_URL(picto.ruta_img);
    img.alt = picto.es;
    img.onerror = () => { img.style.opacity = '0.3'; };
    const label = document.createElement('span');
    label.className = 'tc-opcion-label';
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
    prompt.innerHTML = `Touch the <strong>${_objetivo.en || _objetivo.es}</strong>`;
    _el.querySelector('#tc-label-sup').textContent = 'LISTEN AND TOUCH';
  } else {
    const art = _objetivo.art || '';
    prompt.innerHTML = art
      ? `Toca ${art} <strong>${_objetivo.es}</strong>`
      : `Toca <strong>${_objetivo.es}</strong>`;
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

function _tocar(picto, btn) {
  if (_esperando) return;
  haptic(12);
  picto.id === _objetivo.id ? _acierto(btn) : _error(btn);
}

function _acierto(btn) {
  _esperando = true;
  _aciertos++;
  btn.classList.add('correcto');
  lanzarConfeti({ count: 30, container: _el });
  const texto = _lang === 'en' ? (_objetivo.en || _objetivo.es) : _objetivo.es;
  const archivo = _objetivo.ruta_img;
  _reproducirAudio(archivo, _lang, texto);
  Telemetry.track('toca_acierto', { _modulo: 'toca', picto: _objetivo.es, nivel: _nivel + 1 });
  if (_aciertos >= ACIERTOS_UP) {
    _aciertos = 0;
    if (_nivel < NIVELES.length - 1) {
      setTimeout(() => _mostrarSubidaNivel(), 700);
    } else {
      setTimeout(() => _mostrarModoInfinito(), 700);
    }
  } else {
    _renderDots();
    setTimeout(() => { if (_el) _nuevaRonda(); }, 900);
  }
}

function _error(btn) {
  btn.classList.add('incorrecto');
  haptic([10, 50, 10]);
  setTimeout(() => btn.classList.remove('incorrecto'), 450);
  setTimeout(() => _reproducirInstruccion(), 600);
  Telemetry.track('toca_error', { _modulo: 'toca', picto: _objetivo.es, nivel: _nivel + 1 });
}

function _mostrarSubidaNivel() {
  _nivel++;
  const emojis = ['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '🏆'];
  _el.querySelector('#tc-nivel-up-emoji').textContent = emojis[Math.min(_nivel, emojis.length - 1)];
  _el.querySelector('#tc-nivel-up-texto').textContent =
    _lang === 'en' ? `Level ${_nivel + 1}!` : `¡Nivel ${_nivel + 1}!`;
  _el.querySelector('#tc-nivel-up-sub').textContent =
    _lang === 'en' ? `Now ${NIVELES[_nivel]} pictures` : `Ahora ${NIVELES[_nivel]} opciones`;
  _el.querySelector('#tc-nivel-up').classList.add('visible');
  lanzarConfeti({ count: 60, container: _el });
  TTS.speak(
    _lang === 'en' ? `Level ${_nivel + 1}!` : `¡Nivel ${_nivel + 1}!`,
    { lang: _lang === 'en' ? 'en-US' : 'es-MX', pitch: 1.3, rate: 0.9 }
  );
  setTimeout(() => {
    _el.querySelector('#tc-nivel-up').classList.remove('visible');
    _nuevaRonda();
  }, 2200);
}

function _mostrarModoInfinito() {
  _el.querySelector('#tc-nivel-up-emoji').textContent = '🏆';
  _el.querySelector('#tc-nivel-up-texto').textContent =
    _lang === 'en' ? '¡Champion!' : '¡Campeona!';
  _el.querySelector('#tc-nivel-up-sub').textContent =
    _lang === 'en' ? 'Infinite challenge!' : '¡Reto infinito!';
  _el.querySelector('#tc-nivel-up').classList.add('visible');
  lanzarConfeti({ count: 100, container: _el });
  TTS.speak(
    _lang === 'en' ? 'Champion! Infinite challenge!' : '¡Campeona! ¡Reto infinito!',
    { lang: _lang === 'en' ? 'en-US' : 'es-MX', pitch: 1.3, rate: 0.9 }
  );
  setTimeout(() => {
    _el.querySelector('#tc-nivel-up').classList.remove('visible');
    if (_el) _nuevaRonda();
  }, 2800);
}

function _abrirModalTemas() {
  const lista = _el.querySelector('#tc-modal-lista');
  lista.innerHTML = '';
  lista.appendChild(_crearOpcionTema(
    { id: null, emoji: '🌊', label: 'Todos juegan', desc: `${_catalogo.length} pictogramas` },
    _tema === null
  ));
  _temas.forEach(t => {
    lista.appendChild(_crearOpcionTema(
      { id: t.id, emoji: t.emoji || '📚', label: t.label, desc: `${t.palabras?.length || 0} pictogramas` },
      _tema?.id === t.id
    ));
  });
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
    </span>
  `;
  btn.addEventListener('click', () => { haptic(10); _seleccionarTema(id); });
  return btn;
}

function _cerrarModalTemas() {
  _el.querySelector('#tc-modal-temas')?.classList.remove('visible');
}

function _seleccionarTema(id) {
  _tema = id === null ? null : (_temas.find(t => t.id === id) || null);
  _cerrarModalTemas();
  const label = _el.querySelector('#tc-tema-label');
  if (label) label.textContent = _tema ? _tema.label : 'Todos juegan';
  if (_tema?.palabras?.length) {
    const ids = new Set(_tema.palabras);
    _pool = _shuffle(_catalogo.filter(e => ids.has(e.id)));
  } else {
    _pool = _shuffle([..._catalogo]);
  }
  _nivel = 0;
  _aciertos = 0;
  _nuevaRonda();
}

function _reproducirInstruccion() {
  if (!_objetivo) return;
  const lang = _lang === 'en' ? 'en-US' : 'es-MX';
  const texto = _lang === 'en'
    ? `Touch the ${_objetivo.en || _objetivo.es}`
    : `Toca ${_objetivo.art ? _objetivo.art + ' ' : ''}${_objetivo.es}`;
  TTS.speak(texto, { lang, rate: 0.88, pitch: 1.1 });
}

function _reproducirAudio(ruta, lang, textoFallback) {
  if (!_audioEl) {
    _audioEl = document.createElement('audio');
    _audioEl.preload = 'none';
  }
  TTS.stop();
  _audioEl.pause();
  _audioEl.onerror = null;
  let _usado = false;
  const _fallback = () => {
    if (_usado) return; _usado = true;
    TTS.speak(textoFallback, { lang: lang === 'en' ? 'en-US' : 'es-MX', rate: 0.9, pitch: 1.2 });
  };
  _audioEl.onerror = _fallback;
  _audioEl.src = AUDIO_URL(ruta, lang);
  _audioEl.play().catch(_fallback);
}

function _onLangChange(e) {
  const cfg = e.detail?.langConfig;
  if (!cfg) return;
  _langConfig = { ...cfg };
  _lang = (cfg.en && !cfg.es) ? 'en' : 'es';
  if (_objetivo) {
    _actualizarPrompt();
    _el.querySelectorAll('.tc-opcion-label').forEach((lbl, i) => {
      const p = _opciones[i];
      if (p) lbl.textContent = _lang === 'en' ? (p.en || p.es) : p.es;
    });
  }
}

function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}