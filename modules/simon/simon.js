/* modules/simon/simon.js
   Módulo "Simón" para Marina 2 — memoria de secuencias (tipo Simon, variante A).

   Mecánica:
   · Tablero con vocabulario aleatorio. El nº de piezas define el nivel:
       Nivel 1 (Fácil)   → 3 piezas
       Nivel 2 (Medio)   → 4 piezas
       Nivel 3 (Difícil) → 6 piezas
   · La app ilumina una secuencia (resalte + nombre en audio) que empieza corta
     y crece de a una pieza en cada ronda acertada (de menor a mayor complejidad).
   · La usuaria repite la secuencia tocando los elementos en el mismo orden.

   Principios neuroafirmativos:
   · Sin audio al entrar (onEnter no reproduce nada): la secuencia solo suena
     tras tocar "Jugar".
   · Sin presión de tiempo: la usuaria toca a su ritmo.
   · Sin "fallo" brusco: un error NO reinicia la ronda; se vuelve a mostrar la
     misma secuencia para reintentar. Sin sonido de error estridente, sin confeti.
   · Estados claros y separados: "Observa" (entrada bloqueada) vs "Tu turno".
   · Botón "Ver otra vez" siempre disponible en el turno, para reducir ansiedad.
   · Objetivos táctiles grandes (las piezas llenan el tablero).
*/

import { TTS }       from '../../core/tts.js';
import { haptic }    from '../../core/ui.js';
import { Telemetry } from '../../core/telemetry.js';
import { cfg }       from '../../core/config.js';

// ─── Persistencia ────────────────────────────────────────────────────────────────
// Dos keys de localStorage, con el prefijo de app.config.json:
//   marina2-simon-nivel   → id del nivel seleccionado (1 | 2 | 3)
//   marina2-simon-record  → JSON { "1": N, "2": N, "3": N } — récord de rondas por nivel
const _lsNivel  = () => `${cfg('storage.prefijo', 'app')}-simon-nivel`;
const _lsRecord = () => `${cfg('storage.prefijo', 'app')}-simon-record`;

function _cargarRecord() {
  try { return JSON.parse(localStorage.getItem(_lsRecord()) || '{}'); } catch { return {}; }
}
function _guardarRecord(rec) {
  try { localStorage.setItem(_lsRecord(), JSON.stringify(rec)); } catch {}
}
function _cargarNivelId() {
  try { return parseInt(localStorage.getItem(_lsNivel()), 10) || 1; } catch { return 1; }
}
function _guardarNivelId(id) {
  try { localStorage.setItem(_lsNivel(), String(id)); } catch {}
}

// ─── Rutas (mismas convenciones que el resto de módulos) ───────────────────────
const PICTO_URL = (ruta_img) => `assets/pictogramas/${ruta_img.toLowerCase()}`;
const AUDIO_URL = (ruta_img, lang = 'es') =>
  `assets/audio/${lang}/${ruta_img.replace(/\.png$/i, '').toLowerCase()}.mp3`;

// ─── Configuración ──────────────────────────────────────────────────────────────
const NIVELES = [
  { id: 1, estrellas: '⭐',     piezas: 3, nombre: 'Fácil'   },
  { id: 2, estrellas: '⭐⭐',   piezas: 4, nombre: 'Medio'   },
  { id: 3, estrellas: '⭐⭐⭐', piezas: 6, nombre: 'Difícil' },
];
const SECUENCIA_INICIAL = 2;    // largo de la primera secuencia
const DUR_ILUM = 680;           // ms que una pieza queda iluminada
const DUR_GAP  = 280;           // ms entre piezas
const DUR_PREV = 560;           // pausa antes de empezar a mostrar

// ─── Estado ─────────────────────────────────────────────────────────────────────
let _el          = null;
let _catalogo    = [];   // pictos disponibles (con ruta_img + es)
let _nivel       = NIVELES[0];
let _tablero     = [];   // entradas (pictos) del tablero actual
let _secuencia   = [];   // índices del tablero, en orden
let _pasoUsuario = 0;    // progreso de la usuaria dentro de la secuencia
let _ronda       = 1;
let _aceptaInput = false;
let _seqToken    = 0;     // invalida reproducciones obsoletas
let _lang        = 'es';
let _audioEl     = null;

