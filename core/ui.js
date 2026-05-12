/* ============================================================
   Dótir 2 — core/ui.js
   Utilidades de UI compartidas por todos los módulos:
   · Confeti
   · Toast / notificaciones
   · DOM cache ($)
   · Animación de transición entre módulos
   · Modal genérico
   · Prevención de scroll indeseado en iOS
   ============================================================ */

// ── DOM cache ─────────────────────────────────────────────────
const _cache = {};
/** Obtiene un elemento del DOM con caché. */
export const $ = id => (_cache[id] ??= document.getElementById(id));

// ── Confeti ───────────────────────────────────────────────────
const CONFETI_COLORES = [
  '#fce18a','#ff726d','#b48def','#f4306d',
  '#42c062','#3b82f6','#fbbf24','#34d399',
];

/**
 * Lanza una lluvia de confeti sobre el elemento contenedor.
 * @param {{ count?: number, container?: HTMLElement }} opts
 */
export function lanzarConfeti({ count = 80, container = document.body } = {}) {
  const frag = document.createDocumentFragment();

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    const color = CONFETI_COLORES[i % CONFETI_COLORES.length];
    const size  = 8 + Math.random() * 8;
    const left  = Math.random() * 100;
    const delay = Math.random() * 0.6;
    const dur   = 1.8 + Math.random() * 1.2;

    Object.assign(el.style, {
      position:        'absolute',
      width:           `${size}px`,
      height:          `${size}px`,
      borderRadius:    Math.random() > 0.5 ? '50%' : '2px',
      background:      color,
      left:            `${left}%`,
      top:             '-20px',
      opacity:         '1',
      pointerEvents:   'none',
      zIndex:          '9999',
      animation:       `dotir-confeti-caer ${dur}s ${delay}s ease-in forwards`,
      transform:       `rotate(${Math.random() * 360}deg)`,
    });

    frag.appendChild(el);
  }

  container.style.position = 'relative';
  container.style.overflow  = 'hidden';
  container.appendChild(frag);

  // Limpiar tras la animación
  setTimeout(() => {
    container.querySelectorAll('[style*="dotir-confeti-caer"]').forEach(el => el.remove());
  }, 3500);
}

// ── Keyframe de confeti (inyectar una sola vez) ───────────────
;(function _inyectarCSS() {
  if (document.getElementById('dotir-core-css')) return;
  const style = document.createElement('style');
  style.id = 'dotir-core-css';
  style.textContent = `
    @keyframes dotir-confeti-caer {
      to { transform: translateY(110vh) rotate(720deg); opacity: 0; }
    }
    @keyframes dotir-fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes dotir-slideUp {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes dotir-flotar {
      0%,100% { transform: translateY(0) rotate(0deg); }
      33%      { transform: translateY(-14px) rotate(3deg); }
      66%      { transform: translateY(-8px) rotate(-2deg); }
    }
    .dotir-anim-fadein  { animation: dotir-fadeIn  0.22s ease both; }
    .dotir-anim-slideup { animation: dotir-slideUp 0.28s ease both; }
    .dotir-anim-flotar  { animation: dotir-flotar  2.4s ease-in-out infinite; }

    /* Toast */
    #dotir-toast-container {
      position: fixed; bottom: calc(24px + env(safe-area-inset-bottom));
      left: 50%; transform: translateX(-50%);
      z-index: 99999; display: flex; flex-direction: column;
      align-items: center; gap: 8px; pointer-events: none;
    }
    .dotir-toast {
      background: rgba(30,30,40,0.92); color: white;
      padding: 10px 20px; border-radius: 20px;
      font-size: 0.88rem; font-weight: 600;
      backdrop-filter: blur(12px);
      animation: dotir-slideUp 0.25s ease both;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }

    /* Modal genérico */
    .dotir-modal-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.55);
      display: flex; align-items: center; justify-content: center;
      z-index: 9000; backdrop-filter: blur(4px);
    }
    .dotir-modal-box {
      background: white; border-radius: 24px;
      padding: 28px; width: 88%; max-width: 380px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      animation: dotir-slideUp 0.25s ease both;
    }
  `;
  document.head.appendChild(style);
})();

