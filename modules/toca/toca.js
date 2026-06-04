/* modules/toca/toca.js
   Módulo "Escucha y Toca" — Marina 2

   Mecánica:
   · Voz dice "Toca la fresa" — 3/4/5/6/8 pictogramas en pantalla
   · Toca el correcto → anillo verde + pop + eco de la palabra
   · Toca el incorrecto → wiggle + repite la instrucción + reinicia contador
   · Aciertos CONSECUTIVOS para subir de nivel (un fallo reinicia el contador)
   · 5 niveles: 3 → 4 → 5 → 6 → 8 opciones
   · Aciertos requeridos por nivel: 3 → 4 → 5 → 6 → 8

   Modo infinito (tras completar nivel 5):
   · Sin pantalla de "nivel completado" — rondas continuas con 8 opciones
   · Contador de racha consecutiva visible en pantalla
   · Al fallar: muestra puntuación y récord, guarda el mejor en localStorage

   Bilingüe (cuando es && en activos):
   · _lang = 'ambos' — los labels de cada opción muestran español e inglés
     con igual peso tipográfico, separados por una línea divisoria sutil.
   · El audio de instrucción y de acierto siempre en español (idioma primario).
*/

import { TTS } from '../../core/tts.js';
import { haptic, lanzarConfeti } from '../../core/ui.js';
import { Telemetry } from '../../core/telemetry.js';

const PICTO_URL = (ruta) => `assets/pictogramas/${ruta}`;
const AUDIO_URL = (ruta, lang) => `assets/audio/${lang}/${ruta.replace('.png', '').toLowerCase()}.mp3`;

// Opciones por nivel (índice 0-4)
const NIVELES = [3, 4, 5, 6, 8];

// Aciertos CONSECUTIVOS requeridos para subir de nivel (índice 0-4)
// Progresión basada en criterios de aprendizaje sin error (errorless learning)
// y consolidación de respuestas para apps de comunicación aumentativa:
//   Nivel 1 (3 opts) → 3 aciertos: entrada fluida y motivante
//   Nivel 2 (4 opts) → 4 aciertos: introduce dificultad gradual
//   Nivel 3 (5 opts) → 5 aciertos: consolidación media
//   Nivel 4 (6 opts) → 6 aciertos: reto real
//   Nivel 5 (8 opts) → 8 aciertos: máxima dificultad antes de infinito
const ACIERTOS_POR_NIVEL = [3, 4, 5, 6, 8];

const MEJOR_RACHA_KEY = 'marina2_toca_mejor_racha';

// Tamaño fijo de mosaico — igual en todos los niveles
const MOSAIC_SIZE = 272; // px

let _el           = null;
let _catalogo     = [];
let _temas        = [];
let _tema         = null;
let _pool         = [];
let _langConfig   = { es: true, en: false };
let _lang         = 'es';   // 'es' | 'en' | 'ambos'
let _nivel        = 0;
let _aciertos     = 0;   // aciertos consecutivos en el nivel actual
let _modoInfinito = false;
let _racha        = 0;   // racha en modo infinito
let _mejorRacha   = 0;   // récord guardado en localStorage
let _objetivo     = null;
let _opciones     = [];
let _esperando    = false;
let _audioEl      = null;

// Cache de dimensiones del grid + observer. _ajustarTamanos usa estos
// valores cacheados (siempre el tamaño real estable) en lugar de medir
// al vuelo, eliminando la condición de carrera que producía miniaturas.
let _gridW     = 0;
let _gridH     = 0;
let _resizeObs = null;

// ─── Helper: idioma de audio ──────────────────────────────────────────────────
// Cuando ambos idiomas están activos, el audio de instrucción y de acierto
// se reproduce en español. La instrucción hablada en dos idiomas seguidos
// aumentaría la carga cognitiva sin beneficio claro.
function _langAudio() {
  return _lang === 'ambos' ? 'es' : _lang;
}

// ─── API pública ──────────────────────────────────────────────────────────────

