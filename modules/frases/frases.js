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

const PICTO_URL       = (palabra, lang = 'es') => `assets/pictogramas/${lang}/${palabra}.png`;
const AUDIO_URL       = (palabra, lang = 'es') => `assets/audio/${lang}/${palabra}.mp3`;
const AUDIO_FRASE_URL = (nombre,  lang = 'es') => `assets/audio/frases/${lang}/${nombre}.mp3`;

const NIVELES = [
  {
    id: 1, label: '⭐', titulo: 'Básico',
    color:       '#38bdf8',   // azul cielo — fresco, tranquilo
    colorSuave:  'rgba(56,189,248,0.15)',
    colorBorde:  'rgba(56,189,248,0.40)',
    colorTexto:  '#0c1a24',   // texto oscuro sobre fondo claro del nivel
    bgTira:      'rgba(56,189,248,0.08)',
    bgPanel:     'rgba(56,189,248,0.06)',
    bgPiezaTxt:  'rgba(56,189,248,0.20)',
    bordePiezaTxt: 'rgba(56,189,248,0.50)',
  },
  {
    id: 2, label: '⭐⭐', titulo: 'Intermedio',
    color:       '#c084fc',   // violeta suave
    colorSuave:  'rgba(192,132,252,0.15)',
    colorBorde:  'rgba(192,132,252,0.40)',
    colorTexto:  '#1a0a2e',
    bgTira:      'rgba(192,132,252,0.08)',
    bgPanel:     'rgba(192,132,252,0.06)',
    bgPiezaTxt:  'rgba(192,132,252,0.22)',
    bordePiezaTxt: 'rgba(192,132,252,0.50)',
  },
  {
    id: 3, label: '⭐⭐⭐', titulo: 'Avanzado',
    color:       '#fb7185',   // coral cálido
    colorSuave:  'rgba(251,113,133,0.15)',
    colorBorde:  'rgba(251,113,133,0.40)',
    colorTexto:  '#2a0a10',
    bgTira:      'rgba(251,113,133,0.08)',
    bgPanel:     'rgba(251,113,133,0.06)',
    bgPiezaTxt:  'rgba(251,113,133,0.22)',
    bordePiezaTxt: 'rgba(251,113,133,0.50)',
  },
];

// ─── Estado ───────────────────────────────────────────────────────────────────
let _el          = null;
let _todasFrases = [];   // todas las frases cargadas
let _frases      = [];   // frases del nivel + idioma activos
let _nivel       = 1;
let _lang        = 'es'; // idioma activo — sincronizado con pill global
let _activa      = 0;
let _built       = [];
let _audioEl     = null;

// ─── API pública ──────────────────────────────────────────────────────────────
export async function pause() {
  // Detener audio pero mantener todo el estado en memoria
  if (_audioEl) _audioEl.pause();
  TTS.stop();
}

export async function resume(container) {
  // El contenedor puede haber cambiado — remontar UI con el estado actual
  _el = container;
  _render();
  // Restaurar estado visual
  _renderNiveles();
  _aplicarTema(_nivel);
  _renderSelector();
  _renderPiezas();
  _renderTira();
  _actualizarVacio();
  // Re-registrar listener de idioma
  window.removeEventListener('lang-change', _onLangChange);
  window.addEventListener('lang-change', _onLangChange);
}

