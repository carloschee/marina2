// app.js — entrada principal de Marina
// Carga marina.config.json, monta MarinaApp con navegación,
// tweaks persistidos en localStorage, área de adultos PIN-gated.
// Sin JSX. Todo React.createElement puro.

var h         = React.createElement;
var useState  = React.useState;
var useEffect = React.useEffect;
var useCallback = React.useCallback;
var useMemo   = React.useMemo;

// ─── Constantes ───────────────────────────────────────────────────────────────
var TWEAKS_KEY  = 'marina.tweaks.v1';
var PIN_KEY     = 'marina.pin.v1';
var PIN_DEFAULT = '1234';

var PALETTES = {
  warm:    { primary: '#ff6b8b', green: '#38d9a9' },
  pastel:  { primary: '#ffa3b8', green: '#7be0c2' },
  vivid:   { primary: '#ff3d6a', green: '#0fbf8c' },
  neutral: { primary: '#d97c93', green: '#7da89a' },
};

// ─── useLocalTweaks ───────────────────────────────────────────────────────────
function useLocalTweaks(defaults) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(TWEAKS_KEY);
      return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    } catch { return defaults; }
  });

  const set = useCallback((keyOrObj, value) => {
    setState((prev) => {
      const patch = typeof keyOrObj === 'string' ? { [keyOrObj]: value } : keyOrObj;
      const next  = { ...prev, ...patch };
      try { localStorage.setItem(TWEAKS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return [state, set];
}

// ─── MarinaApp ────────────────────────────────────────────────────────────────
function MarinaApp({ config }) {
  const ttsDefaults = config.tts || {};
  const tweakDefaults = {
    palette:   config.palette   || 'warm',
    density:   config.density   || 'comfy',
    ttsVolume: ttsDefaults.volume ?? 0.9,
    ttsRate:   ttsDefaults.rate   ?? 0.85,
    ttsMuted:  ttsDefaults.muted  ?? false,
    ttsLang:   ttsDefaults.lang   || 'es-MX',
  };

  const [t, setTweak] = useLocalTweaks(tweakDefaults);
  const [screen, setScreen] = useState('home');
  const tts = useTTS();

  // Sincronizar TTS con tweaks
  useEffect(() => {
    tts.configure({
      volume: t.ttsMuted ? 0 : t.ttsVolume,
      rate:   t.ttsRate,
      voice:  t.ttsLang,
      muted:  t.ttsMuted,
    });
  }, [t.ttsMuted, t.ttsVolume, t.ttsRate, t.ttsLang]);

  // Navegación: home + módulos registrados
  const modules   = window.MARINA_MODULES || [];
  const modScreens = Object.fromEntries(modules.map((m) => [m.id, m.component]));

  const CurrentScreen = screen === 'home'
    ? (props) => h(HomeScreen, { ...props, config })
    : modScreens[screen] || ((props) => h(HomeScreen, { ...props, config }));

  // Área de adultos — gesto 5 toques esquina inferior derecha
  const [tapCount, setTapCount]   = useState(0);
  const [areaState, setAreaState] = useState(null); // null | 'pin' | 'open'
  const [pinInput, setPinInput]   = useState('');
  const [pinError, setPinError]   = useState(false);

  const parentPin = useMemo(() => {
    try { return localStorage.getItem(PIN_KEY) || PIN_DEFAULT; } catch { return PIN_DEFAULT; }
  }, [areaState]);

  useEffect(() => {
    if (tapCount >= 5) { setAreaState('pin'); setTapCount(0); }
    if (tapCount > 0) {
      const timer = setTimeout(() => setTapCount(0), 1500);
      return () => clearTimeout(timer);
    }
  }, [tapCount]);

  const checkPin = () => {
    if (pinInput === parentPin) { setAreaState('open'); setPinInput(''); }
    else setPinError(true);
  };

  return h('div', { className: 'marina-stage' },

    // Pantalla activa
    h(CurrentScreen, {
      onNavigate: setScreen,
      density:    t.density,
      speak:      tts.speak,
    }),

    // Trigger oculto — esquina inferior derecha
    h('button', {
      onClick:      () => setTapCount((c) => c + 1),
      'aria-label': 'área de adultos',
      style: {
        position: 'absolute', right: 0, bottom: 0,
        width: 56, height: 56,
        background: 'transparent', border: 'none',
        cursor: 'default', opacity: 0,
      },
    }),

    // Modal PIN
    areaState === 'pin' && h(PinModal, {
      pinInput, pinError,
      onInput:  (v) => { setPinInput(v); setPinError(false); },
      onSubmit: checkPin,
      onCancel: () => { setAreaState(null); setPinInput(''); setPinError(false); },
    }),

    // Panel de ajustes
    areaState === 'open' && h(AjustesPanel, {
      t, setTweak,
      onClose: () => setAreaState(null),
      pinKey:  PIN_KEY,
    })
  );
}

// ─── PinModal ─────────────────────────────────────────────────────────────────
function PinModal({ pinInput, pinError, onInput, onSubmit, onCancel }) {
  return h('div', {
    style: {
      position: 'absolute', inset: 0,
      background: 'rgba(3,22,28,0.86)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10000,
    },
  },
    h('div', {
      style: {
        background: '#0e3a48', padding: 36, borderRadius: 28,
        boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
        fontFamily: '"Lexend",system-ui,sans-serif', color: '#f7f1e3',
        minWidth: 340, textAlign: 'center',
      },
    },
      h('div', { style: { fontFamily: '"Outfit",sans-serif', fontWeight: 800, fontSize: 28, marginBottom: 6 } },
        'Área de adultos'),
      h('div', { style: { opacity: 0.65, fontSize: 14, marginBottom: 22 } },
        'Ingresa el PIN para abrir ajustes'),
      h('input', {
        type: 'password', inputMode: 'numeric', pattern: '[0-9]*',
        autoFocus: true, value: pinInput,
        onChange: (e) => onInput(e.target.value),
        onKeyDown: (e) => { if (e.key === 'Enter') onSubmit(); },
        style: {
          width: '100%', padding: '14px 16px', borderRadius: 14,
          border: pinError ? '2px solid #ff6b8b' : '2px solid rgba(255,255,255,0.12)',
          background: 'rgba(0,0,0,0.25)', color: '#f7f1e3',
          fontSize: 22, fontFamily: 'inherit', textAlign: 'center',
          letterSpacing: 8, marginBottom: 16, boxSizing: 'border-box',
        },
      }),
      h('div', { style: { display: 'flex', gap: 10 } },
        h('button', {
          onClick: onCancel,
          style: {
            flex: 1, padding: '12px 18px', borderRadius: 99,
            border: 'none', cursor: 'pointer',
            background: 'rgba(255,255,255,0.08)', color: '#f7f1e3',
            fontFamily: 'inherit', fontWeight: 600, fontSize: 15,
          },
        }, 'cancelar'),
        h('button', {
          onClick: onSubmit,
          style: {
            flex: 1, padding: '12px 18px', borderRadius: 99,
            border: 'none', cursor: 'pointer',
            background: '#38d9a9', color: '#0a1f27',
            fontFamily: 'inherit', fontWeight: 700, fontSize: 15,
          },
        }, 'abrir')
      ),
      pinError && h('div', { style: { marginTop: 12, color: '#ff6b8b', fontSize: 13 } }, 'PIN incorrecto')
    )
  );
}

// ─── AjustesPanel ─────────────────────────────────────────────────────────────
function AjustesPanel({ t, setTweak, onClose, pinKey }) {
  const [newPin, setNewPin] = useState('');
  const [pinMsg, setPinMsg] = useState('');

  const savePin = () => {
    if (!/^\d{4,8}$/.test(newPin)) { setPinMsg('El PIN debe tener 4–8 dígitos'); return; }
    try { localStorage.setItem(pinKey, newPin); } catch {}
    setNewPin(''); setPinMsg('PIN guardado ✓');
    setTimeout(() => setPinMsg(''), 2000);
  };

  const Toggle = ({ value, onChange }) =>
    h('button', {
      onClick: () => onChange(!value),
      role: 'switch', 'aria-checked': value,
      style: {
        width: 44, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer',
        background: value ? '#38d9a9' : 'rgba(255,255,255,0.15)',
        position: 'relative', flexShrink: 0, transition: 'background .2s',
      },
    },
      h('i', { style: {
        position: 'absolute', top: 3, left: value ? 23 : 3,
        width: 18, height: 18, borderRadius: 99,
        background: '#fff', transition: 'left .2s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }})
    );

  const Seg = ({ value, options, onChange }) =>
    h('div', {
      style: {
        display: 'flex', gap: 4,
        background: 'rgba(255,255,255,0.07)',
        borderRadius: 99, padding: 3,
      },
    }, options.map((o) =>
      h('button', {
        key: o, onClick: () => onChange(o),
        style: {
          padding: '6px 14px', borderRadius: 99, border: 'none', cursor: 'pointer',
          background: value === o ? '#38d9a9' : 'transparent',
          color: value === o ? '#0a1f27' : '#f7f1e3',
          fontFamily: 'inherit', fontWeight: 600, fontSize: 13,
        },
      }, o)
    ));

  const Row = ({ label, children }) =>
    h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 } },
      h('span', { style: { fontWeight: 500, fontSize: 15 } }, label),
      children
    );

  const Section = ({ label }) =>
    h('div', {
      style: {
        fontWeight: 700, fontSize: 11, letterSpacing: 3,
        textTransform: 'uppercase', color: 'rgba(247,241,227,0.45)',
        margin: '24px 0 10px',
      },
    }, label);

  return h('div', {
    style: {
      position: 'absolute', inset: 0,
      background: 'rgba(3,22,28,0.9)', backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10001,
    },
  },
    h('div', {
      style: {
        background: '#0e3a48', borderRadius: 28,
        boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
        fontFamily: '"Lexend",system-ui,sans-serif', color: '#f7f1e3',
        width: 480, maxHeight: '88%', overflowY: 'auto',
        padding: 36,
      },
    },
      // Cabecera
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 } },
        h('div', { style: { fontFamily: '"Outfit",sans-serif', fontWeight: 800, fontSize: 26 } }, 'Ajustes'),
        h('button', {
          onClick: onClose,
          style: {
            background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer',
            borderRadius: 99, color: '#f7f1e3', fontFamily: 'inherit',
            fontWeight: 700, fontSize: 22, padding: '4px 12px',
          },
        }, '×')
      ),

      // Apariencia
      h(Section, { label: 'Apariencia' }),
      h(Row, { label: 'Paleta' },
        h(Seg, { value: t.palette, options: ['warm','pastel','vivid','neutral'], onChange: (v) => setTweak('palette', v) })
      ),
      h(Row, { label: 'Densidad' },
        h(Seg, { value: t.density, options: ['compact','comfy'], onChange: (v) => setTweak('density', v) })
      ),

      // Voz
      h(Section, { label: 'Voz (TTS)' }),
      h(Row, { label: 'Silenciar voz' },
        h(Toggle, { value: t.ttsMuted, onChange: (v) => setTweak('ttsMuted', v) })
      ),
      h('div', { style: { marginBottom: 10 } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 } },
          h('span', { style: { fontWeight: 500, fontSize: 15 } }, 'Volumen'),
          h('span', { style: { opacity: 0.5, fontSize: 13 } }, `${Math.round(t.ttsVolume * 100)}%`)
        ),
        h('input', {
          type: 'range', min: 0, max: 1, step: 0.05, value: t.ttsVolume,
          onChange: (e) => setTweak('ttsVolume', +e.target.value),
          style: { width: '100%', accentColor: '#38d9a9' },
        })
      ),
      h('div', { style: { marginBottom: 10 } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 } },
          h('span', { style: { fontWeight: 500, fontSize: 15 } }, 'Velocidad'),
          h('span', { style: { opacity: 0.5, fontSize: 13 } }, `${t.ttsRate}×`)
        ),
        h('input', {
          type: 'range', min: 0.5, max: 1.4, step: 0.05, value: t.ttsRate,
          onChange: (e) => setTweak('ttsRate', +e.target.value),
          style: { width: '100%', accentColor: '#38d9a9' },
        })
      ),
      h(Row, { label: 'Idioma TTS' },
        h(Seg, { value: t.ttsLang, options: ['es-MX','es-ES','en-US'], onChange: (v) => setTweak('ttsLang', v) })
      ),

      // Seguridad
      h(Section, { label: 'Seguridad' }),
      h('div', { style: { fontSize: 13, opacity: 0.6, marginBottom: 8 } }, 'Cambiar PIN (4–8 dígitos)'),
      h('input', {
        type: 'password', inputMode: 'numeric', pattern: '[0-9]*',
        placeholder: 'nuevo PIN', value: newPin,
        onChange: (e) => { setNewPin(e.target.value); setPinMsg(''); },
        style: {
          width: '100%', padding: '10px 14px', borderRadius: 10,
          border: '1.5px solid rgba(255,255,255,0.12)',
          background: 'rgba(0,0,0,0.2)', color: '#f7f1e3',
          fontFamily: 'inherit', fontSize: 15, boxSizing: 'border-box', marginBottom: 8,
        },
      }),
      h('button', {
        onClick: savePin,
        style: {
          padding: '11px 20px', borderRadius: 99, border: 'none', cursor: 'pointer',
          background: '#38d9a9', color: '#0a1f27',
          fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
        },
      }, 'Guardar PIN'),
      pinMsg && h('div', {
        style: { marginTop: 8, fontSize: 13, color: pinMsg.includes('✓') ? '#38d9a9' : '#ff6b8b' },
      }, pinMsg)
    )
  );
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
function bootMarina() {
  var MAX = 6000, STEP = 50, elapsed = 0;

  function waitForGlobals(cb) {
    if (
      typeof window.useTTS      !== 'undefined' &&
      typeof window.MarinaShell !== 'undefined' &&
      typeof window.HomeScreen  !== 'undefined'
    ) return cb();
    elapsed += STEP;
    if (elapsed >= MAX) {
      console.error('[marina] globals no cargaron tras', MAX, 'ms');
      return cb(); // montar de todos modos con config vacío
    }
    setTimeout(function () { waitForGlobals(cb); }, STEP);
  }

  function loadConfig(cb) {
    var done = false;
    var timeout = setTimeout(function () {
      if (done) return;
      done = true;
      console.warn('[marina] fetch config timeout, usando defaults');
      cb({});
    }, 3000);

    fetch('./marina.config.json')
      .then(function (r) { return r.json(); })
      .then(function (cfg) {
        if (done) return;
        done = true;
        clearTimeout(timeout);
        cb(cfg);
      })
      .catch(function (e) {
        if (done) return;
        done = true;
        clearTimeout(timeout);
        console.warn('[marina] config no disponible, usando defaults:', e.message);
        cb({});
      });
  }

  waitForGlobals(function () {
    loadConfig(function (config) {
      ReactDOM.createRoot(document.getElementById('root')).render(
        h(MarinaApp, { config: config })
      );
    });
  });
}

bootMarina();
