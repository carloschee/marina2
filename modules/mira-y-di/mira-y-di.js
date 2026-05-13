/* modules/mira-y-di/mira-y-di.js
   Módulo "Mira y di" para Dótir 2.
   - Cintillo de letras del alfabeto (A–Z + Ñ)
   - Al tocar una letra → palabra aleatoria que empieza con esa letra
   - Pictogramas ARASAAC locales: assets/pictos/{id}.png
   - Botón "mostrar en inglés" / "mostrar en español"
   - Botón "escucha" → TTS en el idioma activo
   - Navegación ‹ › entre palabras de la letra seleccionada
*/

// ─── Vocabulario ──────────────────────────────────────────────────────────────
// { id: ARASAAC id, es: palabra ES, en: palabra EN }
// Agrega o quita entradas libremente — el módulo se adapta solo.
const VOCAB = [
  // A
  { id: 4665,  es: 'abeja',      en: 'bee'         },
  { id: 4758,  es: 'agua',       en: 'water'        },
  { id: 2582,  es: 'avión',      en: 'airplane'     },
  { id: 5524,  es: 'árbol',      en: 'tree'         },
  // B
  { id: 6326,  es: 'barco',      en: 'boat'         },
  { id: 2535,  es: 'bebé',       en: 'baby'         },
  { id: 5890,  es: 'bicicleta',  en: 'bicycle'      },
  { id: 4750,  es: 'boca',       en: 'mouth'        },
  // C
  { id: 5149,  es: 'cama',       en: 'bed'          },
  { id: 3013,  es: 'casa',       en: 'house'        },
  { id: 2583,  es: 'coche',      en: 'car'          },
  { id: 6474,  es: 'corazón',    en: 'heart'        },
  // D
  { id: 7870,  es: 'dado',       en: 'dice'         },
  { id: 5136,  es: 'delfín',     en: 'dolphin'      },
  { id: 7872,  es: 'dinosaurio', en: 'dinosaur'     },
  { id: 4752,  es: 'dientes',    en: 'teeth'        },
  // E
  { id: 5137,  es: 'elefante',   en: 'elephant'     },
  { id: 5904,  es: 'estrella',   en: 'star'         },
  { id: 4754,  es: 'escalera',   en: 'stairs'       },
  // F
  { id: 5142,  es: 'flor',       en: 'flower'       },
  { id: 7361,  es: 'fresa',      en: 'strawberry'   },
  { id: 5143,  es: 'fuego',      en: 'fire'         },
  // G
  { id: 4669,  es: 'gato',       en: 'cat'          },
  { id: 5145,  es: 'globo',      en: 'balloon'      },
  { id: 4920,  es: 'guitarra',   en: 'guitar'       },
  // H
  { id: 4671,  es: 'helado',     en: 'ice cream'    },
  { id: 5148,  es: 'hormiga',    en: 'ant'          },
  { id: 6444,  es: 'huevo',      en: 'egg'          },
  // I
  { id: 7516,  es: 'iglú',       en: 'igloo'        },
  { id: 4755,  es: 'imán',       en: 'magnet'       },
  // J
  { id: 5152,  es: 'jirafa',     en: 'giraffe'      },
  { id: 5153,  es: 'juguete',    en: 'toy'          },
  // K
  { id: 36568, es: 'kiwi',       en: 'kiwi'         },
  // L
  { id: 5156,  es: 'libro',      en: 'book'         },
  { id: 5157,  es: 'león',       en: 'lion'         },
  { id: 4756,  es: 'luna',       en: 'moon'         },
  // M
  { id: 5159,  es: 'mariposa',   en: 'butterfly'    },
  { id: 4663,  es: 'manzana',    en: 'apple'        },
  { id: 7353,  es: 'mano',       en: 'hand'         },
  { id: 4762,  es: 'mono',       en: 'monkey'       },
  // N
  { id: 5163,  es: 'nariz',      en: 'nose'         },
  { id: 5164,  es: 'nube',       en: 'cloud'        },
  { id: 4921,  es: 'naranja',    en: 'orange'       },
  // Ñ
  { id: 7517,  es: 'ñoño',       en: 'cheesy'       },
  // O
  { id: 5166,  es: 'ojo',        en: 'eye'          },
  { id: 5167,  es: 'oso',        en: 'bear'         },
  { id: 36573, es: 'oveja',      en: 'sheep'        },
  // P
  { id: 5168,  es: 'pájaro',     en: 'bird'         },
  { id: 4664,  es: 'perro',      en: 'dog'          },
  { id: 5169,  es: 'pelota',     en: 'ball'         },
  { id: 4757,  es: 'pez',        en: 'fish'         },
  // Q
  { id: 36577, es: 'queso',      en: 'cheese'       },
  // R
  { id: 5173,  es: 'rana',       en: 'frog'         },
  { id: 4759,  es: 'ratón',      en: 'mouse'        },
  { id: 5174,  es: 'robot',      en: 'robot'        },
  // S
  { id: 7375,  es: 'sandía',     en: 'watermelon'   },
  { id: 5176,  es: 'sol',        en: 'sun'          },
  { id: 5177,  es: 'silla',      en: 'chair'        },
  // T
  { id: 5178,  es: 'tigre',      en: 'tiger'        },
  { id: 4761,  es: 'tren',       en: 'train'        },
  { id: 5179,  es: 'tortuga',    en: 'turtle'       },
  // U
  { id: 7380,  es: 'uva',        en: 'grapes'       },
  { id: 36581, es: 'unicornio',  en: 'unicorn'      },
  // V
  { id: 5182,  es: 'vaca',       en: 'cow'          },
  { id: 5183,  es: 'volcán',     en: 'volcano'      },
  // W
  { id: 36584, es: 'wafle',      en: 'waffle'       },
  // X
  { id: 36585, es: 'xilófono',   en: 'xylophone'    },
  // Y
  { id: 36586, es: 'yoyo',       en: 'yoyo'         },
  // Z
  { id: 5186,  es: 'zapato',     en: 'shoe'         },
  { id: 5187,  es: 'zorro',      en: 'fox'          },
  { id: 5188,  es: 'zanahoria',  en: 'carrot'       },
];

