/* modules/frases/frases.js
   Módulo "Frases" para Marina 2.

   Diseño:
   ┌─────────────────────────────────────────────────┐
   │ Selector de nivel  ①  ②  ③                     │
   ├─────────────────────────────────────────────────┤
   │ Tira de construcción + 🔊 + ×                   │
   ├─────────────────────────────────────────────────┤
   │ PIEZAS — chips tocables (picto o texto)          │
   ├─────────────────────────────────────────────────┤
   │ Selector de frases (pills del nivel activo)      │
   └─────────────────────────────────────────────────┘

   Niveles de dificultad:
   · 1 — básico:      2 piezas, estructura simple
   · 2 — intermedio:  3 piezas, verbos o adjetivos
   · 3 — avanzado:    4+ piezas, frases compuestas

   Feedback de orden:
   · Correcto  → piezas en tira con borde verde + confeti
   · Distinto  → sin penalización, TTS lee la frase igual
*/

import { TTS }                   from '../../core/tts.js';
import { lanzarConfeti, haptic } from '../../core/ui.js';
import { Telemetry }             from '../../core/telemetry.js';

const PICTO_URL       = (ruta_img) => `assets/pictogramas/${ruta_img.toLowerCase()}`;
const AUDIO_URL       = (palabra, lang = 'es') => `assets/audio/${lang}/${palabra}.mp3`;
const AUDIO_FRASE_URL = (nombre,  lang = 'es') => `assets/audio/frases/${lang}/${nombre}.mp3`;

// Resuelve la URL de audio de un picto usando ruta_img del catálogo,
// igual que generar-audio.py. Evita el problema con nombres que tienen
// tildes o espacios (ej. "autobús de dos pisos" → "autobus-dos-pisos.mp3").
function _urlAudioPicto(pieza, lang) {
  const entrada = pieza.picto_id ? _pictos[pieza.picto_id] : null;
  const nombre  = entrada
    ? entrada.ruta_img.replace(/\.png$/i, '')
    : sanitizarNombre(pieza.texto);  // legacy sin picto_id
  return AUDIO_URL(nombre, lang);
}

