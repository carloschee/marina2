/* modules/ajustes/ajustes.js — Marina 2
   Limpio de referencias a Dótir 2 y módulos que no existen en esta app.
   Cambios vs. original:
   · Eliminada sección "Comunicador" (tamaño de pictogramas para SAAC)
   · _descargarTodo() usa assets-manifest.json en lugar de URLs hardcodeadas
   · Versión leída desde app.config.json vía cfg()
   · LS_TAMANO eliminado
*/

import { borrarCache, precachear, fetchTimeout } from '../../core/offline.js';
import { toast, lanzarConfeti }                  from '../../core/ui.js';
import { Perfiles }                              from '../../core/perfiles.js';
import { Telemetry }                             from '../../core/telemetry.js';
import { cfg }                                   from '../../core/config.js';

let _container      = null;
let _onPerfilChange = null;
const _q = sel => _container?.querySelector(sel);

// ─── API pública ──────────────────────────────────────────────────────────────
export async function init(container) {
  _container = container;
  _renderShell();
  _actualizarEstadoConexion();

  _onPerfilChange = () => {
    if (!_container) return;
    _renderPerfiles();
    _renderModulos();
    _renderReporte();
  };
  Perfiles.onChange(_onPerfilChange);
}

export function destroy() {
  if (_onPerfilChange) { Perfiles.offChange(_onPerfilChange); _onPerfilChange = null; }
  _container = null;
}

export function onEnter() { _actualizarEstadoConexion(); }
export function onLeave() {}

