# Marina 2 — PWA Boilerplate

App educativa instalable para iPad (y iPhone). Arquitectura modular basada en Dótir 2.

---

## Estructura del repo

```
├── app.config.json        ← EDITAR ESTO — nombre, tema, PIN, TTS
├── app.js                 ← Arranque y orquestación (no tocar)
├── index.html             ← Shell HTML + imports de módulos
├── manifest.json          ← Metadatos PWA (nombre, íconos, orientación)
├── sw.js                  ← Service worker offline-first
├── assets-manifest.json   ← Lista de assets a precachear (generado)
│
├── core/                  ← Infraestructura compartida — NO TOCAR
│   ├── config.js          Carga app.config.json y expone cfg()
│   ├── offline.js         Service worker, caché, indicador de conexión
│   ├── ui.js              toast, confeti, modal, animarEntrada, $()
│   ├── perfiles.js        Perfiles de usuario, módulos habilitados
│   ├── telemetry.js       Registro local de eventos de uso
│   ├── tts.js             Síntesis de voz — TTS.speak(), TTS.stop()
│   └── audio.js           AudioManager, VideoManager, MediaStop
│
├── themes/                ← Temas visuales intercambiables
│   └── oceano.js          Azul profundo + corrientes submarinas
│
├── modules/               ← Un directorio por módulo
│   ├── _plantilla/        ← COPIAR ESTO para un módulo nuevo
│   │   ├── module.js      Metadatos y registro del módulo
│   │   └── plantilla.js   Lógica, HTML y CSS del módulo
│   ├── ajustes/           Módulo de ajustes (PIN, perfiles, caché)
│   └── mira-y-di/         Módulo de vocabulario por letra + pictogramas
│
├── data/                  ← JSONs de contenido
│   └── vocabulario.json   Palabras por letra en ES y EN
│
└── assets/
    ├── img/               Íconos de la app (icon-192.png, icon-512.png…)
    ├── ui/                Imágenes de tiles del home (btn-{id}.png)
    └── pictogramas/
        ├── es/            {palabra}.png  — nombre = texto a pronunciar
        └── en/            {word}.png     — nombre = texto a pronunciar
```

---

## Levantar una app nueva

### 1. Editar `app.config.json`

```json
{
  "app": {
    "id":          "mi-app",
    "nombre":      "Mi App",
    "descripcion": "Descripción breve",
    "version":     "1.0.0",
    "idiomas":     ["es", "en"],
    "idiomaPorDefecto": "es"
  },
  "ui": {
    "tema":        "oceano",
    "saludo":      "Hola ",
    "mostrarPill": true
  },
  "pin":     { "valorDefecto": "1234" },
  "tts":     { "lang": "es-MX", "rate": 0.92, "pitch": 1.2, "volume": 1 },
  "storage": { "prefijo": "mi-app" }
}
```

> **`storage.prefijo`** aísla el `localStorage` entre apps distintas en el mismo dominio.
> Usa un valor único por app.

---

### 2. Registrar módulos en `app.js`

Edita solo las dos líneas marcadas:

```js
// ── Importa aquí los módulos de tu app ───────────────────────
import MiModulo from './modules/mi-modulo/module.js';
const MODULOS = [AjustesModule, MiModulo];
```

`AjustesModule` siempre debe estar — da acceso al área de adultos.

---

### 3. Crear un módulo nuevo

Copia la carpeta `modules/_plantilla/` y renómbrala:

```
modules/mi-modulo/
├── module.js      ← metadatos
└── mi-modulo.js   ← lógica
```

**`module.js`** — solo metadatos, no tocar salvo los TODOs:

```js
import { init, destroy, onEnter, onLeave } from './mi-modulo.js';

export default {
  id:          'mi-modulo',   // único, minúsculas con guiones
  label:       'Mi módulo',   // nombre en el tile del home
  emoji:       '🌟',          // emoji si no hay imagen en assets/ui/
  orden:       1,             // posición en el home
  habilitado:  true,
  requierePin: false,         // true = pide PIN antes de abrir
  init, destroy, onEnter, onLeave,
  pause:  undefined,          // opcional — pausar al salir
  resume: undefined,          // opcional — reanudar al volver
  cache:  [],                 // URLs a precachear para offline
};
```

**`mi-modulo.js`** — lógica del módulo:

```js
import { TTS }       from '../../core/tts.js';
import { Telemetry } from '../../core/telemetry.js';
import { cfg }       from '../../core/config.js';

let _el = null;

export async function init(container) {
  _el = container;
  _el.innerHTML = `
    <style>
      /* Estilos locales — usa var(--t-primary), var(--t-secondary) del tema */
      #mi-titulo { color: white; font-size: 2rem; font-weight: 900; }
    </style>
    <div id="mi-titulo">Hola desde mi módulo</div>
  `;
  // eventos, fetch de datos, etc.
}

export function destroy() {
  TTS.stop();
  _el = null;
}

export function onEnter() { /* se llama al mostrar el módulo */ }
export function onLeave() { TTS.stop(); }
```

---

### 4. Imagen del tile en el home

Agrega `assets/ui/btn-{id}.png` con el id del módulo.
Si no existe, el tile muestra el emoji de respaldo automáticamente.

---

### 5. Instalar en iPad / iPhone

