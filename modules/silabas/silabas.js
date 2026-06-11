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

// ─── Estado ───────────────────────────────────────────────────────────────────
let _el         = null;
let _catalogo   = [];     // entradas de pictos.json filtradas
let _temas      = [];     // temas.json
let _tema       = null;   // null = "Todas las palabras"
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
  _tema = null;
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
  _el = null; _catalogo = []; _temas = []; _lista = [];
}

export function onEnter() { /* sin audio al entrar — principio neuroafirmativo */ }

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
  _render();                 // app.js pudo limpiar el contenedor; reconstruir
  _mostrarPalabra();
  window.removeEventListener('lang-change', _onLangChange);
  window.addEventListener('lang-change', _onLangChange);
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

      /* ── Barra superior: categoría + contador ── */
      #sl-top { display:flex; align-items:center; gap:12px; flex-shrink:0; }
      #sl-cat-btn {
        display:flex; align-items:center; gap:10px;
        min-height:56px; padding:10px 18px; border-radius:99px;
        background:rgba(167,139,250,0.16);
        border:1.5px solid rgba(167,139,250,0.45);
        color:#fff; font-family:inherit; font-weight:900; font-size:1.05rem;
        cursor:pointer; transition:transform .12s, background .2s;
      }
      #sl-cat-btn:active { transform:scale(.97); }
      #sl-cat-emoji { font-size:1.3rem; }
      #sl-contador {
        margin-left:auto; flex-shrink:0;
        font-size:.95rem; font-weight:800; color:rgba(255,255,255,0.55);
        white-space:nowrap;
      }

      /* ── Tarjeta de palabra — contenedor transparente, sin borde visible ── */
      #sl-card {
        flex:1; min-height:0;
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        gap:10px;
      }
      /* Wrapper cuadrado fijo: el pictograma siempre ocupa el mismo espacio
         independientemente de su contenido (árbol alto, pez ancho, etc.).
         min() evita que desborde en pantallas pequeñas. */
      #sl-picto-wrap {
        width: min(42vh, 62vw);
        height: min(42vh, 62vw);
        flex-shrink: 0;
        background:#fff; border-radius:22px; padding:10px;
        box-shadow:0 10px 30px rgba(0,20,60,0.30);
        display:flex; align-items:center; justify-content:center;
        overflow:hidden;
      }
      #sl-picto {
        width:100%; height:100%;
        object-fit:contain;
      }
      #sl-palabra {
        font-family:'Outfit', sans-serif;
        font-size:clamp(2rem, 6vw, 3.4rem); font-weight:900; color:#fff;
        text-align:center; line-height:1; letter-spacing:-.5px;
      }
      #sl-palabra-en {
        font-size:clamp(1rem, 3vw, 1.4rem); font-weight:800;
        color:rgba(255,255,255,0.50); text-align:center;
      }

      /* ── Fila de sílabas (la firma del módulo) ── */
      #sl-silabas {
        flex-shrink:0; display:flex; flex-wrap:wrap; justify-content:center;
        gap:10px; padding:2px 0;
      }
      .sl-silaba {
        min-height:56px; padding:12px 22px; border-radius:18px;
        background:rgba(255,255,255,0.10);
        border:2px solid rgba(167,139,250,0.40);
        color:#fff; font-family:'Outfit', sans-serif;
        font-weight:900; font-size:clamp(1.4rem, 4.5vw, 2.2rem);
        cursor:pointer; transition:transform .12s, background .18s, border-color .18s;
        display:flex; align-items:center; justify-content:center;
      }
      .sl-silaba:active { transform:scale(.93); }
      .sl-silaba.activa {
        background:rgba(167,139,250,0.85);
        border-color:#fff;
        transform:scale(1.06);
        box-shadow:0 6px 22px rgba(167,139,250,0.55);
      }

      /* ── Controles ── */
      #sl-controles {
        flex-shrink:0; display:flex; align-items:center; gap:10px;
      }
      .sl-nav {
        width:60px; height:60px; flex-shrink:0; border-radius:50%;
        border:1.5px solid rgba(255,255,255,0.22);
        background:rgba(255,255,255,0.10); color:#fff;
        font-size:1.6rem; cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        transition:transform .12s, background .18s;
      }
      .sl-nav:active { transform:scale(.90); }
      .sl-nav:disabled { opacity:.30; pointer-events:none; }
      #sl-acciones { flex:1; display:flex; gap:10px; min-width:0; }
      .sl-accion {
        flex:1; min-width:0; min-height:60px; padding:0 14px;
        border-radius:18px; border:none; cursor:pointer;
        font-family:inherit; font-weight:900; font-size:1.05rem; color:#fff;
        display:flex; align-items:center; justify-content:center; gap:8px;
        transition:transform .12s, filter .18s;
      }
      .sl-accion:active { transform:scale(.96); }
      #sl-btn-secuencia { background:#a78bfa; box-shadow:0 4px 16px rgba(167,139,250,0.45); }
      #sl-btn-palabra   { background:rgba(255,255,255,0.12); border:1.5px solid rgba(255,255,255,0.25); }

      /* ── Modal de categorías (patrón de frases.js: translateY propio) ── */
      #sl-modal {
        position:absolute; inset:0; z-index:30;
        background:rgba(5,20,50,0.80);
        backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
        display:flex; align-items:flex-end;
        opacity:0; pointer-events:none; transition:opacity .25s;
      }
      #sl-modal.visible { opacity:1; pointer-events:all; }
      #sl-modal-box {
        width:100%; max-height:78vh; overflow-y:auto;
        -webkit-overflow-scrolling:touch;
        background:rgba(20,16,46,0.97);
        border-radius:24px 24px 0 0;
        padding:20px 16px calc(28px + env(safe-area-inset-bottom, 0px));
        border-top:2px solid rgba(167,139,250,0.40);
        transform:translateY(20px);
        transition:transform .3s cubic-bezier(.34,1.1,.64,1);
      }
      #sl-modal.visible #sl-modal-box { transform:translateY(0); }
      #sl-modal-header {
        display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;
      }
      #sl-modal-titulo {
        font-size:.82rem; font-weight:900; letter-spacing:.10em;
        text-transform:uppercase; color:rgba(167,139,250,0.85);
      }
      #sl-modal-cerrar {
        width:42px; height:42px; border-radius:50%; border:none;
        background:rgba(255,255,255,0.12); color:#fff; font-size:1.3rem;
        cursor:pointer; display:flex; align-items:center; justify-content:center;
        transition:transform .12s;
      }
      #sl-modal-cerrar:active { transform:scale(.88); }
      .sl-grupo-label {
        font-size:.70rem; font-weight:900; letter-spacing:.10em;
        text-transform:uppercase; color:rgba(255,255,255,0.45); margin:14px 0 8px;
      }
      .sl-grupo-label:first-of-type { margin-top:0; }
      #sl-modal-lista { display:flex; flex-direction:column; gap:8px; }
      .sl-tema-opcion {
        display:flex; align-items:center; gap:14px;
        min-height:56px; padding:12px 16px; border-radius:16px; cursor:pointer;
        background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.10);
        font-family:inherit; color:#fff; text-align:left; width:100%;
        transition:background .15s, transform .12s;
      }
      .sl-tema-opcion:active { transform:scale(.98); }
      .sl-tema-opcion.activo {
        background:rgba(167,139,250,0.18); border-color:rgba(167,139,250,0.45);
      }
      .sl-tema-emoji  { font-size:1.5rem; flex-shrink:0; }
      .sl-tema-info   { display:flex; flex-direction:column; gap:2px; }
      .sl-tema-nombre { font-size:1.05rem; font-weight:900; }
      .sl-tema-desc   { font-size:.74rem; color:rgba(255,255,255,.45); font-weight:700; }

      /* ── Portrait celular ── */
      @media (max-width:600px) and (orientation:portrait) {
        .sl-accion { font-size:.95rem; }
      }
    </style>

    <div id="sl-wrap">
      <div id="sl-top">
        <button id="sl-cat-btn">
          <span id="sl-cat-emoji">📚</span>
          <span id="sl-cat-nombre">Todas las palabras</span>
        </button>
        <span id="sl-contador"></span>
      </div>

      <div id="sl-card">
        <div id="sl-picto-wrap">
          <img id="sl-picto" alt="">
        </div>
        <div id="sl-palabra"></div>
        <div id="sl-palabra-en"></div>
      </div>

      <div id="sl-silabas"></div>

      <div id="sl-controles">
        <button class="sl-nav" id="sl-prev" aria-label="Anterior">◀</button>
        <div id="sl-acciones">
          <button class="sl-accion" id="sl-btn-secuencia">▶ Sílaba a sílaba</button>
          <button class="sl-accion" id="sl-btn-palabra">🔊 Palabra</button>
        </div>
        <button class="sl-nav" id="sl-next" aria-label="Siguiente">▶</button>
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