// ─── Shell ────────────────────────────────────────────────────────────────────
function _renderShell() {
  const appNombre  = cfg('app.nombre',  'Marina 2');
  const appVersion = cfg('app.version', '1.0.0');

  _container.innerHTML = `
    <style>
      #aj-wrap {
        display: flex; flex-direction: column;
        height: 100%; overflow-y: auto;
        background: transparent;
        padding: 16px;
        gap: 14px;
        -webkit-overflow-scrolling: touch;
        padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
      }
      .aj-seccion {
        background: rgba(0,0,0,0.75);
        backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255,255,255,0.16);
        border-radius: 24px; padding: 18px;
        display: flex; flex-direction: column; gap: 14px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        max-width: 560px; margin: 0 auto; width: 100%;
      }
      .aj-titulo {
        font-size: .72rem; font-weight: 900;
        text-transform: uppercase; letter-spacing: .1em;
        color: rgba(255,255,255,0.85);
      }
      .aj-fila { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .aj-fila-info { display: flex; flex-direction: column; gap: 2px; flex: 1; }
      .aj-label { font-size: .92rem; font-weight: 800; color: white; }
      .aj-desc  { font-size: .72rem; color: rgba(255,255,255,0.65); font-weight: 600; }
      .aj-btn {
        border: none; border-radius: 14px; padding: 10px 18px;
        font-weight: 800; font-size: .82rem; cursor: pointer;
        transition: transform .12s; white-space: nowrap; font-family: inherit;
      }
      .aj-btn:active  { transform: scale(.93); }
      .aj-primary { background: var(--t-primary, #0ea5c9); color: white; }
      .aj-danger  { background: #EF4444; color: white; }
      .aj-neutral { background: rgba(255,255,255,0.12); color: white; border: 1px solid rgba(255,255,255,0.2); }

      #aj-dot {
        width: 10px; height: 10px; border-radius: 50%;
        background: #eab308; flex-shrink: 0; transition: background .3s;
      }
      #aj-progreso-wrap { display: none; flex-direction: column; gap: 6px; }
      #aj-progreso-wrap.visible { display: flex; }
      #aj-progreso-bg { height: 10px; border-radius: 20px; background: rgba(255,255,255,0.12); overflow: hidden; }
      #aj-progreso-bar {
        height: 100%; border-radius: 20px; width: 0%;
        background: linear-gradient(90deg, var(--t-primary,#0ea5c9), var(--t-secondary,#14b8a6));
        transition: width .3s ease;
      }
      #aj-progreso-txt { font-size: .72rem; font-weight: 700; color: rgba(255,255,255,0.55); text-align: center; }

      #aj-version { text-align: center; font-size: .7rem; font-weight: 700; color: rgba(255,255,255,0.25); padding-bottom: 8px; }

      /* Perfiles */
      .aj-perfil-item {
        display: flex; align-items: center; gap: 12px;
        padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.07);
      }
      .aj-perfil-item:last-child { border-bottom: none; }
      .aj-perfil-avatar {
        width: 44px; height: 44px; border-radius: 50%; object-fit: cover; flex-shrink: 0;
        background: rgba(255,255,255,0.1);
        display: flex; align-items: center; justify-content: center;
        font-size: 1.4rem; overflow: hidden;
      }
      .aj-perfil-avatar img { width: 100%; height: 100%; object-fit: cover; }
      .aj-perfil-info { flex: 1; min-width: 0; }
      .aj-perfil-apodo { color: white; font-size: .92rem; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .aj-perfil-meta  { color: rgba(255,255,255,0.45); font-size: .7rem; font-weight: 600; margin-top: 2px; }
      .aj-perfil-activo-badge { font-size: .62rem; font-weight: 900; padding: 2px 8px; border-radius: 20px; background: var(--t-primary,#0ea5c9); color: white; flex-shrink: 0; }
      .aj-perfil-btns { display: flex; gap: 6px; flex-shrink: 0; }
      .aj-perfil-btn {
        width: 32px; height: 32px; border-radius: 50%; border: none; cursor: pointer;
        font-size: .85rem; display: flex; align-items: center; justify-content: center;
        transition: transform .12s;
      }
      .aj-perfil-btn:active         { transform: scale(.88); }
      .aj-perfil-btn-activar        { background: rgba(14,165,201,0.25); color: #38bdf8; }
      .aj-perfil-btn-editar         { background: rgba(255,255,255,0.12); color: white; }
      .aj-perfil-btn-eliminar       { background: rgba(239,68,68,0.2); color: #f87171; }

      /* Reporte */
      .aj-reporte-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
      .aj-reporte-item:last-child { border-bottom: none; }
      .aj-reporte-nombre { font-size: .8rem; font-weight: 700; color: rgba(255,255,255,0.8); }
      .aj-reporte-valor  { font-size: .8rem; font-weight: 900; color: var(--t-accent,#38bdf8); }

      /* Toggles de módulos */
      .aj-toggle-fila {
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.07);
      }
      .aj-toggle-fila:last-child { border-bottom: none; }
      .aj-toggle-info  { display: flex; align-items: center; gap: 10px; flex: 1; }
      .aj-toggle-emoji { font-size: 1.3rem; }
      .aj-toggle-label { color: white; font-size: .88rem; font-weight: 800; }
      .aj-toggle { position: relative; width: 44px; height: 26px; flex-shrink: 0; }
      .aj-toggle input { opacity: 0; width: 0; height: 0; }
      .aj-toggle-slider {
        position: absolute; inset: 0; border-radius: 26px;
        background: rgba(255,255,255,0.15); cursor: pointer; transition: background .2s;
      }
      .aj-toggle input:checked + .aj-toggle-slider { background: var(--t-primary,#0ea5c9); }
      .aj-toggle-slider::before {
        content: ''; position: absolute;
        width: 20px; height: 20px; border-radius: 50%;
        background: white; top: 3px; left: 3px; transition: transform .2s;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      }
      .aj-toggle input:checked + .aj-toggle-slider::before { transform: translateX(18px); }

      /* Modal de perfil */
      #aj-modal-perfil {
        display: none; position: fixed; inset: 0; z-index: 100;
        background: rgba(3,17,26,0.88);
        backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
        align-items: center; justify-content: center; padding: 20px;
      }
      #aj-modal-perfil.visible { display: flex; }
      #aj-modal-perfil-box {
        background: rgba(6,42,62,0.98);
        border: 1px solid rgba(14,165,201,0.2);
        border-radius: 28px; padding: 24px;
        width: 100%; max-width: 420px;
        display: flex; flex-direction: column; gap: 16px;
        max-height: 90vh; overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      }
      #aj-modal-perfil-box h3 { color: white; font-size: 1.2rem; font-weight: 900; }
      .aj-modal-label { font-size: .75rem; font-weight: 800; color: rgba(255,255,255,0.55); text-transform: uppercase; letter-spacing: .08em; display: block; margin-bottom: 6px; }
      .aj-modal-input {
        width: 100%; padding: 12px 14px; border-radius: 14px;
        background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15);
        color: white; font-family: inherit; font-size: .92rem; font-weight: 700;
        outline: none; transition: border-color .15s;
      }
      .aj-modal-input:focus { border-color: var(--t-primary,#0ea5c9); }
      .aj-modal-textarea {
        width: 100%; padding: 12px 14px; border-radius: 14px;
        background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15);
        color: white; font-family: inherit; font-size: .88rem;
        outline: none; resize: vertical; min-height: 72px; transition: border-color .15s;
      }
      .aj-modal-textarea:focus { border-color: var(--t-primary,#0ea5c9); }
      .aj-modal-btns { display: flex; gap: 10px; margin-top: 4px; }
      .aj-modal-btns button {
        flex: 1; padding: 14px; border-radius: 16px; border: none;
        font-weight: 900; font-size: .95rem; cursor: pointer;
        font-family: inherit; transition: transform .12s;
      }
      .aj-modal-btns button:active { transform: scale(.95); }
      #btn-modal-guardar  { background: var(--t-primary,#0ea5c9); color: white; }
      #btn-modal-cancelar { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.15); }
      .aj-avatar-row { display: flex; align-items: center; gap: 14px; }
      #aj-avatar-preview {
        width: 72px; height: 72px; border-radius: 50%; flex-shrink: 0;
        background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.15);
        display: flex; align-items: center; justify-content: center;
        font-size: 2rem; overflow: hidden;
      }
      #aj-avatar-preview img { width: 100%; height: 100%; object-fit: cover; }
      .aj-avatar-acciones { display: flex; flex-direction: column; gap: 8px; flex: 1; }

      /* Crop */
      #aj-crop-wrap {
        display: none; position: fixed; inset: 0; z-index: 200;
        background: rgba(3,17,26,0.95);
        backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        flex-direction: column; align-items: center; justify-content: center;
        gap: 16px; padding: 20px;
      }
      #aj-crop-wrap.visible { display: flex; }
      #aj-crop-canvas { border-radius: 16px; touch-action: none; cursor: grab; max-width: 100%; max-height: 60vh; }
      #aj-crop-canvas:active { cursor: grabbing; }
      #aj-crop-hint { color: rgba(255,255,255,0.5); font-size: .75rem; font-weight: 700; text-align: center; }
      #aj-crop-btns { display: flex; gap: 12px; width: 100%; max-width: 340px; }
      #aj-crop-btns button { flex: 1; padding: 14px; border-radius: 16px; border: none; font-weight: 900; font-size: .92rem; cursor: pointer; font-family: inherit; transition: transform .12s; }
      #aj-crop-btns button:active { transform: scale(.95); }
      #btn-crop-confirmar { background: var(--t-primary,#0ea5c9); color: white; }
      #btn-crop-cancelar  { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.6); border: 1px solid rgba(255,255,255,0.15); }
      .aj-crop-zoom { display: flex; align-items: center; gap: 10px; width: 100%; max-width: 340px; }
      .aj-crop-zoom input { flex: 1; accent-color: var(--t-primary,#0ea5c9); }
      .aj-crop-zoom span  { color: rgba(255,255,255,0.5); font-size: .8rem; }
    </style>

    <div id="aj-wrap">

      <!-- Conexión -->
      <div class="aj-seccion">
        <p class="aj-titulo">Conexión</p>
        <div class="aj-fila">
          <div style="display:flex;align-items:center;gap:8px;">
            <div id="aj-dot"></div>
            <span id="aj-texto-conexion" class="aj-label">Verificando...</span>
          </div>
          <button class="aj-btn aj-neutral" id="btn-aj-verificar">Verificar</button>
        </div>
      </div>

      <!-- Uso sin internet -->
      <div class="aj-seccion">
        <p class="aj-titulo">Uso sin internet</p>
        <div id="aj-progreso-wrap">
          <div id="aj-progreso-bg"><div id="aj-progreso-bar"></div></div>
          <p id="aj-progreso-txt">Preparando...</p>
        </div>
        <div class="aj-fila">
          <div class="aj-fila-info">
            <span class="aj-label">Descargar todo</span>
            <span class="aj-desc">Guarda la app para usarla sin internet</span>
          </div>
          <button class="aj-btn aj-primary" id="btn-aj-descargar">Descargar</button>
        </div>
        <div class="aj-fila">
          <div class="aj-fila-info">
            <span class="aj-label">Borrar caché</span>
            <span class="aj-desc">Libera espacio en el dispositivo</span>
          </div>
          <button class="aj-btn aj-danger" id="btn-aj-borrar">Borrar</button>
        </div>
      </div>

      <!-- Aplicación -->
      <div class="aj-seccion">
        <p class="aj-titulo">Aplicación</p>
        <div class="aj-fila">
          <div class="aj-fila-info">
            <span class="aj-label">Actualizar app</span>
            <span class="aj-desc">Aplica la última versión disponible</span>
          </div>
          <button class="aj-btn aj-neutral" id="btn-aj-refresh">Actualizar</button>
        </div>
        <div class="aj-fila">
          <div class="aj-fila-info">
            <span class="aj-label">Reinicio completo</span>
            <span class="aj-desc">Borra caché y recarga desde el servidor</span>
          </div>
          <button class="aj-btn aj-danger" id="btn-aj-reset">Resetear</button>
        </div>
      </div>

      <!-- Reporte de actividad -->
      <div class="aj-seccion" id="aj-sec-reporte">
        <p class="aj-titulo">Reporte de actividad</p>
        <div id="aj-reporte-contenido"></div>
        <div class="aj-fila" style="margin-top:4px;">
          <button class="aj-btn aj-neutral" id="btn-aj-reporte-exportar">⬇️ Exportar</button>
          <button class="aj-btn aj-danger"  id="btn-aj-reporte-limpiar">🗑 Limpiar</button>
        </div>
      </div>

      <!-- Módulos visibles -->
      <div class="aj-seccion">
        <p class="aj-titulo">Módulos visibles</p>
        <p style="color:rgba(255,255,255,0.45);font-size:.75rem;">
          Configura qué módulos ve el perfil activo en el menú principal.
        </p>
        <div id="aj-modulos-lista"></div>
      </div>

      <!-- Perfiles -->
      <div class="aj-seccion" id="aj-sec-perfiles">
        <p class="aj-titulo">Perfiles</p>
        <div id="aj-perfiles-lista"></div>
        <div class="aj-fila">
          <div class="aj-fila-info">
            <span class="aj-label">Nuevo perfil</span>
            <span class="aj-desc">Crea un perfil para un usuario</span>
          </div>
          <button class="aj-btn aj-primary" id="btn-aj-nuevo-perfil">+ Crear</button>
        </div>
      </div>

      <!-- Versión — leída desde app.config.json -->
      <p id="aj-version">${appNombre} v${appVersion}</p>

    </div>

    <!-- Modal de perfil -->
    <div id="aj-modal-perfil">
      <div id="aj-modal-perfil-box">
        <h3 id="aj-modal-titulo">Nuevo perfil</h3>
        <div class="aj-avatar-row">
          <div id="aj-avatar-preview">🧑</div>
          <div class="aj-avatar-acciones">
            <span class="aj-modal-label">Avatar</span>
            <input class="aj-modal-input" id="input-avatar-emoji" placeholder="Emoji (ej: 🐯)" maxlength="4">
            <button class="aj-btn aj-neutral" id="btn-avatar-foto" style="font-size:.78rem;padding:8px 12px;">📷 Subir foto</button>
            <input type="file" id="input-avatar-file" accept="image/*" style="display:none">
          </div>
        </div>
        <div>
          <span class="aj-modal-label">Apodo</span>
          <input class="aj-modal-input" id="input-apodo" placeholder="Ej: Emi" maxlength="24">
        </div>
        <div>
          <span class="aj-modal-label">Fecha de nacimiento</span>
          <input class="aj-modal-input" id="input-fecha" type="date">
        </div>
        <div>
          <span class="aj-modal-label">Notas</span>
          <textarea class="aj-modal-textarea" id="input-notas" placeholder="Observaciones generales..."></textarea>
        </div>
        <div class="aj-modal-btns">
          <button id="btn-modal-cancelar">Cancelar</button>
          <button id="btn-modal-guardar">Guardar</button>
        </div>
      </div>
    </div>

    <!-- Crop de avatar -->
    <div id="aj-crop-wrap">
      <canvas id="aj-crop-canvas" width="320" height="320"></canvas>
      <div class="aj-crop-zoom">
        <span>🔍</span>
        <input type="range" id="aj-crop-zoom-slider" min="0.5" max="3" step="0.01" value="1">
        <span>🔎</span>
      </div>
      <p id="aj-crop-hint">Arrastra para encuadrar · Pinza para zoom</p>
      <div id="aj-crop-btns">
        <button id="btn-crop-cancelar">Cancelar</button>
        <button id="btn-crop-confirmar">Usar foto</button>
      </div>
    </div>
  `;

  // ── Eventos ────────────────────────────────────────────────
  _q('#btn-aj-verificar').addEventListener('click', _actualizarEstadoConexion);
  _q('#btn-aj-descargar').addEventListener('click', _descargarTodo);

  _q('#btn-aj-borrar').addEventListener('click', async () => {
    const btn = _q('#btn-aj-borrar');
    btn.disabled = true;
    await borrarCache();
    toast('Caché borrada', { emoji: '🗑️' });
    btn.disabled = false;
  });

  _q('#btn-aj-refresh').addEventListener('click', async () => {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.waiting) {
      reg.waiting.postMessage({ tipo: 'skipWaiting' });
      setTimeout(() => location.reload(), 400);
    } else {
      location.reload();
    }
  });

  _q('#btn-aj-reset').addEventListener('click', async () => {
    _q('#btn-aj-reset').disabled = true;
    await borrarCache();
    location.reload(true);
  });

  _q('#btn-aj-nuevo-perfil').addEventListener('click', () => _abrirModal());
  _q('#btn-modal-cancelar').addEventListener('click', _cerrarModal);
  _q('#aj-modal-perfil').addEventListener('click', e => {
    if (e.target === _q('#aj-modal-perfil')) _cerrarModal();
  });
  _q('#btn-avatar-foto').addEventListener('click', () => _q('#input-avatar-file').click());
  _q('#input-avatar-file').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => _abrirCrop(ev.target.result);
    reader.readAsDataURL(file);
  });
  _q('#btn-crop-confirmar').addEventListener('click', _confirmarCrop);
  _q('#btn-crop-cancelar').addEventListener('click', _cerrarCrop);
  _q('#aj-crop-zoom-slider').addEventListener('input', e => {
    _cropZoom = parseFloat(e.target.value);
    _dibujarCrop();
  });
  _q('#input-avatar-emoji').addEventListener('input', e => {
    const val = e.target.value.trim();
    if (val) { _avatarFotoData = null; _q('#aj-avatar-preview').innerHTML = val; }
  });
  _q('#btn-modal-guardar').addEventListener('click', _guardarPerfil);

  _q('#btn-aj-reporte-exportar').addEventListener('click', () => {
    const p = Perfiles.getActivo();
    Telemetry.exportar(p.id);
    toast('Reporte exportado', { emoji: '📥' });
  });
  _q('#btn-aj-reporte-limpiar').addEventListener('click', () => {
    const p = Perfiles.getActivo();
    if (!confirm(`¿Borrar todos los datos de actividad de ${p.apodo}?`)) return;
    Telemetry.limpiar(p.id);
    _renderReporte();
    toast('Datos borrados', { emoji: '🗑️' });
  });

  _renderReporte();
  _renderPerfiles();
  _renderModulos();
}