// Espejo exacto de sanitizar_nombre() en generar-audio.py.
// Convierte el texto de una pieza en el nombre de archivo que el script
// realmente produce. Ej: "¿qué hacemos?" → "qué-hacemos" (el archivo en
// disco, porque "¿qué hacemos?.mp3" es un nombre inválido en Windows).
// NO afecta el texto que se envía al TTS — ese sigue siendo pieza.texto.
function sanitizarNombre(texto) {
  let nombre = (texto || '').trim().toLowerCase();
  nombre = nombre.replace(/\//g, '-');              // '/' → '-'  (igual que Python)
  nombre = nombre.replace(/[\\:*?"<>|¿¡!,;.]/g, ''); // resto de inválidos → ''
  nombre = nombre.split(/\s+/).filter(Boolean).join('-');
  nombre = nombre.replace(/^-+|-+$/g, '');
  return nombre || 'sin-nombre';
}

const NIVELES = [
  {
    id: 1, label: '⭐', titulo: 'Básico',
    color:         '#38bdf8',
    colorSuave:    'rgba(56,189,248,0.15)',
    colorBorde:    'rgba(56,189,248,0.40)',
    colorTexto:    '#0c1a24',
    bgTira:        'rgba(56,189,248,0.08)',
    bgPanel:       'rgba(56,189,248,0.06)',
    bgPiezaTxt:    'rgba(56,189,248,0.20)',
    bordePiezaTxt: 'rgba(56,189,248,0.50)',
  },
  {
    id: 2, label: '⭐⭐', titulo: 'Intermedio',
    color:         '#c084fc',
    colorSuave:    'rgba(192,132,252,0.15)',
    colorBorde:    'rgba(192,132,252,0.40)',
    colorTexto:    '#1a0a2e',
    bgTira:        'rgba(192,132,252,0.08)',
    bgPanel:       'rgba(192,132,252,0.06)',
    bgPiezaTxt:    'rgba(192,132,252,0.22)',
    bordePiezaTxt: 'rgba(192,132,252,0.50)',
  },
  {
    id: 3, label: '⭐⭐⭐', titulo: 'Avanzado',
    color:         '#fb7185',
    colorSuave:    'rgba(251,113,133,0.15)',
    colorBorde:    'rgba(251,113,133,0.40)',
    colorTexto:    '#2a0a10',
    bgTira:        'rgba(251,113,133,0.08)',
    bgPanel:       'rgba(251,113,133,0.06)',
    bgPiezaTxt:    'rgba(251,113,133,0.22)',
    bordePiezaTxt: 'rgba(251,113,133,0.50)',
  },
];

// ─── Estado ───────────────────────────────────────────────────────────────────
let _el          = null;
let _todasFrases = [];
let _frases      = [];
let _nivel       = 1;
let _lang        = 'es';
let _activa      = -1;
let _built       = [];
let _audioEl     = null;
let _pictos      = {};

// ─── API pública ──────────────────────────────────────────────────────────────
export async function pause() {
  if (_audioEl) _audioEl.pause();
  TTS.stop();
}

export async function resume(container) {
  _el = container;
  _lang = _langDesdeConfig();
  _render();
  _renderNiveles();
  _aplicarTema(_nivel);
  _renderSelector();
  _renderPiezas();
  _renderTira();
  _actualizarVacio();
  window.removeEventListener('lang-change', _onLangChange);
  window.addEventListener('lang-change', _onLangChange);
}

function _langDesdeConfig() {
  const cfg = window._langConfig || { es: true, en: false };
  if (cfg.es && cfg.en) return 'ambos';
  if (cfg.en) return 'en';
  return 'es';
}

export async function init(container) {
  _el     = container;
  _built  = [];
  _activa = -1;
  _nivel  = 1;
  _lang   = _langDesdeConfig();

  try {
    const res = await fetch('./data/pictos.json');
    const cat = await res.json();
    _pictos = Object.fromEntries(cat.map(e => [e.id, e]));
  } catch {
    _pictos = {};
  }

  try {
    const res = await fetch('./data/frases.json');
    _todasFrases = await res.json();
  } catch (e) {
    console.error('[frases] No se pudo cargar frases.json', e);
    _todasFrases = [];
  }

  _render();
  _cambiarNivel(1);
  window.addEventListener('lang-change', _onLangChange);
}

export function destroy() {
  window.removeEventListener('lang-change', _onLangChange);
  if (_audioEl) { _audioEl.pause(); _audioEl.src = ''; _audioEl = null; }
  TTS.stop();
  _el = null; _todasFrases = []; _frases = []; _built = []; _pictos = {};
}

export function onEnter() {}
export function onLeave() {
  if (_audioEl) _audioEl.pause();
  TTS.stop();
}

// ─── Render del shell ─────────────────────────────────────────────────────────
function _render() {
  _el.style.cssText =
    'position:absolute;inset:0;display:flex;flex-direction:column;' +
    'overflow:hidden;background:transparent;' +
    'padding:14px 20px calc(12px + env(safe-area-inset-bottom, 0px)) 20px;gap:12px;';

  _el.innerHTML = `
  <style>
    /* ── Selector de nivel ── */
    #fr-niveles {
      flex-shrink: 0;
      display: flex; align-items: center; gap: 8px;
      /* Sin acciones aquí — viven en la tira */
    }
    #fr-niveles-label {
      font-size: .85rem; font-weight: 900; letter-spacing: .08em;
      text-transform: uppercase; color: #fff;
      margin-right: 4px; text-shadow: 0 1px 4px rgba(0,0,0,0.40);
      flex-shrink: 0;
    }
    .fr-nivel-btn {
      height: 44px; padding: 0 18px; border-radius: 99px;
      border: 2px solid rgba(255,255,255,0.25);
      cursor: pointer; font-family: inherit; font-weight: 900; font-size: 1.05rem;
      background: rgba(255,255,255,0.10); color: #fff;
      transition: all .2s; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      letter-spacing: 0.5px; white-space: nowrap;
      text-shadow: 0 1px 4px rgba(0,0,0,0.40);
    }
    .fr-nivel-btn:active { transform: scale(.92); }
    .fr-nivel-btn.activo {
      color: #fff; font-weight: 900;
      text-shadow: 0 1px 8px rgba(0,0,0,0.60);
    }

    /* ── Tira de construcción ── */
    #fr-tira {
      flex-shrink: 0;
      background: rgba(0,0,0,0.35);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      border: 1.5px dashed rgba(255,255,255,0.15);
      border-radius: 20px; padding: 12px 16px;
      min-height: 88px;
      display: flex; align-items: center; gap: 10px;
      transition: border-color .35s, border-style .35s;
    }
    #fr-tira.correcto { border-color: #22c55e; border-style: solid; }
    #fr-tira-piezas {
      flex: 1; display: flex; align-items: center;
      gap: 8px; flex-wrap: wrap; min-height: 60px;
    }
    #fr-tira-placeholder {
      color: rgba(255,255,255,0.50);
      font-size: 1rem; font-weight: 700; font-style: italic;
    }
    .fr-tira-pieza {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 12px; border-radius: 12px;
      font-weight: 900; font-size: 1rem; min-height: 60px;
      animation: fr-pop .22s cubic-bezier(.34,1.56,.64,1) both;
      transition: background .35s, box-shadow .35s, border-color .35s;
    }
    .fr-tira-pieza.picto { background: #fff; color: #07212e; border: 2px solid transparent; }
    .fr-tira-pieza.texto {
      background: var(--fr-nivel-bg-txt, rgba(14,165,201,0.25));
      border: 1.5px solid var(--fr-nivel-borde-txt, rgba(14,165,201,0.55));
      color: #fff; font-weight: 900; font-size: 1.05rem;
      text-shadow: 0 1px 6px rgba(0,0,0,0.65);
    }
    .fr-tira-pieza.correcto.picto { border-color: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,0.25); }
    .fr-tira-pieza.correcto.texto { background: rgba(34,197,94,0.18); border-color: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,0.18); }
    .fr-tira-pieza img { width: 44px; height: 44px; object-fit: contain; border-radius: 8px; }

    /* ── Botones de acción — viven en la tira, lado derecho ── */
    #fr-tira-acciones {
      display: flex; flex-direction: column;
      align-items: center; gap: 8px;
      flex-shrink: 0;
    }
    .fr-accion-btn {
      width: 44px; height: 44px; border-radius: 50%; border: none;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: transform .12s, box-shadow .15s;
    }
    .fr-accion-btn:active { transform: scale(.88); }
    #fr-btn-leer {
      background: #00e5b0;
      box-shadow: 0 4px 16px rgba(0,229,176,0.45);
    }
    #fr-btn-borrar {
      background: rgba(251,113,133,0.20);
      border: 1.5px solid rgba(251,113,133,0.50) !important;
      color: #fb7185; font-size: 1.5rem; font-weight: 300; font-family: inherit;
    }

    /* ── Panel de piezas ── */
    #fr-panel-piezas {
      flex-shrink: 0;
      background: rgba(0,0,0,0.30);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.10);
      border-radius: 20px; padding: 12px 16px;
    }
    #fr-panel-label {
      font-size: .78rem; font-weight: 900; letter-spacing: .10em;
      text-transform: uppercase; color: rgba(255,255,255,0.70); margin-bottom: 10px;
    }
    #fr-piezas { display: flex; gap: 10px; flex-wrap: wrap; }
    .fr-pieza {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 16px; border-radius: 16px;
      cursor: pointer; border: none;
      font-family: inherit; font-weight: 900; font-size: 1.05rem;
      min-height: 88px;
      transition: transform .14s, opacity .2s, box-shadow .15s;
      box-shadow: 0 4px 16px rgba(0,0,0,0.25);
    }
    .fr-pieza:active { transform: scale(.93); }
    .fr-pieza.picto  { background: #fff; color: #07212e; }
    .fr-pieza.texto  {
      background: var(--fr-nivel-bg-txt, rgba(255,255,255,0.14));
      border: 2px solid var(--fr-nivel-borde-txt, rgba(255,255,255,0.35));
      color: #fff; font-weight: 900; font-size: 1.1rem;
      text-shadow: 0 1px 6px rgba(0,0,0,0.65);
    }
    .fr-pieza.usada  { opacity: 0.28; pointer-events: none; }
    .fr-pieza img    { width: 60px; height: 60px; object-fit: contain; border-radius: 10px; }

    /* ── Selector de frases ── */
    #fr-selector-wrap {
      flex: 1;
      min-height: 0;
      position: relative;
    }
    #fr-selector-wrap::after {
      content: '';
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 56px;
      pointer-events: none;
      background: linear-gradient(to top, rgba(5,30,65,0.85) 0%, transparent 100%);
      border-radius: 0 0 12px 12px;
      transition: opacity .3s;
    }
    #fr-selector-wrap.al-fondo::after { opacity: 0; }
    #fr-selector {
      height: 100%;
      display: flex; flex-direction: column;
      gap: 8px;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      padding-right: 2px;
      padding-bottom: 48px;
    }
    #fr-selector::-webkit-scrollbar { display: none; }
    .fr-pill {
      width: 100%; box-sizing: border-box; text-align: left;
      padding: 12px 20px; border-radius: 16px;
      border: 1.5px solid var(--fr-nivel-borde, rgba(255,255,255,0.18));
      background: var(--fr-nivel-suave, rgba(255,255,255,0.08));
      color: var(--fr-nivel-color, rgba(255,255,255,0.85));
      cursor: pointer; font-family: inherit; font-weight: 800; font-size: 1.1rem;
      white-space: normal; line-height: 1.3;
      text-shadow: 0 1px 6px rgba(0,0,0,0.50);
      transition: background .18s, color .18s, transform .12s,
                  border-color .18s, box-shadow .18s;
    }
    .fr-pill:active { transform: scale(.97); }
    .fr-pill.activa {
      background: var(--fr-nivel-color, #38bdf8);
      color: #07212e;
      border-color: transparent;
      font-weight: 900; font-size: 1.15rem;
      text-shadow: none;
      box-shadow: 0 4px 14px var(--fr-nivel-borde, rgba(56,189,248,0.35));
    }

    /* ── Estado vacío ── */
    #fr-vacio {
      display: none; flex: 1; flex-direction: column;
      align-items: center; justify-content: center; gap: 10px;
      color: rgba(255,255,255,0.30); font-size: .95rem; font-weight: 700;
    }

    /* ── Animaciones ── */
    @keyframes fr-pop {
      from { transform: scale(0.6); opacity: 0; }
      to   { transform: scale(1);   opacity: 1; }
    }
  </style>

  <!-- Selector de nivel — solo botones de dificultad, sin acciones -->
  <div id="fr-niveles">
    <span id="fr-niveles-label">Nivel</span>
  </div>

  <!-- Tira de construcción — los botones 🔊 y × viven aquí -->
  <div id="fr-tira">
    <div id="fr-tira-piezas">
      <span id="fr-tira-placeholder">toca las piezas en orden…</span>
    </div>
    <div id="fr-tira-acciones">
      <button class="fr-accion-btn" id="fr-btn-leer" title="Leer frase">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M11 5L6 9H2v6h4l5 4V5z" fill="white" opacity=".9"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"
                stroke="white" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>
        </svg>
      </button>
      <button class="fr-accion-btn" id="fr-btn-borrar" title="Borrar">×</button>
    </div>
  </div>

  <!-- Panel de piezas -->
  <div id="fr-panel-piezas">
    <div id="fr-panel-label">PIEZAS</div>
    <div id="fr-piezas"></div>
  </div>

  <!-- Selector de frases -->
  <div id="fr-selector-wrap">
    <div id="fr-selector"></div>
  </div>

  <!-- Estado vacío -->
  <div id="fr-vacio">
    <span style="font-size:2.5rem">🔤</span>
    No hay frases para este nivel todavía.
  </div>
  `;

  _renderNiveles();
  _bindEvents();
}

// ─── Selector de nivel ────────────────────────────────────────────────────────
function _renderNiveles() {
  const wrap  = _el.querySelector('#fr-niveles');
  const label = wrap.querySelector('#fr-niveles-label');
  wrap.innerHTML = '';
  wrap.appendChild(label);

  // Solo mostrar niveles que tienen frases en el idioma activo
  const nivelesConFrases = NIVELES.filter(n =>
    _todasFrases.some(f => {
      if (f.nivel !== n.id) return false;
      if (_lang === 'ambos') return true;
      return (f.lang || 'es') === _lang;
    })
  );

  if (nivelesConFrases.length && !nivelesConFrases.find(n => n.id === _nivel)) {
    _nivel = nivelesConFrases[0].id;
  }

  nivelesConFrases.forEach(n => {
    const btn = document.createElement('button');
    btn.className   = 'fr-nivel-btn' + (n.id === _nivel ? ' activo' : '');
    btn.textContent = n.label;          // solo estrellas — sin texto del título
    btn.title       = n.titulo;
    if (n.id === _nivel) {
      btn.style.borderColor = n.color;
      btn.style.color       = n.color;
      btn.style.background  = n.colorSuave;
      btn.style.boxShadow   = `0 0 0 1px ${n.colorBorde}`;
    }
    btn.addEventListener('click', () => { haptic(8); _cambiarNivel(n.id); });
    wrap.appendChild(btn);
  });
  // No hay acciones que mover — viven en la tira (HTML estático)
}

function _cambiarNivel(nivel) {
  _nivel  = nivel;
  _activa = -1;
  _built  = [];
  _frases = _todasFrases.filter(f => {
    if (f.nivel !== nivel) return false;
    if (_lang === 'ambos') return true;
    return (f.lang || 'es') === _lang;
  });

  _renderNiveles();
  _aplicarTema(nivel);
  _el.querySelector('#fr-tira').classList.remove('correcto');
  _renderSelector();
  _renderPiezas();
  _renderTira();
  _actualizarVacio();
}

function _aplicarTema(nivel) {
  const n = NIVELES.find(x => x.id === nivel);
  if (!n) return;

  const tira = _el.querySelector('#fr-tira');
  if (tira) { tira.style.background = n.bgTira; tira.style.borderColor = n.colorBorde; }

  const panel = _el.querySelector('#fr-panel-piezas');
  if (panel) panel.style.background = n.bgPanel;

  const lbl = _el.querySelector('#fr-panel-label');
  if (lbl) lbl.style.color = n.color;

  const lvlLbl = _el.querySelector('#fr-niveles-label');
  if (lvlLbl) lvlLbl.style.color = n.color;

  _el.style.setProperty('--fr-nivel-color',     n.color);
  _el.style.setProperty('--fr-nivel-suave',     n.colorSuave);
  _el.style.setProperty('--fr-nivel-borde',     n.colorBorde);
  _el.style.setProperty('--fr-nivel-bg-txt',    n.bgPiezaTxt);
  _el.style.setProperty('--fr-nivel-borde-txt', n.bordePiezaTxt);
}

function _actualizarVacio() {
  const vacio = _el.querySelector('#fr-vacio');
  const panel = _el.querySelector('#fr-panel-piezas');
  const tira  = _el.querySelector('#fr-tira');
  const sel   = _el.querySelector('#fr-selector-wrap');
  const sinFrases = _frases.length === 0;
  vacio.style.display = sinFrases ? 'flex'  : 'none';
  panel.style.display = sinFrases ? 'none'  : '';
  tira.style.display  = sinFrases ? 'none'  : '';
  sel.style.display   = sinFrases ? 'none'  : '';
}

// ─── Selector de frases ───────────────────────────────────────────────────────
function _renderSelector() {
  const wrap     = _el.querySelector('#fr-selector');
  const nivelCfg = NIVELES.find(n => n.id === _nivel);
  wrap.innerHTML = '';

  _frases.forEach((f, i) => {
    const btn = document.createElement('button');
    btn.className = 'fr-pill' + (i === _activa ? ' activa' : '');
    if (i === _activa && nivelCfg) {
      btn.style.background = nivelCfg.color;
      btn.style.color      = '#07212e';
      btn.style.fontWeight = '900';
    }
    btn.textContent = _lang === 'en' ? (f.en || f.es) : f.es;
    btn.addEventListener('click', () => {
      haptic(8);
      _seleccionarFrase(i);
      const texto = _lang === 'en' ? (f.en || f.es) : f.es;
      _reproducirFrase(texto, f.id);
    });
    wrap.appendChild(btn);
  });
}

// ─── Seleccionar frase ────────────────────────────────────────────────────────
function _seleccionarFrase(idx) {
  _activa = idx;
  _built  = [];
  _el.querySelector('#fr-tira').classList.remove('correcto');

  const nivelCfg = NIVELES.find(n => n.id === _nivel);
  _el.querySelectorAll('.fr-pill').forEach((p, i) => {
    p.classList.toggle('activa', i === idx);
    if (i === idx) {
      p.style.background = nivelCfg?.color || '#14b8a6';
      p.style.color      = '#07212e';
      p.style.fontWeight = '900';
    } else {
      p.style.background = '';
      p.style.color      = '';
      p.style.fontWeight = '';
    }
  });

  _renderPiezas();
  _renderTira();
  if (_activa >= 0 && _frases[_activa]) _precargarFrase(_frases[_activa].id);
}

// ─── Piezas disponibles ───────────────────────────────────────────────────────
function _renderPiezas() {
  const wrap  = _el.querySelector('#fr-piezas');
  const frase = _activa >= 0 ? _frases[_activa] : null;
  if (!frase) { wrap.innerHTML = ''; return; }

  wrap.innerHTML = '';
  frase.piezas.forEach((pieza, i) => {
    const btn = document.createElement('button');
    btn.className   = `fr-pieza ${pieza.tipo}` + (_built.includes(i) ? ' usada' : '');
    btn.dataset.idx = i;

    if (pieza.tipo === 'picto') {
      const img     = document.createElement('img');
      const entrada = pieza.picto_id ? _pictos[pieza.picto_id] : null;
      img.src = entrada ? PICTO_URL(entrada.ruta_img) : `assets/pictogramas/${pieza.texto}.png`;
      img.alt     = pieza.texto;
      img.onerror = () => img.remove();
      btn.appendChild(img);
    }

    const span       = document.createElement('span');
    span.textContent = pieza.texto;
    btn.appendChild(span);
    btn.addEventListener('click', () => _tocarPieza(i));
    wrap.appendChild(btn);
  });
}

// ─── Tocar pieza ──────────────────────────────────────────────────────────────
function _tocarPieza(idx) {
  if (_activa < 0 || _built.includes(idx)) return;
  haptic(12);

  const frase = _frases[_activa];
  const pieza = frase.piezas[idx];

  _built.push(idx);
  _renderTira();              // render primero: la UI nunca debe depender del audio
  _reproducirPieza(pieza);    // si el audio falla, la pieza ya está en la tira

  const btnPieza = _el.querySelector(`.fr-pieza[data-idx="${idx}"]`);
  if (btnPieza) btnPieza.classList.add('usada');

  if (_built.length === frase.piezas.length) _onFraseCompleta(frase);

  Telemetry.track('pieza_tocada', {
    _modulo: 'frases', frase: frase.id,
    pieza: pieza.texto, orden: _built.length, nivel: _nivel,
  });
}

// ─── Frase completa ───────────────────────────────────────────────────────────
function _onFraseCompleta(frase) {
  const ordenEsperado = frase.piezas.map((_, i) => i);
  const ordenCorrecto = _built.every((idx, pos) => idx === ordenEsperado[pos]);
  const tira = _el.querySelector('#fr-tira');

  if (ordenCorrecto) {
    tira.classList.add('correcto');
    tira.querySelectorAll('.fr-tira-pieza').forEach(p => p.classList.add('correcto'));
    lanzarConfeti({ count: 60, container: _el });
  }

  const texto = _lang === 'en' ? (frase.en || frase.es) : frase.es;
  const delay = ordenCorrecto ? 400 : 100;
  if (_audioEl && !_audioEl.paused) {
    _audioEl.addEventListener('ended', () => _reproducirFrase(texto, frase.id), { once: true });
    _audioEl.addEventListener('error', () => {
      setTimeout(() => _reproducirFrase(texto, frase.id), delay);
    }, { once: true });
  } else {
    setTimeout(() => _reproducirFrase(texto, frase.id), delay);
  }

  Telemetry.track('frase_completada', {
    _modulo: 'frases', frase: frase.id,
    texto: frase.es, orden_correcto: ordenCorrecto, nivel: _nivel,
  });
}

// ─── Render tira ──────────────────────────────────────────────────────────────
function _renderTira() {
  const wrap        = _el.querySelector('#fr-tira-piezas');
  const placeholder = _el.querySelector('#fr-tira-placeholder');
  const frase       = _activa >= 0 ? _frases[_activa] : null;

  if (_built.length === 0) {
    wrap.innerHTML = '';
    if (placeholder) { placeholder.style.display = ''; wrap.appendChild(placeholder); }
    return;
  }
  if (placeholder) placeholder.style.display = 'none';

  wrap.innerHTML = '';
  _built.forEach(idx => {
    const pieza = frase.piezas[idx];
    const div   = document.createElement('div');
    div.className = `fr-tira-pieza ${pieza.tipo}`;

    if (pieza.tipo === 'picto') {
      const img     = document.createElement('img');
      const entrada = pieza.picto_id ? _pictos[pieza.picto_id] : null;
      img.src = entrada ? PICTO_URL(entrada.ruta_img) : `assets/pictogramas/${pieza.texto}.png`;
      img.alt     = pieza.texto;
      img.onerror = () => img.remove();
      div.appendChild(img);
    }

    const span       = document.createElement('span');
    span.textContent = pieza.texto;
    div.appendChild(span);
    wrap.appendChild(div);
  });
}

// ─── Eventos ──────────────────────────────────────────────────────────────────
function _bindEvents() {
  _el.querySelector('#fr-btn-leer').addEventListener('click', () => {
    haptic(10);
    const frase = _activa >= 0 ? _frases[_activa] : null;
    if (!frase || _built.length === 0) return;
    if (_built.length === frase.piezas.length) {
      const texto = _lang === 'en' ? (frase.en || frase.es) : frase.es;
      _reproducirFrase(texto, frase.id);
    } else {
      _reproducirCadena(_built.map(i => frase.piezas[i]), frase.lang || _lang);
    }
  });

  _el.querySelector('#fr-btn-borrar').addEventListener('click', () => {
    haptic(8);
    _built = [];
    _el.querySelector('#fr-tira').classList.remove('correcto');
    _renderTira();
    _renderPiezas();
  });

  // Fade inferior del selector
  const sel  = _el.querySelector('#fr-selector');
  const wrap = _el.querySelector('#fr-selector-wrap');
  const _actualizarFade = () => {
    const alFondo = sel.scrollTop + sel.clientHeight >= sel.scrollHeight - 4;
    wrap.classList.toggle('al-fondo', alFondo);
  };
  sel.addEventListener('scroll', _actualizarFade, { passive: true });
  requestAnimationFrame(_actualizarFade);
}

// ─── Audio ────────────────────────────────────────────────────────────────────
function _getAudio() {
  if (!_audioEl) { _audioEl = document.createElement('audio'); _audioEl.preload = 'auto'; }
  return _audioEl;
}

function _precargarFrase(id) {
  const tmp = new Audio();
  tmp.preload = 'auto';
  tmp.src = AUDIO_FRASE_URL(id, _lang);
}

function _reproducirURL(url, textoFallback, onEnded = null, langForzado = null) {
  const audio = _getAudio();
  TTS.stop();
  audio.pause();
  audio.onended = onEnded;

  let _fallbackUsado = false;
  const _fallback = () => {
    if (_fallbackUsado) return;
    _fallbackUsado = true;
    _hablarTTS(textoFallback, langForzado);
  };

  audio.onerror = _fallback;
  audio.src     = url;
  audio.play().catch(_fallback);
}

function _reproducirFrase(texto, id) {
  const frase = _frases[_activa];
  const lang  = frase?.lang || _lang;
  _reproducirURL(AUDIO_FRASE_URL(id, lang), texto, null, lang);
}

function _reproducirPieza(pieza) {
  const frase = _frases[_activa];
  const lang  = frase?.lang || _lang;
  const url   = pieza.tipo === 'picto'
    ? _urlAudioPicto(pieza, lang)
    : AUDIO_FRASE_URL(sanitizarNombre(pieza.texto), lang);  // archivo sanitizado
  _reproducirURL(url, pieza.texto, null, lang);  // TTS fallback usa texto original
}

function _reproducirCadena(piezas, lang = null) {
  if (!piezas.length) return;
  const [primera, ...resto] = piezas;
  const url = primera.tipo === 'picto'
    ? _urlAudioPicto(primera, lang)
    : AUDIO_FRASE_URL(sanitizarNombre(primera.texto), lang);  // archivo sanitizado
  _reproducirURL(url, primera.texto, () => _reproducirCadena(resto, lang), lang);
}

function _hablarTTS(texto, langForzado = null) {
  const base    = langForzado || (_lang === 'en' ? 'en' : 'es');
  const ttsLang = base === 'en' ? 'en-US' : 'es-MX';
  TTS.speak(texto, ttsLang);
}

// ─── Cambio de idioma ─────────────────────────────────────────────────────────
function _onLangChange(e) {
  const cfg  = e.detail?.langConfig;
  if (!cfg) return;
  const nuevo = (cfg.es && cfg.en) ? 'ambos' : cfg.en ? 'en' : 'es';
  if (nuevo === _lang) return;
  _lang = nuevo;
  _cambiarNivel(_nivel);
}