// Índice por primera letra
const POR_LETRA = {};
for (const v of VOCAB) {
  const l = v.es[0].toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Ñ normaliza a N — la recuperamos manualmente
  const letra = v.es.toUpperCase().startsWith('Ñ') ? 'Ñ' : l;
  if (!POR_LETRA[letra]) POR_LETRA[letra] = [];
  POR_LETRA[letra].push(v);
}

const LETRAS = 'A B C D E F G H I J K L M N Ñ O P Q R S T U V W X Y Z'.split(' ');
const PICTO_URL = id => `assets/pictos/${id}.png`;

// ─── Estado del módulo ────────────────────────────────────────────────────────
let _el       = null;   // contenedor raíz
let _letra    = null;   // letra seleccionada
let _lista    = [];     // palabras de la letra activa (shuffled)
let _idx      = 0;      // índice en _lista
let _enIngles = false;  // mostrar traducción

// ─── API pública ──────────────────────────────────────────────────────────────
export async function init(container) {
  _el = container;
  _enIngles = false;
  _render();
  // Seleccionar letra aleatoria al arrancar
  const letrasConPalabras = LETRAS.filter(l => POR_LETRA[l]?.length);
  _seleccionarLetra(letrasConPalabras[Math.floor(Math.random() * letrasConPalabras.length)]);
}

export function destroy() {
  _el = null;
  _letra = null;
}

export function onEnter() {}
export function onLeave() { window.speechSynthesis?.cancel(); }

