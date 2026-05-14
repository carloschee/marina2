/* core/perfiles.js
   Gestión de perfiles de usuario.
   Las keys de localStorage usan el prefijo definido en app.config.json → storage.prefijo
   para que múltiples apps no compartan datos.

   API pública:
     Perfiles.listar()              → array de perfiles
     Perfiles.getActivo()           → perfil activo
     Perfiles.activar(id)           → cambia perfil activo
     Perfiles.crear(datos)          → crea perfil, retorna perfil
     Perfiles.actualizar(id, datos) → actualiza perfil
     Perfiles.eliminar(id)          → elimina perfil (no el invitado)
     Perfiles.getFavs()             → Set de ids favoritos del perfil activo
     Perfiles.setFavs(set)          → guarda favoritos en perfil activo
     Perfiles.exportar(id)          → descarga JSON del perfil
     Perfiles.onChange(cb)          → suscribirse a cambios
     Perfiles.offChange(cb)         → desuscribirse
*/

import { cfg } from './config.js';

// Keys de LS — se calculan en el primer acceso (después de cargarConfig)
const _lsKey  = sufijo => `${cfg('storage.prefijo', 'app')}-${sufijo}`;

const ID_INVITADO = 'invitado';

// ── Utilidades internas ────────────────────────────────────────
function _uuid() {
  return 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

function _cargar() {
  try {
    const raw = localStorage.getItem(_lsKey('perfiles'));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function _guardar(perfiles) {
  localStorage.setItem(_lsKey('perfiles'), JSON.stringify(perfiles));
}

function _perfilInvitado() {
  return {
    id: ID_INVITADO,
    apodo: 'Invitado',
    avatar: '👤',
    avatarFoto: null,
    fechaNacimiento: null,
    notas: '',
    favs: [],
    creadoEn: 0,
    esInvitado: true,
    modulosHabilitados: null,
  };
}

function _asegurarInvitado(perfiles) {
  if (!perfiles.find(p => p.id === ID_INVITADO)) {
    perfiles.push(_perfilInvitado());
    _guardar(perfiles);
  }
  return perfiles;
}

// ── Estado interno ─────────────────────────────────────────────
let _perfiles  = _asegurarInvitado(_cargar());
let _activoId  = localStorage.getItem(_lsKey('perfil-activo')) || ID_INVITADO;
let _listeners = [];

if (!_perfiles.find(p => p.id === _activoId)) {
  _activoId = ID_INVITADO;
  localStorage.setItem(_lsKey('perfil-activo'), ID_INVITADO);
}

function _notificar() {
  _listeners.forEach(cb => { try { cb(); } catch { } });
}

// ── API pública ────────────────────────────────────────────────
export const Perfiles = {

  listar() {
    const sin = _perfiles.filter(p => p.id !== ID_INVITADO);
    const inv = _perfiles.find(p => p.id === ID_INVITADO);
    return [...sin, inv].filter(Boolean);
  },

  getActivo() {
    return _perfiles.find(p => p.id === _activoId) || _perfilInvitado();
  },

  activar(id) {
    const perfil = _perfiles.find(p => p.id === id);
    if (!perfil) return false;
    _activoId = id;
    localStorage.setItem(_lsKey('perfil-activo'), id);
    _notificar();
    return true;
  },

  crear(datos) {
    if (!datos.apodo?.trim()) throw new Error('El apodo es requerido');
    const perfil = {
      id: _uuid(),
      apodo: datos.apodo.trim(),
      avatar: datos.avatar || '🧑',
      avatarFoto: datos.avatarFoto || null,
      fechaNacimiento: datos.fechaNacimiento || null,
      notas: datos.notas || '',
      favs: [],
      creadoEn: Date.now(),
      esInvitado: false,
      modulosHabilitados: datos.modulosHabilitados || null,
    };
    _perfiles.push(perfil);
    _guardar(_perfiles);
    _notificar();
    return perfil;
  },

  actualizar(id, datos) {
    const idx = _perfiles.findIndex(p => p.id === id);
    if (idx === -1) return false;
    const p = _perfiles[idx];
    if (datos.apodo !== undefined)          p.apodo = datos.apodo.trim();
    if (datos.avatar !== undefined)         p.avatar = datos.avatar;
    if (datos.avatarFoto !== undefined)     p.avatarFoto = datos.avatarFoto;
    if (datos.fechaNacimiento !== undefined) p.fechaNacimiento = datos.fechaNacimiento;
    if (datos.notas !== undefined)          p.notas = datos.notas;
    _guardar(_perfiles);
    _notificar();
    return true;
  },

  eliminar(id) {
    if (id === ID_INVITADO) return false;
    _perfiles = _perfiles.filter(p => p.id !== id);
    _guardar(_perfiles);
    if (_activoId === id) {
      _activoId = ID_INVITADO;
      localStorage.setItem(_lsKey('perfil-activo'), ID_INVITADO);
    }
    _notificar();
    return true;
  },

  getFavs() {
    return new Set(this.getActivo().favs || []);
  },

  setFavs(set) {
    const idx = _perfiles.findIndex(p => p.id === _activoId);
    if (idx === -1) return;
    _perfiles[idx].favs = [...set];
    _guardar(_perfiles);
  },

  exportar(id) {
    const perfil = _perfiles.find(p => p.id === id);
    if (!perfil) return;
    const appId = cfg('app.id', 'app');
    const payload = {
      apodo: perfil.apodo, avatar: perfil.avatar, avatarFoto: perfil.avatarFoto,
      fechaNacimiento: perfil.fechaNacimiento, notas: perfil.notas,
      favs: perfil.favs, creadoEn: perfil.creadoEn,
      exportadoEn: new Date().toISOString(),
      version: `${appId}-perfil-v1`,
    };
    const blob   = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url    = URL.createObjectURL(blob);
    const fecha  = new Date().toISOString().slice(0, 10);
    const nombre = `${appId}-${perfil.apodo.toLowerCase().replace(/\s+/g, '-')}-${fecha}.json`;
    const a      = Object.assign(document.createElement('a'), { href: url, download: nombre });
    a.click();
    URL.revokeObjectURL(url);
  },

  onChange(cb)  { if (!_listeners.includes(cb)) _listeners.push(cb); },
  offChange(cb) { _listeners = _listeners.filter(f => f !== cb); },

  calcularEdad(fechaNacimiento) {
    if (!fechaNacimiento) return null;
    const hoy = new Date(), nac = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nac.getFullYear();
    const diff = hoy.getMonth() - nac.getMonth();
    if (diff < 0 || (diff === 0 && hoy.getDate() < nac.getDate())) edad--;
    return edad >= 0 ? edad : null;
  },

  tienePerfiles() {
    return _perfiles.filter(p => p.id !== ID_INVITADO).length > 0;
  },

  getModulosHabilitados() {
    return this.getActivo().modulosHabilitados || null;
  },

  setModulosHabilitados(ids) {
    const idx = _perfiles.findIndex(p => p.id === _activoId);
    if (idx === -1) return;
    _perfiles[idx].modulosHabilitados = ids;
    _guardar(_perfiles);
    _notificar();
  },

  get activoId()   { return _activoId; },
  get idInvitado() { return ID_INVITADO; },
};