export async function init(container) {
  _el     = container;
  _built  = [];
  _activa = -1;  // sin frase preseleccionada al entrar
  _nivel  = 1;
  _lang   = window._langActivo || 'es';

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
  _el = null; _todasFrases = []; _frases = []; _built = [];
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
    'overflow:hidden;background:transparent;padding:14px 20px 12px;gap:12px;';

  _el.innerHTML = `
  <style>
    /* ── Selector de nivel ── */
    #fr-niveles {
      flex-shrink: 0;
      display: flex; align-items: center; gap: 10px;
    }
    #fr-niveles-label {
      font-size: .85rem; font-weight: 900; letter-spacing: .08em;
      text-transform: uppercase; color: #fff;
      margin-right: 4px; text-shadow: 0 1px 4px rgba(0,0,0,0.40);
    }
    .fr-nivel-btn {
      height: 44px; padding: 0 18px; border-radius: 99px; border: 2px solid rgba(255,255,255,0.25);
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
    #fr-tira.correcto {
      border-color: #22c55e; border-style: solid;
    }
    #fr-tira-piezas {
      flex: 1; display: flex; align-items: center;
      gap: 8px; flex-wrap: wrap; min-height: 60px;
    }
    #fr-tira-placeholder {
      color: rgba(255,255,255,0.50);
      font-size: 1rem; font-weight: 700; font-style: italic;
    }
    /* Pieza en la tira — altura fija para evitar que el renglón crezca */
    .fr-tira-pieza {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 12px; border-radius: 12px;
      font-weight: 900; font-size: 1rem;
      min-height: 60px;
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

    /* Botones de acción */
    #fr-tira-acciones { display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; }
    .fr-accion-btn {
      width: 44px; height: 44px; border-radius: 50%; border: none;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: transform .12s, background .2s;
    }
    .fr-accion-btn:active { transform: scale(.88); }
    #fr-btn-leer {
      background: #0ea5c9;
      border: 2px solid #38bdf8;
      box-shadow: 0 4px 16px rgba(14,165,201,0.50);
    }
    #fr-btn-borrar {
      background: rgba(255,255,255,0.18);
      border: 1.5px solid rgba(255,255,255,0.35);
      color: #fff; font-size: 1.5rem; font-weight: 400; font-family: inherit;
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
    #fr-selector { flex-shrink: 0; display: flex; gap: 10px; flex-wrap: wrap; }
    .fr-pill {
      padding: 10px 20px; border-radius: 99px; border: 1.5px solid rgba(255,255,255,0.18);
      cursor: pointer; font-family: inherit; font-weight: 800; font-size: 1rem;
      background: rgba(255,255,255,0.10); color: rgba(255,255,255,0.80);
      transition: background .18s, color .18s, transform .12s, border-color .18s;
      white-space: nowrap; text-shadow: 0 1px 4px rgba(0,0,0,0.40);
    }
    .fr-pill:active { transform: scale(.93); }
    .fr-pill.activa { color: #fff; border-color: transparent; font-weight: 900;
                      text-shadow: 0 1px 6px rgba(0,0,0,0.50); }

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

  <!-- Selector de nivel -->
  <div id="fr-niveles">
    <span id="fr-niveles-label">Nivel</span>
  </div>

  <!-- Tira de construcción -->
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
  <div id="fr-selector"></div>

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
  const wrap = _el.querySelector('#fr-niveles');
  const label = wrap.querySelector('#fr-niveles-label');
  wrap.innerHTML = '';
  wrap.appendChild(label);

  // Solo mostrar niveles que tienen frases en el idioma activo
  const nivelesConFrases = NIVELES.filter(n =>
    _todasFrases.some(f => f.nivel === n.id && (f.lang || 'es') === _lang)
  );

  // Si el nivel activo no tiene frases en este idioma, cambiar al primero disponible
  if (nivelesConFrases.length && !nivelesConFrases.find(n => n.id === _nivel)) {
    _nivel = nivelesConFrases[0].id;
  }

  nivelesConFrases.forEach(n => {
    const btn = document.createElement('button');
    btn.className   = 'fr-nivel-btn' + (n.id === _nivel ? ' activo' : '');
    btn.textContent = n.label + ' ' + n.titulo;
    btn.title       = n.titulo;
    if (n.id === _nivel) {
      btn.style.borderColor   = n.color;
      btn.style.color         = n.color;
      btn.style.background    = n.colorSuave;
      btn.style.boxShadow     = `0 0 0 1px ${n.colorBorde}`;
    }
    btn.addEventListener('click', () => { haptic(8); _cambiarNivel(n.id); });
    wrap.appendChild(btn);
  });
}

function _cambiarNivel(nivel) {
  _nivel  = nivel;
  _activa = -1;  // sin frase preseleccionada al cambiar nivel
  _built  = [];
  _frases = _todasFrases.filter(f => f.nivel === nivel && (f.lang || 'es') === _lang);

  _renderNiveles();
  _aplicarTema(nivel);

  _el.querySelector('#fr-tira').classList.remove('correcto');
  _renderSelector();
  _renderPiezas();
  _renderTira();
  _actualizarVacio();
}

// Aplica el tema de color del nivel a todos los elementos de la UI
function _aplicarTema(nivel) {
  const n = NIVELES.find(x => x.id === nivel);
  if (!n) return;

  // Tira
  const tira = _el.querySelector('#fr-tira');
  if (tira) {
    tira.style.background   = n.bgTira;
    tira.style.borderColor  = n.colorBorde;
  }

  // Panel de piezas
  const panel = _el.querySelector('#fr-panel-piezas');
  if (panel) panel.style.background = n.bgPanel;

  // Label PIEZAS
  const lbl = _el.querySelector('#fr-panel-label');
  if (lbl) lbl.style.color = n.color;

  // Label NIVEL
  const lvlLbl = _el.querySelector('#fr-niveles-label');
  if (lvlLbl) lvlLbl.style.color = n.color;

  // Guardar en variable CSS para que las piezas de texto la usen
  _el.style.setProperty('--fr-nivel-color',      n.color);
  _el.style.setProperty('--fr-nivel-suave',      n.colorSuave);
  _el.style.setProperty('--fr-nivel-borde',      n.colorBorde);
  _el.style.setProperty('--fr-nivel-bg-txt',     n.bgPiezaTxt);
  _el.style.setProperty('--fr-nivel-borde-txt',  n.bordePiezaTxt);
}

function _actualizarVacio() {
  const vacio  = _el.querySelector('#fr-vacio');
  const panel  = _el.querySelector('#fr-panel-piezas');
  const tira   = _el.querySelector('#fr-tira');
  const sel    = _el.querySelector('#fr-selector');
  const sinFrases = _frases.length === 0;
  vacio.style.display  = sinFrases ? 'flex'  : 'none';
  panel.style.display  = sinFrases ? 'none'  : '';
  tira.style.display   = sinFrases ? 'none'  : '';
  sel.style.display    = sinFrases ? 'none'  : '';
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
      btn.style.color      = '#fff';
      btn.style.fontWeight = '900';
    }
    btn.textContent = _lang === 'en' ? (f.en || f.es) : f.es;
    btn.addEventListener('click', () => {
      haptic(8);
      _seleccionarFrase(i);
      // Reproducir el enunciado completo al seleccionarlo
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
    p.style.background  = i === idx ? (nivelCfg?.color || '#14b8a6') : '';
    p.style.color       = i === idx ? '#fff' : '';
    p.style.fontWeight  = i === idx ? '900' : '';
  });

  _renderPiezas();
  _renderTira();
  // Precargar audio del enunciado para respuesta inmediata al tocar play
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
      const img   = document.createElement('img');
      img.src     = PICTO_URL(pieza.texto, _lang);
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
  _reproducirPieza(pieza);
  _renderTira();

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

  // Esperar a que termine el audio de la última pieza antes de leer la frase completa.
  // Si _audioEl está reproduciendo, esperamos su evento 'ended'.
  // Si no hay audio o ya terminó, usamos un delay mínimo.
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
      const img   = document.createElement('img');
      img.src     = PICTO_URL(pieza.texto, _lang);
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
      // Frase completa — usar MP3 del enunciado completo
      const texto = _lang === 'en' ? (frase.en || frase.es) : frase.es;
      _reproducirFrase(texto, frase.id);
    } else {
      // Frase parcial — reproducir piezas construidas en cadena
      _reproducirCadena(_built.map(i => frase.piezas[i]));
    }
  });

  _el.querySelector('#fr-btn-borrar').addEventListener('click', () => {
    haptic(8);
    _built = [];
    _el.querySelector('#fr-tira').classList.remove('correcto');
    _renderTira();
    _renderPiezas();
  });
}

// ─── Audio ────────────────────────────────────────────────────────────────────

// Elemento de audio reutilizable — preload:'auto' para respuesta inmediata
function _getAudio() {
  if (!_audioEl) {
    _audioEl = document.createElement('audio');
    _audioEl.preload = 'auto';
  }
  return _audioEl;
}

// Precarga silenciosa del enunciado completo al seleccionar una frase.
// Así cuando el usuario toca play, el audio ya está en buffer.
function _precargarFrase(id) {
  const url = AUDIO_FRASE_URL(id, _lang);
  const tmp = new Audio();
  tmp.preload = 'auto';
  tmp.src = url;
  // No lo reproducimos — solo lo descargamos al buffer del navegador
}

// Reproduce el MP3 del enunciado completo con fallback a TTS.
function _reproducirFrase(texto, id) {
  const audio = _getAudio();
  TTS.stop(); // cancelar TTS si estaba activo
  audio.pause();
  audio.src     = AUDIO_FRASE_URL(id, _lang);
  audio.onerror = () => { TTS.stop(); _hablarTTS(texto); };
  audio.play().catch(() => { TTS.stop(); _hablarTTS(texto); });
}

// Reproduce una pieza individual con fallback a TTS.
function _reproducirPieza(pieza) {
  const url   = pieza.tipo === 'picto'
    ? AUDIO_URL(pieza.texto, _lang)
    : AUDIO_FRASE_URL(pieza.texto, _lang);
  const audio = _getAudio();
  TTS.stop();
  audio.pause();
  audio.src     = url;
  audio.onerror = () => { TTS.stop(); _hablarTTS(pieza.texto); };
  audio.play().catch(() => { TTS.stop(); _hablarTTS(pieza.texto); });
}

// Reproduce una cadena de piezas en secuencia (para frase parcial).
function _reproducirCadena(piezas) {
  if (!piezas.length) return;
  const [primera, ...resto] = piezas;
  const audio = _getAudio();
  TTS.stop();
  audio.pause();
  const url     = primera.tipo === 'picto'
    ? AUDIO_URL(primera.texto, _lang)
    : AUDIO_FRASE_URL(primera.texto, _lang);
  audio.src     = url;
  audio.onerror = () => { _hablarTTS(primera.texto); };
  audio.onended = () => { audio.onended = null; _reproducirCadena(resto); };
  audio.play().catch(() => _hablarTTS(primera.texto));
}

function _hablarTTS(texto) {
  const ttsLang = _lang === 'en' ? 'en-US' : 'es-MX';
  TTS.speak(texto, { lang: ttsLang, rate: 0.90, pitch: 1.15 });
}

function _onLangChange(e) {
  const nuevoLang = e.detail?.lang;
  if (!nuevoLang || nuevoLang === _lang) return;
  _lang = nuevoLang;
  // _renderNiveles ajusta _nivel si el actual no tiene frases en el nuevo idioma
  _renderNiveles();
  _cambiarNivel(_nivel);
}