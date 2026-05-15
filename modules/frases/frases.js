/* modules/frases/frases.js
   Módulo "Frases" para Marina 2.

   Diseño:
   ┌─────────────────────────────────────────────────┐
   │ Tira de construcción + 🔊 + ×                   │
   ├─────────────────────────────────────────────────┤
   │ PIEZAS — chips tocables (picto o texto)          │
   ├─────────────────────────────────────────────────┤
   │ Selector de frases (pills horizontales)          │
   └─────────────────────────────────────────────────┘

   Feedback de orden:
   · Orden correcto  → piezas en tira con borde verde + confeti verde
   · Orden distinto  → piezas en tira con estilo neutro, sin penalización
   · En ambos casos  → TTS lee la frase completa
*/

import { TTS }                    from '../../core/tts.js';
import { lanzarConfeti, haptic }  from '../../core/ui.js';
import { Telemetry }              from '../../core/telemetry.js';

const PICTO_URL = (palabra) => `assets/pictogramas/es/${palabra}.png`;
const AUDIO_URL = (palabra) => `assets/audio/es/${palabra}.mp3`;

// ─── Estado ───────────────────────────────────────────────────────────────────
let _el      = null;
let _frases  = [];
let _activa  = 0;
let _built   = [];   // índices de piezas tocadas, en orden de toque
let _audioEl = null;

// ─── API pública ──────────────────────────────────────────────────────────────
export async function init(container) {
  _el     = container;
  _built  = [];
  _activa = 0;

  try {
    const res = await fetch('./data/frases.json');
    _frases = await res.json();
  } catch (e) {
    console.error('[frases] No se pudo cargar frases.json', e);
    _frases = [];
  }

  _render();
  _seleccionarFrase(0);
  window.addEventListener('lang-change', _onLangChange);
}