1. Sube el repo a un servidor **HTTPS** (GitHub Pages, Netlify, Vercel, Cloudflare Pages)
2. Abre la URL en **Safari** (solo Safari instala PWAs en iOS)
3. Toca **Compartir → Añadir a pantalla de inicio**
4. Confirma el nombre y toca **Añadir**

Después del primer uso con internet, la app funciona **100% offline**.

---

## Core — referencia rápida

### `cfg(ruta, defecto?)`
Lee cualquier valor de `app.config.json` con notación de punto:
```js
cfg('tts.lang')          // → 'es-MX'
cfg('app.nombre')        // → 'Marina 2'
cfg('ui.tema', 'oceano') // con valor por defecto
```

### `TTS`
```js
TTS.speak('hola', { lang: 'es-MX', rate: 0.9, pitch: 1.2 })
TTS.stop()
TTS.setMute(true)
TTS.getLangs()  // → ['es-MX', 'en-US', ...]
```
Selecciona automáticamente la mejor voz disponible en el dispositivo.

### `toast(mensaje, tipo?)`
Muestra una notificación no intrusiva. `tipo`: `'ok'` | `'error'` | `'info'`.
```js
toast('¡Guardado!')
toast('Sin conexión', 'error')
```

### `lanzarConfeti({ count?, container? })`
Lluvia de confeti sobre el contenedor indicado.
```js
lanzarConfeti({ container: _el })
```

### `Perfiles`
```js
Perfiles.getActivo()              // → { apodo, avatar, esInvitado, ... }
Perfiles.getModulosHabilitados()  // → ['mira-y-di', 'memorama'] | null
Perfiles.onChange(callback)       // suscribirse a cambios
Perfiles.offChange(callback)      // desuscribirse (hacerlo en destroy())
```

### `Telemetry`
```js
Telemetry.track('evento', { dato: valor })
```
Los eventos se guardan en `localStorage` y son visibles desde Ajustes.

### `animarEntrada(elemento)`
Fade-in suave al mostrar un módulo. Lo llama `app.js` automáticamente,
pero puedes usarlo en subelementos.

### `AudioManager` / `VideoManager`
```js
AudioManager.play('assets/audio/sonido.mp3')
AudioManager.stop()
VideoManager.play(url, { loop: true, container: _el })
```

### `MediaStop`
Botón flotante que aparece automáticamente al reproducir audio o video,
permitiendo al adulto detener la reproducción.

---

## Temas

Los temas controlan el fondo animado y las variables CSS `--t-primary`, `--t-secondary`.
El tema activo se define en `app.config.json → ui.tema`.

Para crear un tema nuevo, copia `themes/oceano.js` y exporta:
```js
export function injectStyles() { /* inyecta <style> en <head> */ }
export function crearFondo()   { /* devuelve un HTMLElement para insertar */ }
```

---

## Ciclo de vida de un módulo

```
navegarA(mod)
  └── mod.init(container)   ← montar HTML, eventos, cargar datos
        └── mod.onEnter()   ← módulo visible

[usuario toca Volver]
  └── mod.onLeave()         ← detener TTS, audio, etc.
      └── mod.pause()       ← (si existe) guardar estado
          o mod.destroy()   ← (si no hay pause) limpiar todo

[usuario vuelve al módulo]
  └── mod.resume()          ← (si existe) restaurar estado
      o mod.init()          ← arrancar de nuevo
```

**Reglas importantes:**
- `init` siempre recibe un `container` limpio — no asumas estado previo
- `destroy` debe limpiar todos los `addEventListener` y timers para evitar memory leaks
- Llama a `Perfiles.offChange(cb)` en `destroy` si te suscribiste en `init`
- No toques el DOM fuera de `container` (salvo TTS y Telemetry)
- Usa `var(--t-primary)` y `var(--t-secondary)` para colores que respeten el tema

---

## Offline

El SW usa 4 estrategias según el tipo de recurso:

| Recurso | Estrategia |
|---|---|
| App shell (HTML, JS, CSS) | Cache-first, precache en install |
| CDN / fuentes | Cache-first, lazy, opaque-ok |
| Audio (.mp3, .ogg, .wav) | Cache-first, lazy, cuota mínima 50 MB |
| Navegación | Network-first, timeout 3s, fallback a index.html |
| Todo lo demás | Stale-while-revalidate |

Para actualizar la caché: incrementa `CACHE_VERSION` en `sw.js`.
El banner "Nueva versión disponible" aparece automáticamente.

Para agregar URLs al precache de un módulo, llénalas en `cache: []` del `module.js`.

---

## Área de adultos (Ajustes)

Dos gestos para abrirla — ninguno es visible para la niña:

| Gesto | Zona |
|---|---|
| 5 toques rápidos | Esquina inferior derecha |
| 3 toques rápidos | Esquina superior izquierda |

PIN por defecto: `1234`. Se cambia desde Ajustes → Seguridad sin tocar código.

---

## Convención de pictogramas

```
assets/pictogramas/
  es/  árbol.png   →  pronuncia "árbol"   en TTS es-MX
  en/  tree.png    →  pronuncia "tree"    en TTS en-US
```

El nombre del archivo **es** el texto a pronunciar y el texto a mostrar.
No hay IDs ni mapeos externos. Para agregar una palabra: coloca el PNG con el nombre correcto.