/* modules/simon/simon.js
   Módulo "Simón" para Marina 2 — memoria de secuencias.

   Niveles (por nº de piezas):
     Nivel 1 (Fácil)   → 4 piezas  — 2×2 en ambas orientaciones
     Nivel 2 (Medio)   → 6 piezas  — landscape 2×3 / portrait 3×2
     Nivel 3 (Difícil) → 8 piezas  — landscape 2×4 / portrait 4×2

   Flujo de entrada:
   1. Tablero visible (blur suave) + overlay con ▶ flotando.
   2. Al tocar ▶: overlay se cierra, aparece modal ⭐ con instrucciones TTS.
   3. Al terminar TTS: modal se cierra, comienza la secuencia.
   4. Cada pieza iluminada: tono musical → nombre del pictograma.
   5. Acierto → secuencia crece. Error → misma secuencia, sin reinicio.

   Principios neuroafirmativos:
   · Sin presión de tiempo.
   · Error amable: ámbar, misma secuencia para reintentar.
   · Botón "Ver otra vez" disponible durante el turno.
   · onEnter sin audio — la usuaria elige cuándo empieza.
*/

import { TTS }       from '../../core/tts.js';
import { haptic }    from '../../core/ui.js';
import { Telemetry } from '../../core/telemetry.js';
import { cfg }       from '../../core/config.js';

// ─── Persistencia ────────────────────────────────────────────────────────────────
const _lsNivel  = () => `${cfg('storage.prefijo', 'app')}-simon-nivel`;
const _lsRecord = () => `${cfg('storage.prefijo', 'app')}-simon-record`;

function _cargarRecord()     { try { return JSON.parse(localStorage.getItem(_lsRecord()) || '{}'); } catch { return {}; } }
function _guardarRecord(rec) { try { localStorage.setItem(_lsRecord(), JSON.stringify(rec)); } catch {} }
function _cargarNivelId()    { try { return parseInt(localStorage.getItem(_lsNivel()), 10) || 1; } catch { return 1; } }
function _guardarNivelId(id) { try { localStorage.setItem(_lsNivel(), String(id)); } catch {} }

// ─── Rutas ────────────────────────────────────────────────────────────────────────
const PICTO_URL = (r) => `assets/pictogramas/${r.toLowerCase()}`;
const AUDIO_URL = (r, lang = 'es') => `assets/audio/${lang}/${r.replace(/\.png$/i, '').toLowerCase()}.mp3`;

// ─── Configuración ────────────────────────────────────────────────────────────────
const NIVELES = [
  { id: 1, estrellas: '⭐',     piezas: 4, nombre: 'Fácil'   },
  { id: 2, estrellas: '⭐⭐',   piezas: 6, nombre: 'Medio'   },
  { id: 3, estrellas: '⭐⭐⭐', piezas: 8, nombre: 'Difícil' },
];
const SECUENCIA_INICIAL = 2;
const DUR_ILUM  = 620;   // ms que una pieza queda iluminada
const DUR_GAP   = 260;   // ms entre piezas
const DUR_PREV  = 400;   // pausa antes de iniciar la secuencia

// ─── Generador de tonos (Do mayor, sube de octava al completar) ───────────────────
// Frecuencias base: Do4–Do5. Cada octava siguiente multiplica por 2.
const NOTAS_BASE = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
let _audioCtx    = null;
let _notaIdx     = 0;     // índice dentro de NOTAS_BASE (0–7)
let _octavaShift = 0;     // número de octavas subidas

function _getAudioCtx() {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

function _tocarNota(duracionMs = 420) {
  try {
    const ctx   = _getAudioCtx();
    const freq  = NOTAS_BASE[_notaIdx] * Math.pow(2, _octavaShift);
    const osc   = ctx.createOscillator();
    const gain  = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type      = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.38, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duracionMs / 1000);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duracionMs / 1000);

    // Avanzar índice; subir octava al completar la escala
    _notaIdx++;
    if (_notaIdx >= NOTAS_BASE.length) {
      _notaIdx = 0;
      _octavaShift = (_octavaShift + 1) % 3; // máx 3 octavas de desplazamiento
    }
  } catch {}
}