// ─── API pública ──────────────────────────────────────────────────────────────
export async function init(container) {
  _el = container;
  const langCfg = window._langConfig || { es: true, en: false };
  _lang = (langCfg.es && langCfg.en) ? 'ambos' : langCfg.en ? 'en' : 'es';
  // Recuperar el nivel que la usuaria usó la última vez (o nivel 1 por defecto)
  const nivelGuardado = _cargarNivelId();
  _nivel = NIVELES.find(n => n.id === nivelGuardado) || NIVELES[0];

  try {
    const res = await fetch('./data/pictos.json');
    const cat = await res.json();
    _catalogo = cat.filter(e => e.ruta_img && e.es);
  } catch (e) {
    console.error('[simon] No se pudo cargar pictos.json', e);
    _catalogo = [];
  }

  _render();
  _nuevaPartida();                  // prepara tablero, NO reproduce nada
  window.addEventListener('lang-change', _onLangChange);
}

export function destroy() {
  window.removeEventListener('lang-change', _onLangChange);
  _detenerTodo();
  _el = null; _catalogo = []; _tablero = []; _secuencia = [];
}

export function onEnter() { /* sin audio al entrar — principio neuroafirmativo */ }

export function onLeave() {
  _detenerTodo();
  Telemetry.track('simon_sesion', {
    _modulo: 'simon',
    nivel: _nivel.id,
    ronda_alcanzada: _ronda,
    largo_secuencia: _secuencia.length,
  });
}

export async function pause() { _detenerTodo(); }

export async function resume(container) {
  _el = container;
  const langCfg = window._langConfig || { es: true, en: false };
  _lang = (langCfg.es && langCfg.en) ? 'ambos' : langCfg.en ? 'en' : 'es';
  // Restaurar el nivel guardado también al resumir (puede que haya cambiado
  // de perfil o de sesión mientras el módulo estaba en pausa)
  const nivelGuardado = _cargarNivelId();
  _nivel = NIVELES.find(n => n.id === nivelGuardado) || _nivel;
  _render();
  _nuevaPartida();
  window.removeEventListener('lang-change', _onLangChange);
  window.addEventListener('lang-change', _onLangChange);
}

