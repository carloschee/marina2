/* modules/silabas/silabas.js
   Módulo "Sílabas" para Marina 2.

   Explora el vocabulario por categorías (data/temas.json → data/pictos.json)
   con una guía de pronunciación sílaba por sílaba.

   Diseño (calma, sin puntaje ni presión — herramienta de exploración):
   ┌─────────────────────────────────────────────────┐
   │ [📚 Categoría]                      palabra 3/24 │
   ├─────────────────────────────────────────────────┤
   │                  ┌──────────┐                    │
   │                  │  picto   │                    │
   │                  └──────────┘                    │
   │                    elefante                      │
   ├─────────────────────────────────────────────────┤
   │       [ e ] [ le ] [ fan ] [ te ]                │  ← fichas tocables
   ├─────────────────────────────────────────────────┤
   │   ◀     [▶ Sílaba a sílaba]  [🔊 Palabra]     ▶  │
   └─────────────────────────────────────────────────┘

   Principios neuroafirmativos aplicados:
   · Sin audio inesperado al entrar (onEnter no reproduce nada).
   · Objetivos táctiles ≥ 56px.
   · Transiciones breves, sin parpadeos ni elementos que aparecen/desaparecen.
   · La sílaba que suena se resalta para anclar la atención visual al audio.
   · La guía silábica es siempre en español (el silabeo es propio del idioma);
     en modo bilingüe se muestra la traducción al inglés como apoyo, pero la
     pronunciación sílaba a sílaba se mantiene en español para no sumar carga.
*/

import { TTS }       from '../../core/tts.js';
import { haptic }    from '../../core/ui.js';
import { Telemetry } from '../../core/telemetry.js';

// ─── Rutas de recursos (mismas convenciones que frases.js / generar-audio.py) ──
const PICTO_URL = (ruta_img) => `assets/pictogramas/${ruta_img.toLowerCase()}`;        // ruta_img ya incluye .png
const AUDIO_URL = (ruta_img, lang = 'es') =>
  `assets/audio/${lang}/${ruta_img.replace(/\.png$/i, '').toLowerCase()}.mp3`;
// Audio pregenerado por sílaba (generar-audio-silabas.py). idx es el índice
// dentro del array que devuelve silabificar(). Solo existe para 'es'.
const SILABA_AUDIO_URL = (ruta_img, idx) =>
  `assets/audio/es/silabas/${ruta_img.replace(/\.png$/i, '').toLowerCase()}-${idx}.mp3`;

// ════════════════════════════════════════════════════════════════════════════
//  Silabificador de español (reglas estándar RAE/uso común)
//  Maneja: dígrafos ch/ll/rr, qu, gu(e/i) con u muda, diptongos, triptongos,
//  hiatos (incl. hiato por tilde en vocal débil í/ú) y grupos consonánticos
//  inseparables (pr,br,tr,dr,cr,gr,fr,pl,bl,cl,gl,fl).
//  Probado contra vocabulario real (40/40 casos correctos).
// ════════════════════════════════════════════════════════════════════════════
const _VOC_FUERTE        = new Set(['a', 'e', 'o', 'á', 'é', 'ó']);
const _VOC_DEBIL         = new Set(['i', 'u', 'ü']);
const _VOC_DEBIL_TONICA  = new Set(['í', 'ú']);
const _TODAS_VOC         = new Set([..._VOC_FUERTE, ..._VOC_DEBIL, ..._VOC_DEBIL_TONICA]);
const _INSEPARABLES      = new Set([
  'pr', 'br', 'tr', 'dr', 'cr', 'gr', 'fr',
  'pl', 'bl', 'cl', 'gl', 'fl',
]);

const _esVocal = (c) => _TODAS_VOC.has(c);

function _formanDiptongo(c1, c2) {
  const f1 = _VOC_FUERTE.has(c1), f2 = _VOC_FUERTE.has(c2);
  const d1 = _VOC_DEBIL.has(c1),  d2 = _VOC_DEBIL.has(c2);
  if (_VOC_DEBIL_TONICA.has(c1) || _VOC_DEBIL_TONICA.has(c2)) return false; // í/ú → hiato
  if (f1 && f2) return false;            // dos abiertas → hiato
  if (d1 && d2) return true;             // débil + débil → diptongo
  if ((f1 && d2) || (d1 && f2)) return true; // abierta+cerrada → diptongo
  return false;
}