// ─── Categorías ────────────────────────────────────────────────────────────────
function _abrirModal() {
  const lista = _el.querySelector('#sl-modal-lista');
  lista.innerHTML = '';

  lista.appendChild(_opcionTema(
    { id: null, emoji: '🌊', label: 'Todas las palabras', desc: `${_catalogo.length} palabras` },
    _tema === null
  ));

  // Agrupar por tipo (vocabulario / lenguaje), igual que el selector de Memorama
  const grupos = { vocabulario: [], lenguaje: [], otros: [] };
  _temas.forEach(t => (grupos[t.tipo] || grupos.otros).push(t));

  const _seccion = (titulo, arr) => {
    if (!arr.length) return;
    const h = document.createElement('div');
    h.className = 'sl-grupo-label';
    h.textContent = titulo;
    lista.appendChild(h);
    arr.forEach(t => lista.appendChild(_opcionTema(
      { id: t.id, emoji: t.emoji || '📚', label: t.label, desc: `${t.palabras?.length || 0} palabras` },
      _tema?.id === t.id
    )));
  };
  _seccion('Vocabulario', grupos.vocabulario);
  _seccion('Lenguaje',    grupos.lenguaje);
  _seccion('Otros',       grupos.otros);

  const box = _el.querySelector('#sl-modal-box');
  box.scrollTop = 0;                                   // reset de scroll (patrón frases.js)
  _el.querySelector('#sl-modal').classList.add('visible');
}

