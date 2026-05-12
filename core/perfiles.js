/* Dotir 2 - core/perfiles.js
   Gestión de perfiles de usuario.
   API pública:
     Perfiles.listar()           -> array de perfiles
     Perfiles.getActivo()        -> perfil activo
     Perfiles.activar(id)        -> cambia perfil activo
     Perfiles.crear(datos)       -> crea perfil, retorna perfil
     Perfiles.actualizar(id, datos) -> actualiza perfil
     Perfiles.eliminar(id)       -> elimina perfil (no el invitado)
     Perfiles.getFavs()          -> Set de ids favoritos del perfil activo
     Perfiles.setFavs(set)       -> guarda favoritos en perfil activo
     Perfiles.exportar(id)       -> descarga JSON del perfil
     Perfiles.onChange(cb)       -> suscribirse a cambios
     Perfiles.offChange(cb)      -> desuscribirse
*/

const LS_PERFILES = 'dotir2-perfiles';
const LS_ACTIVO = 'dotir2-perfil-activo';
const ID_INVITADO = 'invitado';

// -- Utilidades internas ---

function _uuid() {
  return 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

function _cargar() {
  try {
    const raw = localStorage.getItem(LS_PERFILES);
    return raw ? JSON.parse(raw) : [];
  } catch (_) { return []; }
}

function _guardar(perfiles) {
  localStorage.setItem(LS_PERFILES, JSON.stringify(perfiles));
}

function _perfilInvitado() {
  return {
    id: ID_INVITADO,
    apodo: 'Invitado',
    avatar: '\u{1F468}',
    avatarFoto: null,
    fechaNacimiento: null,
    notas: '',
    favs: [],
    creadoEn: 0,
    esInvitado: true,
    modulosHabilitados: null,  // null = todos habilitados
  };
}

function _asegurarInvitado(perfiles) {
  if (!perfiles.find(p => p.id === ID_INVITADO)) {
    perfiles.push(_perfilInvitado());
    _guardar(perfiles);
  }
  return perfiles;
}

// -- Estado interno ---

let _perfiles = _asegurarInvitado(_cargar());
let _activoId = localStorage.getItem(LS_ACTIVO) || ID_INVITADO;
let _listeners = [];

// Si el id guardado ya no existe, caer al invitado
if (!_perfiles.find(p => p.id === _activoId)) {
  _activoId = ID_INVITADO;
  localStorage.setItem(LS_ACTIVO, ID_INVITADO);
}

function _notificar() {
  _listeners.forEach(cb => { try { cb(); } catch (_) { } });
}

// -- API pública ---

export const Perfiles = {

  // Retorna copia del array de perfiles (invitado siempre al final)
  listar() {
    const sin = _perfiles.filter(p => p.id !== ID_INVITADO);
    const inv = _perfiles.find(p => p.id === ID_INVITADO);
    return [...sin, inv].filter(Boolean);
  },

  // Retorna el perfil activo
  getActivo() {
    return _perfiles.find(p => p.id === _activoId) || _perfilInvitado();
  },

  // Cambia el perfil activo
  activar(id) {
    const perfil = _perfiles.find(p => p.id === id);
    if (!perfil) return false;
    _activoId = id;
    localStorage.setItem(LS_ACTIVO, id);
    _notificar();
    return true;
  },

  // Crea un nuevo perfil
  // datos: { apodo, avatar, avatarFoto, fechaNacimiento, notas }
  crear(datos) {
    if (!datos.apodo?.trim()) throw new Error('El apodo es requerido');
    const perfil = {
      id: _uuid(),
      apodo: datos.apodo.trim(),
      avatar: datos.avatar || '\u{1F9D1}',
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

  // Actualiza campos de un perfil existente
  actualizar(id, datos) {
    const idx = _perfiles.findIndex(p => p.id === id);
    if (idx === -1) return false;
    const p = _perfiles[idx];
    if (datos.apodo !== undefined) p.apodo = datos.apodo.trim();
    if (datos.avatar !== undefined) p.avatar = datos.avatar;
    if (datos.avatarFoto !== undefined) p.avatarFoto = datos.avatarFoto;
    if (datos.fechaNacimiento !== undefined) p.fechaNacimiento = datos.fechaNacimiento;
    if (datos.notas !== undefined) p.notas = datos.notas;
    _guardar(_perfiles);
    _notificar();
    return true;
  },

  // Elimina un perfil (el invitado no se puede eliminar)
  eliminar(id) {
    if (id === ID_INVITADO) return false;
    _perfiles = _perfiles.filter(p => p.id !== id);
    _guardar(_perfiles);
    // Si se eliminó el activo, caer al invitado
    if (_activoId === id) {
      _activoId = ID_INVITADO;
      localStorage.setItem(LS_ACTIVO, ID_INVITADO);
    }
    _notificar();
    return true;
  },

  // Retorna Set de favoritos del perfil activo
  getFavs() {
    const p = this.getActivo();
    return new Set(p.favs || []);
  },

  // Guarda favoritos en el perfil activo
  setFavs(set) {
    const idx = _perfiles.findIndex(p => p.id === _activoId);
    if (idx === -1) return;
    _perfiles[idx].favs = [...set];
    _guardar(_perfiles);
  },

  // Exporta un perfil como JSON descargable
  exportar(id) {
    const perfil = _perfiles.find(p => p.id === id);
    if (!perfil) return;
    const exportData = {
      apodo: perfil.apodo,
      avatar: perfil.avatar,
      avatarFoto: perfil.avatarFoto,
      fechaNacimiento: perfil.fechaNacimiento,
      notas: perfil.notas,
      favs: perfil.favs,
      creadoEn: perfil.creadoEn,
      exportadoEn: new Date().toISOString(),
      version: 'dotir2-perfil-v1',
    };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const fecha = new Date().toISOString().slice(0, 10);
    const nombre = 'dotir2-' + perfil.apodo.toLowerCase().replace(/\s+/g, '-') + '-' + fecha + '.json';
    const a = document.createElement('a');
    a.href = url; a.download = nombre; a.click();
    URL.revokeObjectURL(url);
  },

  // Suscribirse a cambios de perfiles
  onChange(cb) {
    if (!_listeners.includes(cb)) _listeners.push(cb);
  },

  // Desuscribirse
  offChange(cb) {
    _listeners = _listeners.filter(f => f !== cb);
  },

  // Calcula edad en años a partir de fechaNacimiento
  calcularEdad(fechaNacimiento) {
    if (!fechaNacimiento) return null;
    const hoy = new Date();
    const nac = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nac.getFullYear();
    const diff = hoy.getMonth() - nac.getMonth();
    if (diff < 0 || (diff === 0 && hoy.getDate() < nac.getDate())) edad--;
    return edad >= 0 ? edad : null;
  },

  // Retorna true si hay mas de un perfil (ademas del invitado)
  tienePerfiles() {
    return _perfiles.filter(p => p.id !== ID_INVITADO).length > 0;
  },

  get activoId() { return _activoId; },
  get idInvitado() { return ID_INVITADO; },

  getModulosHabilitados() {
    const p = this.getActivo();
    return p.modulosHabilitados || null;  // null = todos
  },

  setModulosHabilitados(ids) {
    const idx = _perfiles.findIndex(p => p.id === _activoId);
    if (idx === -1) return;
    _perfiles[idx].modulosHabilitados = ids;
    _guardar(_perfiles);
    _notificar();
  },
};