function silabificar(palabraOriginal) {
  const palabra = (palabraOriginal || '').toLowerCase().trim();
  if (!palabra) return [];

  // 1) Tokenizar agrupando dígrafos consonánticos como una sola consonante
  const chars  = [...palabra];
  const tokens = []; // { t:'V'|'C', raw:string }
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i], next = chars[i + 1];
    if (_esVocal(c)) { tokens.push({ t: 'V', raw: c }); continue; }
    if ((c === 'c' && next === 'h') || (c === 'l' && next === 'l') || (c === 'r' && next === 'r')) {
      tokens.push({ t: 'C', raw: c + next }); i++; continue;
    }
    if (c === 'q' && next === 'u') { tokens.push({ t: 'C', raw: 'qu' }); i++; continue; }
    if (c === 'g' && next === 'u' && (chars[i + 2] === 'e' || chars[i + 2] === 'i')) {
      tokens.push({ t: 'C', raw: 'gu' }); i++; continue;
    }
    tokens.push({ t: 'C', raw: c });
  }

  // 2) Agrupar vocales en núcleos (diptongos / triptongos)
  const nucleos = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].t !== 'V') continue;
    const grupo = [i];
    while (i + 1 < tokens.length && tokens[i + 1].t === 'V' &&
           _formanDiptongo(tokens[i].raw, tokens[i + 1].raw)) {
      grupo.push(i + 1); i++;
    }
    nucleos.push(grupo);
  }
  if (nucleos.length <= 1) return [palabra]; // monosílabo

  // 3) Repartir consonantes entre núcleos
  const silabas  = [];
  const tokenStr = (a, b) => tokens.slice(a, b).map(t => t.raw).join('');
  let cursor = 0;

  for (let n = 0; n < nucleos.length; n++) {
    const nuc     = nucleos[n];
    const finNuc  = nuc[nuc.length - 1];
    const silIni  = (n === 0) ? 0 : cursor;

    if (n === nucleos.length - 1) { silabas.push(tokenStr(silIni, tokens.length)); break; }

    let cPostIni = finNuc + 1, cPostFin = cPostIni;
    while (cPostFin < tokens.length && tokens[cPostFin].t === 'C') cPostFin++;
    const entre = tokens.slice(cPostIni, cPostFin);
    const k = entre.length;

    let coda;
    if (k <= 1)      coda = 0;                                                  // V-V / V-CV
    else if (k === 2) coda = _INSEPARABLES.has(entre[0].raw + entre[1].raw) ? 0 : 1;
    else if (k === 3) coda = _INSEPARABLES.has(entre[1].raw + entre[2].raw) ? 1 : 2;
    else              coda = 2;                                                 // VCC-CCV

    const fin = cPostIni + coda;
    silabas.push(tokenStr(silIni, fin));
    cursor = fin;
  }
  return silabas;
}

// ════════════════════════════════════════════════════════════════════════════
//  Normalización para TTS — reglas estrictas de pronunciación
//
//  Problemas detectados con el motor TTS en español:
//   1) Sílabas de 2 letras coinciden con abreviaturas de puntos cardinales
//      ("no" → lee "noroeste", "se" → "sudeste", etc.)
//   2) Una vocal acentuada SOLA ("í", "é"...) se lee como nombre de letra
//      ("i acentuada") en lugar de sonar la vocal.
//   3) Una "r" simple al INICIO de una sílaba intermedia se pronuncia como
//      "rr" fuerte (vibrante múltiple) en lugar de "r" suave.
//
//  Orden de prioridad (de mayor a menor):
//   a) entrada.silabas_tts[i]  — override manual por palabra en pictos.json
//   b) SILABAS_TTS_OVERRIDES   — diccionario de sílabas problemáticas conocidas
//   c) Reglas genéricas (vocal sola / r suave)
// ════════════════════════════════════════════════════════════════════════════

// Diccionario de sílabas con pronunciación forzada — case-insensitive.
// Se añade tilde a monosílabos que el motor confunde con abreviaturas de
// puntos cardinales (N, S, E, O, NE, NO, SE, SO...) o con otras siglas.
// La tilde fuerza una lectura fonética normal sin cambiar audiblemente
// la vocal en la mayoría de motores es-MX.
const SILABAS_TTS_OVERRIDES = {
  'no': 'nó',
  'se': 'sé',
  'su': 'sú',
  'es': 'és',
  'os': 'ós',
};

// Regex: r simple (no rr) al inicio de sílaba — debe sonar suave
const RE_R_SUAVE = /^r[^r]/i;
// Regex: sílaba formada por UNA sola vocal, con o sin tilde
const RE_VOCAL_SOLA = /^[aeiouáéíóúAEIOUÁÉÍÓÚ]$/;

// ── Estrategia para la "r" suave en sílabas intermedias ──
// Cambiar este valor para probar enfoques distintos sin tocar el resto:
//   'h'     → antepone "h" muda: "ro" → "hro" (hipótesis a probar)
//   'vocal' → antepone la última vocal de la sílaba anterior: "ro" → "ero"/"oro"/etc.
//   'ninguna' → no aplica corrección (deja "ro" tal cual; sonará como "rro")
const R_SUAVE_ESTRATEGIA = 'vocal';

