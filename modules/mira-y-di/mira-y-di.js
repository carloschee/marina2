/* modules/mira-y-di/mira-y-di.js
   Lee vocabulario.json.
   Pictogramas en assets/pictogramas/es/{palabra}.png
                  assets/pictogramas/en/{palabra}.png
   El nombre del archivo = texto a pronunciar.
   Ñ solo tiene español.
*/

const LETRAS = 'A B C D E F G H I J K L M N Ñ O P Q R S T U V W X Y Z'.split(' ');

const pictoURL = (palabra, lang) =>
  `assets/pictogramas/${lang}/${palabra}.png`;

// ─── Estado ───────────────────────────────────────────────────────────────────
let _el    = null;
let _vocab = null;
let _lang  = 'es';
let _letra = null;
let _lista = [];
let _idx   = 0;

// ─── API pública ──────────────────────────────────────────────────────────────
export async function init(container) {
  _el   = container;
  _lang = 'es';

  try {
    const res = await fetch('./data/vocabulario.json');
    _vocab = await res.json();
  } catch (e) {
    console.error('[mira-y-di] No se pudo cargar vocabulario.json', e);
    _vocab = {};
  }

  _render();

  const disponibles = LETRAS.filter(l => _vocab[l]?.es?.length);
  _seleccionarLetra(disponibles[Math.floor(Math.random() * disponibles.length)]);
}

export function destroy() { _el = null; _vocab = null; _letra = null; }
export function onEnter()  {}
export function onLeave()  { window.speechSynthesis?.cancel(); }