// ── Toast ─────────────────────────────────────────────────────
let _toastContainer = null;

function _getToastContainer() {
  if (!_toastContainer) {
    _toastContainer = document.createElement('div');
    _toastContainer.id = 'dotir-toast-container';
    document.body.appendChild(_toastContainer);
  }
  return _toastContainer;
}

/**
 * Muestra una notificación temporal (toast).
 * @param {string} mensaje
 * @param {{ duracion?: number, emoji?: string }} opts
 */
export function toast(mensaje, { duracion = 2400, emoji = '' } = {}) {
  const el = document.createElement('div');
  el.className   = 'dotir-toast';
  el.textContent = emoji ? `${emoji} ${mensaje}` : mensaje;
  _getToastContainer().appendChild(el);

  setTimeout(() => {
    el.style.animation = 'dotir-fadeIn 0.2s ease reverse both';
    setTimeout(() => el.remove(), 250);
  }, duracion);
}

// ── Modal genérico ────────────────────────────────────────────
/**
 * Muestra un modal simple con título, contenido HTML y botones.
 * @param {{ titulo: string, html: string,
 *           botones: Array<{ label: string, accion: () => void, primario?: boolean }> }}
 * @returns {{ cerrar: () => void }}
 */
export function modal({ titulo, html, botones = [] }) {
  const overlay = document.createElement('div');
  overlay.className = 'dotir-modal-overlay';

  const box = document.createElement('div');
  box.className = 'dotir-modal-box';

  const h = document.createElement('h2');
  h.style.cssText = 'margin:0 0 14px;font-size:1.2rem;font-weight:800;';
  h.textContent = titulo;

  const body = document.createElement('div');
  body.innerHTML = html;

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:10px;margin-top:20px;justify-content:flex-end;';

  const cerrar = () => overlay.remove();

  botones.forEach(({ label, accion, primario }) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = primario
      ? 'padding:10px 22px;border-radius:12px;border:none;background:#4A90E2;color:white;font-weight:700;cursor:pointer;'
      : 'padding:10px 22px;border-radius:12px;border:2px solid #ddd;background:white;font-weight:600;cursor:pointer;';
    btn.addEventListener('click', () => { accion?.(); cerrar(); });
    footer.appendChild(btn);
  });

  overlay.addEventListener('click', e => { if (e.target === overlay) cerrar(); });

  box.append(h, body, footer);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  return { cerrar };
}

// ── Transición entre vistas ───────────────────────────────────
/**
 * Aplica una animación de entrada a un elemento.
 * @param {HTMLElement} el
 * @param {'fadeIn'|'slideUp'} tipo
 */
export function animarEntrada(el, tipo = 'slideUp') {
  el.classList.remove('dotir-anim-fadein', 'dotir-anim-slideup');
  void el.offsetWidth; // reflow
  el.classList.add(tipo === 'fadeIn' ? 'dotir-anim-fadein' : 'dotir-anim-slideup');
}

// ── Prevención de scroll en iOS ───────────────────────────────
/** Devuelve true si el elemento (o un ancestro) puede hacer scroll en la dirección dada. */
function _puedeScrollear(el, dy, dx) {
  while (el && el !== document.body) {
    const s = getComputedStyle(el);
    const overflowY = s.overflowY;
    const overflowX = s.overflowX;
    const canY = ['auto','scroll','overlay'].includes(overflowY);
    const canX = ['auto','scroll','overlay'].includes(overflowX);

    if (canY && Math.abs(dy) > Math.abs(dx) && el.scrollHeight > el.clientHeight) return true;
    if (canX && Math.abs(dx) > Math.abs(dy) && el.scrollWidth  > el.clientWidth)  return true;
    el = el.parentElement;
  }
  return false;
}

let _touchStartX = 0, _touchStartY = 0;

document.addEventListener('touchstart', e => {
  _touchStartX = e.touches[0].clientX;
  _touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (e.touches.length > 1) return;
  const dy = _touchStartY - e.touches[0].clientY;
  const dx = _touchStartX - e.touches[0].clientX;
  if (!_puedeScrollear(e.target, dy, dx)) e.preventDefault();
}, { passive: false });