// ─── Render del shell ────────────────────────────────────────────────────────────
function _render() {
  _el.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;';
  _el.innerHTML = `
    <style>
      #sm-wrap {
        flex:1; min-height:0; display:flex; flex-direction:column;
        padding:14px 16px calc(12px + env(safe-area-inset-bottom, 0px));
        gap:12px; overflow:hidden;
      }

      /* ── Barra superior: niveles + ronda ── */
      #sm-top { display:flex; align-items:center; gap:10px; flex-shrink:0; }
      #sm-niveles { display:flex; gap:8px; }
      .sm-nivel {
        min-height:48px; padding:8px 14px; border-radius:14px; cursor:pointer;
        font-family:inherit; font-weight:900; font-size:1rem; color:#fff;
        background:rgba(255,255,255,0.08); border:1.5px solid rgba(255,255,255,0.16);
        transition:transform .12s, background .18s, border-color .18s;
      }
      .sm-nivel:active { transform:scale(.95); }
      .sm-nivel.activo {
        background:rgba(244,63,94,0.22); border-color:rgba(244,63,94,0.65);
      }
      .sm-nivel:disabled { opacity:.4; pointer-events:none; }
      #sm-ronda {
        margin-left:auto; flex-shrink:0; white-space:nowrap;
        font-size:.95rem; font-weight:800; color:rgba(255,255,255,0.55);
      }

      /* ── Indicador de estado ── */
      #sm-estado {
        flex-shrink:0; text-align:center;
        font-family:'Outfit', sans-serif; font-weight:900;
        font-size:clamp(1.1rem, 3.5vw, 1.5rem); color:#fff;
        min-height:1.6em; transition:color .2s;
      }
      #sm-estado.observa { color:#fbbf24; }
      #sm-estado.turno   { color:#f43f5e; }
      #sm-estado.bien    { color:#34d399; }

      /* ── Tablero ── */
      #sm-board {
        flex:1; min-height:0; display:grid; gap:14px;
        grid-auto-rows:1fr; align-content:stretch; justify-content:stretch;
      }
      #sm-board.p3 { grid-template-columns:repeat(3, minmax(0,1fr)); }
      #sm-board.p4 { grid-template-columns:repeat(2, minmax(0,1fr)); }
      #sm-board.p6 { grid-template-columns:repeat(3, minmax(0,1fr)); }

      .sm-tile {
        position:relative; border-radius:22px; cursor:pointer; overflow:hidden;
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        gap:6px; padding:10px;
        background:rgba(255,255,255,0.07);
        border:2px solid rgba(255,255,255,0.14);
        transition:transform .14s ease, box-shadow .18s ease,
                   background .18s ease, border-color .18s ease, filter .18s ease;
      }
      .sm-tile img {
        width:auto; max-width:84%; max-height:60%; flex:0 1 auto; object-fit:contain;
        background:#fff; border-radius:16px; padding:8px;
        transition:transform .14s ease;
      }
      .sm-tile .sm-tile-label {
        font-family:'Outfit', sans-serif; font-weight:800;
        font-size:clamp(.85rem, 2.4vw, 1.15rem); color:rgba(255,255,255,0.85);
        text-align:center; line-height:1;
      }
      /* En reposo bloqueado (Observa) las piezas no responden al tap */
      #sm-board.bloqueado .sm-tile { cursor:default; }
      #sm-board.bloqueado .sm-tile:active { transform:none; }
      .sm-tile:active { transform:scale(.96); }

      /* Iluminada */
      .sm-tile.activa {
        background:rgba(244,63,94,0.85);
        border-color:#fff;
        transform:scale(1.04);
        box-shadow:0 0 0 4px rgba(244,63,94,0.35), 0 12px 34px rgba(244,63,94,0.5);
        filter:brightness(1.12);
      }
      .sm-tile.activa img { transform:scale(1.06); }
      /* Error suave (ámbar, sin estridencia) */
      .sm-tile.mal {
        background:rgba(251,191,36,0.30);
        border-color:rgba(251,191,36,0.85);
      }

      /* ── Controles ── */
      #sm-controles {
        flex-shrink:0; display:flex; gap:10px; justify-content:center;
        min-height:60px;
      }
      .sm-btn {
        min-height:60px; padding:0 26px; border-radius:18px; border:none;
        cursor:pointer; font-family:inherit; font-weight:900; font-size:1.1rem;
        color:#fff; display:flex; align-items:center; justify-content:center; gap:8px;
        transition:transform .12s, filter .18s;
      }
      .sm-btn:active { transform:scale(.96); }
      #sm-jugar   { background:#f43f5e; box-shadow:0 4px 18px rgba(244,63,94,0.45); }
      #sm-repetir { background:rgba(255,255,255,0.12); border:1.5px solid rgba(255,255,255,0.25); }
      .sm-btn.oculto { display:none; }

      /* ── Portrait ── */
      @media (orientation:portrait) {
        #sm-board.p6 { grid-template-columns:repeat(2, minmax(0,1fr)); }
      }
    </style>

    <div id="sm-wrap">
      <div id="sm-top">
        <div id="sm-niveles"></div>
        <span id="sm-ronda"></span>
      </div>

      <div id="sm-estado"></div>

      <div id="sm-board" class="bloqueado"></div>

      <div id="sm-controles">
        <button class="sm-btn" id="sm-jugar">▶ Jugar</button>
        <button class="sm-btn oculto" id="sm-repetir">👀 Ver otra vez</button>
      </div>
    </div>
  `;

  // Selector de niveles
  const cont = _el.querySelector('#sm-niveles');
  NIVELES.forEach(n => {
    const b = document.createElement('button');
    b.className = 'sm-nivel' + (n.id === _nivel.id ? ' activo' : '');
    b.textContent = n.estrellas;
    b.title = n.nombre;
    b.dataset.nivel = n.id;
    b.addEventListener('click', () => { haptic(8); _cambiarNivel(n.id); });
    cont.appendChild(b);
  });

  _el.querySelector('#sm-jugar').addEventListener('click', () => { haptic(10); _jugar(); });
  _el.querySelector('#sm-repetir').addEventListener('click', () => { haptic(8); _reproducirSecuencia(); });
}