// ─── Shell ────────────────────────────────────────────────────────────────────
function _render() {
  _el.style.cssText =
    'position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;background:transparent;';

  _el.innerHTML = `
  <style>
    #md-letras-wrap {
      flex-shrink:0; overflow-x:auto; overflow-y:hidden;
      padding:10px 16px 6px; scrollbar-width:none;
      -webkit-overflow-scrolling:touch;
    }
    #md-letras-wrap::-webkit-scrollbar { display:none; }
    #md-letras { display:flex; gap:6px; width:max-content; }

    .md-letra-btn {
      width:38px; height:38px; border-radius:50%; border:none; cursor:pointer;
      font-family:inherit; font-weight:900; font-size:.9rem;
      background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.55);
      transition:background .15s, color .15s, transform .12s; flex-shrink:0;
    }
    .md-letra-btn:active  { transform:scale(.88); }
    .md-letra-btn.activa  { background:#0ea5c9; color:#fff; box-shadow:0 4px 14px rgba(14,165,201,.45); }
    .md-letra-btn.vacia   { opacity:.22; cursor:default; pointer-events:none; }

    #md-main {
      flex:1; min-height:0; display:grid;
      grid-template-columns:1fr 1fr; gap:16px; padding:10px 20px 16px;
    }

    #md-card {
      border-radius:24px; overflow:hidden;
      display:flex; align-items:center; justify-content:center;
    }
    #md-picto {
      width:75%; height:75%; object-fit:contain;
      filter:drop-shadow(0 12px 24px rgba(0,0,0,.22));
      transition:opacity .22s;
    }
    #md-picto.cargando { opacity:0; }

    #md-panel {
      display:flex; flex-direction:column;
      justify-content:space-between; gap:12px;
    }

    /* Pill ES / EN — solo abarca sus dos botones */
    #md-lang-pill {
      display:inline-flex; gap:3px; padding:3px;
      border-radius:99px;
      background:rgba(255,255,255,0.07);
      border:1px solid rgba(255,255,255,0.10);
      align-self:flex-start;         /* no se estira */
      width:fit-content;
    }
    .md-lang-btn {
      padding:5px 14px; border-radius:99px; border:none; cursor:pointer;
      font-family:inherit; font-size:.75rem; font-weight:900;
      background:transparent; color:rgba(255,255,255,.45);
      transition:all .18s; white-space:nowrap;
    }
    .md-lang-btn.activo        { background:#0ea5c9; color:#fff; }
    .md-lang-btn.deshabilitado { opacity:.25; pointer-events:none; }

    #md-meta {
      font-size:.72rem; font-weight:900; letter-spacing:.12em;
      text-transform:uppercase; color:#14b8a6; margin-top:8px;
    }
    #md-palabra {
      font-size:clamp(2.6rem,7vw,4.8rem); font-weight:900;
      letter-spacing:-1px; color:#fff; line-height:1;
      word-break:break-word; margin:6px 0 0;
    }

    /* Cintillo de letras dentro del panel — retícula táctil */
    #md-letras-panel {
      background:rgba(255,255,255,0.05);
      border:1px solid rgba(255,255,255,0.10);
      border-radius:16px;
      padding:12px;
      display:flex; flex-wrap:wrap; gap:6px;
      flex:1; align-content:flex-start;
      min-height:0; overflow-y:auto; scrollbar-width:none;
    }
    #md-letras-panel::-webkit-scrollbar { display:none; }
    #md-letras-panel .md-letra-btn {
      width:52px; height:52px; font-size:1.1rem;
    }

    #md-controles { display:flex; align-items:center; gap:10px; }
    .md-nav-btn {
      width:52px; height:52px; border-radius:50%; border:none; cursor:pointer;
      background:rgba(255,255,255,.10); color:#fff;
      font-size:1.4rem; font-weight:900;
      display:flex; align-items:center; justify-content:center;
      transition:background .15s, transform .12s; flex-shrink:0;
    }
    .md-nav-btn:active { transform:scale(.88); background:rgba(255,255,255,.18); }

    #md-btn-escucha {
      flex:1; height:52px; border-radius:99px; border:none; cursor:pointer;
      background:#fb7185; color:#fff;
      font-family:inherit; font-weight:900; font-size:1.05rem;
      display:flex; align-items:center; justify-content:center; gap:10px;
      box-shadow:0 8px 24px rgba(251,113,133,.40);
      transition:transform .12s, box-shadow .15s;
    }
    #md-btn-escucha:active { transform:scale(.96); box-shadow:0 4px 12px rgba(251,113,133,.30); }

    #md-dots { display:flex; gap:5px; justify-content:center; margin-top:8px; }
    .md-dot  { height:5px; border-radius:99px; background:rgba(255,255,255,.18); transition:all .3s; }
    .md-dot.activo { background:#0ea5c9; }

    #md-vacio {
      display:none; flex:1; flex-direction:column;
      align-items:center; justify-content:center; gap:12px;
      color:rgba(255,255,255,.30); font-size:1rem; font-weight:700;
    }
  </style>

  <div id="md-main">
    <div id="md-card">
      <img id="md-picto" src="" alt="" class="cargando" />
    </div>
    <div id="md-panel">
      <!-- Fila superior: pill idioma + meta -->
      <div>
        <div id="md-lang-pill">
          <button class="md-lang-btn activo" data-lang="es">ES</button>
          <button class="md-lang-btn"         data-lang="en">EN</button>
        </div>
        <div id="md-meta"></div>
        <div id="md-palabra">—</div>
      </div>
      <!-- Cintillo de letras — retícula en el panel -->
      <div id="md-letras-panel"></div>
      <!-- Controles -->
      <div>
        <div id="md-controles">
          <button class="md-nav-btn" id="md-prev">‹</button>
          <button id="md-btn-escucha"><span style="font-size:1.3rem">🔊</span> escucha</button>
          <button class="md-nav-btn" id="md-next">›</button>
        </div>
        <div id="md-dots"></div>
      </div>
    </div>
  </div>

  <div id="md-vacio">
    <span style="font-size:3rem">🔤</span>
    No hay palabras para esta combinación.
  </div>
  `;

  _renderLetras();
  _bindEvents();
}

// ─── Letras ───────────────────────────────────────────────────────────────────
function _renderLetras() {
  const wrap = _el.querySelector('#md-letras-panel');
  wrap.innerHTML = '';
  for (const letra of LETRAS) {
    const vacia = !_vocab[letra]?.es?.length && !_vocab[letra]?.en?.length;
    const btn = document.createElement('button');
    btn.className     = 'md-letra-btn' + (vacia ? ' vacia' : '');
    btn.textContent   = letra;
    btn.dataset.letra = letra;
    btn.addEventListener('click', () => _seleccionarLetra(letra));
    wrap.appendChild(btn);
  }
}