export async function init(container) {
  _el = container;
  _langConfig = window._langConfig ? { ...window._langConfig } : { es: true, en: false };
  _lang = (_langConfig.es && _langConfig.en) ? 'ambos'
        : _langConfig.en ? 'en' : 'es';
  _nivel        = 0;
  _aciertos     = 0;
  _modoInfinito = false;
  _racha        = 0;
  _esperando    = false;
  _tema         = null;

  // Cargar récord guardado
  try { _mejorRacha = parseInt(localStorage.getItem(MEJOR_RACHA_KEY) || '0', 10) || 0; }
  catch { _mejorRacha = 0; }

  try {
    const res = await fetch('./data/pictos.json');
    const cat = await res.json();
    _catalogo = cat.filter(e => e.ruta_img && e.es && e.art !== undefined);
  } catch (e) {
    console.error('[toca] No se pudo cargar pictos.json', e);
    _catalogo = [];
  }

  try {
    const res2 = await fetch('./data/temas.json');
    _temas = await res2.json();
  } catch {
    _temas = [];
  }

  _pool = _shuffle([..._catalogo]);
  _render();
  _abrirModalTemas();
  window.addEventListener('lang-change', _onLangChange);
}

export function destroy() {
  window.removeEventListener('lang-change', _onLangChange);
  _resizeObs?.disconnect();
  _resizeObs = null;
  _gridW = 0; _gridH = 0;
  TTS.stop();
  if (_audioEl) { _audioEl.pause(); _audioEl.src = ''; _audioEl = null; }
  _el = null; _catalogo = []; _pool = []; _temas = [];
}

export function onEnter() {}
export function onLeave() {
  TTS.stop();
  if (_audioEl) _audioEl.pause();
  Telemetry.track('toca_sesion', {
    _modulo: 'toca',
    nivel_alcanzado: _nivel + 1,
    opciones_nivel: NIVELES[Math.min(_nivel, NIVELES.length - 1)],
    modo_infinito: _modoInfinito,
    mejor_racha: _mejorRacha,
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
  _lang = (_langConfig.es && _langConfig.en) ? 'ambos'
        : _langConfig.en ? 'en' : 'es';

  // Reconstruir HTML (mismo patrón que memorama — el contenedor pudo
  // haber sido limpiado por app.js, no se puede asumir que persiste).
  _render();

  // Restaurar estado visual del header según el estado en memoria
  const label = _el.querySelector('#tc-tema-label');
  if (label) {
    label.textContent = _tema
      ? _tema.label
      : (_lang === 'en' ? 'All play' : 'Todos juegan');
  }

  if (_modoInfinito) {
    const nivelValor = _el.querySelector('#tc-nivel-valor');
    if (nivelValor) nivelValor.textContent = '∞';
    _el.querySelector('#tc-racha-wrap')?.classList.add('visible');
    const dots = _el.querySelector('#tc-dots');
    if (dots) dots.style.display = 'none';
    if (_mejorRacha > 0) {
      _el.querySelector('#tc-record-wrap')?.classList.add('visible');
      const rv = _el.querySelector('#tc-record-valor');
      if (rv) rv.textContent = _mejorRacha;
    }
    _actualizarRacha();
  }

  _esperando = false;

  // Diferir _nuevaRonda dos frames: el primero deja que el navegador aplique
  // el layout del HTML recién insertado, el segundo garantiza que el grid
  // ya tenga clientWidth/clientHeight reales antes de _ajustarTamanos().
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (_el) _nuevaRonda();
    });
  });
}

// ─── Cambio de idioma ─────────────────────────────────────────────────────────

function _onLangChange(e) {
  const cfg = e.detail?.langConfig;
  if (!cfg) return;
  const nuevo = (cfg.es && cfg.en) ? 'ambos' : cfg.en ? 'en' : 'es';
  if (nuevo === _lang) return;
  _lang = nuevo;
  _nuevaRonda();
}

// ─── Render principal ─────────────────────────────────────────────────────────