export function destroy() {
  window.removeEventListener('lang-change', _onLangChange);
  if (_audioEl) { _audioEl.pause(); _audioEl.src = ''; _audioEl = null; }
  TTS.stop();
  _el = null; _frases = []; _built = [];
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
    'overflow:hidden;background:transparent;padding:16px 20px;gap:14px;';

  _el.innerHTML = `
  <style>
    /* ── Tira de construcción ── */
    #fr-tira {
      flex-shrink: 0;
      background: rgba(0,0,0,0.35);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      border: 1.5px dashed rgba(255,255,255,0.15);
      border-radius: 20px;
      padding: 16px 18px;
      min-height: 110px;
      display: flex; align-items: center; gap: 10px;
      transition: border-color .35s;
    }
    #fr-tira.correcto {
      border-color: #22c55e;
      border-style: solid;
    }
    #fr-tira-piezas {
      flex: 1; display: flex; align-items: center;
      gap: 10px; flex-wrap: wrap; min-height: 64px;
    }
    #fr-tira-placeholder {
      color: rgba(255,255,255,0.30);
      font-size: 1rem; font-weight: 600; font-style: italic;
    }

    /* Pieza en la tira — altura fija igual a piezas con pictograma
       para evitar que el renglón cambie de alto según el contenido */
    .fr-tira-pieza {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 14px; border-radius: 14px;
      font-weight: 900; font-size: 1.05rem;
      min-height: 60px; /* img(44px) + padding(8px*2) */
      animation: fr-pop .22s cubic-bezier(.34,1.56,.64,1) both;
      transition: background .35s, box-shadow .35s, border-color .35s;
    }
    .fr-tira-pieza.picto {
      background: #fff; color: #07212e;
      border: 2px solid transparent;
    }
    .fr-tira-pieza.texto {
      background: rgba(14,165,201,0.18);
      border: 1.5px solid rgba(14,165,201,0.30);
      color: #e8f4f8;
    }
    /* Orden correcto — realce verde */
    .fr-tira-pieza.correcto.picto {
      border-color: #22c55e;
      box-shadow: 0 0 0 3px rgba(34,197,94,0.25);
    }
    .fr-tira-pieza.correcto.texto {
      background: rgba(34,197,94,0.18);
      border-color: #22c55e;
      box-shadow: 0 0 0 3px rgba(34,197,94,0.18);
    }
    .fr-tira-pieza img {
      width: 44px; height: 44px; object-fit: contain; border-radius: 8px;
    }

    /* Botones de acción */
    #fr-tira-acciones {
      display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;
    }
    .fr-accion-btn {
      width: 48px; height: 48px; border-radius: 50%; border: none;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: transform .12s, background .2s;
    }
    .fr-accion-btn:active { transform: scale(.88); }
    #fr-btn-leer {
      background: rgba(14,165,201,0.25);
      border: 1.5px solid rgba(14,165,201,0.40);
    }
    #fr-btn-leer.hablando { background: #0ea5c9; }
    #fr-btn-borrar {
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.45);
      font-size: 1.5rem; font-weight: 300; font-family: inherit;
    }

    /* ── Panel de piezas ── */
    #fr-panel-piezas {
      flex-shrink: 0;
      background: rgba(0,0,0,0.30);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.10);
      border-radius: 20px; padding: 14px 18px;
    }
    #fr-panel-label {
      font-size: .68rem; font-weight: 900; letter-spacing: .12em;
      text-transform: uppercase; color: rgba(255,255,255,0.45);
      margin-bottom: 12px;
    }
    #fr-piezas { display: flex; gap: 12px; flex-wrap: wrap; }

    .fr-pieza {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 18px; border-radius: 18px;
      cursor: pointer; border: none;
      font-family: inherit; font-weight: 900; font-size: 1.1rem;
      min-height: 92px; /* img(64px) + padding(12px*2) + margen */
      transition: transform .14s, opacity .2s, box-shadow .15s;
      box-shadow: 0 4px 16px rgba(0,0,0,0.25);
    }
    .fr-pieza:active { transform: scale(.93); }
    .fr-pieza.picto  { background: #fff; color: #07212e; }
    .fr-pieza.texto  {
      background: rgba(255,255,255,0.10);
      border: 1.5px solid rgba(255,255,255,0.18);
      color: #e8f4f8;
    }
    .fr-pieza.usada  { opacity: 0.28; pointer-events: none; }
    .fr-pieza img    { width: 64px; height: 64px; object-fit: contain; border-radius: 10px; }

    /* ── Selector de frases ── */
    #fr-selector { flex-shrink: 0; display: flex; gap: 8px; flex-wrap: wrap; }
    .fr-pill {
      padding: 9px 18px; border-radius: 99px; border: none; cursor: pointer;
      font-family: inherit; font-weight: 700; font-size: .88rem;
      background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.65);
      transition: background .18s, color .18s, transform .12s;
      white-space: nowrap;
    }
    .fr-pill:active { transform: scale(.93); }
    .fr-pill.activa { background: #14b8a6; color: #07212e; }

    /* ── Animaciones ── */
    @keyframes fr-pop {
      from { transform: scale(0.6); opacity: 0; }
      to   { transform: scale(1);   opacity: 1; }
    }
  </style>

  <!-- Tira de construcción -->
  <div id="fr-tira">
    <div id="fr-tira-piezas">
      <span id="fr-tira-placeholder">toca las piezas en orden…</span>
    </div>
    <div id="fr-tira-acciones">
      <button class="fr-accion-btn" id="fr-btn-leer" title="Leer frase">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
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
  `;

  _bindEvents();
  _renderSelector();
}

// ─── Selector ─────────────────────────────────────────────────────────────────
function _renderSelector() {
  const wrap = _el.querySelector('#fr-selector');
  wrap.innerHTML = '';
  _frases.forEach((f, i) => {
    const btn = document.createElement('button');
    btn.className   = 'fr-pill' + (i === _activa ? ' activa' : '');
    btn.textContent = f.es;
    btn.addEventListener('click', () => { haptic(8); _seleccionarFrase(i); });
    wrap.appendChild(btn);
  });
}

// ─── Seleccionar frase ────────────────────────────────────────────────────────
function _seleccionarFrase(idx) {
  _activa = idx;
  _built  = [];
  _el.querySelector('#fr-tira').classList.remove('correcto');
  _el.querySelectorAll('.fr-pill').forEach((p, i) =>
    p.classList.toggle('activa', i === idx)
  );
  _renderPiezas();
  _renderTira();
}