// ─── Render principal ─────────────────────────────────────────────────────────
function _render() {
  _el.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;background:transparent;';

  _el.innerHTML = `
  <style>
    /* ── Cintillo de letras ── */
    #md-letras-wrap {
      flex-shrink: 0;
      overflow-x: auto; overflow-y: hidden;
      padding: 10px 16px 6px;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }
    #md-letras-wrap::-webkit-scrollbar { display: none; }
    #md-letras {
      display: flex; gap: 6px;
      width: max-content;
    }
    .md-letra-btn {
      width: 38px; height: 38px;
      border-radius: 50%; border: none; cursor: pointer;
      font-family: inherit; font-weight: 900; font-size: .95rem;
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.55);
      transition: background .15s, color .15s, transform .12s;
      flex-shrink: 0;
    }
    .md-letra-btn:active { transform: scale(0.88); }
    .md-letra-btn.activa {
      background: #0ea5c9;
      color: #fff;
      box-shadow: 0 4px 14px rgba(14,165,201,0.45);
    }
    .md-letra-btn.vacia {
      opacity: 0.25; cursor: default; pointer-events: none;
    }

    /* ── Área principal ── */
    #md-main {
      flex: 1; min-height: 0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      padding: 10px 20px 16px;
    }

    /* ── Tarjeta de imagen ── */
    #md-card {
      border-radius: 24px;
      overflow: hidden;
      background: #f87171; /* se sobreescribe por JS según letra */
      display: flex; align-items: center; justify-content: center;
      position: relative;
    }
    #md-picto {
      width: 75%; height: 75%;
      object-fit: contain;
      filter: drop-shadow(0 12px 24px rgba(0,0,0,0.22));
      transition: opacity .25s;
    }
    #md-picto.cargando { opacity: 0; }

    /* ── Panel derecho ── */
    #md-panel {
      display: flex; flex-direction: column;
      justify-content: space-between;
      gap: 12px;
    }

    /* Contador + idioma */
    #md-meta {
      font-size: .72rem; font-weight: 900;
      letter-spacing: .12em; text-transform: uppercase;
      color: #14b8a6;
    }

    /* Palabra */
    #md-palabra {
      font-size: clamp(2.8rem, 7vw, 5rem);
      font-weight: 900; letter-spacing: -1px;
      color: #fff; line-height: 1;
      word-break: break-word;
    }

    /* Botón idioma */
    #md-btn-idioma {
      align-self: flex-start;
      padding: 8px 18px; border-radius: 99px;
      border: 1.5px solid rgba(255,255,255,0.22);
      background: transparent; color: #fff;
      font-family: inherit; font-weight: 700; font-size: .82rem;
      cursor: pointer; transition: all .18s;
    }
    #md-btn-idioma:active { transform: scale(.94); }
    #md-btn-idioma.activo {
      background: #14b8a6;
      border-color: #14b8a6;
      color: #07212e;
    }

    /* Controles inferiores */
    #md-controles {
      display: flex; align-items: center; gap: 10px;
    }
    .md-nav-btn {
      width: 52px; height: 52px; border-radius: 50%;
      border: none; cursor: pointer;
      background: rgba(255,255,255,0.10); color: #fff;
      font-size: 1.4rem; font-weight: 900;
      display: flex; align-items: center; justify-content: center;
      transition: background .15s, transform .12s;
      flex-shrink: 0;
    }
    .md-nav-btn:active { transform: scale(.88); background: rgba(255,255,255,.18); }

    #md-btn-escucha {
      flex: 1; height: 52px; border-radius: 99px;
      border: none; cursor: pointer;
      background: #fb7185; color: #fff;
      font-family: inherit; font-weight: 900; font-size: 1.05rem;
      display: flex; align-items: center; justify-content: center; gap: 10px;
      box-shadow: 0 8px 24px rgba(251,113,133,0.40);
      transition: transform .12s, box-shadow .15s;
    }
    #md-btn-escucha:active {
      transform: scale(.96);
      box-shadow: 0 4px 12px rgba(251,113,133,0.30);
    }

    /* Dots de paginación */
    #md-dots {
      display: flex; gap: 5px; justify-content: center;
      margin-top: 6px;
    }
    .md-dot {
      height: 5px; border-radius: 99px;
      background: rgba(255,255,255,0.18);
      transition: all .3s;
    }
    .md-dot.activo {
      background: #0ea5c9;
    }

    /* Estado vacío */
    #md-vacio {
      display: none;
      flex: 1; align-items: center; justify-content: center;
      flex-direction: column; gap: 12px;
      color: rgba(255,255,255,0.30);
      font-size: 1rem; font-weight: 700;
    }
  </style>

  <!-- Cintillo de letras -->
  <div id="md-letras-wrap">
    <div id="md-letras"></div>
  </div>

  <!-- Área principal -->
  <div id="md-main">
    <!-- Tarjeta imagen -->
    <div id="md-card">
      <img id="md-picto" src="" alt="" class="cargando" />
    </div>

    <!-- Panel derecho -->
    <div id="md-panel">
      <div>
        <div id="md-meta">1 · 1 · ESPAÑOL</div>
        <div id="md-palabra">—</div>
        <button id="md-btn-idioma">mostrar en inglés</button>
      </div>

      <div>
        <div id="md-controles">
          <button class="md-nav-btn" id="md-prev">‹</button>
          <button id="md-btn-escucha">
            <span style="font-size:1.3rem">🔊</span> escucha
          </button>
          <button class="md-nav-btn" id="md-next">›</button>
        </div>
        <div id="md-dots"></div>
      </div>
    </div>
  </div>

  <!-- Estado vacío -->
  <div id="md-vacio">
    <span style="font-size:3rem">🔤</span>
    No hay palabras para esta letra todavía.
  </div>
  `;

  _renderLetras();
  _bindEvents();
}

// ─── Cintillo de letras ───────────────────────────────────────────────────────
function _renderLetras() {
  const wrap = _el.querySelector('#md-letras');
  wrap.innerHTML = '';
  for (const letra of LETRAS) {
    const btn = document.createElement('button');
    btn.className = 'md-letra-btn' + (POR_LETRA[letra]?.length ? '' : ' vacia');
    btn.textContent = letra;
    btn.dataset.letra = letra;
    btn.addEventListener('click', () => _seleccionarLetra(letra));
    wrap.appendChild(btn);
  }
}