// ─── Flujo de juego ──────────────────────────────────────────────────────────────
function _cambiarNivel(id) {
  if (_nivel.id === id) return;
  _nivel = NIVELES.find(n => n.id === id) || NIVELES[0];
  _guardarNivelId(_nivel.id);                             // ← persistir
  _el.querySelectorAll('.sm-nivel').forEach(b =>
    b.classList.toggle('activo', Number(b.dataset.nivel) === _nivel.id));
  _nuevaPartida();
}

function _nuevaPartida() {
  _detenerSecuencia();
  _ronda = 1;
  _secuencia = [];
  _pasoUsuario = 0;
  _aceptaInput = false;

  _tablero = _muestraAleatoria(_catalogo, _nivel.piezas);
  _renderTablero();
  _actualizarRonda();
  _setEstado('idle');
}

function _renderTablero() {
  const board = _el.querySelector('#sm-board');
  board.className = 'bloqueado p' + _nivel.piezas;
  board.innerHTML = '';
  _tablero.forEach((entrada, idx) => {
    const tile = document.createElement('button');
    tile.className = 'sm-tile';
    tile.dataset.idx = idx;
    tile.innerHTML = `
      <img src="${PICTO_URL(entrada.ruta_img)}" alt="${entrada.es}">
      <span class="sm-tile-label">${entrada.es}</span>`;
    tile.querySelector('img').onerror = (ev) => { ev.target.style.visibility = 'hidden'; };
    tile.addEventListener('click', () => _onTap(idx));
    board.appendChild(tile);
  });
}

function _jugar() {
  if (!_tablero.length) return;
  if (_secuencia.length === 0) {
    for (let i = 0; i < SECUENCIA_INICIAL; i++) _secuencia.push(_pasoAleatorio());
  }
  _reproducirSecuencia();
}

async function _reproducirSecuencia() {
  if (!_secuencia.length) return;
  _setEstado('observa');
  const token = ++_seqToken;
  await _sleep(DUR_PREV);

  for (let i = 0; i < _secuencia.length; i++) {
    if (token !== _seqToken || !_el) return;          // abortar si quedó obsoleta
    const idx = _secuencia[i];
    _iluminar(idx);
    _reproducirNombre(_tablero[idx]);
    await _sleep(DUR_ILUM);
    if (token !== _seqToken || !_el) return;
    _apagar(idx);
    await _sleep(DUR_GAP);
  }
  if (token !== _seqToken || !_el) return;
  _pasoUsuario = 0;
  _setEstado('turno');
}

function _onTap(idx) {
  if (!_aceptaInput) return;
  haptic(8);
  _flashTile(idx);
  _reproducirNombre(_tablero[idx]);

  if (idx === _secuencia[_pasoUsuario]) {
    _pasoUsuario++;
    if (_pasoUsuario >= _secuencia.length) _rondaCompleta();
  } else {
    _error(idx);
  }
}

function _rondaCompleta() {
  _aceptaInput = false;
  _el.querySelector('#sm-repetir')?.classList.add('oculto');
  _ronda++;
  _setEstado('bien');
  _actualizarRonda();

  // Actualizar récord del nivel activo si se supera
  const rec = _cargarRecord();
  const clave = String(_nivel.id);
  if (!rec[clave] || _ronda > rec[clave]) {
    rec[clave] = _ronda;
    _guardarRecord(rec);
  }

  // Crece la secuencia (mismo prefijo + una pieza nueva) y se vuelve a mostrar.
  setTimeout(() => {
    if (!_el) return;
    _secuencia.push(_pasoAleatorio());
    _reproducirSecuencia();
  }, 1100);
}

function _error(idxTocado) {
  _aceptaInput = false;
  _el.querySelector('#sm-repetir')?.classList.add('oculto');
  haptic(22);
  const tile = _tiles()[idxTocado];
  tile?.classList.add('mal');
  _setStatus('Uy… observa otra vez 👀');
  // Sin reinicio: se repite la MISMA secuencia para reintentar.
  setTimeout(() => {
    if (!_el) return;
    tile?.classList.remove('mal');
    _reproducirSecuencia();
  }, 950);
}