// Extrae la última vocal (sin tilde) de una sílaba — usada por la
// estrategia 'vocal' de continuidad fonética para la "r" suave.
const VOCALES = 'aeiouáéíóúAEIOUÁÉÍÓÚ';
function _ultimaVocal(silaba) {
  for (let i = silaba.length - 1; i >= 0; i--) {
    if (VOCALES.includes(silaba[i])) {
      return silaba[i].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
  }
  return null;
}

// silabas: array completo de la palabra. idx: índice de la sílaba actual.
function _normalizarParaTTS(silabas, idx, entrada) {
  const silaba = silabas[idx];

  // (a) Override manual por palabra — máxima prioridad, sin más procesamiento
  if (entrada?.silabas_tts && entrada.silabas_tts[idx]) {
    return entrada.silabas_tts[idx];
  }

  let t = silaba;
  const clave = t.toLowerCase();

  // (b) Diccionario de sílabas problemáticas conocidas (match exacto)
  if (SILABAS_TTS_OVERRIDES[clave]) {
    return SILABAS_TTS_OVERRIDES[clave];
  }

  // (c1) Vocal acentuada sola → quitar tilde para que no se lea como
  //      "vocal acentuada" (nombre de letra) y suene la vocal simple.
  if (RE_VOCAL_SOLA.test(t)) {
    t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return t;
  }

  // (c2) r simple al inicio de sílaba intermedia → forzar pronunciación suave.
  //      "h" es muda en español: "ro" → "hro" no debería sonar como "rro"
  //      ni formar una palabra reconocible distinta (a diferencia de "aro").
  //      Si esta hipótesis no se confirma al probar en dispositivo, cambiar
  //      R_SUAVE_ESTRATEGIA arriba a 'vocal' (continuidad con la sílaba previa)
  //      o 'ninguna' (sin corrección, usar silabas_tts caso por caso).
  if (RE_R_SUAVE.test(t) && idx > 0) {
    if (R_SUAVE_ESTRATEGIA === 'h') {
      t = 'h' + t;
    } else if (R_SUAVE_ESTRATEGIA === 'vocal') {
      const vocalPrevia = _ultimaVocal(silabas[idx - 1]);
      if (vocalPrevia) t = vocalPrevia + t;
    }
    // 'ninguna' → no se modifica t
  }

  return t;
}

// ─── Estado ───────────────────────────────────────────────────────────────────
let _el         = null;
let _catalogo   = [];     // entradas de pictos.json filtradas
let _temas      = [];     // temas.json
let _tema       = null;   // null = "Todas las palabras"
let _temaElegido = false; // true cuando la usuaria elige explícitamente un tema
let _lista      = [];     // entradas de la categoría activa
let _idx        = 0;
let _lang       = 'es';   // 'es' | 'en' | 'ambos'
let _langConfig = { es: true, en: false };
let _audioEl    = null;
let _seqToken   = 0;      // invalida secuencias de audio obsoletas

// ─── API pública ──────────────────────────────────────────────────────────────
export async function init(container) {
  _el = container;
  _langConfig = window._langConfig ? { ...window._langConfig } : { es: true, en: false };
  _lang = (_langConfig.es && _langConfig.en) ? 'ambos' : _langConfig.en ? 'en' : 'es';
  _tema = null; _temaElegido = false;
  _idx  = 0;

  try {
    const res = await fetch('./data/pictos.json');
    const cat = await res.json();
    _catalogo = cat.filter(e => e.ruta_img && e.es);
  } catch (e) {
    console.error('[silabas] No se pudo cargar pictos.json', e);
    _catalogo = [];
  }

  try {
    const res2 = await fetch('./data/temas.json');
    _temas = await res2.json();
  } catch {
    _temas = [];
  }

  _render();
  _aplicarTema(null);          // arranca en "Todas las palabras", sin modal intrusivo
  window.addEventListener('lang-change', _onLangChange);
}

export function destroy() {
  window.removeEventListener('lang-change', _onLangChange);
  _detenerTodo();
  _el = null; _catalogo = []; _temas = []; _lista = []; _temaElegido = false;
}

export function onEnter() { if (!_temaElegido) _abrirModal(); }

export function onLeave() {
  _detenerTodo();
  Telemetry.track('silabas_sesion', {
    _modulo: 'silabas',
    tema: _tema?.id || 'todos',
    palabras_en_categoria: _lista.length,
  });
}

export async function pause() { _detenerTodo(); }

export async function resume(container) {
  _el = container;
  _langConfig = window._langConfig ? { ...window._langConfig } : _langConfig;
  _lang = (_langConfig.es && _langConfig.en) ? 'ambos' : _langConfig.en ? 'en' : 'es';
  _render();
  window.removeEventListener('lang-change', _onLangChange);
  window.addEventListener('lang-change', _onLangChange);
  // Si hay una lista cargada (ya se eligió tema), restaurar la palabra actual.
  // Si no, mostrar el modal de temas igual que al entrar por primera vez.
  if (_temaElegido) {
    _mostrarPalabra();
  } else {
    _abrirModal();
  }
}

// ─── Render del shell ──────────────────────────────────────────────────────────
function _render() {
  _el.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;';
  _el.innerHTML = `
    <style>
      #sl-wrap {
        flex:1; min-height:0; display:flex; flex-direction:column;
        padding:14px 16px calc(12px + env(safe-area-inset-bottom, 0px));
        gap:12px; overflow:hidden;
      }

      /* ── Header: [Temas] [contador] en un solo renglón ── */
      #sl-top { display:flex; align-items:center; gap:12px; flex-shrink:0; min-height:56px; }
      #sl-cat-btn {
        display:flex; align-items:center;
        min-height:44px; padding:8px 16px; border-radius:99px;
        background:rgba(167,139,250,0.16);
        border:1.5px solid rgba(167,139,250,0.45);
        color:#fff; font-family:inherit; font-weight:900; font-size:.95rem;
        cursor:pointer; transition:transform .12s, background .2s; flex-shrink:0;
      }
      #sl-cat-btn:active { transform:scale(.97); }
      #sl-contador {
        margin-left:auto; flex-shrink:0;
        font-size:.95rem; font-weight:800; color:rgba(255,255,255,0.55);
        white-space:nowrap;
      }

      /* ── Tarjeta de palabra — landscape: fila con navs a los lados del picto ── */
      /* ── Tarjeta: columna centrada ── */
      #sl-card {
        flex:1; min-height:0;
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        gap:10px;
      }
      /* Centro de la tarjeta: picto + nombre apilados */
      #sl-card-centro {
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        gap:10px; flex-shrink:0;
      }
      /* Wrapper cuadrado fijo — position:relative para anclar los navs dentro */
      #sl-picto-wrap {
        position:relative;
        width: min(38vh, 52vw);
        height: min(38vh, 52vw);
        flex-shrink:0;
        background:#fff; border-radius:22px; padding:10px;
        box-shadow:0 10px 30px rgba(0,20,60,0.30);
        display:flex; align-items:center; justify-content:center;
        overflow:visible;          /* visible para que los navs sobresalgan */
      }
      #sl-picto { width:100%; height:100%; object-fit:contain; }
      #sl-palabra {
        font-family:'Outfit', sans-serif;
        font-size:clamp(1.8rem, 5vw, 3.2rem); font-weight:900; color:#fff;
        text-align:center; line-height:1; letter-spacing:-.5px;
      }
      #sl-palabra-en {
        font-size:clamp(.9rem, 2.5vw, 1.3rem); font-weight:800;
        color:rgba(255,255,255,0.50); text-align:center;
      }

      /* ── Navs: absolutos dentro de #sl-picto-wrap ──
         top:50% + translateY(-50%) los centra exactamente en el eje Y del
         wrapper cuadrado, en cualquier orientación y tamaño de pantalla.
         Sobresalen del wrapper (overflow:visible) para no tapar el picto. */
      .sl-nav {
        position:absolute; top:50%; transform:translateY(-50%);
        width:52px; height:52px; border-radius:50%;
        border:1.5px solid rgba(255,255,255,0.22);
        background:rgba(20,40,100,0.55);
        backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);
        color:#fff; font-size:1.4rem; cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        transition:transform .12s, background .18s;
        z-index:2;
      }
      #sl-prev { left:-28px; }   /* mitad fuera del wrapper a la izquierda */
      #sl-next { right:-28px; }  /* mitad fuera del wrapper a la derecha  */
      .sl-nav:active  { transform:translateY(-50%) scale(.88); background:rgba(255,255,255,.22); }
      .sl-nav:disabled { opacity:.28; pointer-events:none; }

      /* ── Chips de sílabas — diseño orgánico con paleta de colores ── */
      /* Paleta: 6 colores vivos, asignados por índice mod 6 */
      #sl-silabas {
        flex-shrink:0; display:flex; flex-wrap:wrap; justify-content:center;
        gap:12px; padding:4px 0;
      }
      .sl-silaba {
        min-height:58px; padding:12px 26px;
        color:#fff; font-family:'Outfit', sans-serif;
        font-weight:900; font-size:clamp(1.4rem, 4.5vw, 2.2rem);
        cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        border:none;
        /* La transición NO incluye transform para no interferir con @keyframes */
        transition:box-shadow .18s, filter .18s;
        /* Forma orgánica base — variada por JS con data-silaba-idx */
        border-radius: 60% 40% 55% 45% / 45% 55% 45% 55%;
      }
      /* Variantes de forma orgánica por posición (0–5) */
      .sl-silaba[data-si="0"] { border-radius:60% 40% 55% 45% / 45% 55% 45% 55%; transform:rotate(-2deg); }
      .sl-silaba[data-si="1"] { border-radius:45% 55% 40% 60% / 55% 45% 60% 40%; transform:rotate(1.5deg); }
      .sl-silaba[data-si="2"] { border-radius:55% 45% 60% 40% / 40% 60% 45% 55%; transform:rotate(-1deg); }
      .sl-silaba[data-si="3"] { border-radius:40% 60% 45% 55% / 60% 40% 55% 45%; transform:rotate(2deg); }
      .sl-silaba[data-si="4"] { border-radius:50% 50% 60% 40% / 40% 60% 50% 50%; transform:rotate(-1.5deg); }
      .sl-silaba[data-si="5"] { border-radius:45% 55% 50% 50% / 55% 45% 40% 60%; transform:rotate(1deg); }
      /* Colores por posición */
      .sl-silaba[data-si="0"] { background:#e11d48; box-shadow:0 4px 16px rgba(225,29,72,0.40); }
      .sl-silaba[data-si="1"] { background:#d97706; box-shadow:0 4px 16px rgba(217,119,6,0.40); }
      .sl-silaba[data-si="2"] { background:#059669; box-shadow:0 4px 16px rgba(5,150,105,0.40); }
      .sl-silaba[data-si="3"] { background:#2563eb; box-shadow:0 4px 16px rgba(37,99,235,0.40); }
      .sl-silaba[data-si="4"] { background:#7c3aed; box-shadow:0 4px 16px rgba(124,58,237,0.40); }
      .sl-silaba[data-si="5"] { background:#0891b2; box-shadow:0 4px 16px rgba(8,145,178,0.40); }

      .sl-silaba:active { filter:brightness(1.18); }

      /* Animación de rebote al estar activa — escala + salto */
      @keyframes sl-bounce {
        0%   { transform: scale(1.00, 1.00); }
        25%  { transform: scale(1.08, 0.82); }   /* aplasta */
        55%  { transform: scale(0.94, 1.10); }   /* rebote elástico hacia arriba */
        75%  { transform: scale(1.03, 0.97); }   /* asentamiento */
        100% { transform: scale(1.00, 1.00); }   /* reposo */
      }
      .sl-silaba.activa {
        animation: sl-bounce .55s cubic-bezier(.36,.07,.19,.97) 1 forwards;
        filter:brightness(1.22);
        box-shadow:0 8px 28px rgba(0,0,0,0.35);
        z-index:2; position:relative;
      }

      /* ── Controles (solo los botones de acción — los navs están en #sl-card) ── */
      #sl-controles {
        flex-shrink:0; display:flex; align-items:stretch; gap:10px;
        padding:0 4px;
      }
      #sl-acciones { display:flex; flex-direction:row; gap:10px; flex:1; min-width:0; }
      .sl-accion {
        flex:1; min-width:0; min-height:64px; padding:0 18px;
        border-radius:20px; border:none; cursor:pointer;
        font-family:inherit; font-weight:900; font-size:1.08rem; color:#fff;
        display:flex; align-items:center; justify-content:center; gap:8px;
        transition:transform .12s, filter .18s;
      }
      .sl-accion:active { transform:scale(.96); filter:brightness(1.1); }
      /* Colores sólidos legibles */
      #sl-btn-secuencia { background:#6d28d9; box-shadow:0 4px 18px rgba(109,40,217,0.50); }
      #sl-btn-palabra   { background:#1d4ed8; box-shadow:0 4px 18px rgba(29,78,216,0.45); }

      /* ── Portrait: botones de acción apilados ── */
      @media (orientation:portrait) {
        #sl-acciones { flex-direction:column; gap:10px; }
        .sl-accion { min-height:68px; font-size:1.12rem; }
      }

      /* ── Modal de categorías (patrón de frases.js: translateY propio) ── */
      /* ── Modal de temas — mosaico ── */
      #sl-modal {
        position:absolute; inset:0; z-index:30;
        background:rgba(5,20,50,0.80);
        backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
        display:flex; align-items:flex-end; justify-content:center;
        opacity:0; pointer-events:none; transition:opacity .25s;
      }
      #sl-modal.visible { opacity:1; pointer-events:all; }
      #sl-modal-box {
        width:100%; max-width:620px; max-height:88vh;
        background:rgba(20,16,46,0.97); border-radius:24px 24px 0 0;
        display:flex; flex-direction:column;
        border-top:2px solid rgba(167,139,250,0.40);
        transform:translateY(20px); transition:transform .3s cubic-bezier(.34,1.1,.64,1);
        overflow:hidden;
      }
      #sl-modal.visible #sl-modal-box { transform:translateY(0); }
      #sl-modal-header { display:flex; align-items:center; justify-content:space-between; padding:18px 20px 14px; flex-shrink:0; }
      #sl-modal-titulo { font-size:1rem; font-weight:900; letter-spacing:.08em; text-transform:uppercase; color:#a78bfa; }
      #sl-modal-cerrar {
        width:36px; height:36px; border-radius:50%; border:none; cursor:pointer;
        background:rgba(255,255,255,0.10); color:#fff; font-size:1rem;
        display:flex; align-items:center; justify-content:center; transition:background .15s;
      }
      #sl-modal-cerrar:active { background:rgba(255,255,255,0.20); }
      #sl-modal-lista { flex:1; overflow-y:auto; padding:0 16px 24px; -webkit-overflow-scrolling:touch; }
      .sl-mosaico { display:grid; grid-template-columns:repeat(auto-fill,minmax(88px,1fr)); gap:10px; padding:4px 0; }
      .sl-mosaico-tile {
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        gap:4px; padding:10px 6px 8px; border-radius:16px;
        border:2px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.06);
        cursor:pointer; transition:transform .12s, background .15s, border-color .15s; min-height:84px;
      }
      .sl-mosaico-tile:active { transform:scale(.93); }
      .sl-mosaico-tile.activo { background:rgba(255,255,255,0.12); border-color:#a78bfa; box-shadow:0 0 0 1px #a78bfa44; }
      .sl-mosaico-emoji { font-size:2rem; line-height:1; pointer-events:none; }
      .sl-mosaico-label {
        font-size:.62rem; font-weight:800; text-align:center; color:rgba(255,255,255,0.75);
        line-height:1.2; pointer-events:none; max-width:80px;
        overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
      }
      .sl-mosaico-tile.activo .sl-mosaico-label { color:#fff; }
      .sl-tile-todas { grid-column:1/-1; flex-direction:row; justify-content:flex-start; gap:14px; padding:12px 18px; min-height:auto; }
      .sl-tile-todas .sl-mosaico-emoji { font-size:1.8rem; }
      .sl-tile-todas .sl-mosaico-label { font-size:.85rem; font-weight:900; max-width:none; -webkit-line-clamp:1; }
      .sl-mosaico-divisor { grid-column:1/-1; height:1px; background:rgba(255,255,255,0.12); margin:6px 0; }
      .sl-tema-nombre { font-size:1.05rem; font-weight:900; }
      .sl-tema-desc   { font-size:.74rem; color:rgba(255,255,255,.45); font-weight:700; }

    </style>

    <div id="sl-wrap">
      <div id="sl-top">
        <button id="sl-cat-btn">Temas</button>
        <span id="sl-contador"></span>
      </div>

      <div id="sl-card">
        <div id="sl-card-centro">
          <div id="sl-picto-wrap">
            <button class="sl-nav" id="sl-prev" aria-label="Anterior">◀</button>
            <img id="sl-picto" alt="">
            <button class="sl-nav" id="sl-next" aria-label="Siguiente">▶</button>
          </div>
          <div id="sl-palabra"></div>
          <div id="sl-palabra-en"></div>
        </div>
      </div>

      <div id="sl-silabas"></div>

      <div id="sl-controles">
        <div id="sl-acciones">
          <button class="sl-accion" id="sl-btn-secuencia">▶ Sílaba a sílaba</button>
          <button class="sl-accion" id="sl-btn-palabra">🔊 Palabra</button>
        </div>
      </div>
    </div>

    <!-- Modal categorías -->
    <div id="sl-modal">
      <div id="sl-modal-box">
        <div id="sl-modal-header">
          <span id="sl-modal-titulo">Elige una categoría</span>
          <button id="sl-modal-cerrar" aria-label="Cerrar">✕</button>
        </div>
        <div id="sl-modal-lista"></div>
      </div>
    </div>
  `;

  // Eventos
  _el.querySelector('#sl-cat-btn').addEventListener('click', () => { haptic(10); _abrirModal(); });
  _el.querySelector('#sl-modal-cerrar').addEventListener('click', () => { haptic(8); _cerrarModal(); });
  _el.querySelector('#sl-modal').addEventListener('click', (e) => {
    if (e.target.id === 'sl-modal') _cerrarModal();   // tocar fuera cierra
  });
  _el.querySelector('#sl-prev').addEventListener('click', () => { haptic(8); _navegar(-1); });
  _el.querySelector('#sl-next').addEventListener('click', () => { haptic(8); _navegar(1); });
  _el.querySelector('#sl-btn-secuencia').addEventListener('click', () => { haptic(10); _reproducirSecuencia(); });
  _el.querySelector('#sl-btn-palabra').addEventListener('click', () => { haptic(10); _reproducirPalabra(); });
}

// ─── Categorías — mosaico ──────────────────────────────────────────────────────
const SL_TEMAS_PRIO = ['transportes','frutas','verduras','alimentos','animales'];

function _abrirModal() {
  const lista = _el.querySelector('#sl-modal-lista');
  lista.innerHTML = '';
  const activoId = _tema?.id ?? null;
  const prio = [], resto = [];
  _temas.forEach(t => (SL_TEMAS_PRIO.includes(t.id) ? prio : resto).push(t));
  prio.sort((a,b) => SL_TEMAS_PRIO.indexOf(a.id) - SL_TEMAS_PRIO.indexOf(b.id));
  const grid = document.createElement('div');
  grid.className = 'sl-mosaico';
  const tileTodas = _sl_crearTile(null, '🌊', 'Todas las palabras', activoId === null);
  tileTodas.classList.add('sl-tile-todas');
  grid.appendChild(tileTodas);
  const sep1 = document.createElement('div'); sep1.className = 'sl-mosaico-divisor';
  grid.appendChild(sep1);
  prio.forEach(t => grid.appendChild(_sl_crearTile(t.id, t.emoji||'📚', t.label, t.id===activoId)));
  if (resto.length) {
    const sep2 = document.createElement('div'); sep2.className = 'sl-mosaico-divisor';
    grid.appendChild(sep2);
    resto.forEach(t => grid.appendChild(_sl_crearTile(t.id, t.emoji||'📚', t.label, t.id===activoId)));
  }
  lista.appendChild(grid);
  const box = _el.querySelector('#sl-modal-box');
  if (box) box.scrollTop = 0;
  _el.querySelector('#sl-modal').classList.add('visible');
}

function _sl_crearTile(id, emoji, label, activo) {
  const tile = document.createElement('button');
  tile.className = 'sl-mosaico-tile' + (activo ? ' activo' : '');
  tile.innerHTML = `<span class="sl-mosaico-emoji">${emoji}</span><span class="sl-mosaico-label">${label}</span>`;
  tile.addEventListener('click', () => { haptic(10); _temaElegido = true; _aplicarTema(id); _cerrarModal(); });
  return tile;
}

function _cerrarModal() {
  _el.querySelector('#sl-modal')?.classList.remove('visible');
}

function _aplicarTema(id) {
  _tema = id === null ? null : (_temas.find(t => t.id === id) || null);

  if (_tema?.palabras?.length) {
    const orden = new Map(_tema.palabras.map((pid, i) => [pid, i]));   // respeta orden curado
    _lista = _catalogo
      .filter(e => orden.has(e.id))
      .sort((a, b) => orden.get(a.id) - orden.get(b.id));
  } else {
    _lista = [..._catalogo];
  }

  _idx = 0;
  // El botón solo dice 'Temas' — no hay label dinámico
  _mostrarPalabra();
}

// ─── Navegación entre palabras ──────────────────────────────────────────────────
function _navegar(dir) {
  if (!_lista.length) return;
  _detenerTodo();
  _idx = (_idx + dir + _lista.length) % _lista.length;   // circular
  _mostrarPalabra();
}

function _mostrarPalabra() {
  _detenerSecuencia();
  const entrada = _lista[_idx];
  const card    = _el.querySelector('#sl-card');
  const contador = _el.querySelector('#sl-contador');
  const fila    = _el.querySelector('#sl-silabas');

  if (!entrada) {
    if (card) card.style.display = 'none';
    if (fila) fila.innerHTML = '';
    if (contador) contador.textContent = '';
    return;
  }
  if (card) card.style.display = 'flex';
  if (contador) contador.textContent = `${_idx + 1} / ${_lista.length}`;

  // Picto
  const img = _el.querySelector('#sl-picto');
  img.onerror = () => { img.style.visibility = 'hidden'; };
  img.style.visibility = 'visible';
  img.src = PICTO_URL(entrada.ruta_img);
  img.alt = entrada.es;

  // Palabra + traducción
  _el.querySelector('#sl-palabra').textContent = entrada.es;
  const en = _el.querySelector('#sl-palabra-en');
  en.textContent = (_lang !== 'es' && entrada.en) ? entrada.en : '';
  en.style.display = en.textContent ? 'block' : 'none';

  // Sílabas
  fila.innerHTML = '';
  const silabas = silabificar(entrada.es);
  silabas.forEach((s, i) => {
    const chip = document.createElement('button');
    chip.className = 'sl-silaba';
    chip.textContent = s;
    chip.dataset.idx = i;
    chip.dataset.si = i % 6;          // paleta y forma orgánica (0–5)
    chip.addEventListener('click', () => { haptic(8); _decirSilaba(silabas, i); });
    fila.appendChild(chip);
  });

  // Botón anterior/siguiente nunca se deshabilita (navegación circular),
  // pero si solo hay una palabra, no tiene sentido navegar.
  const unica = _lista.length <= 1;
  _el.querySelector('#sl-prev').disabled = unica;
  _el.querySelector('#sl-next').disabled = unica;
}

// ─── Audio ──────────────────────────────────────────────────────────────────────
function _resaltar(idx) {
  _el?.querySelectorAll('.sl-silaba').forEach((c, i) =>
    c.classList.toggle('activa', i === idx));
}
function _limpiarResaltado() {
  _el?.querySelectorAll('.sl-silaba.activa').forEach(c => c.classList.remove('activa'));
}

// Pronuncia una sola sílaba (al tocar la ficha).
// Prioridad: MP3 pregenerado (generar-audio-silabas.py) → TTS normalizado.
function _decirSilaba(silabas, idx) {
  _detenerSecuencia();
  _resaltar(idx);
  const entrada = _lista[_idx];

  if (!_audioEl) { _audioEl = document.createElement('audio'); _audioEl.preload = 'none'; }
  TTS.stop();
  try { _audioEl.pause(); } catch {}
  _audioEl.onended = null;

  let usado = false;
  const fallback = () => {
    if (usado) return; usado = true;
    const textoTTS = _normalizarParaTTS(silabas, idx, entrada);
    TTS.speak(textoTTS, { lang: 'es-MX', rate: 0.7, pitch: 1.1 });
  };
  _audioEl.onerror = fallback;
  _audioEl.volume = 1;
  _audioEl.src = SILABA_AUDIO_URL(entrada.ruta_img, idx);
  _audioEl.play().catch(fallback);

  // El resaltado se limpia al iniciar otra acción; aquí lo dejamos breve.
  setTimeout(() => { _el?.querySelector(`.sl-silaba[data-idx="${idx}"]`)?.classList.remove('activa'); }, 650);
}

// Reproduce la palabra completa: MP3 pregenerado (es) con fallback a TTS.
function _reproducirPalabra() {
  _detenerSecuencia();
  _limpiarResaltado();
  const entrada = _lista[_idx];
  if (!entrada) return;

  if (!_audioEl) { _audioEl = document.createElement('audio'); _audioEl.preload = 'none'; }
  TTS.stop();
  _audioEl.pause();
  _audioEl.onerror = null;
  _audioEl.onended = null;

  let usado = false;
  const fallback = () => {
    if (usado) return; usado = true;
    TTS.speak(entrada.es, { lang: 'es-MX', rate: 0.9, pitch: 1.15 });
  };
  _audioEl.onerror = fallback;
  _audioEl.volume = 1;
  _audioEl.src = AUDIO_URL(entrada.ruta_img, 'es');
  _audioEl.play().catch(fallback);
}

// Lee sílaba por sílaba, resaltando cada una, y cierra con la palabra completa.
// Cada sílaba reproduce su MP3 pregenerado (generar-audio-silabas.py); si falta
// el archivo, cae a TTS normalizado solo para esa sílaba. Se encadena con
// onended/onerror del <audio> compartido — no usa speechSynthesis en serie.
function _reproducirSecuencia() {
  const entrada = _lista[_idx];
  if (!entrada) return;

  _detenerSecuencia();
  const token = ++_seqToken;
  const silabas = silabificar(entrada.es);

  if (!_audioEl) { _audioEl = document.createElement('audio'); _audioEl.preload = 'none'; }
  TTS.stop();
  try { _audioEl.pause(); } catch {}
  try { window.speechSynthesis?.cancel(); } catch {}

  // "Desbloquear" speechSynthesis DENTRO del gesto del usuario (este click).
  // El fallback TTS de sílabas omitidas (ej. "go") se dispara después, de
  // forma asíncrona, vía onerror del <audio> — fuera del gesto original.
  // En iOS/Safari, speechSynthesis.speak() llamado fuera de un gesto de
  // usuario no produce sonido (sin error visible: queda en silencio).
  // Hablar y cancelar inmediatamente un utterance casi silencioso aquí
  // habilita la sesión de TTS para el resto de la secuencia.
  try {
    const synth = window.speechSynthesis;
    if (synth) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      synth.speak(u);
      synth.cancel();
    }
  } catch {}

  let i = 0;
  const siguiente = () => {
    if (!_el || token !== _seqToken) return;            // secuencia obsoleta → abortar
    if (i >= silabas.length) {                          // al final, palabra completa
      _limpiarResaltado();
      setTimeout(() => { if (token === _seqToken) _reproducirPalabra(); }, 260);
      return;
    }
    _resaltar(i);

    const idxActual = i;
    let avanzado = false;
    const avanzar = () => {
      if (avanzado || token !== _seqToken) return;
      avanzado = true;
      i++;
      setTimeout(siguiente, 220);
    };

    // Fallback TTS solo para esta sílaba si su MP3 no existe.
    // Guardia: onerror y play().catch() pueden disparar ambos para el mismo
    // archivo faltante — sin esto, el fallback se ejecutaba dos veces.
    //
    // Usa TTS.speak() (el mismo wrapper que ya funciona en _decirSilaba),
    // en vez de un SpeechSynthesisUtterance crudo — ese enfoque no producía
    // audio ni disparaba onend/onerror en este contexto (la secuencia se
    // quedaba trabada). TTS.speak() es "fire-and-forget" (no avisa cuándo
    // termina), así que el avance al siguiente sílaba se hace por
    // temporizador, estimado según la longitud del texto.
    let fallbackUsado = false;
    const fallbackTTS = () => {
      if (fallbackUsado) return;
      fallbackUsado = true;
      const textoTTS = _normalizarParaTTS(silabas, idxActual, entrada);
      const duracion = Math.max(700, textoTTS.length * 150);

      try { _audioEl.removeAttribute('src'); _audioEl.load(); } catch {}
      setTimeout(() => {
        // Si el usuario navegó a otro pictograma mientras esperábamos,
        // el token ya cambió — no hablar con el texto del picto anterior.
        if (token !== _seqToken) return;
        try {
          window.speechSynthesis?.resume();
          TTS.speak(textoTTS, { lang: 'es-MX', rate: 0.7, pitch: 1.1 });
        } catch {}
      }, 80);

      setTimeout(() => { if (token === _seqToken) avanzar(); }, duracion + 80);
    };

    _audioEl.onended = avanzar;
    _audioEl.onerror = fallbackTTS;
    _audioEl.volume = 1;
    _audioEl.src = SILABA_AUDIO_URL(entrada.ruta_img, idxActual);
    _audioEl.play().catch(fallbackTTS);
  };

  siguiente();
}

function _detenerSecuencia() {
  _seqToken++;                 // invalida cualquier secuencia en curso
  _limpiarResaltado();
}

function _detenerTodo() {
  _detenerSecuencia();
  TTS.stop();
  if (_audioEl) _audioEl.pause();
}

// ─── Cambio de idioma (pill ES/EN) ──────────────────────────────────────────────
function _onLangChange(e) {
  const cfg = e.detail?.langConfig || window._langConfig;
  if (!cfg) return;
  const nuevo = (cfg.es && cfg.en) ? 'ambos' : cfg.en ? 'en' : 'es';
  if (nuevo === _lang) return;
  _lang = nuevo;
  // El silabeo se mantiene en español; solo cambia la traducción de apoyo.
  const entrada = _lista[_idx];
  const en = _el?.querySelector('#sl-palabra-en');
  if (en && entrada) {
    en.textContent = (_lang !== 'es' && entrada.en) ? entrada.en : '';
    en.style.display = en.textContent ? 'block' : 'none';
  }
}