function _render() {
  _el.innerHTML = `
  <style>
    :host, #tc-root { box-sizing:border-box; }
    * { box-sizing:inherit; }

    /* ── Layout ── */
    /* El contenedor (_el) debe ser position:absolute; inset:0 desde app.js */
    #tc-root {
      width:100%; height:100%;
      display:flex; flex-direction:column;
      background:linear-gradient(160deg,#032340 0%,#05193c 60%,#071428 100%);
      font-family:'Nunito','Outfit',system-ui,sans-serif;
      color:#fff; overflow:hidden; position:relative;
      user-select:none; -webkit-user-select:none;
    }

    /* ── Header ── */
    #tc-header {
      flex-shrink:0; display:flex; align-items:center; gap:8px;
      padding:10px 14px 6px; flex-wrap:wrap;
    }
    #tc-nivel-wrap, #tc-racha-wrap, #tc-record-wrap {
      display:flex; align-items:center; gap:4px;
      background:rgba(255,255,255,0.08);
      border:1px solid rgba(255,255,255,0.14);
      border-radius:99px; padding:4px 10px;
      font-size:.80rem; font-weight:900;
    }
    #tc-racha-wrap, #tc-record-wrap {
      display:none;
    }
    #tc-racha-wrap.visible  { display:flex; }
    #tc-record-wrap.visible { display:flex; }
    #tc-nivel-label, #tc-racha-label {
      font-size:.64rem; font-weight:900; letter-spacing:.10em;
      text-transform:uppercase; opacity:.55;
    }
    #tc-btn-tema {
      margin-left:auto; display:flex; align-items:center; gap:5px;
      padding:5px 12px; border-radius:99px; border:1px solid rgba(255,255,255,0.18);
      background:rgba(255,255,255,0.08); color:#fff; cursor:pointer;
      font-family:inherit; font-size:.80rem; font-weight:800;
      transition:background .15s;
    }
    #tc-btn-tema:active { background:rgba(255,255,255,0.18); }
    #tc-dots {
      display:flex; gap:6px; align-items:center; flex-shrink:0;
    }
    .tc-dot {
      width:10px; height:10px; border-radius:50%;
      background:rgba(255,255,255,0.20);
      transition:background .25s, transform .2s;
    }
    .tc-dot.lleno {
      background:#00e5b0;
      box-shadow:0 0 8px rgba(0,229,176,0.60);
      transform:scale(1.2);
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
    /* Segunda línea del prompt en modo ambos — igual peso que la primera */
    .tc-prompt-en {
      display:block;
      font-size:clamp(1.1rem,3.5vw,1.5rem); font-weight:900;
      color:#fff;
      opacity:0.92;
    }
    .tc-prompt-en strong { color:#ffe566; }
    #tc-btn-repetir {
      width:48px; height:48px; border-radius:50%; border:none;
      background:#00e5b0; font-size:1.3rem; cursor:pointer;
      box-shadow:0 4px 16px rgba(0,229,176,0.45);
      transition:transform .12s;
    }
    #tc-btn-repetir:active { transform:scale(.88); }

    /* ── Grid ── */
    #tc-grid {
      flex:1; min-height:0;
      display:flex; flex-wrap:wrap;
      align-content:center; justify-content:center;
      gap:12px; padding:8px 12px;
      overflow:hidden;
    }
    .tc-opcion {
      border-radius:22px; border:3px solid rgba(255,255,255,0.30);
      background:#fff;
      cursor:pointer; display:flex; flex-direction:column;
      align-items:center; justify-content:center; gap:0;
      padding:10px; transition:transform .15s, border-color .2s, box-shadow .2s;
      overflow:hidden; position:relative;
      box-shadow:0 4px 16px rgba(0,0,0,0.25);
    }
    .tc-opcion:active { transform:scale(.93); }
    /* Monolingüe: imagen 62×62 igual que antes de los cambios */
    .tc-opcion img {
      width:62%; height:62%; object-fit:contain;
      border-radius:12px; pointer-events:none;
    }
    /* Bilingüe: imagen más compacta para que quepan los dos labels sin desbordarse.
       La clase se aplica al botón desde JS cuando _lang === 'ambos'. */
    .tc-opcion.bilingue img {
      width:56%; height:50%;
    }

    /* ── Labels de opción ── */
    /* Contenedor de los uno o dos nombres dentro de la tile */
    .tc-opcion-labels {
      display:flex; flex-direction:column;
      align-items:center; width:100%;
      gap:0; flex-shrink:0;
    }

    /* Nombre en modo monolingüe (un solo span, peso máximo) */
    .tc-opcion-label {
      font-size:clamp(.75rem,2.2vw,.95rem); font-weight:900;
      color:#07212e;
      text-align:center; padding:2px 4px 0;
      line-height:1.2;
    }

    /* Separador entre los dos nombres en modo bilingüe */
    .tc-opcion-divisor {
      width:60%; height:1px;
      background:rgba(7,33,46,0.18);
      margin:3px 0;
    }

    /* En modo bilingüe ambos nombres usan la misma escala y peso.
       El contraste de posición (arriba/abajo) es suficiente para
       distinguirlos sin imponer jerarquía tipográfica. */
    .tc-opcion-label-es,
    .tc-opcion-label-en {
      font-size:clamp(.70rem,2.0vw,.88rem); font-weight:900;
      color:#07212e;
      text-align:center; padding:0 4px;
      line-height:1.2;
    }

    .tc-opcion.correcto {
      border-color:#00e5b0;
      box-shadow:0 0 0 4px rgba(0,229,176,0.30);
      animation:tc-pop .3s cubic-bezier(.34,1.56,.64,1);
    }
    .tc-opcion.incorrecto {
      border-color:#ff6b6b;
      animation:tc-shake .35s ease;
    }
    @keyframes tc-pop {
      from { transform:scale(.85); }
      to   { transform:scale(1); }
    }
    @keyframes tc-shake {
      0%,100% { transform:translateX(0); }
      20%     { transform:translateX(-8px); }
      40%     { transform:translateX(8px); }
      60%     { transform:translateX(-5px); }
      80%     { transform:translateX(5px); }
    }

    /* ── Overlay de subida de nivel ── */
    #tc-nivel-up {
      position:absolute; inset:0;
      display:flex; flex-direction:column;
      align-items:center; justify-content:center; gap:10px;
      background:rgba(5,25,60,0.85);
      backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
      opacity:0; pointer-events:none;
      transition:opacity .3s;
      z-index:10;
    }
    #tc-nivel-up.visible { opacity:1; pointer-events:all; }
    #tc-nivel-up-emoji { font-size:3.5rem; animation:tc-pop .4s ease; }
    #tc-nivel-up-texto {
      font-size:2rem; font-weight:900; color:#fff;
      text-shadow:0 2px 20px rgba(255,229,102,0.60);
    }
    #tc-nivel-up-sub {
      font-size:1rem; font-weight:800; color:rgba(255,255,255,0.65);
    }

    /* ── Overlay de fallo en modo infinito ── */
    #tc-fallo-infinito {
      position:absolute; inset:0;
      display:flex; flex-direction:column;
      align-items:center; justify-content:center; gap:14px;
      background:rgba(5,25,60,0.90);
      backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
      opacity:0; pointer-events:none;
      transition:opacity .3s;
      z-index:10;
    }
    #tc-fallo-infinito.visible { opacity:1; pointer-events:all; }
    #tc-fallo-emoji { font-size:3rem; }
    #tc-fallo-racha {
      font-size:3.5rem; font-weight:900; color:#00e5b0;
      text-shadow:0 2px 20px rgba(0,229,176,0.50);
      line-height:1;
    }
    #tc-fallo-label {
      font-size:1rem; font-weight:800; color:rgba(255,255,255,0.60);
      letter-spacing:.05em;
    }
    #tc-fallo-record {
      font-size:1rem; font-weight:900; color:#ffe566;
      text-shadow:0 0 12px rgba(255,229,102,0.50);
      min-height:1.4em;
    }
    #tc-fallo-btn {
      margin-top:8px; padding:14px 32px; border-radius:99px; border:none;
      background:#00e5b0; color:#032340;
      font-family:inherit; font-size:1.1rem; font-weight:900;
      cursor:pointer; transition:transform .12s;
    }
    #tc-fallo-btn:active { transform:scale(.93); }

    /* ── Modal temas ── */
    #tc-modal-temas {
      position:absolute; inset:0; z-index:20;
      background:rgba(5,20,50,0.80);
      backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
      display:flex; align-items:flex-end;
      opacity:0; pointer-events:none; transition:opacity .25s;
    }
    #tc-modal-temas.visible { opacity:1; pointer-events:all; }
    #tc-modal-box {
      width:100%; max-height:70vh; overflow-y:auto; overflow-x:hidden;
      box-sizing:border-box;
      background:rgba(12,30,70,0.95);
      border-radius:24px 24px 0 0;
      padding:20px 16px 32px;
      border-top:1px solid rgba(255,255,255,0.10);
    }
    #tc-modal-titulo {
      font-size:.78rem; font-weight:900; letter-spacing:.12em;
      text-transform:uppercase; color:rgba(255,255,255,0.50); margin:0 0 12px;
    }
    #tc-modal-lista {
      display:flex; flex-direction:column; gap:8px;
      width:100%; box-sizing:border-box;
    }
    .tc-tema-opcion {
      display:flex; align-items:center; gap:14px;
      padding:14px 16px; border-radius:16px; cursor:pointer;
      background:rgba(255,255,255,0.06);
      border:1px solid rgba(255,255,255,0.10);
      font-family:inherit; color:#fff; text-align:left;
      transition:background .15s, transform .12s;
      width:100%; box-sizing:border-box; min-width:0;
    }
    .tc-tema-opcion:active { transform:scale(.97); }
    .tc-tema-opcion.activo { background:rgba(0,229,176,0.15); border-color:rgba(0,229,176,0.40); }
    .tc-tema-emoji  { font-size:1.5rem; flex-shrink:0; }
    .tc-tema-info   { display:flex; flex-direction:column; gap:2px; min-width:0; }
    .tc-tema-nombre { font-size:1rem; font-weight:900; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .tc-tema-desc   { font-size:.72rem; color:rgba(255,255,255,.45); font-weight:700; }

    /* ── Vacío ── */
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
    <div id="tc-racha-wrap">
      <span id="tc-racha-label">RACHA</span>
      <span id="tc-racha-valor">0</span>
    </div>
    <div id="tc-record-wrap">
      <span id="tc-record-label">🏆</span>
      <span id="tc-record-valor">0</span>
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

  <!-- Overlay subida de nivel (niveles 1-5) -->
  <div id="tc-nivel-up">
    <div id="tc-nivel-up-emoji">⭐</div>
    <div id="tc-nivel-up-texto"></div>
    <div id="tc-nivel-up-sub"></div>
  </div>

  <!-- Overlay fallo en modo infinito -->
  <div id="tc-fallo-infinito">
    <div id="tc-fallo-emoji">💫</div>
    <div id="tc-fallo-racha">0</div>
    <div id="tc-fallo-label">aciertos consecutivos</div>
    <div id="tc-fallo-record"></div>
    <button id="tc-fallo-btn">Seguir jugando</button>
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
  _el.querySelector('#tc-fallo-btn').addEventListener('click', () => {
    haptic(10);
    _el.querySelector('#tc-fallo-infinito').classList.remove('visible');
    _racha = 0;
    _actualizarRacha();
    _nuevaRonda();
  });

  _observarGrid();
}

// ─── Observer de dimensiones del grid ──────────────────────────────────────────
// El grid (#tc-grid) tiene un tamaño estable durante la sesión (flex:1 en una
// columna de altura fija). Cachear las dimensiones reales evita que
// _ajustarTamanos lea ceros justo después de un reflow.
function _observarGrid() {
  _resizeObs?.disconnect();
  const grid = _el?.querySelector('#tc-grid');
  if (!grid) return;
  _resizeObs = new ResizeObserver(entries => {
    for (const e of entries) {
      const { width, height } = e.contentRect;
      if (width > 50 && height > 50) {
        _gridW = width;
        _gridH = height;
      }
    }
  });
  _resizeObs.observe(grid);
}

// ─── Lógica de ronda ──────────────────────────────────────────────────────────

function _nuevaRonda() {
  if (!_el || !_catalogo.length) {
    _el?.querySelector('#tc-vacio')?.style.setProperty('display', 'flex');
    return;
  }
  const nOpciones = _modoInfinito
    ? NIVELES[NIVELES.length - 1]
    : NIVELES[_nivel];

  if (_pool.length < nOpciones) {
    _pool = _shuffle([..._catalogo]);
  }

  _opciones  = _pool.splice(0, nOpciones);
  _objetivo  = _opciones[Math.floor(Math.random() * nOpciones)];
  _esperando = false;

  _renderRonda();
  setTimeout(() => _reproducirInstruccion(), 350);
}

function _renderRonda() {
  const nOpciones = _modoInfinito
    ? NIVELES[NIVELES.length - 1] : NIVELES[_nivel];
  const grid = _el.querySelector('#tc-grid');

  _el.querySelector('#tc-nivel-valor').textContent = _modoInfinito ? '∞' : (_nivel + 1);
  _renderDots();
  _actualizarPrompt();

  grid.className = '';
  grid.innerHTML = '';

  _opciones.forEach((picto) => {
    const btn = document.createElement('button');
    btn.className = 'tc-opcion' + (_lang === 'ambos' ? ' bilingue' : '');
    btn.dataset.id = picto.id;

    const img = document.createElement('img');
    img.src = PICTO_URL(picto.ruta_img);
    img.alt = picto.es;
    img.onerror = () => {
      // Reintentar una vez con cache-busting por si el error fue transitorio
      if (!img.dataset.reintentado) {
        img.dataset.reintentado = '1';
        img.src = PICTO_URL(picto.ruta_img) + '?r=' + Date.now();
      } else {
        img.style.opacity = '0.3';
      }
    };

    btn.appendChild(img);

    // ── Labels ──────────────────────────────────────────────────────────────
    // Modo monolingüe: un solo span con peso máximo.
    // Modo bilingüe:   dos spans de igual peso, separados por línea divisoria.
    //   · español arriba (idioma primario de la app)
    //   · inglés abajo
    //   · mismo tamaño y mismo font-weight → ninguno domina al otro
    if (_lang === 'ambos') {
      const wrap = document.createElement('div');
      wrap.className = 'tc-opcion-labels';

      const labelEs = document.createElement('span');
      labelEs.className = 'tc-opcion-label-es';
      labelEs.textContent = picto.es;

      const divisor = document.createElement('div');
      divisor.className = 'tc-opcion-divisor';
      divisor.setAttribute('aria-hidden', 'true');

      const labelEn = document.createElement('span');
      labelEn.className = 'tc-opcion-label-en';
      labelEn.textContent = picto.en || picto.es;

      wrap.appendChild(labelEs);
      wrap.appendChild(divisor);
      wrap.appendChild(labelEn);
      btn.appendChild(wrap);
    } else {
      const label = document.createElement('span');
      label.className = 'tc-opcion-label';
      label.textContent = _lang === 'en' ? (picto.en || picto.es) : picto.es;
      btn.appendChild(label);
    }

    btn.addEventListener('click', () => _tocar(picto, btn));
    grid.appendChild(btn);
  });

  // Diferir al siguiente frame: garantiza que el grid tenga dimensiones
  // reales antes de calcular el tamaño de los mosaicos (evita miniaturas
  // cuando _renderRonda corre tras un reflow, ej. después del confeti).
  requestAnimationFrame(() => { if (_el) _ajustarTamanos(); });
}

// ─── Interacción ──────────────────────────────────────────────────────────────

function _tocar(picto, btn) {
  if (_esperando) return;
  haptic(12);
  picto.id === _objetivo.id ? _acierto(btn) : _error(btn);
}

function _acierto(btn) {
  _esperando = true;
  _aciertos++;

  btn.classList.add('correcto');
  _confeti(30);

  const la      = _langAudio();
  const texto   = la === 'en' ? (_objetivo.en || _objetivo.es) : _objetivo.es;
  const archivo = _objetivo.ruta_img;
  _reproducirAudio(archivo, la, texto);

  Telemetry.track('toca_acierto', {
    _modulo: 'toca', picto: _objetivo.es,
    nivel: _nivel + 1, modo_infinito: _modoInfinito,
    racha: _modoInfinito ? _racha + 1 : undefined,
  });

  if (_modoInfinito) {
    // ── Modo infinito: solo incrementar racha, siguiente ronda sin overlay
    _racha++;
    _actualizarRacha();
    _renderDots();
    setTimeout(() => { if (_el) _nuevaRonda(); }, 900);
    return;
  }

  // ── Modo normal: verificar si completó el nivel
  const aciertosNecesarios = ACIERTOS_POR_NIVEL[_nivel];
  _renderDots();

  if (_aciertos >= aciertosNecesarios) {
    _aciertos = 0;
    if (_nivel < NIVELES.length - 1) {
      setTimeout(() => _mostrarSubidaNivel(), 700);
    } else {
      setTimeout(() => _activarModoInfinito(), 700);
    }
  } else {
    setTimeout(() => { if (_el) _nuevaRonda(); }, 900);
  }
}

function _error(btn) {
  btn.classList.add('incorrecto');
  haptic([10, 50, 10]);

  Telemetry.track('toca_error', {
    _modulo: 'toca', picto: _objetivo.es,
    nivel: _nivel + 1, modo_infinito: _modoInfinito,
    racha_perdida: _modoInfinito ? _racha : _aciertos,
  });

  if (_modoInfinito) {
    // Modo infinito: mostrar overlay de fallo con puntuación
    setTimeout(() => _mostrarFalloInfinito(), 400);
  } else {
    // Modo normal: reiniciar contador de aciertos consecutivos
    _aciertos = 0;
    _renderDots();
    setTimeout(() => btn.classList.remove('incorrecto'), 450);
    setTimeout(() => _reproducirInstruccion(), 600);
  }
}

// ─── Overlays ─────────────────────────────────────────────────────────────────

function _mostrarSubidaNivel() {
  _nivel++;
  _aciertos = 0;
  const emojis = ['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '🏆'];
  _el.querySelector('#tc-nivel-up-emoji').textContent = emojis[Math.min(_nivel, emojis.length - 1)];
  _el.querySelector('#tc-nivel-up-texto').textContent =
    _lang === 'en' ? `Level ${_nivel + 1}!` : `¡Nivel ${_nivel + 1}!`;
  _el.querySelector('#tc-nivel-up-sub').textContent =
    _lang === 'en'
      ? `Now ${NIVELES[_nivel]} pictures — ${ACIERTOS_POR_NIVEL[_nivel]} in a row!`
      : `Ahora ${NIVELES[_nivel]} opciones — ¡${ACIERTOS_POR_NIVEL[_nivel]} seguidos!`;
  _el.querySelector('#tc-nivel-up').classList.add('visible');
  _confeti(60);

  const la = _langAudio();
  TTS.speak(
    la === 'en' ? `Level ${_nivel + 1}!` : `¡Nivel ${_nivel + 1}!`,
    { lang: la === 'en' ? 'en-US' : 'es-MX', pitch: 1.15, rate: 0.88 }
  );

  setTimeout(() => {
    _el?.querySelector('#tc-nivel-up')?.classList.remove('visible');
    if (_el) _nuevaRonda();
  }, 2200);
}

function _activarModoInfinito() {
  _modoInfinito = true;
  _racha        = 0;
  _aciertos     = 0;
  _el.querySelector('#tc-racha-wrap').classList.add('visible');
  _el.querySelector('#tc-dots').style.display = 'none';
  if (_mejorRacha > 0) {
    _el.querySelector('#tc-record-wrap').classList.add('visible');
    _el.querySelector('#tc-record-valor').textContent = _mejorRacha;
  }

  const la = _langAudio();
  _el.querySelector('#tc-nivel-up-emoji').textContent = '🏆';
  _el.querySelector('#tc-nivel-up-texto').textContent =
    la === 'en' ? 'Infinite mode!' : '¡Modo infinito!';
  _el.querySelector('#tc-nivel-up-sub').textContent =
    la === 'en' ? 'How many can you get?' : '¿Cuántos puedes encadenar?';
  _el.querySelector('#tc-nivel-up').classList.add('visible');
  _confeti(80);
  TTS.speak(
    la === 'en' ? 'Infinite mode!' : '¡Modo infinito!',
    { lang: la === 'en' ? 'en-US' : 'es-MX', pitch: 1.2, rate: 0.88 }
  );

  setTimeout(() => {
    _el?.querySelector('#tc-nivel-up')?.classList.remove('visible');
    if (_el) _nuevaRonda();
  }, 2400);
}

function _mostrarFalloInfinito() {
  const esRecord = _racha > _mejorRacha;
  if (esRecord && _racha > 0) {
    _mejorRacha = _racha;
    try { localStorage.setItem(MEJOR_RACHA_KEY, String(_mejorRacha)); } catch {}
    _el.querySelector('#tc-record-valor').textContent = _mejorRacha;
    if (_mejorRacha > 0) _el.querySelector('#tc-record-wrap').classList.add('visible');
  }

  _el.querySelector('#tc-fallo-racha').textContent = _racha;
  _el.querySelector('#tc-fallo-emoji').textContent  = _racha >= 10 ? '🌟' : '💫';
  _el.querySelector('#tc-fallo-label').textContent  =
    _lang === 'en' ? 'consecutive hits' : 'aciertos consecutivos';
  _el.querySelector('#tc-fallo-record').textContent = esRecord && _racha > 0
    ? (_lang === 'en' ? `🏆 New record!` : `🏆 ¡Nuevo récord!`)
    : (_mejorRacha > 0
        ? (_lang === 'en' ? `Best: ${_mejorRacha}` : `Récord: ${_mejorRacha}`)
        : '');
  _el.querySelector('#tc-fallo-btn').textContent =
    _lang === 'en' ? 'Keep playing' : 'Seguir jugando';
  _el.querySelector('#tc-fallo-infinito').classList.add('visible');

  if (_racha >= 5) _confeti(40);

  const la = _langAudio();
  TTS.speak(
    la === 'en'
      ? `${_racha} in a row!${esRecord ? ' New record!' : ''}`
      : `¡${_racha} seguidos!${esRecord ? ' ¡Nuevo récord!' : ''}`,
    { lang: la === 'en' ? 'en-US' : 'es-MX', pitch: 1.1, rate: 0.9 }
  );
}

// ─── Modal temas ──────────────────────────────────────────────────────────────

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
  _nivel        = 0;
  _aciertos     = 0;
  _modoInfinito = false;
  _racha        = 0;
  _el.querySelector('#tc-racha-wrap').classList.remove('visible');
  _el.querySelector('#tc-record-wrap').classList.remove('visible');
  _el.querySelector('#tc-dots').style.display = '';
  _nuevaRonda();
}

// ─── Audio e instrucción ──────────────────────────────────────────────────────

function _reproducirInstruccion() {
  if (!_objetivo) return;
  const la   = _langAudio();
  const lang = la === 'en' ? 'en-US' : 'es-MX';
  const texto = la === 'en'
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
    if (_usado) return;
    _usado = true;
    TTS.speak(textoFallback, { lang: lang === 'en' ? 'en-US' : 'es-MX', rate: 0.9, pitch: 1.2 });
  };

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

  } else if (_lang === 'ambos') {
    // Ambos idiomas con igual peso: misma estructura HTML, mismas clases CSS.
    // El orden (español arriba, inglés abajo) refleja el idioma primario
    // de la app sin imponer jerarquía tipográfica.
    const art   = _objetivo.art || '';
    const texEs = art
      ? `Toca ${art} <strong>${_objetivo.es}</strong>`
      : `Toca <strong>${_objetivo.es}</strong>`;
    const texEn = _objetivo.en
      ? `Touch the <strong>${_objetivo.en}</strong>`
      : `Touch the <strong>${_objetivo.es}</strong>`;
    prompt.innerHTML = `${texEs}<span class="tc-prompt-en">${texEn}</span>`;
    _el.querySelector('#tc-label-sup').textContent = 'ESCUCHA Y TOCA · LISTEN & TOUCH';

  } else {
    const art = _objetivo.art || '';
    prompt.innerHTML = art
      ? `Toca ${art} <strong>${_objetivo.es}</strong>`
      : `Toca <strong>${_objetivo.es}</strong>`;
    _el.querySelector('#tc-label-sup').textContent = 'ESCUCHA Y TOCA';
  }
}

function _renderDots() {
  if (_modoInfinito) return;  // en modo infinito los dots no aplican
  const wrap = _el.querySelector('#tc-dots');
  const aciertosNecesarios = ACIERTOS_POR_NIVEL[Math.min(_nivel, ACIERTOS_POR_NIVEL.length - 1)];
  wrap.innerHTML = '';
  for (let i = 0; i < aciertosNecesarios; i++) {
    const d = document.createElement('div');
    d.className = 'tc-dot' + (i < _aciertos ? ' lleno' : '');
    wrap.appendChild(d);
  }
}

function _actualizarRacha() {
  if (!_el) return;
  _el.querySelector('#tc-racha-valor').textContent = _racha;
}

function _ajustarTamanos() {
  const grid = _el.querySelector('#tc-grid');
  if (!grid) return;

  // Usar dimensiones cacheadas por el ResizeObserver (tamaño real estable).
  // Si el cache aún está vacío (primer render antes de que dispare el observer),
  // medir directamente; si la medición tampoco es válida, reintentar.
  let W = _gridW;
  let H = _gridH;
  if (W < 50 || H < 50) {
    W = grid.clientWidth;
    H = grid.clientHeight;
    if (W < 50 || H < 50) {
      requestAnimationFrame(() => { if (_el) _ajustarTamanos(); });
      return;
    }
    _gridW = W;
    _gridH = H;
  }

  const n    = _opciones.length;
  const cols = n <= 3 ? n : n <= 4 ? 2 : n <= 6 ? 3 : 4;
  const rows = Math.ceil(n / cols);

  const gap     = 12;
  const padH    = 16;
  const padV    = 8;
  const maxW    = Math.floor((W - padH * 2 - gap * (cols - 1)) / cols);
  const maxH    = Math.floor((H - padV * 2 - gap * (rows - 1)) / rows);
  const size    = Math.min(maxW, maxH, MOSAIC_SIZE);

  grid.querySelectorAll('.tc-opcion').forEach(btn => {
    btn.style.width  = size + 'px';
    btn.style.height = size + 'px';
  });
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function _confeti(n) {
  try {
    lanzarConfeti({ n, container: _el });
    // lanzarConfeti puede mutar position del contenedor; restaurar
    requestAnimationFrame(() => {
      if (_el) _el.style.position = 'absolute';
    });
  } catch {}
}