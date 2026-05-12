/* Dotir 2 - core/audio.js
   AudioManager: singleton para musica
   VideoManager: singleton para video persistente entre secciones
   MediaStop:    boton global fijo en header que detiene ambos
*/

// ── VideoManager ──────────────────────────────────────────────
const VideoManager = (() => {
  let _video     = null;
  let _idx       = -1;
  let _onEndedCb = null;

  function _init() {
    if (_video) return;
    _video = document.createElement('video');
    _video.playsInline = true;
    _video.setAttribute('playsinline', '');
    _video.preload    = 'none';
    _video.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;' +
      'object-fit:contain;display:none;pointer-events:none;';
  }

  return {
    get video() { return _video; },
    get idx()   { return _idx; },
    get playing() { return _video && !_video.paused && _video.src; },

    init() { _init(); },

    montarEn(contenedor) {
      _init();
      if (_video.parentElement !== contenedor) {
        contenedor.appendChild(_video);
      }
      _video.style.display = 'block';
    },

    play(idx, src) {
      _init();
      _idx = idx;
      if (_video.src !== src) {
        _video.src = src;
        _video.load();
      }
      _video.play().catch(e => console.warn('[Video] play:', e));
      _video.onended = () => { if (_onEndedCb) _onEndedCb(idx); };
      MediaStop._actualizar();
    },

    stop() {
      if (!_video) return;
      _video.pause();
      _video.removeAttribute('src');
      _video.load();
      _idx = -1;
      MediaStop._actualizar();
    },

    ocultar() {
      if (_video) _video.style.display = 'none';
    },

    mostrar() {
      if (_video && _video.src) _video.style.display = 'block';
    },

    onEnded(cb) { _onEndedCb = cb; },
  };
})();

// ── AudioManager ──────────────────────────────────────────────
const AudioManager = (() => {
  let _audio    = null;
  let _actx     = null;
  let _analyser = null;
  let _source   = null;
  let _idx      = -1;
  let _canciones  = [];
  let _onPlayCbs  = [];
  let _onStopCbs  = [];

  function _init() {
    if (_audio) return;
    _audio = new Audio();
    _audio.crossOrigin = 'anonymous';
    _audio.addEventListener('ended', _notificar);
    _audio.addEventListener('play',  _notificar);
    _audio.addEventListener('pause', _notificar);
    try {
      _actx     = new (window.AudioContext || window.webkitAudioContext)();
      _analyser = _actx.createAnalyser();
      _analyser.fftSize = 512;
      _analyser.smoothingTimeConstant = 0.82;
      _source   = _actx.createMediaElementSource(_audio);
      _source.connect(_analyser);
      _analyser.connect(_actx.destination);
    } catch (e) {
      console.warn('[Audio]', e);
    }
  }

  function _notificar() {
    const playing = _audio && !_audio.paused;
    if (playing)  _onPlayCbs.forEach(cb => cb(_idx, _canciones[_idx]));
    if (!playing) _onStopCbs.forEach(cb => cb());
    MediaStop._actualizar();
  }

  function _resumeCtx() {
    if (_actx && _actx.state === 'suspended') _actx.resume();
  }

  return {
    get audio()    { return _audio; },
    get analyser() { return _analyser; },
    get idx()      { return _idx; },
    get canciones(){ return _canciones; },
    get playing()  { return _audio && !_audio.paused; },

    setCanciones(list) { _canciones = list; },

    play(idx, srcUrl) {
      _init();
      _resumeCtx();
      // Detener video si estaba reproduciendose
      if (VideoManager.playing) VideoManager.stop();
      _idx = idx;
      if (_audio.src !== srcUrl) {
        _audio.src = srcUrl;
      } else {
        _audio.currentTime = 0;
      }
      _audio.play().catch(e => console.warn('[Audio] play:', e));
    },

    stop() {
      if (_audio) { _audio.pause(); _audio.currentTime = 0; }
      _notificar();
    },

    onPlay(cb)  { if (!_onPlayCbs.includes(cb))  _onPlayCbs.push(cb); },
    onStop(cb)  { if (!_onStopCbs.includes(cb))  _onStopCbs.push(cb); },
    offPlay(cb) { _onPlayCbs = _onPlayCbs.filter(f => f !== cb); },
    offStop(cb) { _onStopCbs = _onStopCbs.filter(f => f !== cb); },
  };
})();

// ── MediaStop — boton global fijo ────────────────────────────
const MediaStop = {
  _btn: null,
  _montado: false,

  montar() {
    if (this._montado) return;
    this._montado = true;

    const nav = document.getElementById('header-derecha');
    if (!nav) return;

    const btn = document.createElement('button');
    btn.id    = 'media-stop-btn';
    btn.title = 'Detener reproduccion';
    btn.style.cssText =
      'display:flex;align-items:center;justify-content:center;' +
      'width:32px;height:32px;border-radius:50%;border:none;' +
      'background:rgba(239,68,68,0.20);' +
      'cursor:pointer;transition:background .15s, transform .12s;' +
      'flex-shrink:0;margin-right:15px;'
    btn.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 14 14" fill="none">' +
      '<rect x="2" y="2" width="10" height="10" rx="2" fill="white" fill-opacity="0.9"/>' +
      '</svg>';
    btn.addEventListener('click', () => {
      AudioManager.stop();
      VideoManager.stop();
    });
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(239,68,68,0.55)';
    });
    btn.addEventListener('mouseleave', () => {
      this._actualizar();
    });

    // Insertar ANTES del indicador offline para que quede a su izquierda
    nav.insertBefore(btn, nav.firstChild);
    this._btn = btn;
    this._actualizar();
  },

  _actualizar() {
    if (!this._btn) return;
    const hayMedia = AudioManager.playing || VideoManager.playing;
    this._btn.style.background = hayMedia
      ? 'rgba(239,68,68,0.75)'
      : 'rgba(255,255,255,0.08)';
    this._btn.style.opacity = hayMedia ? '1' : '0.45';
  },
};

export { VideoManager, MediaStop };
export default AudioManager;
