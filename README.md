# Marina PWA

App educativa instalable para iPad Air 4ª gen. en horizontal.  
Diseñada para desarrollo de lenguaje en Emi (3 años, autista).

---

## Instalación en iPad

1. Sube esta carpeta a un servidor con **HTTPS**  
   (GitHub Pages, Netlify, Vercel, Cloudflare Pages).  
   _iOS no instala PWAs sin HTTPS._
2. Abre la URL en **Safari** (no Chrome — sólo Safari instala PWAs en iOS).
3. Toca **Compartir → Añadir a pantalla de inicio**.
4. Confirma el nombre "Marina" y toca **Añadir**.
5. Ábrela desde la pantalla de inicio — modo pantalla completa, sin barra del navegador.

Después del primer uso con internet, todo queda en caché y funciona **100% offline**.

---

## Área de adultos (Ajustes)

Hay dos gestos para abrirla:

| Gesto | Dónde |
|---|---|
| 5 toques rápidos | Esquina **inferior derecha** (zona invisible) |
| 3 toques rápidos | Esquina **superior izquierda** |

PIN por defecto: `1234`  
Se puede cambiar desde el panel de Ajustes → Seguridad (sin tocar código).

---

## Estructura de archivos

```
marina/
├── index.html            ← Punto de entrada PWA
├── manifest.json         ← Metadatos PWA (nombre, íconos, orientación)
├── sw.js                 ← Service worker offline-first
├── marina.config.json    ← Configuración de la app (editar esto)
├── app.js                ← MarinaApp: navegación, tweaks, PIN, ajustes
├── shell.js              ← Tokens de diseño + componentes de layout (MarinaShell, MarinaTopBar)
├── home.js               ← Pantalla principal + grid de módulos
├── shared.js             ← useTTS, helpers
├── icons/                ← Íconos PNG (180, 192, 256, 384, 512, maskable)
└── modules/              ← Un archivo .js por módulo (crear según necesidad)
```

---

## Configurar la app

Todo lo que cambia entre versiones vive en `marina.config.json`:

```json
{
  "app": {
    "name": "Marina",
    "themeColor": "#062a35"
  },
  "greeting": {
    "name": "Emi",
    "subtitle": "¿qué quieres jugar?"
  },
  "palette": "warm",
  "tts": { "lang": "es-MX", "rate": 0.85, "volume": 0.9 },
  "modules": []
}
```

**Paletas disponibles:** `warm` · `pastel` · `vivid` · `neutral`

---

## Agregar un módulo

1. Crea `modules/mi-modulo.js` siguiendo la plantilla:

```js
// modules/mi-modulo.js
'use strict';
const { createElement: h, useState } = React;

function MiModulo({ onNavigate, speak }) {
  return h(MarinaShell, null,
    h(MarinaTopBar, { onBack: () => onNavigate('home'), title: 'Mi módulo' }),
    h('div', null, '¡Hola desde mi módulo!')
  );
}

// Registrar el módulo en el home
window.MARINA_MODULES.push({
  id:        'mi-modulo',
  label:     'Mi módulo',
  sub:       'descripción corta',
  emoji:     '🌟',
  accent:    '#ff6b8b',
  active:    true,
  component: MiModulo,
});
```

2. Agrega el `<script>` en `index.html` **antes** de `app.js`:

```html
<script src="modules/mi-modulo.js"></script>
<script src="app.js"></script>
```

3. Agrega el id a `modules` en `marina.config.json`:

```json
"modules": ["mi-modulo"]
```

4. Bumping del service worker: cambia `CACHE_VERSION` en `sw.js`:

```js
const CACHE_VERSION = 'marina-v1-2026-05-12'; // ← incrementa
```

---

## Pendientes

- Reemplazar emoji por pictogramas ARASAAC (descarga + bundle ~30 imágenes).
- Build/precompile JS para eliminar el parse overhead de React UMD en primer cargado.
- Routing con historial para que el botón físico atrás del iPad funcione.