function _resetNotas() { _notaIdx = 0; _octavaShift = 0; }

// ─── Estado ───────────────────────────────────────────────────────────────────────
let _el          = null;
let _catalogo    = [];
let _temas       = [];
let _tema        = null;
let _nivel       = NIVELES[0];
let _tablero     = [];
let _secuencia   = [];
let _pasoUsuario = 0;
let _ronda       = 1;
let _aceptaInput = false;
let _seqToken    = 0;
let _lang        = 'es';
let _audioEl     = null;

// ─── API pública ──────────────────────────────────────────────────────────────────
export async function init(container) {
  _el = container;
  const langCfg = window._langConfig || { es: true, en: false };
  _lang  = (langCfg.es && langCfg.en) ? 'ambos' : langCfg.en ? 'en' : 'es';
  _nivel = NIVELES.find(n => n.id === _cargarNivelId()) || NIVELES[0];
  _tema  = null;

  try {
    _catalogo = (await (await fetch('./data/pictos.json')).json())
      .filter(e => e.ruta_img && e.es);
  } catch { _catalogo = []; }

  try { _temas = await (await fetch('./data/temas.json')).json(); }
  catch { _temas = []; }

  _render();
  _nuevaPartida();
  window.addEventListener('lang-change', _onLangChange);
}

export function destroy() {
  window.removeEventListener('lang-change', _onLangChange);
  _detenerTodo();
  _el = null; _catalogo = []; _temas = []; _tablero = []; _secuencia = [];
}

export function onEnter() { _abrirModalCat(); }

export function onLeave() {
  _detenerTodo();
  Telemetry.track('simon_sesion', { _modulo: 'simon', nivel: _nivel.id, ronda_alcanzada: _ronda });
}

export async function pause() { _detenerTodo(); }

export async function resume(container) {
  _el = container;
  const langCfg = window._langConfig || { es: true, en: false };
  _lang  = (langCfg.es && langCfg.en) ? 'ambos' : langCfg.en ? 'en' : 'es';
  _nivel = NIVELES.find(n => n.id === _cargarNivelId()) || _nivel;
  _render();
  _nuevaPartida();
  window.removeEventListener('lang-change', _onLangChange);
  window.addEventListener('lang-change', _onLangChange);
}

