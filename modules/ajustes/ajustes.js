/* Dotir 2 - modules/ajustes/ajustes.js */

import { borrarCache, precachear, fetchTimeout } from '../../core/offline.js';
import { toast, lanzarConfeti } from '../../core/ui.js';
import { Perfiles } from '../../core/perfiles.js';
import SaacModule from '../saac/module.js';
import MemoramaModule from '../memorama/module.js';
import MediaModule from '../media/module.js';
import TemporizadorModule from '../temporizador/module.js';
import LibrosModule from '../libros/module.js';
import { Telemetry } from '../../core/telemetry.js';

const LS_TAMANO = 'dotir2-saac-tamano';

let _container = null;
let _onPerfilChange = null;
const _q = sel => _container?.querySelector(sel);

export async function init(container) {
  _container = container;
  _renderShell();
  _actualizarEstadoConexion();
  Perfiles.onChange(() => {
    _renderPerfiles();
    _renderModulos();
  });
  _onPerfilChange = () => {
    if (!_container) return;
    _renderPerfiles();
    _renderModulos();
    _renderReporte();
  };
  Perfiles.onChange(_onPerfilChange);
}

export function destroy() {
  Perfiles.offChange(_onPerfilChange);
  _container = null;
  if (_onPerfilChange) { Perfiles.offChange(_onPerfilChange); _onPerfilChange = null; }
}
export function onEnter() { _actualizarEstadoConexion(); }
export function onLeave() { }

