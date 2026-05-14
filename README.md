# PWA Boilerplate

App educativa instalable para iPad. Basada en Dótir 2 / Marina 2.

---

## Estructura

```
boilerplate/
├── app.config.json        ← EDITAR ESTO para configurar la app
├── app.js                 ← Arranque (no tocar)
├── index.html             ← Shell PWA + imports de módulos
├── manifest.json          ← Metadatos PWA (nombre, íconos)
├── sw.js                  ← Service worker offline-first
│
├── core/                  ← No tocar. Infraestructura compartida.
│   ├── config.js          Carga app.config.json, expone cfg()
│   ├── offline.js         SW, caché, indicador de conexión
│   ├── ui.js              toast, confeti, modal, animaciones
│   ├── perfiles.js        Gestión de perfiles de usuario
│   ├── telemetry.js       Registro local de eventos
│   ├── tts.js             Síntesis de voz (TTS)
│   └── audio.js           AudioManager, VideoManager, MediaStop
│
├── themes/                ← Temas visuales intercambiables
│   └── oceano.js          Azul profundo + corrientes submarinas
│
├── modules/               ← Un directorio por módulo
│   └── _plantilla/        Copiar y renombrar para nuevo módulo
│       ├── module.js      Registro del módulo (metadatos)
│       └── plantilla.js   Lógica, HTML y CSS del módulo
│
├── data/                  ← JSONs de contenido (vocabulario, etc.)
└── assets/
    ├── ui/                Íconos de la app y tiles del home
    └── pictogramas/
        ├── es/            {palabra}.png en español
        └── en/            {word}.png en inglés
```

---

## Para una app nueva

### 1. Editar `app.config.json`

```json
{
  "app": {
    "id":     "mi-app",
    "nombre": "Mi App"
  },
  "ui":      { "tema": "oceano" },
  "pin":     { "valorDefecto": "1234" },
  "tts":     { "lang": "es-MX", "rate": 0.92, "pitch": 1.2 },
  "storage": { "prefijo": "mi-app" }
}
```

> `storage.prefijo` aísla el localStorage entre apps. Pon un valor único por app.

### 2. Agregar módulos en `app.js`

```js
import MiModulo from './modules/mi-modulo/module.js';
const MODULOS = [MiModulo];
```

### 3. Registrar el módulo

```js
// modules/mi-modulo/module.js
import { init, destroy, onEnter, onLeave } from './mi-modulo.js';
export default {
  id: 'mi-modulo', label: 'Mi módulo', orden: 1,
  habilitado: true, requierePin: false,
  init, destroy, onEnter, onLeave,
};
```

### 4. Subir a HTTPS y abrir en Safari del iPad

Safari → Compartir → Añadir a pantalla de inicio.

---

## Core — qué provee cada archivo

| Archivo | Qué exporta | Cuándo usarlo |
|---|---|---|
| `config.js` | `cargarConfig()`, `cfg(ruta)` | Leer cualquier valor de `app.config.json` |
| `offline.js` | `registrarSW()`, `onConexionChange()`, `borrarCache()` | SW y estado de red |
| `ui.js` | `toast()`, `lanzarConfeti()`, `modal()`, `animarEntrada()` | Feedback visual |
| `perfiles.js` | `Perfiles.*` | Gestión de usuarios |
| `telemetry.js` | `Telemetry.track()`, `getReporte()` | Registro de uso |
| `tts.js` | `TTS.speak()`, `TTS.stop()` | Síntesis de voz |
| `audio.js` | `AudioManager`, `VideoManager`, `MediaStop` | Audio y video |

---

## Temas

Un tema es un archivo JS en `themes/` que exporta tres cosas:

```js
export const tokens = { '--t-primary': '#0ea5c9', ... }; // variables CSS
export function injectStyles() { ... }   // inyecta CSS en <head>
export function crearFondo() { ... }     // retorna HTMLElement del fondo animado
```

Para crear un tema nuevo, copia `themes/oceano.js` y cambia los colores y las animaciones.

---

## Área de adultos

- **5 toques** en esquina inferior derecha → pide PIN → abre Ajustes
- **3 toques** en esquina superior izquierda → mismo efecto
- PIN por defecto: el de `app.config.json → pin.valorDefecto`
- El módulo `ajustes` puede cambiarlo via `window._setPIN(nuevoPin)`

---

## Bumping del service worker

Cada vez que cambies cualquier archivo cacheado, actualiza `CACHE_VERSION` en `sw.js`:

```js
const CACHE_VERSION = 'mi-app-v2-2026-05-13';
```