// ─── Render del shell ─────────────────────────────────────────────────────────────
function _render() {
  _el.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;';
  _el.innerHTML = `
    <style>
      /* ── Wrap principal ── */
      #sm-wrap {
        flex:1; min-height:0; display:flex; flex-direction:column;
        padding:12px 14px calc(10px + env(safe-area-inset-bottom,0px));
        gap:10px; overflow:hidden;
      }

      /* ── Barra superior ── */
      #sm-top { display:flex; align-items:center; gap:10px; flex-shrink:0; }
      #sm-cat-btn {
        display:flex; align-items:center;
        min-height:44px; padding:8px 16px; border-radius:99px;
        background:rgba(244,63,94,0.14); border:1.5px solid rgba(244,63,94,0.40);
        color:#fff; font-family:inherit; font-weight:900; font-size:.95rem; cursor:pointer;
        transition:transform .12s, background .2s; flex-shrink:0;
      }
      #sm-cat-btn:active { transform:scale(.97); }
      #sm-niveles { display:flex; gap:8px; }
      .sm-nivel {
        min-height:44px; padding:6px 12px; border-radius:12px; cursor:pointer;
        font-family:inherit; font-weight:900; font-size:.95rem; color:#fff;
        background:rgba(255,255,255,0.08); border:1.5px solid rgba(255,255,255,0.14);
        transition:transform .12s, background .18s;
      }
      .sm-nivel:active { transform:scale(.95); }
      .sm-nivel.activo { background:rgba(244,63,94,0.22); border-color:rgba(244,63,94,0.65); }
      .sm-nivel:disabled { opacity:.4; pointer-events:none; }

      /* ── Indicador de estado ── */
      #sm-estado {
        flex-shrink:0; text-align:center;
        font-family:'Outfit',sans-serif; font-weight:900;
        font-size:clamp(1rem,3vw,1.4rem); color:#fff; min-height:1.5em;
      }
      #sm-ronda {
        margin-left:auto; flex-shrink:0; white-space:nowrap;
        font-size:.88rem; font-weight:800; color:rgba(255,255,255,0.50);
      }
      #sm-info { display:flex; align-items:center; flex-shrink:0; }

      /* ── Tablero ── */
      #sm-board-wrap { flex:1; min-height:0; position:relative; }
      #sm-board {
        width:100%; height:100%; display:grid;
        gap:12px; box-sizing:border-box;
      }
      /* Landscape */
      #sm-board.p4 { grid-template-columns:repeat(2,1fr); grid-template-rows:repeat(2,1fr); }
      #sm-board.p6 { grid-template-columns:repeat(3,1fr); grid-template-rows:repeat(2,1fr); }
      #sm-board.p8 { grid-template-columns:repeat(4,1fr); grid-template-rows:repeat(2,1fr); }
      /* Portrait */
      @media (orientation:portrait) {
        #sm-board.p4 { grid-template-columns:repeat(2,1fr); grid-template-rows:repeat(2,1fr); }
        #sm-board.p6 { grid-template-columns:repeat(2,1fr); grid-template-rows:repeat(3,1fr); }
        #sm-board.p8 { grid-template-columns:repeat(2,1fr); grid-template-rows:repeat(4,1fr); }
      }

      .sm-tile {
        position:relative; border-radius:20px; cursor:pointer; overflow:hidden;
        display:flex; flex-direction:column; align-items:stretch;
        gap:0; padding:10px 10px 8px;
        background:#ffffff;
        border:2px solid rgba(255,255,255,0.18);
        box-shadow:0 4px 14px rgba(0,0,0,0.18);
        transition:box-shadow .18s, background .18s, border-color .18s, filter .18s;
        -webkit-tap-highlight-color:transparent;
      }
      /* Wrapper que ocupa todo el espacio disponible del tile */
      .sm-picto-wrap {
        flex:1; min-height:0;
        display:flex; align-items:center; justify-content:center;
        overflow:hidden;
      }
      .sm-picto-wrap img {
        width:100%; height:100%; object-fit:contain;
        display:block;
      }
      .sm-tile .sm-tile-label {
        flex-shrink:0;
        font-family:'Outfit',sans-serif; font-weight:900;
        font-size:clamp(.85rem,2.4vw,1.15rem); color:#1a1a2e;
        text-align:center; line-height:1.2; padding-top:6px;
      }
      #sm-board.bloqueado .sm-tile { cursor:default; }

      /* Iluminada — aqua con brillo */
      .sm-tile.activa {
        background:rgba(0,229,210,0.22);
        border-color:#00e5d2;
        box-shadow:
          0 0 0 3px rgba(0,229,210,0.55),
          0 0 28px 6px rgba(0,229,210,0.45),
          0 12px 36px rgba(0,180,170,0.40);
        filter:brightness(1.08) saturate(1.1);
      }
      .sm-tile.activa .sm-tile-label { color:#003d3a; }
      .sm-tile.activa .sm-picto-wrap img { filter:brightness(1.12) saturate(1.15); }
      /* Error suave */
      .sm-tile.mal { background:rgba(251,191,36,.22); border-color:rgba(251,191,36,.85); }

      /* overlay de play eliminado — se inicia directo con las instrucciones */
      @keyframes sm-float {
        0%,100% {
          transform:translateY(0) scale(1);
          box-shadow:0 0 0 10px rgba(244,63,94,.18),0 0 50px 18px rgba(244,63,94,.50),0 0 100px 40px rgba(244,63,94,.22),0 10px 36px rgba(244,63,94,.55);
        }
        50% {
          transform:translateY(-12px) scale(1.05);
          box-shadow:0 0 0 14px rgba(244,63,94,.22),0 0 70px 26px rgba(244,63,94,.60),0 0 130px 55px rgba(244,63,94,.28),0 20px 50px rgba(244,63,94,.65);
        }
      }

      /* ── Modal de instrucciones — sin blur, resplandor en estrella y texto ── */
      #sm-modal-intro {
        position:absolute; inset:0; z-index:20;
        background:rgba(5,18,48,0.78);
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        gap:20px; opacity:0; pointer-events:none;
        transition:opacity .35s;
      }
      #sm-modal-intro.visible { opacity:1; pointer-events:all; }
      #sm-estrella {
        font-size:clamp(4rem,16vw,7rem); line-height:1;
        animation:sm-star-pulse 1.1s ease-in-out infinite;
        /* Resplandor dorado alrededor de la estrella */
        filter:drop-shadow(0 0 18px rgba(255,220,50,0.90))
               drop-shadow(0 0 50px rgba(255,200,0,0.60))
               drop-shadow(0 0 90px rgba(255,180,0,0.35));
      }
      @keyframes sm-star-pulse {
        0%,100% { transform:scale(1)    rotate(0deg);   }
        25%      { transform:scale(1.12) rotate(-4deg);  }
        75%      { transform:scale(1.08) rotate(4deg);   }
      }
      #sm-intro-texto {
        font-family:'Outfit',sans-serif; font-weight:900; color:#fff; text-align:center;
        font-size:clamp(1.1rem,4vw,1.7rem); line-height:1.3;
        max-width:80%; padding:0 16px;
        /* Resplandor suave en el texto para separarlo del tablero */
        text-shadow:
          0 0 20px rgba(255,255,255,0.70),
          0 0 50px rgba(200,220,255,0.45),
          0 2px 8px rgba(0,0,0,0.60);
      }

      /* ── Controles ── */
      #sm-controles {
        flex-shrink:0; display:flex; gap:10px; justify-content:center; min-height:56px;
      }
      .sm-btn {
        min-height:56px; padding:0 22px; border-radius:16px; border:none;
        cursor:pointer; font-family:inherit; font-weight:900; font-size:1rem;
        color:#fff; display:flex; align-items:center; justify-content:center; gap:8px;
        transition:transform .12s, filter .18s;
      }
      .sm-btn:active { transform:scale(.96); }
      #sm-repetir {
        background:rgba(255,255,255,0.12);
        border:1.5px solid rgba(255,255,255,0.25);
      }
      #sm-repetir.oculto { display:none; }
      #sm-repetir img {
        width:22px; height:22px; object-fit:contain;
        filter:invert(1); pointer-events:none;
        transition:transform .35s cubic-bezier(.34,1.56,.64,1);
      }
      #sm-repetir:active img { transform:rotate(-360deg); }

      /* ── Modal de categorías (patrón frases.js) ── */
      #sm-modal-cat {
        position:absolute; inset:0; z-index:30;
        background:rgba(5,20,50,0.80);
        backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
        display:flex; align-items:flex-end;
        opacity:0; pointer-events:none; transition:opacity .25s;
      }
      #sm-modal-cat.visible { opacity:1; pointer-events:all; }
      #sm-modal-cat-box {
        width:100%; max-height:78vh; overflow-y:auto; -webkit-overflow-scrolling:touch;
        background:rgba(10,20,50,0.98); border-radius:24px 24px 0 0;
        padding:20px 16px calc(28px + env(safe-area-inset-bottom,0px));
        border-top:2px solid rgba(244,63,94,0.40);
        transform:translateY(20px); transition:transform .3s cubic-bezier(.34,1.1,.64,1);
      }
      #sm-modal-cat.visible #sm-modal-cat-box { transform:translateY(0); }
      #sm-modal-cat-header {
        display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;
      }
      #sm-modal-cat-titulo {
        font-size:.82rem; font-weight:900; letter-spacing:.10em;
        text-transform:uppercase; color:rgba(244,63,94,0.85);
      }
      #sm-modal-cat-cerrar {
        width:42px; height:42px; border-radius:50%; border:none;
        background:rgba(255,255,255,0.12); color:#fff; font-size:1.3rem;
        cursor:pointer; display:flex; align-items:center; justify-content:center;
      }
      #sm-modal-cat-lista { display:flex; flex-direction:column; gap:8px; }
      .sm-grupo-label {
        font-size:.70rem; font-weight:900; letter-spacing:.10em;
        text-transform:uppercase; color:rgba(255,255,255,0.40); margin:12px 0 6px;
      }
      .sm-tema-opcion {
        display:flex; align-items:center; gap:14px; min-height:56px;
        padding:12px 16px; border-radius:16px; cursor:pointer;
        background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.10);
        font-family:inherit; color:#fff; text-align:left; width:100%;
        transition:background .15s;
      }
      .sm-tema-opcion.activo { background:rgba(244,63,94,0.18); border-color:rgba(244,63,94,0.45); }
      .sm-tema-emoji  { font-size:1.5rem; flex-shrink:0; }
      .sm-tema-nombre { font-size:1rem; font-weight:900; }
      .sm-tema-desc   { font-size:.74rem; color:rgba(255,255,255,.40); font-weight:700; }
    </style>

    <div id="sm-wrap">
      <div id="sm-top">
        <button id="sm-cat-btn">Temas</button>
        <div id="sm-niveles"></div>
      </div>

      <div id="sm-info">
        <div id="sm-estado"></div>
        <span id="sm-ronda"></span>
      </div>

      <div id="sm-board-wrap">
        <div id="sm-board" class="bloqueado"></div>

        <!-- Modal de instrucciones -->
        <div id="sm-modal-intro">
          <div id="sm-estrella">⭐</div>
          <div id="sm-intro-texto"></div>
        </div>
      </div>

      <div id="sm-controles">
        <button class="sm-btn" id="sm-repetir"><img src="assets/ui/reiniciar.svg" alt="">Ver otra vez</button>
      </div>
    </div>

    <!-- Modal de categorías -->
    <div id="sm-modal-cat">
      <div id="sm-modal-cat-box">
        <div id="sm-modal-cat-header">
          <span id="sm-modal-cat-titulo">Elige una categoría</span>
          <button id="sm-modal-cat-cerrar" aria-label="Cerrar">✕</button>
        </div>
        <div id="sm-modal-cat-lista"></div>
      </div>
    </div>
  `;

  // Selector de niveles
  const contNiveles = _el.querySelector('#sm-niveles');
  NIVELES.forEach(n => {
    const b = document.createElement('button');
    b.className = 'sm-nivel' + (n.id === _nivel.id ? ' activo' : '');
    b.textContent = n.estrellas;
    b.title = `${n.nombre} — ${n.piezas} piezas`;
    b.dataset.nivel = n.id;
    b.addEventListener('click', () => { haptic(8); _cambiarNivel(n.id); });
    contNiveles.appendChild(b);
  });

  _el.querySelector('#sm-repetir').addEventListener('click', () => { haptic(8); _reproducirSecuencia(); });
  _el.querySelector('#sm-cat-btn').addEventListener('click', () => { haptic(10); _abrirModalCat(); });
  _el.querySelector('#sm-modal-cat-cerrar').addEventListener('click', () => _cerrarModalCat());
  _el.querySelector('#sm-modal-cat').addEventListener('click', e => { if (e.target.id === 'sm-modal-cat') _cerrarModalCat(); });
}