function _renderShell() {
  const tamano = localStorage.getItem(LS_TAMANO) || 'M';

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
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255,255,255,0.16);
        border-radius: 24px;
        padding: 18px;
        display: flex; flex-direction: column; gap: 14px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        max-width: 560px;
        margin: 0 auto;
        width: 100%;
      }
      .aj-titulo {
        font-size: .72rem; font-weight: 900;
        text-transform: uppercase; letter-spacing: .1em;
        color: rgba(255,255,255,0.85);
      }
      .aj-fila {
        display: flex; align-items: center;
        justify-content: space-between; gap: 12px;
      }
      .aj-fila-info { display: flex; flex-direction: column; gap: 2px; flex: 1; }
      .aj-label { font-size: .92rem; font-weight: 800; color: white; }
      .aj-desc  { font-size: .72rem; color: rgba(255,255,255,0.65); font-weight: 600; }
      .aj-btn {
        border: none; border-radius: 14px; padding: 10px 18px;
        font-weight: 800; font-size: .82rem; cursor: pointer;
        transition: transform .12s; white-space: nowrap;
        font-family: inherit;
      }
      .aj-btn:active { transform: scale(.93); }
      .aj-primary { background: #A855F7; color: white; }
      .aj-danger  { background: #EF4444; color: white; }
      .aj-neutral {
        background: rgba(255,255,255,0.12);
        color: white;
        border: 1px solid rgba(255,255,255,0.2);
      }

      #aj-tamano-btns { display: flex; gap: 8px; }
      .aj-tam-btn {
        flex: 1; padding: 10px 6px; border-radius: 12px;
        border: 2px solid rgba(255,255,255,0.18);
        background: rgba(255,255,255,0.08); color: white;
        font-weight: 800; font-size: .85rem; cursor: pointer;
        transition: all .15s; font-family: inherit;
      }
      .aj-tam-btn.activo { background: #A855F7; color: white; border-color: #A855F7; }

      #aj-dot {
        width: 10px; height: 10px; border-radius: 50%;
        background: #eab308; flex-shrink: 0; transition: background .3s;
      }

      #aj-progreso-wrap { display: none; flex-direction: column; gap: 6px; }
      #aj-progreso-wrap.visible { display: flex; }
      #aj-progreso-bg {
        height: 10px; border-radius: 20px;
        background: rgba(255,255,255,0.12); overflow: hidden;
      }
      #aj-progreso-bar {
        height: 100%; border-radius: 20px; width: 0%;
        background: linear-gradient(90deg, #7C3AED, #EC4899);
        transition: width .3s ease;
      }
      #aj-progreso-txt {
        font-size: .72rem; font-weight: 700;
        color: rgba(255,255,255,0.55); text-align: center;
      }
      #aj-version {
        text-align: center; font-size: .7rem; font-weight: 700;
        color: rgba(255,255,255,0.25); padding-bottom: 8px;
      }

      /* Perfiles */
      .aj-perfil-item {
        display: flex; align-items: center; gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid rgba(255,255,255,0.07);
      }
      .aj-perfil-item:last-child { border-bottom: none; }
      .aj-perfil-avatar {
        width: 44px; height: 44px; border-radius: 50%;
        object-fit: cover; flex-shrink: 0;
        background: rgba(255,255,255,0.1);
        display: flex; align-items: center; justify-content: center;
        font-size: 1.4rem; overflow: hidden;
      }
      .aj-perfil-avatar img { width: 100%; height: 100%; object-fit: cover; }
      .aj-perfil-info { flex: 1; min-width: 0; }
      .aj-perfil-apodo {
        color: white; font-size: .92rem; font-weight: 800;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .aj-perfil-meta {
        color: rgba(255,255,255,0.45); font-size: .7rem; font-weight: 600;
        margin-top: 2px;
      }
      .aj-perfil-activo-badge {
        font-size: .62rem; font-weight: 900; padding: 2px 8px;
        border-radius: 20px; background: #A855F7; color: white;
        flex-shrink: 0;
      }
      .aj-perfil-btns { display: flex; gap: 6px; flex-shrink: 0; }
      .aj-perfil-btn {
        width: 32px; height: 32px; border-radius: 50%;
        border: none; cursor: pointer; font-size: .85rem;
        display: flex; align-items: center; justify-content: center;
        transition: transform .12s;
      }
      .aj-perfil-btn:active { transform: scale(.88); }
      .aj-perfil-btn-activar { background: rgba(168,85,247,0.25); color: #c084fc; }
      .aj-perfil-btn-editar  { background: rgba(255,255,255,0.12); color: white; }
      .aj-perfil-btn-exportar { background: rgba(34,197,94,0.2); color: #4ade80; }
      .aj-perfil-btn-eliminar { background: rgba(239,68,68,0.2); color: #f87171; }

      /* Modal de perfil */
      #aj-modal-perfil {
        display: none; position: fixed; inset: 0; z-index: 100;
        background: rgba(10,8,30,0.85);
        backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
        align-items: center; justify-content: center; padding: 20px;
      }
      #aj-modal-perfil.visible { display: flex; }
      #aj-modal-perfil-box {
        background: rgba(30,30,58,0.98);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 28px; padding: 24px;
        width: 100%; max-width: 420px;
        display: flex; flex-direction: column; gap: 16px;
        max-height: 90vh; overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      }
      #aj-modal-perfil-box h3 { color: white; font-size: 1rem; font-weight: 900; }
      .aj-modal-label {
        color: rgba(255,255,255,0.45); font-size: .7rem;
        font-weight: 900; text-transform: uppercase; letter-spacing: .08em;
        margin-bottom: 4px; display: block;
      }
      .aj-modal-input {
        width: 100%; padding: 12px 14px; border-radius: 14px;
        border: 1.5px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.07); color: white;
        font-size: .92rem; font-weight: 700; font-family: inherit;
        outline: none; -webkit-appearance: none;
      }
      .aj-modal-input:focus { border-color: #A855F7; }
      .aj-modal-textarea {
        width: 100%; padding: 12px 14px; border-radius: 14px;
        border: 1.5px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.07); color: white;
        font-size: .88rem; font-weight: 600; font-family: inherit;
        outline: none; resize: none; height: 90px;
        -webkit-appearance: none;
      }
      .aj-modal-textarea:focus { border-color: #A855F7; }
      #aj-avatar-preview {
        width: 72px; height: 72px; border-radius: 50%;
        background: rgba(255,255,255,0.1);
        display: flex; align-items: center; justify-content: center;
        font-size: 2.2rem; overflow: hidden; flex-shrink: 0;
        border: 2px solid rgba(255,255,255,0.15);
      }
      #aj-avatar-preview img { width: 100%; height: 100%; object-fit: cover; }
      .aj-avatar-row { display: flex; align-items: center; gap: 14px; }
      .aj-avatar-acciones { display: flex; flex-direction: column; gap: 8px; flex: 1; }
      .aj-modal-btns { display: flex; gap: 10px; }
      .aj-modal-btns button {
        flex: 1; padding: 14px; border-radius: 16px; border: none;
        font-weight: 900; font-size: .92rem; cursor: pointer; font-family: inherit;
        transition: transform .12s;
      }
      .aj-modal-btns button:active { transform: scale(.95); }
      #btn-modal-guardar { background: #A855F7; color: white; }
      #btn-modal-cancelar {
        background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.6);
        border: 1px solid rgba(255,255,255,0.15);
      }

      /* Crop de avatar */
      #aj-crop-wrap {
        display: none; position: fixed; inset: 0; z-index: 200;
        background: rgba(0,0,0,0.92);
        backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        flex-direction: column; align-items: center; justify-content: center;
        gap: 16px; padding: 20px;
      }
      #aj-crop-wrap.visible { display: flex; }
      #aj-crop-canvas {
        border-radius: 16px;
        touch-action: none;
        cursor: grab;
        max-width: 100%;
        max-height: 60vh;
      }
      #aj-crop-canvas:active { cursor: grabbing; }
      #aj-crop-hint {
        color: rgba(255,255,255,0.5); font-size: .75rem; font-weight: 700;
        text-align: center;
      }
      #aj-crop-btns { display: flex; gap: 12px; width: 100%; max-width: 340px; }
      #aj-crop-btns button {
        flex: 1; padding: 14px; border-radius: 16px; border: none;
        font-weight: 900; font-size: .92rem; cursor: pointer;
        font-family: inherit; transition: transform .12s;
      }
      #aj-crop-btns button:active { transform: scale(.95); }
      #btn-crop-confirmar { background: #A855F7; color: white; }
      #btn-crop-cancelar  {
        background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.6);
        border: 1px solid rgba(255,255,255,0.15);
      }
      .aj-crop-zoom {
        display: flex; align-items: center; gap: 10px;
        width: 100%; max-width: 340px;
      }
      .aj-crop-zoom input {
        flex: 1; accent-color: #A855F7;
      }
      .aj-crop-zoom span { color: rgba(255,255,255,0.5); font-size: .8rem; }

      /* Toggles de módulos */
      .aj-toggle-fila {
        display: flex; align-items: center;
        justify-content: space-between; gap: 12px;
        padding: 8px 0;
        border-bottom: 1px solid rgba(255,255,255,0.07);
      }
      .aj-toggle-fila:last-child { border-bottom: none; }
      .aj-toggle-info { display: flex; align-items: center; gap: 10px; flex: 1; }
      .aj-toggle-emoji { font-size: 1.3rem; }
      .aj-toggle-label { color: white; font-size: .88rem; font-weight: 800; }
      .aj-toggle {
        position: relative; width: 44px; height: 26px; flex-shrink: 0;
      }
      .aj-toggle input { opacity: 0; width: 0; height: 0; }
      .aj-toggle-slider {
        position: absolute; inset: 0; border-radius: 26px;
        background: rgba(255,255,255,0.15); cursor: pointer;
        transition: background .2s;
      }
      .aj-toggle-slider::before {
        content: ''; position: absolute;
        width: 20px; height: 20px; border-radius: 50%;
        background: white; left: 3px; top: 3px;
        transition: transform .2s;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      }
      .aj-toggle input:checked + .aj-toggle-slider { background: #A855F7; }
      .aj-toggle input:checked + .aj-toggle-slider::before { transform: translateX(18px); }

      /* Reporte de telemetria */
      .aj-reporte-bloque {
        display: flex; flex-direction: column; gap: 8px;
      }
      .aj-reporte-subtitulo {
        font-size: .68rem; font-weight: 900; text-transform: uppercase;
        letter-spacing: .08em; color: rgba(255,255,255,0.45);
        margin-top: 4px;
      }
      .aj-reporte-stat {
        display: flex; align-items: center;
        justify-content: space-between; gap: 8px;
        padding: 6px 0;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .aj-reporte-stat:last-child { border-bottom: none; }
      .aj-reporte-stat-label {
        color: rgba(255,255,255,0.7); font-size: .82rem; font-weight: 700;
        flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .aj-reporte-stat-val {
        color: white; font-size: .82rem; font-weight: 900;
        flex-shrink: 0;
      }
      .aj-reporte-barra-wrap {
        height: 6px; border-radius: 6px;
        background: rgba(255,255,255,0.08); overflow: hidden;
        margin-top: 2px;
      }
      .aj-reporte-barra {
        height: 100%; border-radius: 6px;
        background: linear-gradient(90deg, #A855F7, #EC4899);
        transition: width .4s ease;
      }
      .aj-reporte-vacio {
        color: rgba(255,255,255,0.3); font-size: .78rem;
        font-weight: 700; text-align: center; padding: 8px 0;
      }
      .aj-reporte-frase {
        color: rgba(255,255,255,0.65); font-size: .78rem; font-weight: 600;
        padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
        line-height: 1.3;
      }
      .aj-reporte-frase:last-child { border-bottom: none; }
    </style>

    <div id="aj-wrap">

      <div class="aj-seccion">
        <p class="aj-titulo">Conexion</p>
        <div class="aj-fila">
          <div style="display:flex;align-items:center;gap:10px;">
            <div id="aj-dot"></div>
            <span id="aj-texto-conexion" class="aj-label">Verificando...</span>
          </div>
          <button class="aj-btn aj-neutral" id="btn-aj-verificar">Verificar</button>
        </div>
      </div>

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
            <span class="aj-label">Borrar cache</span>
            <span class="aj-desc">Libera espacio en el dispositivo</span>
          </div>
          <button class="aj-btn aj-danger" id="btn-aj-borrar">Borrar</button>
        </div>
      </div>

      <div class="aj-seccion">
        <p class="aj-titulo">Aplicacion</p>
        <div class="aj-fila">
          <div class="aj-fila-info">
            <span class="aj-label">Actualizar app</span>
            <span class="aj-desc">Aplica la ultima version disponible</span>
          </div>
          <button class="aj-btn aj-neutral" id="btn-aj-refresh">Actualizar</button>
        </div>
        <div class="aj-fila">
          <div class="aj-fila-info">
            <span class="aj-label">Reinicio completo</span>
            <span class="aj-desc">Borra cache y recarga desde el servidor</span>
          </div>
          <button class="aj-btn aj-danger" id="btn-aj-reset">Resetear</button>
        </div>
      </div>

      <div class="aj-seccion">
        <p class="aj-titulo">Comunicador</p>
        <div class="aj-fila">
          <div class="aj-fila-info">
            <span class="aj-label">Tamano de pictogramas</span>
            <span class="aj-desc">Ajusta el tamano de las tarjetas del tablero</span>
          </div>
        </div>
        <div id="aj-tamano-btns">
          ${['S', 'M', 'L'].map(t => `
            <button class="aj-tam-btn${tamano === t ? ' activo' : ''}" data-tam="${t}">
              ${t === 'S' ? 'Pequeno' : t === 'M' ? 'Mediano' : 'Grande'}
            </button>`).join('')}
        </div>
      </div>

      <div class="aj-seccion" id="aj-sec-reporte">
        <p class="aj-titulo">Reporte de actividad</p>
        <div id="aj-reporte-contenido"></div>
        <div class="aj-fila" style="margin-top:4px;">
          <button class="aj-btn aj-neutral" id="btn-aj-reporte-exportar">⬇️ Exportar</button>
          <button class="aj-btn aj-danger"  id="btn-aj-reporte-limpiar">🗑 Limpiar</button>
        </div>
      </div>

      <div class="aj-seccion">
        <p class="aj-titulo">Módulos visibles</p>
        <p class="aj-desc" style="color:rgba(255,255,255,0.45);font-size:.75rem;">
          Configura qué módulos ve el perfil activo en el menú principal.
        </p>
        <div id="aj-modulos-lista"></div>
      </div>

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

      <p id="aj-versi on">Dotir 2 v2.0</p>

      <div id="aj-modal-perfil">
        <div id="aj-modal-perfil-box">
          <h3 id="aj-modal-titulo">Nuevo perfil</h3>
            <div class="aj-avatar-row">
              <div id="aj-avatar-preview">🧑</div>
                <div class="aj-avatar-acciones">
                  <span class="aj-modal-label">Avatar</span>
                  <input class="aj-modal-input" id="input-avatar-emoji"
               placeholder="Emoji (ej: 🐯)" maxlength="4">
                  <button class="aj-btn aj-neutral" id="btn-avatar-foto"
                style="font-size:.78rem;padding:8px 12px;">
                    📷 Subir foto
                  </button>
                  <input type="file" id="input-avatar-file"
               accept="image/*" style="display:none">
                  </div>
                </div>
              <div>
                <span class="aj-modal-label">Apodo</span>
                  <input class="aj-modal-input" id="input-apodo"
             placeholder="Ej: Tigre" maxlength="24">
            </div>
          <div>
      <span class="aj-modal-label">Fecha de nacimiento</span>
      <input class="aj-modal-input" id="input-fecha"
             type="date">
    </div>
    <div>
      <span class="aj-modal-label">Notas</span>
      <textarea class="aj-modal-textarea" id="input-notas"
                placeholder="Observaciones generales..."></textarea>
    </div>
    <div class="aj-modal-btns">
      <button id="btn-modal-cancelar">Cancelar</button>
      <button id="btn-modal-guardar">Guardar</button>
    </div>
  </div>
  
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

</div>

    </div>
  `;

  _q('#btn-aj-verificar').addEventListener('click', _actualizarEstadoConexion);

  _q('#btn-aj-descargar').addEventListener('click', _descargarTodo);

  _q('#btn-aj-borrar').addEventListener('click', async () => {
    const btn = _q('#btn-aj-borrar');
    btn.disabled = true;
    await borrarCache();
    toast('Cache borrada', { emoji: '🗑️' });
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

  _q('#aj-tamano-btns').addEventListener('click', e => {
    const btn = e.target.closest('[data-tam]');
    if (!btn) return;
    const t = btn.dataset.tam;
    localStorage.setItem(LS_TAMANO, t);
    _q('#aj-tamano-btns').querySelectorAll('.aj-tam-btn').forEach(b =>
      b.classList.toggle('activo', b.dataset.tam === t)
    );
    const nombre = t === 'S' ? 'pequeno' : t === 'M' ? 'mediano' : 'grande';
    toast('Tamano ' + nombre, { emoji: '🔲' });
    window.DotirApp?.MODULE_REGISTRY?.find(m => m.id === 'saac')?.setTamano?.(t);
  });
  _q('#btn-aj-nuevo-perfil').addEventListener('click', () => _abrirModal());
  _q('#btn-modal-cancelar').addEventListener('click', _cerrarModal);
  _q('#aj-modal-perfil').addEventListener('click', e => {
    if (e.target === _q('#aj-modal-perfil')) _cerrarModal();
  });
  _q('#btn-avatar-foto').addEventListener('click', () => {
    _q('#input-avatar-file').click();
  });
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
    if (val) {
      _avatarFotoData = null;
      _q('#aj-avatar-preview').innerHTML = val;
    }
  });
  _q('#btn-modal-guardar').addEventListener('click', _guardarPerfil);
  _q('#btn-aj-reporte-exportar').addEventListener('click', () => {
    const p = Perfiles.getActivo();
    Telemetry.exportar(p.id);
    toast('Reporte exportado', { emoji: '📥' });
  });
  _q('#btn-aj-reporte-limpiar').addEventListener('click', () => {
    const p = Perfiles.getActivo();
    if (!confirm('¿Borrar todos los datos de actividad de ' + p.apodo + '?')) return;
    Telemetry.limpiar(p.id);
    _renderReporte();
    toast('Datos borrados', { emoji: '🗑️' });
  });
  _renderReporte();
  _renderPerfiles();
  _renderModulos();

} // <-- cierre de _renderShell

async function _actualizarEstadoConexion() {
  const dot = _q('#aj-dot');
  const texto = _q('#aj-texto-conexion');
  if (!dot || !texto) return;
  dot.style.background = '#eab308';
  texto.textContent = 'Verificando...';
  if (!navigator.onLine) {
    dot.style.background = '#ef4444';
    texto.textContent = 'Sin conexion';
    return;
  }
  try {
    const res = await fetchTimeout('./manifest.json', 4000, { method: 'HEAD', cache: 'no-store' });
    if (!_container) return;                          // guard
    dot.style.background = res.ok ? '#22c55e' : '#ef4444';
    texto.textContent = res.ok ? 'En linea' : 'Sin conexion';
  } catch {
    if (!_container) return;                          // guard
    dot.style.background = '#ef4444';
    texto.textContent = 'Sin conexion';
  }
}

async function _descargarTodo() {
  const btn = _q('#btn-aj-descargar');
  const wrap = _q('#aj-progreso-wrap');
  const bar = _q('#aj-progreso-bar');
  const txt = _q('#aj-progreso-txt');
  if (!btn || !wrap || !bar || !txt) return;         // guard inicial

  btn.disabled = true;
  wrap.classList.add('visible');
  bar.style.width = '0%';
  txt.textContent = 'Recopilando recursos...';

  const urls = new Set([
    './index.html', './manifest.json', './sw.js',
    './core/tts.js', './core/offline.js', './core/ui.js', './core/audio.js',
    './assets/ui/btn-comunicador.png', './assets/ui/btn-memorama.png',
    './assets/ui/btn-musica.png', './assets/ui/btn-libros.png',
    './assets/ui/btn-videos.png', './assets/ui/btn-ajustes.png',
    './assets/ui/btn-inicio.png', './assets/ui/favicon.png',
    './modules/saac/module.js', './modules/saac/saac.js',
    './modules/memorama/module.js', './modules/memorama/memorama.js',
    './modules/libros/module.js', './modules/libros/libros.js',
    './modules/ajustes/module.js', './modules/ajustes/ajustes.js',
    './data/saac.json', './data/libros.json',
    './data/memorama-temas.json',
    './data/media.json',
    './modules/media/module.js', './modules/media/media.js',
  ]);

  const registry = window.DotirApp?.MODULE_REGISTRY || [];
  for (const mod of registry) {
    try {
      const cache = mod.buildCache
        ? await mod.buildCache()
        : (mod.cache || []);
      if (!_container) return;                        // guard
      cache.forEach(u => urls.add(u));
    } catch (_) { }
  }

  try {
    const r = await fetchTimeout('./data/saac.json', 6000);
    if (!_container) return;                          // guard
    if (r.ok) {
      const data = await r.json();
      if (!_container) return;                        // guard
      const cats = data.categorias || data;
      (Array.isArray(cats) ? cats : Object.values(cats)).forEach(cat => {
        (cat.items || []).forEach(item => {
          if (item.imagen) urls.add('./assets/pics/' + item.imagen);
        });
      });
    }
  } catch (_) { }

  try {
    const r = await fetchTimeout('./data/memorama-temas.json', 5000);
    if (!_container) return;                          // guard
    if (r.ok) {
      const temas = await r.json();
      if (!_container) return;                        // guard
      for (const meta of temas) {
        urls.add('./' + meta.archivo);
        try {
          const r2 = await fetchTimeout('./' + meta.archivo, 5000);
          if (!_container) return;                    // guard
          if (r2.ok) {
            const tema = await r2.json();
            if (!_container) return;                  // guard
            tema.items?.forEach(item => {
              if (tema.carpeta_img && item.imagen)
                urls.add('./' + tema.carpeta_img + item.imagen);
            });
          }
        } catch (_) { }
      }
    }
  } catch (_) { }
  // Descargar archivos de audio
  try {
    const r = await fetchTimeout('./data/media.json', 5000);
    if (!_container) return;
    if (r.ok) {
      const media = await r.json();
      if (!_container) return;
      media.forEach(item => {
        if (item.tipo === 'audio') {
          urls.add('./assets/audio/' + item.archivo + '.mp3');
          urls.add('./assets/audio/img/' + item.archivo + '.jpg');
        } else {
          urls.add('./assets/videos/' + item.archivo + '.mp4');
          urls.add('./assets/videos/img/' + item.archivo + '.jpg');
        }
      });
    }
  } catch (_) { }

  if (!_container) return;                            // guard antes de precachear

  const { ok, total } = await precachear([...urls], {
    onProgress: (d, t) => {
      if (!_container) return;                        // guard dentro del callback
      const pct = Math.round((d / t) * 100);
      bar.style.width = pct + '%';
      txt.textContent = d + ' de ' + t + ' archivos...';
    }
  });

  if (!_container) return;                            // guard post-precache

  bar.style.width = '100%';
  bar.style.background = ok === total ? '#22c55e' : '#f59e0b';
  txt.textContent = ok === total
    ? ok + ' archivos listos'
    : ok + ' de ' + total + ' descargados';

  lanzarConfeti({ count: 40, container: _container });
  toast('Descarga completada', { emoji: '\u{1F4E5}' });
  btn.disabled = false;
}

let _editandoId = null;
let _avatarFotoData = null;

function _renderPerfiles() {
  const lista = _q('#aj-perfiles-lista');
  if (!lista) return;
  lista.innerHTML = '';
  Perfiles.listar().forEach(p => {
    const esActivo = p.id === Perfiles.activoId;
    const edad = Perfiles.calcularEdad(p.fechaNacimiento);
    const item = document.createElement('div');
    item.className = 'aj-perfil-item';

    // Avatar
    const avatarEl = document.createElement('div');
    avatarEl.className = 'aj-perfil-avatar';
    if (p.avatarFoto) {
      avatarEl.innerHTML = '<img src="' + p.avatarFoto + '" alt="' + p.apodo + '">';
    } else {
      avatarEl.textContent = p.avatar || '🧑';
    }

    // Info
    const info = document.createElement('div');
    info.className = 'aj-perfil-info';
    info.innerHTML =
      '<div class="aj-perfil-apodo">' + p.apodo + '</div>' +
      '<div class="aj-perfil-meta">' +
      (edad !== null ? edad + ' años' : 'Sin fecha de nacimiento') +
      '</div>';

    // Badge activo
    const btns = document.createElement('div');
    btns.className = 'aj-perfil-btns';

    if (esActivo) {
      const badge = document.createElement('span');
      badge.className = 'aj-perfil-activo-badge';
      badge.textContent = 'Activo';
      btns.appendChild(badge);
    } else {
      const btnActivar = document.createElement('button');
      btnActivar.className = 'aj-perfil-btn aj-perfil-btn-activar';
      btnActivar.title = 'Activar perfil';
      btnActivar.textContent = '▶';
      btnActivar.addEventListener('click', () => {
        Perfiles.activar(p.id);
        _renderPerfiles();
        toast('Perfil activo: ' + p.apodo, { emoji: '👤' });
      });
      btns.appendChild(btnActivar);
    }

    // Editar
    const btnEditar = document.createElement('button');
    btnEditar.className = 'aj-perfil-btn aj-perfil-btn-editar';
    btnEditar.title = 'Editar';
    btnEditar.textContent = '✏️';
    btnEditar.addEventListener('click', () => _abrirModal(p.id));
    btns.appendChild(btnEditar);

    // Exportar (no para invitado)
    if (!p.esInvitado) {
      const btnExp = document.createElement('button');
      btnExp.className = 'aj-perfil-btn aj-perfil-btn-exportar';
      btnExp.title = 'Exportar';
      btnExp.textContent = '⬇️';
      btnExp.addEventListener('click', () => {
        Perfiles.exportar(p.id);
        toast('Perfil exportado', { emoji: '📥' });
      });
      btns.appendChild(btnExp);
    }

    // Eliminar (no para invitado)
    if (!p.esInvitado) {
      const btnDel = document.createElement('button');
      btnDel.className = 'aj-perfil-btn aj-perfil-btn-eliminar';
      btnDel.title = 'Eliminar';
      btnDel.textContent = '🗑';
      btnDel.addEventListener('click', () => {
        if (!confirm('¿Eliminar el perfil "' + p.apodo + '"? Esta acción no se puede deshacer.')) return;
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

function _abrirModal(id) {
  _editandoId = id || null;
  _avatarFotoData = null;

  const titulo = _q('#aj-modal-titulo');
  const inputApodo = _q('#input-apodo');
  const inputEmoji = _q('#input-avatar-emoji');
  const inputFecha = _q('#input-fecha');
  const inputNotas = _q('#input-notas');
  const preview = _q('#aj-avatar-preview');

  if (id) {
    const p = Perfiles.listar().find(x => x.id === id);
    if (!p) return;
    titulo.textContent = 'Editar perfil';
    inputApodo.value = p.apodo;
    inputFecha.value = p.fechaNacimiento || '';
    inputNotas.value = p.notas || '';
    if (p.avatarFoto) {
      _avatarFotoData = p.avatarFoto;
      preview.innerHTML = '<img src="' + p.avatarFoto + '">';
      inputEmoji.value = '';
    } else {
      preview.textContent = p.avatar || '🧑';
      inputEmoji.value = p.avatar || '';
    }
  } else {
    titulo.textContent = 'Nuevo perfil';
    inputApodo.value = '';
    inputEmoji.value = '';
    inputFecha.value = '';
    inputNotas.value = '';
    preview.textContent = '🧑';
  }

  _q('#aj-modal-perfil').classList.add('visible');
}

function _cerrarModal() {
  _q('#aj-modal-perfil')?.classList.remove('visible');
  _editandoId = null;
  _avatarFotoData = null;
  const fileInput = _q('#input-avatar-file');
  if (fileInput) fileInput.value = '';
}

function _guardarPerfil() {
  const apodo = _q('#input-apodo').value.trim();
  if (!apodo) {
    toast('El apodo es requerido', { emoji: '⚠️' });
    return;
  }
  const emoji = _q('#input-avatar-emoji').value.trim();
  const datos = {
    apodo,
    avatar: emoji || '🧑',
    avatarFoto: _avatarFotoData || null,
    fechaNacimiento: _q('#input-fecha').value || null,
    notas: _q('#input-notas').value.trim(),
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

// -- Crop interactivo ---

let _cropImg = null;
let _cropZoom = 1;
let _cropOffX = 0;
let _cropOffY = 0;
let _cropDragging = false;
let _cropLastX = 0;
let _cropLastY = 0;
let _cropPinchDist = 0;

function _abrirCrop(src) {
  const img = new Image();
  img.onload = () => {
    _cropImg = img;
    _cropZoom = Math.max(320 / img.width, 320 / img.height);
    _cropOffX = 0;
    _cropOffY = 0;
    _q('#aj-crop-zoom-slider').min = String(_cropZoom * 0.8);
    _q('#aj-crop-zoom-slider').max = String(_cropZoom * 4);
    _q('#aj-crop-zoom-slider').step = String(_cropZoom * 0.01);
    _q('#aj-crop-zoom-slider').value = String(_cropZoom);
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
  const fileInput = _q('#input-avatar-file');
  if (fileInput) fileInput.value = '';
}

function _confirmarCrop() {
  const out = document.createElement('canvas');
  out.width = 256;
  out.height = 256;
  const ctx = out.getContext('2d');

  // Recorte circular
  ctx.beginPath();
  ctx.arc(128, 128, 128, 0, Math.PI * 2);
  ctx.clip();

  // Calcular posicion de la imagen en el canvas de preview (320x320)
  const canvas = _q('#aj-crop-canvas');
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const iw = _cropImg.width * _cropZoom;
  const ih = _cropImg.height * _cropZoom;
  const ix = cx + _cropOffX - iw / 2;
  const iy = cy + _cropOffY - ih / 2;

  // Escalar al canvas de salida 256x256
  const escala = 256 / 320;
  ctx.drawImage(_cropImg, ix * escala, iy * escala, iw * escala, ih * escala);

  _avatarFotoData = out.toDataURL('image/jpeg', 0.88);
  const prev = _q('#aj-avatar-preview');
  prev.innerHTML = '<img src="' + _avatarFotoData + '">';
  _q('#input-avatar-emoji').value = '';
  _cerrarCrop();
}

function _dibujarCrop() {
  const canvas = _q('#aj-crop-canvas');
  if (!canvas || !_cropImg) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  const cy = H / 2;

  ctx.clearRect(0, 0, W, H);

  // Fondo oscuro
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, W, H);

  // Imagen
  const iw = _cropImg.width * _cropZoom;
  const ih = _cropImg.height * _cropZoom;
  const ix = cx + _cropOffX - iw / 2;
  const iy = cy + _cropOffY - ih / 2;
  ctx.drawImage(_cropImg, ix, iy, iw, ih);

  // Overlay oscuro fuera del círculo
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.arc(cx, cy, W * 0.46, 0, Math.PI * 2, true);
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fill();
  ctx.restore();

  // Borde del círculo
  ctx.beginPath();
  ctx.arc(cx, cy, W * 0.46, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(168,85,247,0.9)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

function _clampOffset() {
  if (!_cropImg) return;
  const canvas = _q('#aj-crop-canvas');
  const radio = canvas.width * 0.46;
  const iw = _cropImg.width * _cropZoom;
  const ih = _cropImg.height * _cropZoom;
  const maxX = Math.max(0, iw / 2 - radio);
  const maxY = Math.max(0, ih / 2 - radio);
  _cropOffX = Math.max(-maxX, Math.min(maxX, _cropOffX));
  _cropOffY = Math.max(-maxY, Math.min(maxY, _cropOffY));
}

// -- Eventos de drag y pinch ---

function _iniciarEventosCrop() {
  const canvas = _q('#aj-crop-canvas');
  if (!canvas) return;

  canvas.addEventListener('mousedown', _onCropMouseDown);
  canvas.addEventListener('mousemove', _onCropMouseMove);
  canvas.addEventListener('mouseup', _onCropMouseUp);
  canvas.addEventListener('mouseleave', _onCropMouseUp);
  canvas.addEventListener('wheel', _onCropWheel, { passive: false });
  canvas.addEventListener('touchstart', _onCropTouchStart, { passive: false });
  canvas.addEventListener('touchmove', _onCropTouchMove, { passive: false });
  canvas.addEventListener('touchend', _onCropTouchEnd);
}

function _limpiarEventosCrop() {
  const canvas = _q('#aj-crop-canvas');
  if (!canvas) return;
  canvas.removeEventListener('mousedown', _onCropMouseDown);
  canvas.removeEventListener('mousemove', _onCropMouseMove);
  canvas.removeEventListener('mouseup', _onCropMouseUp);
  canvas.removeEventListener('mouseleave', _onCropMouseUp);
  canvas.removeEventListener('wheel', _onCropWheel);
  canvas.removeEventListener('touchstart', _onCropTouchStart);
  canvas.removeEventListener('touchmove', _onCropTouchMove);
  canvas.removeEventListener('touchend', _onCropTouchEnd);
}

function _onCropMouseDown(e) {
  _cropDragging = true;
  _cropLastX = e.clientX;
  _cropLastY = e.clientY;
}

function _onCropMouseMove(e) {
  if (!_cropDragging) return;
  _cropOffX += e.clientX - _cropLastX;
  _cropOffY += e.clientY - _cropLastY;
  _cropLastX = e.clientX;
  _cropLastY = e.clientY;
  _clampOffset();
  _dibujarCrop();
}

function _onCropMouseUp() { _cropDragging = false; }

function _onCropWheel(e) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.08 : 0.08;
  const slider = _q('#aj-crop-zoom-slider');
  _cropZoom = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), _cropZoom + delta * _cropZoom));
  slider.value = String(_cropZoom);
  _clampOffset();
  _dibujarCrop();
}

function _onCropTouchStart(e) {
  e.preventDefault();
  if (e.touches.length === 1) {
    _cropDragging = true;
    _cropLastX = e.touches[0].clientX;
    _cropLastY = e.touches[0].clientY;
  } else if (e.touches.length === 2) {
    _cropDragging = false;
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
    _clampOffset();
    _dibujarCrop();
  } else if (e.touches.length === 2) {
    const dist = _pinchDist(e.touches);
    const delta = dist / _cropPinchDist;
    const slider = _q('#aj-crop-zoom-slider');
    _cropZoom = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), _cropZoom * delta));
    slider.value = String(_cropZoom);
    _cropPinchDist = dist;
    _clampOffset();
    _dibujarCrop();
  }
}

function _onCropTouchEnd(e) {
  if (e.touches.length === 0) _cropDragging = false;
}

function _pinchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

const _MODULOS_CONFIGURABLES = [
  SaacModule,
  MemoramaModule,
  MediaModule,
  TemporizadorModule,
  LibrosModule,
];

function _renderModulos() {
  const lista = _q('#aj-modulos-lista');
  if (!lista) return;
  lista.innerHTML = '';

  const habilitados = Perfiles.getModulosHabilitados();

  _MODULOS_CONFIGURABLES.forEach(mod => {
    const activo = habilitados === null || habilitados.includes(mod.id);

    const fila = document.createElement('div');
    fila.className = 'aj-toggle-fila';

    const info = document.createElement('div');
    info.className = 'aj-toggle-info';
    info.innerHTML =
      '<span class="aj-toggle-emoji">' + mod.emoji + '</span>' +
      '<span class="aj-toggle-label">' + mod.label + '</span>';

    const label = document.createElement('label');
    label.className = 'aj-toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = activo;
    const slider = document.createElement('span');
    slider.className = 'aj-toggle-slider';
    label.appendChild(input);
    label.appendChild(slider);

    input.addEventListener('change', () => {
      const todos = _MODULOS_CONFIGURABLES.map(m => m.id);
      const actual = Perfiles.getModulosHabilitados() || [...todos];
      const nuevos = input.checked
        ? [...new Set([...actual, mod.id])]
        : actual.filter(id => id !== mod.id);
      const sonTodos = todos.every(id => nuevos.includes(id));
      Perfiles.setModulosHabilitados(sonTodos ? null : nuevos);
    });

    fila.appendChild(info);
    fila.appendChild(label);
    lista.appendChild(fila);
  });
}

function _renderReporte() {
  const contenido = _q('#aj-reporte-contenido');
  if (!contenido) return;
  contenido.innerHTML = '';

  const p = Perfiles.getActivo();
  const reporte = Telemetry.getReporte(p.id);
  const total = Telemetry.contarEventos(p.id);

  if (total === 0) {
    contenido.innerHTML =
      '<p class="aj-reporte-vacio">Aun no hay actividad registrada para ' + p.apodo + '.</p>';
    return;
  }

  // -- Encabezado general ---
  const desde = reporte.primerEvento
    ? reporte.primerEvento.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  const hasta = reporte.ultimoEvento
    ? reporte.ultimoEvento.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  _aj_stat(contenido, 'Perfil', p.apodo);
  _aj_stat(contenido, 'Periodo', desde + ' – ' + hasta);
  _aj_stat(contenido, 'Total de eventos', String(total));

  // -- SAAC ---
  const s = reporte.saac;
  if (s.totalPictos > 0 || s.totalFrases > 0) {
    _aj_subtitulo(contenido, '💬 Comunicador');
    _aj_stat(contenido, 'Pictogramas usados', String(s.totalPictos));
    _aj_stat(contenido, 'Frases habladas', String(s.totalFrases));
    _aj_stat(contenido, 'Favoritos agregados', String(s.totalFavs));

    if (s.topPictos.length > 0) {
      _aj_subtitulo(contenido, 'Top pictogramas');
      const maxCount = s.topPictos[0].count;
      s.topPictos.forEach(item => {
        const fila = document.createElement('div');
        fila.className = 'aj-reporte-stat';
        fila.style.flexDirection = 'column';
        fila.style.alignItems = 'flex-start';
        fila.innerHTML =
          '<div style="display:flex;justify-content:space-between;width:100%">' +
          '<span class="aj-reporte-stat-label">' + (item.label || item.id) + '</span>' +
          '<span class="aj-reporte-stat-val">' + item.count + 'x</span>' +
          '</div>' +
          '<div class="aj-reporte-barra-wrap" style="width:100%">' +
          '<div class="aj-reporte-barra" style="width:' + Math.round((item.count / maxCount) * 100) + '%"></div>' +
          '</div>';
        contenido.appendChild(fila);
      });
    }

    if (s.ultimasFrases.length > 0) {
      _aj_subtitulo(contenido, 'Ultimas frases');
      s.ultimasFrases.forEach(f => {
        const div = document.createElement('div');
        div.className = 'aj-reporte-frase';
        div.textContent = f.texto;
        contenido.appendChild(div);
      });
    }
  }

  // -- Memorama ---
  const m = reporte.memorama;
  if (m.totalPartidas > 0) {
    _aj_subtitulo(contenido, '🃏 Memorama');
    _aj_stat(contenido, 'Partidas iniciadas', String(m.totalPartidas));
    _aj_stat(contenido, 'Partidas completadas', String(m.partidasComp));
    if (m.duracionPromSeg !== null) {
      const min = Math.floor(m.duracionPromSeg / 60);
      const seg = m.duracionPromSeg % 60;
      _aj_stat(contenido, 'Tiempo promedio', (min > 0 ? min + 'm ' : '') + seg + 's');
    }
    _aj_stat(contenido, 'Parejas encontradas', String(m.totalParejas));

    if (m.temas.length > 0) {
      _aj_subtitulo(contenido, 'Temas jugados');
      m.temas.forEach(t => _aj_stat(contenido, t.tema, t.veces + 'x'));
    }

    const idiomasEntries = Object.entries(m.idiomas);
    if (idiomasEntries.length > 0) {
      _aj_subtitulo(contenido, 'Idiomas usados');
      idiomasEntries
        .sort((a, b) => b[1] - a[1])
        .forEach(([lang, count]) => _aj_stat(contenido, lang, count + 'x'));
    }
  }

  // -- Multimedia ---
  const mm = reporte.multimedia;
  if (mm.totalReproducidos > 0) {
    _aj_subtitulo(contenido, '▶️ Multimedia');
    _aj_stat(contenido, 'Reproducciones', String(mm.totalReproducidos));

    if (mm.topMedia.length > 0) {
      _aj_subtitulo(contenido, 'Mas reproducidos');
      const maxM = mm.topMedia[0].count;
      mm.topMedia.forEach(item => {
        const fila = document.createElement('div');
        fila.className = 'aj-reporte-stat';
        fila.style.flexDirection = 'column';
        fila.style.alignItems = 'flex-start';
        fila.innerHTML =
          '<div style="display:flex;justify-content:space-between;width:100%">' +
          '<span class="aj-reporte-stat-label">' +
          (item.tipo === 'audio' ? '🎵 ' : '🎬 ') + item.titulo +
          '</span>' +
          '<span class="aj-reporte-stat-val">' + item.count + 'x</span>' +
          '</div>' +
          '<div class="aj-reporte-barra-wrap" style="width:100%">' +
          '<div class="aj-reporte-barra" style="width:' + Math.round((item.count / maxM) * 100) + '%"></div>' +
          '</div>';
        contenido.appendChild(fila);
      });
    }
  }
}

// Helpers de render del reporte
function _aj_stat(parent, label, val) {
  const div = document.createElement('div');
  div.className = 'aj-reporte-stat';
  div.innerHTML =
    '<span class="aj-reporte-stat-label">' + label + '</span>' +
    '<span class="aj-reporte-stat-val">' + val + '</span>';
  parent.appendChild(div);
}

function _aj_subtitulo(parent, texto) {
  const p = document.createElement('p');
  p.className = 'aj-reporte-subtitulo';
  p.textContent = texto;
  parent.appendChild(p);
}