// ─── Conexión ─────────────────────────────────────────────────────────────────
async function _actualizarEstadoConexion() {
  const dot   = _q('#aj-dot');
  const texto = _q('#aj-texto-conexion');
  if (!dot || !texto) return;
  dot.style.background = '#eab308';
  texto.textContent = 'Verificando...';
  if (!navigator.onLine) {
    dot.style.background = '#ef4444';
    texto.textContent = 'Sin conexión';
    return;
  }
  try {
    const res = await fetchTimeout('./manifest.json', 4000, { method: 'HEAD', cache: 'no-store' });
    if (!_container) return;
    dot.style.background = res.ok ? '#22c55e' : '#ef4444';
    texto.textContent = res.ok ? 'En línea' : 'Sin conexión';
  } catch {
    if (!_container) return;
    dot.style.background = '#ef4444';
    texto.textContent = 'Sin conexión';
  }
}

// ─── Descarga offline ─────────────────────────────────────────────────────────
// Usa assets-manifest.json generado por scripts/generate-manifest.js
// No hay URLs hardcodeadas de módulos específicos.
async function _descargarTodo() {
  const btn  = _q('#btn-aj-descargar');
  const wrap = _q('#aj-progreso-wrap');
  const bar  = _q('#aj-progreso-bar');
  const txt  = _q('#aj-progreso-txt');
  if (!btn || !wrap || !bar || !txt) return;

  btn.disabled = true;
  wrap.classList.add('visible');
  bar.style.width = '0%';
  txt.textContent = 'Leyendo manifiesto...';

  // 1. Cargar lista desde assets-manifest.json
  let urls = new Set();
  try {
    const res = await fetchTimeout('./assets-manifest.json', 6000);
    if (res.ok) {
      const manifest = await res.json();
      (manifest.urls || []).forEach(u => urls.add(u));
    }
  } catch (e) {
    console.warn('[Ajustes] assets-manifest.json no disponible:', e.message);
  }

  // 2. Agregar URLs de caché declaradas por cada módulo activo
  const registry = window.DotirApp?.MODULE_REGISTRY || [];
  for (const mod of registry) {
    try {
      const extra = mod.buildCache ? await mod.buildCache() : (mod.cache || []);
      if (!_container) return;
      extra.forEach(u => urls.add(u));
    } catch (_) {}
  }

  if (!urls.size) {
    txt.textContent = 'No hay recursos para descargar.';
    btn.disabled = false;
    return;
  }

  txt.textContent = `Descargando ${urls.size} archivos...`;

  if (!_container) return;

  const { ok, total } = await precachear([...urls], {
    onProgress: (done, tot) => {
      if (!_container) return;
      const pct = Math.round((done / tot) * 100);
      bar.style.width = pct + '%';
      txt.textContent = `${done} de ${tot} archivos...`;
    },
  });

  if (!_container) return;

  bar.style.width   = '100%';
  bar.style.background = ok === total ? '#22c55e' : '#f59e0b';
  txt.textContent   = ok === total ? `${ok} archivos listos` : `${ok} de ${total} descargados`;

  lanzarConfeti({ count: 40, container: _container });
  toast('Descarga completada', { emoji: '📥' });
  btn.disabled = false;
}