// ─── Flujo de juego ───────────────────────────────────────────────────────────────
function _cambiarNivel(id) {
  if (_nivel.id === id) return;
  _nivel = NIVELES.find(n => n.id === id) || NIVELES[0];
  _guardarNivelId(_nivel.id);
  _el.querySelectorAll('.sm-nivel').forEach(b =>
    b.classList.toggle('activo', Number(b.dataset.nivel) === _nivel.id));
  _nuevaPartida();
}

function _nuevaPartida() {
  _detenerSecuencia();
  _ronda = 1; _secuencia = []; _pasoUsuario = 0; _aceptaInput = false;
  _resetNotas();

  let lista = _catalogo;
  if (_tema?.palabras?.length) {
    const orden = new Map(_tema.palabras.map((pid, i) => [pid, i]));
    lista = _catalogo.filter(e => orden.has(e.id)).sort((a,b) => orden.get(a.id) - orden.get(b.id));
  }
  _tablero = _muestraAleatoria(lista, _nivel.piezas);

  _renderTablero();
  _actualizarRonda();
  _setStatus('', '');
  _el.querySelector('#sm-repetir')?.classList.add('oculto');
  _iniciarConIntro();
}

// ── Modal de instrucciones ────────────────────────────────────────────────────────
// Textos fijos en español e inglés — sin nombre de perfil (simplicidad).
// Intenta reproducir assets/audio/simon/{lang}/simon-inicio.mp3;
// si falla, cae a TTS.
const INTRO_ES = '¡Hola! Observa los botones y sigue la secuencia';
const INTRO_EN = 'Hello! Look at the buttons and follow the sequence';

