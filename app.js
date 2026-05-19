/* app.js — Marina 2
   ╔══════════════════════════════════════════════════════════╗
   ║  Para una app nueva solo editas:                         ║
   ║   · app.config.json  — nombre, colores, PIN, TTS         ║
   ║   · index.html       — imports de módulos                ║
   ║   · modules/         — un archivo por módulo             ║
   ╚══════════════════════════════════════════════════════════╝
*/

import { cargarConfig, cfg } from './core/config.js';
import { registrarSW, onConexionChange } from './core/offline.js';
import { toast, animarEntrada } from './core/ui.js';
import { Perfiles } from './core/perfiles.js';
import { TTS } from './core/tts.js';
import AudioManager from './core/audio.js';
import MemoramaModule from './modules/memorama/module.js';

// ── Módulos de la app ─────────────────────────────────────────
import AjustesModule from './modules/ajustes/module.js';
import MiraYDiModule from './modules/mira-y-di/module.js';
import FrasesModule from './modules/frases/module.js';

const MODULOS = [AjustesModule, MiraYDiModule, FrasesModule, MemoramaModule];

// ─────────────────────────────────────────────────────────────
// ARRANQUE
// ─────────────────────────────────────────────────────────────
(async function boot() {
  await cargarConfig();

  await _cargarTema(cfg('ui.tema', 'oceano'));

  registrarSW();
  _montarHeader();

  onConexionChange(estado => {
    const el = document.getElementById('indicador-offline');
    const txt = document.getElementById('texto-conexion');
    if (!el) return;
    el.className = estado;
    if (txt) txt.textContent = {
      online: 'En línea', offline: 'Sin conexión', checking: 'Verificando...'
    }[estado] || '';
  });

  _actualizarChipPerfil();
  Perfiles.onChange(_actualizarChipPerfil);

  _montarHome();
  _initAreaAdultos();
  _initWakeLock();
  _solicitarMicrofono();

})();

// ─────────────────────────────────────────────────────────────
// TEMA
// ─────────────────────────────────────────────────────────────
async function _cargarTema(nombreTema) {
  try {
    const mod = await import(`./themes/${nombreTema}.js`);
    mod.injectStyles();
    const fondo = mod.crearFondo();
    const app = document.getElementById('app');
    if (app) app.insertBefore(fondo, app.firstChild);
    return mod;
  } catch (e) {
    console.warn('[App] Tema no encontrado:', nombreTema, e.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// HEADER
// ─────────────────────────────────────────────────────────────
function _montarHeader() {
  const nombre = cfg('app.nombre', 'App');
  const header = document.getElementById('app-header');
  if (!header) return;

  header.innerHTML = `
    <div id="header-izq">
      <button id="btn-volver" aria-label="Volver al menú">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M13 4L7 10L13 16" stroke="white" stroke-width="2.2"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="menu-logo" id="header-logo">
        <h1>${nombre}</h1>
        <span id="saludo-nombre"></span>
      </div>
      <div id="perfil-chip">
        <span id="perfil-chip-avatar"></span>
        <span id="perfil-chip-apodo"></span>
      </div>
    </div>

    <div id="modulo-acciones"></div>

    <div id="header-derecha">
      ${cfg('ui.mostrarPill', true) ? `
       <div id="lang-pill">
         <button data-lang="es" class="lang-btn activo" title="Español">ES</button>
         <button data-lang="en" class="lang-btn" title="Inglés">EN</button>
       </div>` : ''}
       <div id="indicador-offline" class="checking">
        <span id="dot-conexion"></span>
        <span id="texto-conexion">Verificando...</span>
      </div>
    </div>
  `;

  // Botón volver — oculto en home
  document.getElementById('btn-volver').style.display = 'none';

  // ── Pill de doble toggle ES / EN ──────────────────────────────────────────
  // Estado global del idioma — objeto con flags independientes
  window._langConfig = { es: true, en: false };

  // Resuelve qué idioma usar en una reproducción concreta:
  // · solo ES → 'es'
  // · solo EN → 'en'
  // · ambos   → elige aleatoriamente en cada llamada
  window.getLang = function () {
    const { es, en } = window._langConfig;
    if (es && en) return Math.random() < 0.5 ? 'es' : 'en';
    if (en) return 'en';
    return 'es';   // default y fallback
  };

  document.getElementById('lang-pill')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-lang]');
    if (!btn) return;
    const lang = btn.dataset.lang;

    // Toggle del idioma tocado
    const next = !window._langConfig[lang];

    // Regla: al menos un idioma debe estar activo
    const otroActivo = lang === 'es' ? window._langConfig.en : window._langConfig.es;
    if (!next && !otroActivo) return; // no permitir desactivar el último

    window._langConfig[lang] = next;
    btn.classList.toggle('activo', next);

    // Notificar a los módulos — pasan el langConfig completo
    window.dispatchEvent(new CustomEvent('lang-change', {
      detail: { langConfig: { ...window._langConfig } }
    }));
  });

  // Botón ajustes — solo si existe el módulo
  const ajustesMod = MODULOS.find(m => m.id === 'ajustes');
  if (ajustesMod) {
    const btn = document.createElement('button');
    btn.id = 'btn-ajustes-header';
    btn.title = 'Ajustes';
    btn.innerHTML = '⚙️';
    btn.addEventListener('click', () => _abrirPin(ajustesMod));
    document.getElementById('header-derecha')
      ?.insertBefore(btn, document.getElementById('indicador-offline'));
  }
}