// ─── Reporte ──────────────────────────────────────────────────────────────────
function _renderReporte() {
  const el = _q('#aj-reporte-contenido');
  if (!el) return;
  const p      = Perfiles.getActivo();
  const reporte = Telemetry.getReporte?.(p.id) || {};
  const entradas = Object.entries(reporte);
  if (!entradas.length) {
    el.innerHTML = '<p style="color:rgba(255,255,255,0.35);font-size:.8rem;">Sin actividad registrada.</p>';
    return;
  }
  el.innerHTML = entradas.map(([k, v]) =>
    `<div class="aj-reporte-item">
      <span class="aj-reporte-nombre">${k}</span>
      <span class="aj-reporte-valor">${v}</span>
    </div>`
  ).join('');
}

// ─── Módulos visibles ─────────────────────────────────────────────────────────
// Lee los módulos del registry global en lugar de una lista hardcodeada.
const _MODULOS_CONFIGURABLES = [];  // se popula al primer render

function _renderModulos() {
  const lista = _q('#aj-modulos-lista');
  if (!lista) return;

  // Tomar módulos del registry, excluir ajustes
  const registry = (window.DotirApp?.MODULE_REGISTRY || [])
    .filter(m => m.id !== 'ajustes' && m.habilitado);

  // Sincronizar con la lista configurable
  _MODULOS_CONFIGURABLES.length = 0;
  registry.forEach(m => _MODULOS_CONFIGURABLES.push({ id: m.id, label: m.label, emoji: m.emoji || '📦' }));

  lista.innerHTML = '';

  if (!_MODULOS_CONFIGURABLES.length) {
    lista.innerHTML = '<p style="color:rgba(255,255,255,0.35);font-size:.8rem;">No hay módulos configurables.</p>';
    return;
  }

  const habilitados = Perfiles.getModulosHabilitados();
  const todos = _MODULOS_CONFIGURABLES.map(m => m.id);

  _MODULOS_CONFIGURABLES.forEach(mod => {
    const activo = habilitados === null || habilitados.includes(mod.id);
    const fila   = document.createElement('div');
    fila.className = 'aj-toggle-fila';

    const info  = document.createElement('div');
    info.className = 'aj-toggle-info';
    info.innerHTML = `<span class="aj-toggle-emoji">${mod.emoji}</span><span class="aj-toggle-label">${mod.label}</span>`;

    const label  = document.createElement('label');
    label.className = 'aj-toggle';
    const input  = document.createElement('input');
    input.type    = 'checkbox';
    input.checked = activo;
    const slider  = document.createElement('span');
    slider.className = 'aj-toggle-slider';
    label.append(input, slider);

    input.addEventListener('change', () => {
      const actual = Perfiles.getModulosHabilitados() || [...todos];
      const nuevos = input.checked
        ? [...new Set([...actual, mod.id])]
        : actual.filter(id => id !== mod.id);
      const sonTodos = todos.every(id => nuevos.includes(id));
      Perfiles.setModulosHabilitados(sonTodos ? null : nuevos);
    });

    fila.append(info, label);
    lista.appendChild(fila);
  });
}