function _iniciarConIntro() {
  haptic(10);

  const modal   = _el.querySelector('#sm-modal-intro');
  const texto   = _el.querySelector('#sm-intro-texto');
  const lang    = (window._langConfig?.en && !window._langConfig?.es) ? 'en' : 'es';
  const msg     = lang === 'en' ? INTRO_EN : INTRO_ES;
  const ttsLang = lang === 'en' ? 'en-US' : 'es-MX';
  const audioSrc = `assets/audio/simon/${lang}/simon-inicio.mp3`;

  texto.textContent = msg;
  modal.classList.add('visible');

  const continuar = () => {
    if (!_el) return;
    modal.classList.remove('visible');
    setTimeout(() => { if (_el) _jugar(); }, 350);
  };

  // Intentar MP3 pregenerado; fallback a TTS si no existe o falla
  const audio = new Audio(audioSrc);
  audio.onended = continuar;
  audio.onerror = () => {
    const synth = window.speechSynthesis;
    if (!synth) { continuar(); return; }
    const u = new SpeechSynthesisUtterance(msg);
    u.lang = ttsLang; u.rate = 0.88; u.pitch = 1.1;
    const voz = TTS.getVoice?.(ttsLang);
    if (voz) u.voice = voz;
    u.onend = continuar; u.onerror = continuar;
    try { synth.cancel(); synth.speak(u); } catch { continuar(); }
  };
  audio.play().catch(() => audio.onerror());
}