// ─── Estados de UI ───────────────────────────────────────────────────────────────
function _setEstado(estado) {
  const board   = _el.querySelector('#sm-board');
  const jugar   = _el.querySelector('#sm-jugar');
  const repetir = _el.querySelector('#sm-repetir');

  switch (estado) {
    case 'idle':
      _aceptaInput = false;
      board.classList.add('bloqueado');
      jugar.classList.remove('oculto');
      repetir.classList.add('oculto');
      _setStatus('Observa y repite la secuencia', '');
      break;
    case 'observa':
      _aceptaInput = false;
      board.classList.add('bloqueado');
      jugar.classList.add('oculto');
      repetir.classList.add('oculto');
      _setStatus('Observa…', 'observa');
      break;
    case 'turno':
      _aceptaInput = true;
      board.classList.remove('bloqueado');
      jugar.classList.add('oculto');
      repetir.classList.remove('oculto');
      _setStatus('Tu turno', 'turno');
      break;
    case 'bien':
      _aceptaInput = false;
      board.classList.add('bloqueado');
      _setStatus('¡Muy bien! 🎉', 'bien');
      break;
  }
}

function _setStatus(texto, clase = '') {
  const el = _el?.querySelector('#sm-estado');
  if (!el) return;
  el.textContent = texto;
  el.className = clase;
}

function _actualizarRonda() {
  const el = _el?.querySelector('#sm-ronda');
  if (!el) return;
  const rec = _cargarRecord();
  const mejor = rec[String(_nivel.id)];
  el.textContent = mejor && mejor > 1
    ? `Ronda ${_ronda}  ·  Récord ${mejor}`
    : `Ronda ${_ronda}`;
}

// ─── Iluminación / audio ─────────────────────────────────────────────────────────
function _tiles() { return _el ? [..._el.querySelectorAll('.sm-tile')] : []; }
function _iluminar(idx) { _tiles()[idx]?.classList.add('activa'); }
function _apagar(idx)   { _tiles()[idx]?.classList.remove('activa'); }

function _flashTile(idx) {
  const tile = _tiles()[idx];
  if (!tile) return;
  tile.classList.add('activa');
  setTimeout(() => tile.classList.remove('activa'), 280);
}

// Reproduce el nombre del picto: MP3 pregenerado con fallback a TTS. Best-effort
// (no bloquea el ritmo de la secuencia).
function _reproducirNombre(entrada) {
  if (!entrada) return;
  const langCode = _lang === 'en' ? 'en' : 'es';
  if (!_audioEl) { _audioEl = document.createElement('audio'); _audioEl.preload = 'none'; }
  TTS.stop();
  try { _audioEl.pause(); } catch {}
  let usado = false;
  const fallback = () => {
    if (usado) return; usado = true;
    TTS.speak((langCode === 'en' && entrada.en) ? entrada.en : entrada.es,
      { lang: langCode === 'en' ? 'en-US' : 'es-MX', rate: 0.95, pitch: 1.1 });
  };
  _audioEl.onerror = fallback;
  _audioEl.src = AUDIO_URL(entrada.ruta_img, langCode);
  _audioEl.play().catch(fallback);
}

// ─── Utilidades ──────────────────────────────────────────────────────────────────
const _sleep = (ms) => new Promise(r => setTimeout(r, ms));
const _pasoAleatorio = () => Math.floor(Math.random() * _tablero.length);

function _muestraAleatoria(arr, n) {
  const copia = [...arr];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia.slice(0, Math.min(n, copia.length));
}

function _detenerSecuencia() { _seqToken++; }

function _detenerTodo() {
  _detenerSecuencia();
  _aceptaInput = false;
  TTS.stop();
  if (_audioEl) { try { _audioEl.pause(); } catch {} }
}

// ─── Cambio de idioma ────────────────────────────────────────────────────────────
function _onLangChange(e) {
  const cfg = e.detail?.langConfig || window._langConfig;
  if (!cfg) return;
  _lang = (cfg.es && cfg.en) ? 'ambos' : cfg.en ? 'en' : 'es';
  // El tablero muestra la etiqueta en español; solo cambia el idioma del audio.
}