function _actualizarChipPerfil() {
  const p = Perfiles.getActivo();
  const avatar = document.getElementById('perfil-chip-avatar');
  const apodo = document.getElementById('perfil-chip-apodo');
  const chip = document.getElementById('perfil-chip');
  const saludo = document.getElementById('saludo-nombre');
  if (!avatar || !apodo || !chip) return;

  if (p.avatarFoto) {
    avatar.innerHTML =
      `<img src="${p.avatarFoto}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;">`;
  } else {
    avatar.textContent = p.avatar || '👤';
  }
  apodo.textContent = p.esInvitado ? 'Invitado' : p.apodo;
  chip.style.opacity = p.esInvitado ? '0.45' : '1';
  if (saludo) saludo.textContent = (!p.esInvitado && p.apodo) ? `· ${p.apodo}` : '';
}

// ─────────────────────────────────────────────────────────────
// HOME — grid de módulos
// ─────────────────────────────────────────────────────────────
let _moduloActivo = null;
const _modulosPausados = {};
const _contenedores = {};

function _getContenedor(id) {
  if (!_contenedores[id]) {
    const div = document.createElement('div');
    div.id = `modulo-contenedor-${id}`;
    div.style.cssText =
      'position:absolute;inset:0;display:none;overflow:hidden;';
    document.getElementById('app-body').appendChild(div);
    _contenedores[id] = div;
  }
  return _contenedores[id];
}

function _modoMenu() {
  document.getElementById('btn-volver').style.display = 'none';
  document.getElementById('modulo-acciones').innerHTML = '';
}

function _montarHome() {
  const grid = document.getElementById('menu-grid');
  if (!grid) return;

  const habilitados = Perfiles.getModulosHabilitados();
  const modulos = MODULOS
    .filter(m => m.habilitado && m.id !== 'ajustes')
    .filter(m => !habilitados || habilitados.includes(m.id))
    .sort((a, b) => a.orden - b.orden);

  if (!modulos.length) {
    grid.innerHTML = '';
    modulos.forEach(mod => {
      const btn = document.createElement('button');
      btn.className = 'module-tile';

      // Imagen como fondo — fallback a emoji si no carga
      const imgUrl = `assets/ui/btn-${mod.id}.png`;
      const testImg = new Image();
      testImg.onload = () => btn.style.backgroundImage = `url('${imgUrl}')`;
      testImg.onerror = () => {
        btn.style.background = mod.color || 'rgba(255,255,255,0.10)';
        const emoji = document.createElement('span');
        emoji.textContent = mod.emoji || '🌟';
        emoji.style.cssText = 'font-size:3.5rem;margin-bottom:8px;';
        btn.insertBefore(emoji, btn.firstChild);
      };
      testImg.src = imgUrl;

      btn.innerHTML = `<span class="tile-label">${mod.label}</span>`;
      btn.addEventListener('click', () =>
        mod.requierePin ? _abrirPin(mod) : navegarA(mod)
      );
      grid.appendChild(btn);
    });
    return;
  }

  grid.innerHTML = '';
  modulos.forEach(mod => {
    const btn = document.createElement('button');
    btn.className = 'module-tile';
    btn.innerHTML = `<span class="tile-label">${mod.label}</span>`;

    const imgUrl = `assets/ui/btn-${mod.id}.png`;
    const testImg = new Image();
    testImg.onload = () => btn.style.backgroundImage = `url('${imgUrl}')`;
    testImg.onerror = () => {
      btn.style.backgroundColor = mod.color || 'rgba(255,255,255,0.10)';
      const emoji = document.createElement('span');
      emoji.textContent = mod.emoji || '🌟';
      emoji.style.cssText = 'font-size:3.5rem;margin-bottom:8px;position:relative;z-index:1;';
      btn.insertBefore(emoji, btn.firstChild);
    };
    testImg.src = imgUrl;

    btn.addEventListener('click', () =>
      mod.requierePin ? _abrirPin(mod) : navegarA(mod)
    );
    grid.appendChild(btn);
  });
}