// ─── Perfiles ─────────────────────────────────────────────────────────────────
function _renderPerfiles() {
  const lista = _q('#aj-perfiles-lista');
  if (!lista) return;
  lista.innerHTML = '';

  Perfiles.listar().forEach(p => {
    const esActivo = p.id === Perfiles.activoId;
    const edad     = Perfiles.calcularEdad(p.fechaNacimiento);
    const item     = document.createElement('div');
    item.className = 'aj-perfil-item';

    const avatarEl = document.createElement('div');
    avatarEl.className = 'aj-perfil-avatar';
    if (p.avatarFoto) {
      avatarEl.innerHTML = `<img src="${p.avatarFoto}" alt="${p.apodo}">`;
    } else {
      avatarEl.textContent = p.avatar || '🧑';
    }

    const info = document.createElement('div');
    info.className = 'aj-perfil-info';
    info.innerHTML =
      `<div class="aj-perfil-apodo">${p.apodo}</div>` +
      `<div class="aj-perfil-meta">${edad !== null ? `${edad} años` : ''}${p.notas ? (edad !== null ? ' · ' : '') + p.notas : ''}</div>`;

    const btns = document.createElement('div');
    btns.className = 'aj-perfil-btns';

    if (esActivo) {
      const badge = document.createElement('span');
      badge.className   = 'aj-perfil-activo-badge';
      badge.textContent = 'activo';
      btns.appendChild(badge);
    } else {
      const btnAct = document.createElement('button');
      btnAct.className = 'aj-perfil-btn aj-perfil-btn-activar';
      btnAct.title     = 'Activar';
      btnAct.textContent = '▶';
      btnAct.addEventListener('click', () => {
        Perfiles.activar(p.id);
        _renderPerfiles();
        toast(`Perfil: ${p.apodo}`, { emoji: '👤' });
      });
      btns.appendChild(btnAct);
    }

    const btnEdit = document.createElement('button');
    btnEdit.className   = 'aj-perfil-btn aj-perfil-btn-editar';
    btnEdit.title       = 'Editar';
    btnEdit.textContent = '✏️';
    btnEdit.addEventListener('click', () => _abrirModal(p.id));
    btns.appendChild(btnEdit);

    if (!esActivo) {
      const btnDel = document.createElement('button');
      btnDel.className   = 'aj-perfil-btn aj-perfil-btn-eliminar';
      btnDel.title       = 'Eliminar';
      btnDel.textContent = '🗑';
      btnDel.addEventListener('click', () => {
        if (!confirm(`¿Eliminar el perfil de ${p.apodo}? Esta acción no se puede deshacer.`)) return;
        Perfiles.eliminar(p.id);
        _renderPerfiles();
        toast('Perfil eliminado', { emoji: '🗑️' });
      });
      btns.appendChild(btnDel);
    }

    item.append(avatarEl, info, btns);
    lista.appendChild(item);
  });
}

