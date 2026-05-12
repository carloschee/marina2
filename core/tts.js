/* ============================================================
   Dótir 2 — core/tts.js
   Motor de síntesis de voz compartido por todos los módulos.
   · Desbloqueo automático en iOS (requiere gesto del usuario)
   · Caché de voces por idioma
   · Cola de utterances para evitar solapamiento
   · API pública: TTS.speak(texto, { lang, pitch, rate, delay })
                  TTS.stop()
                  TTS.getLangs() → idiomas disponibles
   ============================================================ */

export const TTS = (() => {
  const synth = window.speechSynthesis;
  if (!synth) return _stub();

  // ── Estado interno ────────────────────────────────────────
  let _voiceMap    = {};   // lang → SpeechSynthesisVoice
  let _desbloqueado = false;
  let _muteTTS     = false;

  // ── Cargar voces (asíncrono en Chrome) ───────────────────
  const _cargarVoces = () => {
    const voces = synth.getVoices();
    if (!voces.length) return;

    // Palabras clave que identifican voces de alta calidad
    const KEYWORDS_PREMIUM = [
      'premium', 'enhanced', 'neural', 'natural',
      'samantha', 'karen', 'daniel', 'moira',   // iOS en-US / en-AU / en-GB / en-IE
      'alex',                                    // macOS
      'google',                                  // Chrome/Android Google TTS
      'microsoft',                               // Edge/Windows
    ];

    // Calcula un score: mayor = mejor calidad
    const _score = (v) => {
      let s = 0;
      const name = v.name.toLowerCase();
      KEYWORDS_PREMIUM.forEach(kw => { if (name.includes(kw)) s += 10; });
      // Voces de red suelen ser más naturales en móviles
      if (!v.localService) s += 5;
      // En desktop las voces locales premium son mejores
      if (v.localService && KEYWORDS_PREMIUM.some(kw => name.includes(kw))) s += 8;
      return s;
    };

    // Agrupar por lang y quedarse con la de mayor score
    const mejores = {};
    voces.forEach(v => {
      const score = _score(v);
      if (!mejores[v.lang] || score > mejores[v.lang].score) {
        mejores[v.lang] = { voz: v, score };
      }
    });

    _voiceMap = {};
    Object.entries(mejores).forEach(([lang, { voz }]) => {
      _voiceMap[lang] = voz;
    });
  };

  _cargarVoces();
  synth.onvoiceschanged = _cargarVoces;

  // ── Desbloqueo iOS (utterance silenciosa en primer gesto) ─
  const _desbloquear = () => {
    if (_desbloqueado) return;
    _desbloqueado = true;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      u.rate   = 10;
      synth.speak(u);
    } catch (_) {}
  };

  ['touchstart', 'pointerdown'].forEach(ev =>
    document.addEventListener(ev, _desbloquear, { once: true, passive: true })
  );

  // ── Buscar voz para un locale ─────────────────────────────
  const _vozPara = (lang) => {
    if (_voiceMap[lang]) return _voiceMap[lang];
    // Fallback: mismo idioma con distinta región
    const base = lang.slice(0, 2);
    const candidatas = Object.entries(_voiceMap)
      .filter(([l]) => l.startsWith(base))
      .map(([, v]) => v);
    return candidatas[0] || null;
  };

  // ── API pública ───────────────────────────────────────────
  return {
    /**
     * Pronuncia un texto.
     * @param {string} texto
     * @param {{ lang?: string, pitch?: number, rate?: number,
     *           volume?: number, delay?: number }} opts
     */
    speak(texto, opts = {}) {
      if (!texto || _muteTTS) return;

      const {
        lang   = 'es-MX',
        pitch  = 1.2,
        rate   = 0.92,
        volume = 1,
        delay  = 0,
      } = opts;

      const _do = () => {
        synth.cancel(); // detener lo que haya en curso
        try {
          const u    = new SpeechSynthesisUtterance(texto);
          u.lang     = lang;
          u.pitch    = pitch;
          u.rate     = rate;
          u.volume   = volume;
          const voz  = _vozPara(lang);
          if (voz) u.voice = voz;
          u.onerror  = ev => console.debug('[TTS] error:', ev.error);
          synth.speak(u);
        } catch (e) {
          console.debug('[TTS] excepción:', e);
        }
      };

      delay > 0 ? setTimeout(_do, delay) : _do();
    },

    /** Detiene la síntesis en curso. */
    stop() {
      synth.cancel();
    },

    /** Silenciar / reactivar TTS globalmente. */
    setMute(val) {
      _muteTTS = !!val;
      if (_muteTTS) synth.cancel();
    },

    get muted() { return _muteTTS; },

    /**
     * Devuelve los idiomas disponibles en el dispositivo.
     * @returns {string[]}
     */
    getLangs() {
      _cargarVoces();
      return Object.keys(_voiceMap);
    },

    /**
     * Devuelve la mejor voz para un idioma (o null).
     * @param {string} lang
     */
    getVoice(lang) { return _vozPara(lang); },
  };

  // ── Stub cuando la API no existe ─────────────────────────
  function _stub() {
    console.warn('[TTS] SpeechSynthesis no disponible en este dispositivo.');
    return {
      speak()   {},
      stop()    {},
      setMute() {},
      muted:     false,
      getLangs() { return []; },
      getVoice() { return null; },
    };
  }
})();