// ─── Selección de letra ───────────────────────────────────────────────────────
function _seleccionarLetra(letra) {
  _letra    = letra;
  _enIngles = false;
  _lista    = _shuffle([...(POR_LETRA[letra] || [])]);
  _idx      = 0;

  // Resaltar botón activo y hacer scroll hacia él
  _el.querySelectorAll('.md-letra-btn').forEach(b => {
    b.classList.toggle('activa', b.dataset.letra === letra);
  });
  const btnActivo = _el.querySelector(`.md-letra-btn[data-letra="${letra}"]`);
  btnActivo?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

  _actualizarVista();
}

// ─── Actualizar vista con la palabra actual ───────────────────────────────────
const COLORES_LETRA = {
  A:'#f87171', B:'#fb923c', C:'#fbbf24', D:'#a3e635', E:'#34d399',
  F:'#22d3ee', G:'#60a5fa', H:'#a78bfa', I:'#f472b6', J:'#f87171',
  K:'#fb923c', L:'#fbbf24', M:'#34d399', N:'#22d3ee', Ñ:'#60a5fa',
  O:'#a78bfa', P:'#f472b6', Q:'#f87171', R:'#fb923c', S:'#fbbf24',
  T:'#34d399', U:'#22d3ee', V:'#60a5fa', W:'#a78bfa', X:'#f472b6',
  Y:'#f87171', Z:'#fb923c',
};

function _actualizarVista() {
  const main  = _el.querySelector('#md-main');
  const vacio = _el.querySelector('#md-vacio');
  const sinPalabras = !_lista.length;

  main.style.display  = sinPalabras ? 'none' : 'grid';
  vacio.style.display = sinPalabras ? 'flex'  : 'none';
  if (sinPalabras) return;

  const v = _lista[_idx];

  // Color de la tarjeta según letra
  const color = COLORES_LETRA[_letra] || '#0ea5c9';
  _el.querySelector('#md-card').style.background =
    `linear-gradient(160deg, ${color} 0%, ${color}cc 100%)`;

  // Pictograma
  const img = _el.querySelector('#md-picto');
  img.classList.add('cargando');
  img.src = PICTO_URL(v.id);
  img.alt = v.es;
  img.onload  = () => img.classList.remove('cargando');
  img.onerror = () => { img.src = ''; img.classList.remove('cargando'); };

  // Meta y palabra
  _el.querySelector('#md-meta').textContent =
    `${_idx + 1} · ${_lista.length} · ${_enIngles ? 'INGLÉS' : 'ESPAÑOL'}`;
  _el.querySelector('#md-palabra').textContent = _enIngles ? v.en : v.es;

  // Botón idioma
  const btnIdioma = _el.querySelector('#md-btn-idioma');
  btnIdioma.textContent = _enIngles ? 'mostrar en español' : 'mostrar en inglés';
  btnIdioma.classList.toggle('activo', _enIngles);

  // Dots de paginación (máx 8 visibles)
  _renderDots();
}

function _renderDots() {
  const dots = _el.querySelector('#md-dots');
  dots.innerHTML = '';
  const total = Math.min(_lista.length, 8);
  for (let i = 0; i < total; i++) {
    const d = document.createElement('span');
    d.className = 'md-dot' + (i === (_idx % total) ? ' activo' : '');
    d.style.width = i === (_idx % total) ? '24px' : '8px';
    dots.appendChild(d);
  }
}

// ─── Eventos ──────────────────────────────────────────────────────────────────
function _bindEvents() {
  _el.querySelector('#md-prev').addEventListener('click', () => {
    _idx = (_idx - 1 + _lista.length) % _lista.length;
    _enIngles = false;
    _actualizarVista();
  });

  _el.querySelector('#md-next').addEventListener('click', () => {
    _idx = (_idx + 1) % _lista.length;
    _enIngles = false;
    _actualizarVista();
  });

  _el.querySelector('#md-btn-idioma').addEventListener('click', () => {
    _enIngles = !_enIngles;
    _actualizarVista();
  });

  _el.querySelector('#md-btn-escucha').addEventListener('click', () => {
    if (!_lista.length) return;
    const v    = _lista[_idx];
    const text = _enIngles ? v.en : v.es;
    const lang = _enIngles ? 'en-US' : 'es-MX';
    _hablar(text, lang);
  });
}

// ─── TTS ──────────────────────────────────────────────────────────────────────
function _hablar(texto, lang = 'es-MX') {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u   = new SpeechSynthesisUtterance(texto);
  u.lang    = lang;
  u.rate    = 0.85;
  u.pitch   = 1.05;
  u.volume  = 1;
  window.speechSynthesis.speak(u);
}

// ─── Utilidades ───────────────────────────────────────────────────────────────
function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