// ─────────────────────────────────────────────────────────────
// NAVEGACIÓN
// ─────────────────────────────────────────────────────────────
async function navegarA(mod) {
  const vistaMenu = document.getElementById('vista-menu');
  const btnVolver = document.getElementById('btn-volver');
  const acciones = document.getElementById('modulo-acciones');

  // Pausar o destruir módulo activo
  if (_moduloActivo) {
    try { _moduloActivo.onLeave?.(); } catch { }
    const c = _getContenedor(_moduloActivo.id);
    if (_moduloActivo.pause) {
      try { _moduloActivo.pause(); } catch { }
      c.style.display = 'none';
      _modulosPausados[_moduloActivo.id] = _moduloActivo;
    } else {
      try { _moduloActivo.destroy?.(); } catch { }
      c.innerHTML = ''; c.style.display = 'none';
    }
    _moduloActivo = null;
  }

  vistaMenu.style.display = 'none';
  btnVolver.style.display = 'flex';
  acciones.innerHTML = '';

  const contenedor = _getContenedor(mod.id);

  // Reanudar si estaba pausado
  if (_modulosPausados[mod.id] && mod.resume) {
    _moduloActivo = mod;
    contenedor.style.display = 'block';
    try { await mod.resume(contenedor); mod.onEnter?.(); animarEntrada(contenedor); } catch (e) {
      console.error('[App] Error al resumir', mod.id, e);
    }
    return;
  }

  // Limpiar si estaba pausado pero no tiene resume
  if (_modulosPausados[mod.id] && !mod.resume) {
    try { _modulosPausados[mod.id].destroy?.(); } catch { }
    delete _modulosPausados[mod.id];
    contenedor.innerHTML = '';
  }

  _moduloActivo = mod;
  contenedor.innerHTML = '';
  contenedor.style.display = 'block';

  try {
    await mod.init(contenedor);
    mod.onEnter?.();
    animarEntrada(contenedor);
  } catch (e) {
    console.error('[App] Error en módulo', mod.id, e);
    contenedor.innerHTML =
      '<div style="padding:2rem;color:#ef4444;font-weight:600;">Error al cargar el módulo.</div>';
  }
}

function volverAlMenu() {
  if (_moduloActivo) {
    try { _moduloActivo.onLeave?.(); } catch { }
    const c = _getContenedor(_moduloActivo.id);
    if (_moduloActivo.pause) {
      try { _moduloActivo.pause(); } catch { }
      c.style.display = 'none';
      _modulosPausados[_moduloActivo.id] = _moduloActivo;
    } else {
      try { _moduloActivo.destroy?.(); } catch { }
      c.innerHTML = ''; c.style.display = 'none';
    }
    _moduloActivo = null;
  }
  document.getElementById('vista-menu').style.display = '';
  _modoMenu();
  animarEntrada(document.getElementById('vista-menu'), 'fadeIn');
}

// Exponer globalmente para uso desde módulos
window.DotirApp = { volverAlMenu, navegarA, toast, MODULE_REGISTRY: MODULOS };
window._volverAlMenu = volverAlMenu;

// ─────────────────────────────────────────────────────────────
// ÁREA DE ADULTOS — PIN matemático
// ─────────────────────────────────────────────────────────────
let _pinTarget = null;
let _pinRespuesta = 0;

function _abrirPin(mod) {
  _pinTarget = mod;
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  _pinRespuesta = a + b;
  const hint = document.getElementById('pin-hint');
  const inp = document.getElementById('input-pin');
  const err = document.getElementById('pin-error');
  if (hint) hint.textContent = `Resuelve: ${a} + ${b} = ?`;
  if (inp) inp.value = '';
  if (err) err.textContent = '';
  document.getElementById('modal-pin')?.classList.add('visible');
  setTimeout(() => inp?.focus(), 100);
}

function _cerrarPin() {
  document.getElementById('modal-pin')?.classList.remove('visible');
  _pinTarget = null;
}

function _initAreaAdultos() {
  document.getElementById('btn-volver')
    ?.addEventListener('click', volverAlMenu);

  document.getElementById('btn-pin-ok')?.addEventListener('click', () => {
    const inp = document.getElementById('input-pin');
    if (parseInt(inp?.value, 10) === _pinRespuesta) {
      const mod = _pinTarget;
      _cerrarPin();
      navegarA(mod);
    } else {
      const err = document.getElementById('pin-error');
      if (err) err.textContent = 'Respuesta incorrecta, intenta de nuevo.';
      if (inp) { inp.value = ''; inp.focus(); }
    }
  });

  document.getElementById('btn-pin-cancel')
    ?.addEventListener('click', _cerrarPin);

  document.getElementById('input-pin')
    ?.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('btn-pin-ok')?.click(); });

  document.getElementById('modal-pin')
    ?.addEventListener('click', e => { if (e.target.id === 'modal-pin') _cerrarPin(); });

  // Gestos ocultos para abrir área de adultos
  const ajustesMod = MODULOS.find(m => m.id === 'ajustes');
  if (!ajustesMod) return;

  // Deep link por URL: ?modulo=mira-y-di
  const moduloUrl = new URLSearchParams(location.search).get('modulo');
  if (moduloUrl) {
    const mod = MODULOS.find(m => m.id === moduloUrl);
    if (mod) navegarA(mod);
  }
}