// ─── Piezas disponibles ───────────────────────────────────────────────────────
function _renderPiezas() {
  const wrap  = _el.querySelector('#fr-piezas');
  const frase = _frases[_activa];
  if (!frase) { wrap.innerHTML = ''; return; }

  wrap.innerHTML = '';
  frase.piezas.forEach((pieza, i) => {
    const btn = document.createElement('button');
    btn.className   = `fr-pieza ${pieza.tipo}` + (_built.includes(i) ? ' usada' : '');
    btn.dataset.idx = i;

    if (pieza.tipo === 'picto') {
      const img   = document.createElement('img');
      img.src     = PICTO_URL(pieza.texto);
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
  if (_built.includes(idx)) return;
  haptic(12);

  const frase = _frases[_activa];
  const pieza = frase.piezas[idx];

  _built.push(idx);
  _reproducir(pieza.texto);
  _renderTira();

  const btnPieza = _el.querySelector(`.fr-pieza[data-idx="${idx}"]`);
  if (btnPieza) btnPieza.classList.add('usada');

  if (_built.length === frase.piezas.length) {
    _onFraseCompleta(frase);
  }

  Telemetry.track('pieza_tocada', {
    _modulo: 'frases', frase: frase.id,
    pieza: pieza.texto, orden: _built.length,
  });
}

// ─── Frase completa ───────────────────────────────────────────────────────────
function _onFraseCompleta(frase) {
  // Comparar orden tocado vs. orden esperado (0,1,2,3…)
  const ordenEsperado = frase.piezas.map((_, i) => i);
  const ordenCorrecto = _built.every((idx, pos) => idx === ordenEsperado[pos]);

  const tira = _el.querySelector('#fr-tira');

  if (ordenCorrecto) {
    // ── Feedback positivo: piezas en verde + confeti verde ──
    tira.classList.add('correcto');
    tira.querySelectorAll('.fr-tira-pieza').forEach(p => p.classList.add('correcto'));
    lanzarConfeti({ count: 60, container: _el });

    Telemetry.track('frase_completada', {
      _modulo: 'frases', frase: frase.id,
      texto: frase.es, orden_correcto: true,
    });
  } else {
    // ── Sin penalización — solo lectura de la frase ──
    Telemetry.track('frase_completada', {
      _modulo: 'frases', frase: frase.id,
      texto: frase.es, orden_correcto: false,
    });
  }

  // En ambos casos: TTS lee la frase completa
  setTimeout(() => _hablarTTS(frase.es), ordenCorrecto ? 600 : 200);
}

// ─── Render tira ──────────────────────────────────────────────────────────────
function _renderTira(marcarCorrectos = false) {
  const wrap        = _el.querySelector('#fr-tira-piezas');
  const placeholder = _el.querySelector('#fr-tira-placeholder');
  const frase       = _frases[_activa];

  if (_built.length === 0) {
    wrap.innerHTML = '';
    if (placeholder) { placeholder.style.display = ''; wrap.appendChild(placeholder); }
    return;
  }
  if (placeholder) placeholder.style.display = 'none';

  wrap.innerHTML = '';
  _built.forEach((idx, pos) => {
    const pieza   = frase.piezas[idx];
    const div     = document.createElement('div');
    const esCorrecta = idx === pos; // posición tocada == posición esperada
    div.className = `fr-tira-pieza ${pieza.tipo}`;

    if (pieza.tipo === 'picto') {
      const img   = document.createElement('img');
      img.src     = PICTO_URL(pieza.texto);
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
    const frase = _frases[_activa];
    if (!frase || _built.length === 0) return;
    const texto = _built.length === frase.piezas.length
      ? frase.es
      : _built.map(i => frase.piezas[i].texto).join(' ');
    _hablarTTS(texto);
  });

  _el.querySelector('#fr-btn-borrar').addEventListener('click', () => {
    haptic(8);
    _built = [];
    _el.querySelector('#fr-tira').classList.remove('correcto');
    _renderTira();
    _renderPiezas();
  });
}

// ─── Audio: MP3 → fallback TTS ────────────────────────────────────────────────
function _reproducir(texto) {
  if (!_audioEl) {
    _audioEl = document.createElement('audio');
    _audioEl.preload = 'none';
  }
  _audioEl.pause();
  _audioEl.src     = AUDIO_URL(texto);
  _audioEl.onerror = () => _hablarTTS(texto);
  _audioEl.play().catch(() => _hablarTTS(texto));
}

function _hablarTTS(texto) {
  TTS.speak(texto, { lang: 'es-MX', rate: 0.90, pitch: 1.15 });
}

function _onLangChange() {}