// ─── Modal de perfil ──────────────────────────────────────────────────────────
let _editandoId    = null;
let _avatarFotoData = null;

function _abrirModal(id) {
  _editandoId    = id || null;
  _avatarFotoData = null;

  const titulo = _q('#aj-modal-titulo');
  const inputApodo = _q('#input-apodo');
  const inputEmoji = _q('#input-avatar-emoji');
  const inputFecha = _q('#input-fecha');
  const inputNotas = _q('#input-notas');
  const preview    = _q('#aj-avatar-preview');

  if (id) {
    const p = Perfiles.listar().find(x => x.id === id);
    if (!p) return;
    titulo.textContent = 'Editar perfil';
    inputApodo.value   = p.apodo;
    inputFecha.value   = p.fechaNacimiento || '';
    inputNotas.value   = p.notas || '';
    if (p.avatarFoto) {
      _avatarFotoData = p.avatarFoto;
      preview.innerHTML = `<img src="${p.avatarFoto}">`;
      inputEmoji.value  = '';
    } else {
      preview.textContent = p.avatar || '🧑';
      inputEmoji.value    = p.avatar || '';
    }
  } else {
    titulo.textContent  = 'Nuevo perfil';
    inputApodo.value    = '';
    inputEmoji.value    = '';
    inputFecha.value    = '';
    inputNotas.value    = '';
    preview.textContent = '🧑';
  }

  _q('#aj-modal-perfil').classList.add('visible');
  setTimeout(() => inputApodo?.focus(), 100);
}