function _renderTablero() {
  const board = _el.querySelector('#sm-board');
  board.className = `bloqueado p${_nivel.piezas}`;
  board.innerHTML = '';
  _tablero.forEach((entrada, idx) => {
    const tile = document.createElement('button');
    tile.className = 'sm-tile';
    tile.dataset.idx = idx;
    tile.innerHTML = `
      <div class="sm-picto-wrap"><img src="${PICTO_URL(entrada.ruta_img)}" alt="${entrada.es}"></div>
      <span class="sm-tile-label">${entrada.es}</span>`;
    tile.querySelector('img').onerror = ev => { ev.target.style.visibility = 'hidden'; };
    tile.addEventListener('click', () => _onTap(idx));
    board.appendChild(tile);
  });
}

function _jugar() {
  if (_secuencia.length === 0)
    for (let i = 0; i < SECUENCIA_INICIAL; i++) _secuencia.push(_pasoAleatorio());
  _reproducirSecuencia();
}

// ─── Secuencia de iluminación ─────────────────────────────────────────────────────
async function _reproducirSecuencia() {
  if (!_secuencia.length) return;
  _setStatus('Observa…', 'observa');
  _setBloqueado(true);
  _el.querySelector('#sm-repetir')?.classList.add('oculto');
  const token = ++_seqToken;
  await _sleep(DUR_PREV);

  for (let i = 0; i < _secuencia.length; i++) {
    if (token !== _seqToken || !_el) return;
    const idx = _secuencia[i];
    _iluminar(idx);
    _tocarNota(DUR_ILUM - 80);
    await _sleep(200);                        // pequeña pausa para que la nota arrange
    if (token !== _seqToken || !_el) return;
    await _reproducirNombreAsync(_tablero[idx]);
    await _sleep(DUR_ILUM - 200);
    if (token !== _seqToken || !_el) return;
    _apagar(idx);
    await _sleep(DUR_GAP);
  }
  if (token !== _seqToken || !_el) return;
  _pasoUsuario = 0;
  _setStatus('Tu turno', 'turno');
  _setBloqueado(false);
  _el.querySelector('#sm-repetir')?.classList.remove('oculto');
}