function _opcionTema({ id, emoji, label, desc }, activo) {
  const btn = document.createElement('button');
  btn.className = 'sl-tema-opcion' + (activo ? ' activo' : '');
  btn.innerHTML = `
    <span class="sl-tema-emoji">${emoji}</span>
    <span class="sl-tema-info">
      <span class="sl-tema-nombre">${label}</span>
      <span class="sl-tema-desc">${desc}</span>
    </span>`;
  btn.addEventListener('click', () => { haptic(10); _aplicarTema(id); _cerrarModal(); });
  return btn;
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
  const nombre = _el.querySelector('#sl-cat-nombre');
  const emoji  = _el.querySelector('#sl-cat-emoji');
  if (nombre) nombre.textContent = _tema ? _tema.label : 'Todas las palabras';
  if (emoji)  emoji.textContent  = _tema ? (_tema.emoji || '📚') : '🌊';
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
    chip.addEventListener('click', () => { haptic(8); _decirSilaba(s, i); });
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

// Pronuncia una sola sílaba (al tocar la ficha)
function _decirSilaba(silaba, idx) {
  _detenerSecuencia();
  _resaltar(idx);
  TTS.speak(silaba, { lang: 'es-MX', rate: 0.7, pitch: 1.1 });
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

  let usado = false;
  const fallback = () => {
    if (usado) return; usado = true;
    TTS.speak(entrada.es, { lang: 'es-MX', rate: 0.9, pitch: 1.15 });
  };
  _audioEl.onerror = fallback;
  _audioEl.src = AUDIO_URL(entrada.ruta_img, 'es');
  _audioEl.play().catch(fallback);
}

// Lee sílaba por sílaba, resaltando cada una, y cierra con la palabra completa.
// Encadena con onend (la API de TTS hace synth.cancel() en cada speak, así que
// no podemos usarla en serie; usamos speechSynthesis directo con la voz premium
// que selecciona TTS.getVoice()).
function _reproducirSecuencia() {
  const entrada = _lista[_idx];
  if (!entrada) return;

  const synth = window.speechSynthesis;
  if (!synth) { _reproducirPalabra(); return; }

  _detenerSecuencia();
  const token = ++_seqToken;
  const silabas = silabificar(entrada.es);
  const voz = TTS.getVoice('es-MX');

  let i = 0;
  const siguiente = () => {
    if (!_el || token !== _seqToken) return;            // secuencia obsoleta → abortar
    if (i >= silabas.length) {                          // al final, palabra completa
      _limpiarResaltado();
      setTimeout(() => { if (token === _seqToken) _reproducirPalabra(); }, 260);
      return;
    }
    _resaltar(i);
    const u  = new SpeechSynthesisUtterance(silabas[i]);
    u.lang   = 'es-MX';
    u.rate   = 0.7;
    u.pitch  = 1.1;
    if (voz) u.voice = voz;
    u.onend   = () => { if (token === _seqToken) { i++; setTimeout(siguiente, 220); } };
    u.onerror = () => { if (token === _seqToken) { i++; setTimeout(siguiente, 220); } };
    synth.speak(u);
  };

  try { synth.cancel(); } catch {}
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