function _cerrarModal() {
  _q('#aj-modal-perfil')?.classList.remove('visible');
  _editandoId    = null;
  _avatarFotoData = null;
  const fi = _q('#input-avatar-file');
  if (fi) fi.value = '';
}

function _guardarPerfil() {
  const apodo = _q('#input-apodo').value.trim();
  if (!apodo) { toast('El apodo es requerido', { emoji: '⚠️' }); return; }

  const datos = {
    apodo,
    avatar:          _q('#input-avatar-emoji').value.trim() || '🧑',
    avatarFoto:      _avatarFotoData || null,
    fechaNacimiento: _q('#input-fecha').value || null,
    notas:           _q('#input-notas').value.trim(),
  };

  if (_editandoId) {
    Perfiles.actualizar(_editandoId, datos);
    toast('Perfil actualizado', { emoji: '✅' });
  } else {
    Perfiles.crear(datos);
    toast('Perfil creado', { emoji: '🎉' });
  }

  _cerrarModal();
  _renderPerfiles();
}

// ─── Crop de avatar ───────────────────────────────────────────────────────────
let _cropImg      = null;
let _cropZoom     = 1;
let _cropOffX     = 0;
let _cropOffY     = 0;
let _cropDragging = false;
let _cropLastX    = 0;
let _cropLastY    = 0;
let _cropPinchDist = 0;

function _abrirCrop(src) {
  const img = new Image();
  img.onload = () => {
    _cropImg  = img;
    _cropZoom = Math.max(320 / img.width, 320 / img.height);
    _cropOffX = 0; _cropOffY = 0;
    const sl  = _q('#aj-crop-zoom-slider');
    sl.min    = String(_cropZoom * 0.8);
    sl.max    = String(_cropZoom * 4);
    sl.step   = String(_cropZoom * 0.01);
    sl.value  = String(_cropZoom);
    _dibujarCrop();
    _q('#aj-crop-wrap').classList.add('visible');
    _iniciarEventosCrop();
  };
  img.src = src;
}

function _cerrarCrop() {
  _q('#aj-crop-wrap').classList.remove('visible');
  _limpiarEventosCrop();
  _cropImg = null;
  const fi = _q('#input-avatar-file');
  if (fi) fi.value = '';
}

function _confirmarCrop() {
  const out = document.createElement('canvas');
  out.width = out.height = 256;
  const ctx = out.getContext('2d');
  ctx.beginPath();
  ctx.arc(128, 128, 128, 0, Math.PI * 2);
  ctx.clip();
  const canvas = _q('#aj-crop-canvas');
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const iw = _cropImg.width * _cropZoom;
  const ih = _cropImg.height * _cropZoom;
  const ix = cx + _cropOffX - iw / 2;
  const iy = cy + _cropOffY - ih / 2;
  const e  = 256 / 320;
  ctx.drawImage(_cropImg, ix * e, iy * e, iw * e, ih * e);
  _avatarFotoData = out.toDataURL('image/jpeg', 0.88);
  const prev = _q('#aj-avatar-preview');
  prev.innerHTML = `<img src="${_avatarFotoData}">`;
  _q('#input-avatar-emoji').value = '';
  _cerrarCrop();
}