// Reproduce el nombre como promesa (resuelve al terminar el audio/TTS)
function _reproducirNombreAsync(entrada) {
  return new Promise(resolve => {
    if (!entrada) { resolve(); return; }
    const langCode = _lang === 'en' ? 'en' : 'es';
    const texto    = (langCode === 'en' && entrada.en) ? entrada.en : entrada.es;
    if (!_audioEl) { _audioEl = document.createElement('audio'); _audioEl.preload = 'none'; }
    try { _audioEl.pause(); } catch {}
    let done = false;
    const fin = () => { if (!done) { done = true; resolve(); } };
    _audioEl.onended = fin; _audioEl.onerror = () => {
      const u    = new SpeechSynthesisUtterance(texto);
      u.lang     = langCode === 'en' ? 'en-US' : 'es-MX';
      u.rate     = 0.95; u.pitch = 1.1;
      u.onend    = fin; u.onerror = fin;
      try { window.speechSynthesis.speak(u); } catch { fin(); }
    };
    _audioEl.src = AUDIO_URL(entrada.ruta_img, langCode);
    _audioEl.play().catch(() => _audioEl.onerror());
    // Guardia de tiempo máximo (evita bloqueos si el audio dura mucho)
    setTimeout(fin, 1800);
  });
}

// ─── Interacción de la usuaria ────────────────────────────────────────────────────
function _onTap(idx) {
  if (!_aceptaInput) return;
  haptic(8);
  _flashTile(idx);
  _tocarNota(320);

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
  _setStatus('¡Muy bien! 🎉', 'bien');
  _actualizarRonda();

  const rec  = _cargarRecord();
  const clave = String(_nivel.id);
  if (!rec[clave] || _ronda > rec[clave]) { rec[clave] = _ronda; _guardarRecord(rec); }

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
  _setStatus('Uy… observa otra vez 👀', '');
  setTimeout(() => {
    if (!_el) return;
    tile?.classList.remove('mal');
    _reproducirSecuencia();
  }, 950);
}

// ─── Estados de UI ────────────────────────────────────────────────────────────────
function _setBloqueado(bloqueado) {
  _aceptaInput = !bloqueado;
  _el.querySelector('#sm-board')?.classList.toggle('bloqueado', bloqueado);
}

function _setStatus(texto, clase = '') {
  const el = _el?.querySelector('#sm-estado');
  if (!el) return;
  el.textContent = texto;
  el.className   = clase;
}

function _actualizarRonda() {
  const el  = _el?.querySelector('#sm-ronda');
  if (!el) return;
  const rec  = _cargarRecord();
  const mejor = rec[String(_nivel.id)];
  el.textContent = mejor && mejor > 1
    ? `Ronda ${_ronda}  ·  Récord ${mejor}`
    : `Ronda ${_ronda}`;
}