// ─── Selección de letra ───────────────────────────────────────────────────────
const COLORES = {
  A:'#f87171',B:'#fb923c',C:'#fbbf24',D:'#a3e635',E:'#34d399',
  F:'#22d3ee',G:'#60a5fa',H:'#a78bfa',I:'#f472b6',J:'#f87171',
  K:'#fb923c',L:'#fbbf24',M:'#34d399',N:'#22d3ee',Ñ:'#60a5fa',
  O:'#a78bfa',P:'#f472b6',Q:'#f87171',R:'#fb923c',S:'#fbbf24',
  T:'#34d399',U:'#22d3ee',V:'#60a5fa',W:'#a78bfa',X:'#f472b6',
  Y:'#f87171',Z:'#fb923c',
};

function _seleccionarLetra(letra) {
  _letra = letra;
  _idx   = 0;

  // Si el idioma activo no tiene palabras para esta letra, cambiar al otro
  if (!_vocab[letra]?.[_lang]?.length) {
    _lang = _lang === 'es' ? 'en' : 'es';
  }

  _construirLista();

  _el.querySelectorAll('.md-letra-btn').forEach(b =>
    b.classList.toggle('activa', b.dataset.letra === letra)
  );

  _actualizarPill();
  _actualizarVista();
}

function _construirLista() {
  _lista = _shuffle([...(_vocab[_letra]?.[_lang] || [])]);
  _idx   = 0;
}

// ─── Pill ─────────────────────────────────────────────────────────────────────
function _actualizarPill() {
  _el.querySelectorAll('.md-lang-btn').forEach(btn => {
    const l = btn.dataset.lang;
    btn.classList.toggle('activo', l === _lang);
    btn.classList.toggle('deshabilitado', !_vocab[_letra]?.[l]?.length);
  });
}

// ─── Vista ────────────────────────────────────────────────────────────────────
function _actualizarVista() {
  const main  = _el.querySelector('#md-main');
  const vacio = _el.querySelector('#md-vacio');

  if (!_lista.length) {
    main.style.display  = 'none';
    vacio.style.display = 'flex';
    return;
  }
  main.style.display  = 'grid';
  vacio.style.display = 'none';

  const palabra = _lista[_idx];
  const color   = COLORES[_letra] || '#0ea5c9';

  _el.querySelector('#md-card').style.background =
    `linear-gradient(160deg, ${color} 0%, ${color}cc 100%)`;

  const img = _el.querySelector('#md-picto');
  img.classList.add('cargando');
  img.alt = palabra;
  img.src = pictoURL(palabra, _lang);
  img.onload  = () => img.classList.remove('cargando');
  img.onerror = () => img.classList.remove('cargando');

  _el.querySelector('#md-meta').textContent =
    `${_idx + 1} · ${_lista.length} · ${_lang === 'es' ? 'ESPAÑOL' : 'INGLÉS'}`;
  _el.querySelector('#md-palabra').textContent = palabra;

  _renderDots();
}

function _renderDots() {
  const wrap  = _el.querySelector('#md-dots');
  const total = Math.min(_lista.length, 8);
  wrap.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const d = document.createElement('span');
    d.className  = 'md-dot' + (i === _idx % total ? ' activo' : '');
    d.style.width = i === _idx % total ? '24px' : '8px';
    wrap.appendChild(d);
  }
}

// ─── Eventos ──────────────────────────────────────────────────────────────────
function _bindEvents() {
  _el.querySelector('#md-prev').addEventListener('click', () => {
    _idx = (_idx - 1 + _lista.length) % _lista.length;
    _actualizarVista();
  });
  _el.querySelector('#md-next').addEventListener('click', () => {
    _idx = (_idx + 1) % _lista.length;
    _actualizarVista();
  });
  _el.querySelector('#md-btn-escucha').addEventListener('click', () => {
    if (_lista.length) _hablar(_lista[_idx], _lang === 'es' ? 'es-MX' : 'en-US');
  });
  _el.querySelector('#md-lang-pill').addEventListener('click', e => {
    const btn = e.target.closest('.md-lang-btn');
    if (!btn || btn.classList.contains('deshabilitado')) return;
    _lang = btn.dataset.lang;
    _construirLista();
    _actualizarPill();
    _actualizarVista();
  });
}

// ─── TTS ──────────────────────────────────────────────────────────────────────
function _hablar(texto, lang = 'es-MX') {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = lang; u.rate = 0.85; u.pitch = 1.05; u.volume = 1;
  window.speechSynthesis.speak(u);
}

function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}