function _dibujarCrop() {
  const canvas = _q('#aj-crop-canvas');
  if (!canvas || !_cropImg) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, W, H);
  const iw = _cropImg.width * _cropZoom;
  const ih = _cropImg.height * _cropZoom;
  ctx.drawImage(_cropImg, cx + _cropOffX - iw / 2, cy + _cropOffY - ih / 2, iw, ih);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.arc(cx, cy, W * 0.46, 0, Math.PI * 2, true);
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, W * 0.46, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(14,165,201,0.9)';
  ctx.lineWidth   = 2.5;
  ctx.stroke();
}

function _clampOffset() {
  if (!_cropImg) return;
  const canvas = _q('#aj-crop-canvas');
  const radio  = canvas.width * 0.46;
  const iw = _cropImg.width * _cropZoom;
  const ih = _cropImg.height * _cropZoom;
  const maxX = Math.max(0, iw / 2 - radio);
  const maxY = Math.max(0, ih / 2 - radio);
  _cropOffX = Math.max(-maxX, Math.min(maxX, _cropOffX));
  _cropOffY = Math.max(-maxY, Math.min(maxY, _cropOffY));
}

function _iniciarEventosCrop() {
  const c = _q('#aj-crop-canvas');
  if (!c) return;
  c.addEventListener('mousedown',  _onCropMouseDown);
  c.addEventListener('mousemove',  _onCropMouseMove);
  c.addEventListener('mouseup',    _onCropMouseUp);
  c.addEventListener('mouseleave', _onCropMouseUp);
  c.addEventListener('wheel',      _onCropWheel,      { passive: false });
  c.addEventListener('touchstart', _onCropTouchStart, { passive: false });
  c.addEventListener('touchmove',  _onCropTouchMove,  { passive: false });
  c.addEventListener('touchend',   _onCropTouchEnd);
}

function _limpiarEventosCrop() {
  const c = _q('#aj-crop-canvas');
  if (!c) return;
  c.removeEventListener('mousedown',  _onCropMouseDown);
  c.removeEventListener('mousemove',  _onCropMouseMove);
  c.removeEventListener('mouseup',    _onCropMouseUp);
  c.removeEventListener('mouseleave', _onCropMouseUp);
  c.removeEventListener('wheel',      _onCropWheel);
  c.removeEventListener('touchstart', _onCropTouchStart);
  c.removeEventListener('touchmove',  _onCropTouchMove);
  c.removeEventListener('touchend',   _onCropTouchEnd);
}

function _onCropMouseDown(e) { _cropDragging = true;  _cropLastX = e.clientX; _cropLastY = e.clientY; }
function _onCropMouseUp()    { _cropDragging = false; }
function _onCropMouseMove(e) {
  if (!_cropDragging) return;
  _cropOffX += e.clientX - _cropLastX;
  _cropOffY += e.clientY - _cropLastY;
  _cropLastX = e.clientX; _cropLastY = e.clientY;
  _clampOffset(); _dibujarCrop();
}
function _onCropWheel(e) {
  e.preventDefault();
  const sl    = _q('#aj-crop-zoom-slider');
  const delta = e.deltaY > 0 ? -0.08 : 0.08;
  _cropZoom   = Math.max(parseFloat(sl.min), Math.min(parseFloat(sl.max), _cropZoom + delta * _cropZoom));
  sl.value    = String(_cropZoom);
  _clampOffset(); _dibujarCrop();
}
function _onCropTouchStart(e) {
  e.preventDefault();
  if (e.touches.length === 1) {
    _cropDragging = true;
    _cropLastX    = e.touches[0].clientX;
    _cropLastY    = e.touches[0].clientY;
  } else if (e.touches.length === 2) {
    _cropDragging  = false;
    _cropPinchDist = _pinchDist(e.touches);
  }
}
function _onCropTouchMove(e) {
  e.preventDefault();
  if (e.touches.length === 1 && _cropDragging) {
    _cropOffX += e.touches[0].clientX - _cropLastX;
    _cropOffY += e.touches[0].clientY - _cropLastY;
    _cropLastX = e.touches[0].clientX;
    _cropLastY = e.touches[0].clientY;
    _clampOffset(); _dibujarCrop();
  } else if (e.touches.length === 2) {
    const sl    = _q('#aj-crop-zoom-slider');
    const dist  = _pinchDist(e.touches);
    _cropZoom   = Math.max(parseFloat(sl.min), Math.min(parseFloat(sl.max), _cropZoom * (dist / _cropPinchDist)));
    sl.value    = String(_cropZoom);
    _cropPinchDist = dist;
    _clampOffset(); _dibujarCrop();
  }
}
function _onCropTouchEnd(e) { if (e.touches.length === 0) _cropDragging = false; }
function _pinchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}