// ─────────────────────────────────────────────────────────────
// WAKE LOCK — evita que el iPad apague la pantalla
// ─────────────────────────────────────────────────────────────
function _initWakeLock() {
  // Video silencioso de 1px como fallback para Safari que no soporta WakeLock API
  const video = document.createElement('video');
  video.loop = true; video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.style.cssText =
    'position:fixed;width:1px;height:1px;top:0;left:0;opacity:0.01;pointer-events:none;z-index:-1;';
  video.src = 'data:video/mp4;base64,' +
    'AAAAHGZ0eXBpc29tAAACAGlzb21pc28yYXZjMQAAAAhmcmVlAAAAG21kYXQAAAGzABAHAAABthAd' +
    'AT8LkAAA9oAAAIUGl2aXNhAAAHAm1vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAPoAAEAAAEB' +
    'AAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAA' +
    'AAABAAAABnN0dHMAAAAAAAAAAQAAAAEAAAAUAAAAFHN0c3MAAAAAAAAAAQAAAAEAAAAcc3RzYwAAAAAA' +
    'AAABAAAABAAAAAEAAAABAAAAHHN0c3oAAAAAAAACMgAAAAEAAAAUAAAAFHN0Y28AAAAAAAAAAQAAADAA' +
    'AAABdHJhawAAAFx0a2hkAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AQAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAFAAAACAAAAAAAAAAB4bWRpYQAAACBtZGhk' +
    'AAAAAAAAAAAAAAAAAAB9AAAB9AAVxAAAAAAAI2hkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABW' +
    'aWRlb0hhbmRsZXIAAAABD21pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYA' +
    'AAAAAAAAAQAAAAx1cmwgAAAAAQAAAM9zdGJsAAAAa3N0c2QAAAAAAAAAAQAAAFthdmMxAAAAAAAA' +
    'AAABABAAAAAAAAAAAAAB9AAB9AABAAABAAHgQAEABl//gdLCmgAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAP//AAAB9AAAB9AQAAAAAEAAAABAAAABAAAABIAAAAUAAAAFAAAABAAAABIc3R0' +
    'cwAAAAAAAAABAAAABAAAAAEAAAAUc3RzYwAAAAAAAAABAAAABAAAAAEAAAABAAAAHHN0c3oAAAAAAAA' +
    'AMgAAAAEAAAAUAAAAFAAAABRzdGNvAAAAAAAAAAEAAAAwAAAAYXVkdGEAAABZbWV0YQAAAAAAAAAh' +
    'aGRscgAAAAAAAAAABG1kaXJhcHBsAAAAAAAAAAAAAAAALWlsc3QAAAAlqXRvbwAAAB1kYXRhAAAA' +
    'AQAAAABMYXZM';
  document.body.appendChild(video);

  let _wakeLock = null;

  async function _activar() {
    if ('wakeLock' in navigator) {
      try {
        if (_wakeLock) return;
        _wakeLock = await navigator.wakeLock.request('screen');
        _wakeLock.addEventListener('release', () => {
          _wakeLock = null;
          if (document.visibilityState === 'visible') _activar();
        });
        return;
      } catch { }
    }
    // Fallback: video silencioso
    if (video.paused) {
      try { await video.play(); } catch (e) { console.warn('[WakeLock] fallback falló:', e); }
    }
  }

  // Activar tras primer gesto (iOS requiere interacción)
  ['touchstart', 'touchend', 'click', 'pointerdown'].forEach(ev => {
    document.addEventListener(ev, function _u() {
      _activar();
      document.removeEventListener(ev, _u);
    }, { passive: true });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { _wakeLock = null; _activar(); }
    else if (!video.paused) video.pause();
  });

  // Heartbeat al SW cada 4 min
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      navigator.serviceWorker?.controller?.postMessage({ tipo: 'heartbeat' });
    }
  }, 4 * 60 * 1000);
}

// ─────────────────────────────────────────────────────────────
// MICRÓFONO — solicitar permiso al arranque (una sola vez)
// Safari recuerda la decisión para el origen permanentemente.
// ─────────────────────────────────────────────────────────────
function _solicitarMicrofono() {
  if (!navigator.mediaDevices?.getUserMedia) return;
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => stream.getTracks().forEach(t => t.stop()))
    .catch(e => console.warn('[Mic] permiso no concedido:', e.message));
}