// shared.js — TTS, utilidades comunes
// Sin JSX. Todo React.createElement puro.
// Exporta al window para uso cross-script.

'use strict';

// ─── TTS hook ─────────────────────────────────────────────────────────────────
// Uso:
//   const tts = useTTS();
//   tts.configure({ volume: 0.9, rate: 0.85, voice: 'es-MX', muted: false });
//   tts.speak('hola');
//   tts.speak('hello', { lang: 'en-US' });
function useTTS() {
  const ref = React.useRef({ volume: 1, rate: 0.85, voice: 'es-MX', muted: false });

  const configure = React.useCallback((cfg) => {
    ref.current = { ...ref.current, ...cfg };
  }, []);

  const speak = React.useCallback((text, opts = {}) => {
    if (!window.speechSynthesis) return;
    const { volume, rate, voice, muted } = ref.current;
    if (muted || volume <= 0) return;
    try {
      window.speechSynthesis.cancel();
      const u     = new SpeechSynthesisUtterance(text);
      u.lang      = opts.lang  ?? voice ?? 'es-MX';
      u.rate      = opts.rate  ?? rate;
      u.pitch     = opts.pitch ?? 1.05;
      u.volume    = volume;
      window.speechSynthesis.speak(u);
    } catch { /* noop */ }
  }, []);

  return { speak, configure };
}

// ─── Exports ──────────────────────────────────────────────────────────────────
Object.assign(window, { useTTS });