// ─── Iluminación ─────────────────────────────────────────────────────────────────
function _tiles()       { return _el ? [..._el.querySelectorAll('.sm-tile')] : []; }
function _iluminar(idx) { _tiles()[idx]?.classList.add('activa'); }
function _apagar(idx)   { _tiles()[idx]?.classList.remove('activa'); }
function _flashTile(idx) {
  const t = _tiles()[idx]; if (!t) return;
  t.classList.add('activa');
  setTimeout(() => t.classList.remove('activa'), 280);
}

// ─── Modal de categorías ──────────────────────────────────────────────────────────
function _abrirModalCat() {
  const lista = _el.querySelector('#sm-modal-cat-lista');
  lista.innerHTML = '';

  lista.appendChild(_opcionTema(
    { id: null, emoji: '🌊', label: 'Todas las palabras', desc: `${_catalogo.length} palabras` },
    _tema === null
  ));

  const grupos = { vocabulario: [], lenguaje: [], otros: [] };
  _temas.forEach(t => (grupos[t.tipo] || grupos.otros).push(t));

  const _seccion = (titulo, arr) => {
    if (!arr.length) return;
    const h = document.createElement('div');
    h.className = 'sm-grupo-label'; h.textContent = titulo;
    lista.appendChild(h);
    arr.forEach(t => lista.appendChild(_opcionTema(
      { id: t.id, emoji: t.emoji || '📚', label: t.label, desc: `${t.palabras?.length || 0} palabras` },
      _tema?.id === t.id
    )));
  };
  _seccion('Vocabulario', grupos.vocabulario);
  _seccion('Lenguaje',    grupos.lenguaje);
  _seccion('Otros',       grupos.otros);

  const box = _el.querySelector('#sm-modal-cat-box');
  box.scrollTop = 0;
  _el.querySelector('#sm-modal-cat').classList.add('visible');
}

function _opcionTema({ id, emoji, label, desc }, activo) {
  const btn = document.createElement('button');
  btn.className = 'sm-tema-opcion' + (activo ? ' activo' : '');
  btn.innerHTML = `
    <span class="sm-tema-emoji">${emoji}</span>
    <span><div class="sm-tema-nombre">${label}</div><div class="sm-tema-desc">${desc}</div></span>`;
  btn.addEventListener('click', () => { haptic(10); _aplicarTema(id); _cerrarModalCat(); });
  return btn;
}

function _cerrarModalCat() {
  _el.querySelector('#sm-modal-cat')?.classList.remove('visible');
}

function _aplicarTema(id) {
  _tema = id === null ? null : (_temas.find(t => t.id === id) || null);
  // El botón solo dice 'Temas' — no hay label dinámico
  _nuevaPartida();
}

// ─── Utilidades ───────────────────────────────────────────────────────────────────
const _sleep         = ms => new Promise(r => setTimeout(r, ms));
const _pasoAleatorio = ()  => Math.floor(Math.random() * _tablero.length);

function _muestraAleatoria(arr, n) {
  const c = [...arr];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); [c[i], c[j]] = [c[j], c[i]];
  }
  return c.slice(0, Math.min(n, c.length));
}

function _detenerSecuencia() { _seqToken++; }
function _detenerTodo() {
  _detenerSecuencia(); _aceptaInput = false;
  TTS.stop();
  try { window.speechSynthesis?.cancel(); } catch {}
  if (_audioEl) { try { _audioEl.pause(); } catch {} }
}

// ─── Cambio de idioma ─────────────────────────────────────────────────────────────
function _onLangChange(e) {
  const langCfg = e.detail?.langConfig || window._langConfig;
  if (!langCfg) return;
  _lang = (langCfg.es && langCfg.en) ? 'ambos' : langCfg.en ? 'en' : 'es';
}