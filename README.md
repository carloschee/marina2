# Marina 2

PWA educativa de comunicación aumentativa y alternativa (CAA) para Emi.

Módulos: **Mira y di** · **Frases** · **Memorama** · **Escucha y Toca**

URL de producción: `https://carloschee.github.io/marina2/`

---

## Novedades en v2.1.0

### ✨ Nuevas funcionalidades

**Frases**
- Selector de frases reemplazado por modal — libera espacio en pantalla, especialmente en iPhone SE
- Corrección puntual de piezas: tocar una pieza en la tira la elimina junto con las posteriores, permitiendo rehacer desde ese punto sin borrar todo
- Piezas de texto ahora reproducen su audio correctamente (sanitización de nombres de archivo)
- Audio de pictogramas resuelto desde `ruta_img` del catálogo — corrige problemas con nombres con tildes o espacios (ej. "autobús de dos pisos")
- Scroll propio en el área de piezas disponibles y en la tira de construcción para frases largas
- Layout compacto optimizado para iPhone SE portrait: imágenes más pequeñas, padding reducido, mejor distribución vertical

**Escucha y Toca**
- Aciertos progresivos por nivel: `[3, 4, 5, 6, 8]` consecutivos requeridos (antes: 3 fijo para todos)
- Fallo reinicia el contador de aciertos consecutivos
- Modo infinito: rondas continuas sin overlay de "nivel completado"
- Contador de racha visible en modo infinito
- Récord persistente en localStorage (`marina2_toca_mejor_racha`)
- Overlay de fallo en modo infinito con puntuación y aviso de récord
- Tiles de opciones con fondo blanco y texto negro
- Persistencia al volver al menú: conserva nivel, tema y aciertos

**Mira y di**
- Botón de micrófono ahora visible y funcional en iPhone 13 e iPad (estaba oculto por CSS)
- Desactivado correctamente en iPhone SE donde el servicio de reconocimiento de voz no está disponible (`service-not-allowed`): no muestra el botón ni solicita permiso al cargar

**Menú**
- Layout portrait unificado: iPhone SE e iPhone 13 muestran el mismo menú 1×4
- Tiles del menú al 25% de altura del contenedor (`grid-template-rows: repeat(4, 1fr)`)

**Datos — catálogo**
- 93 animales nuevos en `pictos.json` (IDs 1459–1551)
- Nuevas frases: "quiero + verbo" (×7), "primero…después" (×2), "el fuego está caliente ¿qué hacemos? ¡sóplale!", "el autobús de dos pisos es muy alto"
- Nuevos pictogramas: quiero, lavar las manos, primero, descansar, hacer popo, hacer pipi, sóplale, autobús de dos pisos, transportes adicionales (1438–1458)

**Datos — temas unificados**
- `data/temas.json` reemplaza `memorama.json` y `toca-temas.json` como fuente única de verdad para todos los módulos
- 24 temas organizados en dos tipos: `vocabulario` (Animales, Frutas, Transportes…) y `lenguaje` (Verbos, Emociones, Opuestos…)
- Memorama y Escucha y Toca leen del mismo archivo

**Herramientas**
- `scripts/clasificar-temas.py` — clasifica `pictos.json` en campos semánticos CAA/TEA y genera `temas.json`. Tres capas: reglas explícitas, embeddings semánticos (sentence-transformers) y revisión manual. GUI integrada con `--revisar`
- `scripts/editar-vocabulario.py` — GUI para curar el vocabulario de Mira y di por letra. Muestra todos los pictos disponibles con la inicial seleccionada, pre-marca los ya incluidos, migra automáticamente el formato antiguo ES/EN al formato simplificado
- `scripts/test-pronunciacion.py` — prueba pronunciación TTS al vuelo sin guardar archivos. Soporta texto plano, SSML, fonema IPA (`/f`), cambio de voz (`/v`) y velocidad (`/r`)
- `generar-audio.py` — corregido error `[Errno 22]` en Windows con nombres de archivo que contienen caracteres inválidos (`¿`, `!`, etc.) mediante `sanitizar_nombre()`

### 🐛 Bugs corregidos

- **Frases — piezas de texto no aparecían** hasta tocar un picto: `_tocarPieza` ahora renderiza la tira antes de reproducir audio
- **Frases — scroll del selector roto** tras completar una frase: `scrollTop` se resetea al reconstruir la lista; listener de scroll apunta al elemento correcto
- **Escucha y Toca — opciones en miniatura** de forma intermitente: causa raíz era `lanzarConfeti()` mutando `container.style.position` a `relative`, colapsando el grid. Solución: helper `_confeti()` + ResizeObserver que cachea dimensiones reales del grid
- **Escucha y Toca — reinicio al volver al menú**: `resume()` reconstruye el HTML correctamente siguiendo el patrón de Memorama
- **Mira y di — medidor de pronunciación no visible** en iPhone 13: estaba oculto por `display:none !important` en el bloque CSS `≤600px`
- **Audio — nombres con caracteres especiales**: `sanitizarNombre()` en JS espejo exacto de `sanitizar_nombre()` en Python garantiza que los nombres de archivo coincidan

---

## Descripción

Marina 2 es una app de comunicación aumentativa y alternativa (CAA) diseñada para Emi. Funciona en iPad, iPhone y cualquier navegador moderno. No requiere conexión a internet después de la primera carga.

### Módulos

| Módulo | Descripción |
|--------|-------------|
| **Mira y di** | Vocabulario A–Z con pictogramas, audio y evaluación de pronunciación por micrófono |
| **Frases** | Constructor de frases por nivel de dificultad con pictogramas y piezas de texto |
| **Memorama** | Juego de pares con pictogramas por tema y nivel de dificultad |
| **Escucha y Toca** | Escucha una instrucción y toca el pictograma correcto — 5 niveles + modo infinito |

---

## Uso

### Área del usuario (Emi)

La pantalla principal muestra los cuatro módulos. Se navega tocando el tile correspondiente. El botón `‹` vuelve al menú.

### Área del supervisor (adulto)

Se accede desde el ícono de ajustes ⚙️ con un PIN (por defecto `1234`). Permite:
- Gestionar perfiles de usuario
- Habilitar o deshabilitar módulos por perfil
- Ver reportes de actividad
- Descargar contenido offline

La configuración general está en `app.config.json`. No es necesario editarla en código.

---

## Opciones de configuración

Toda la configuración de la app vive en `app.config.json`:

```json
{
  "app": {
    "nombre":           "Marina 2",
    "version":          "2.1.0",
    "idiomas":          ["es", "en"],
    "idiomaPorDefecto": "es"
  },
  "ui": {
    "tema":        "oceano",
    "saludo":      "Hola ",
    "mostrarPill": true
  },
  "pin": {
    "valorDefecto": "1234"
  },
  "tts": {
    "lang":   "es-MX",
    "rate":   0.92,
    "pitch":  1.2,
    "volume": 1
  },
  "storage": {
    "prefijo": "marina2"
  }
}
```

| Campo | Qué hace |
|-------|----------|
| `app.nombre` | Nombre en el header |
| `ui.tema` | Tema visual (`"oceano"` es el único disponible) |
| `ui.mostrarPill` | Muestra u oculta el pill ES/EN |
| `tts.rate` | Velocidad de la voz (1 = normal, rango: 0.7–1.2) |
| `tts.pitch` | Tono de la voz (1 = normal, rango: 0.8–1.4) |
| `pin.valorDefecto` | PIN inicial de Ajustes |

---

## Manual técnico

### Stack y arquitectura

PWA de arquitectura modular. JavaScript vanilla con ES modules, CSS nativo y Service Worker propio. Sin frameworks, sin build step.

```
marina2/
├── app.config.json        ← Configuración: nombre, versión, tema, TTS, PIN
├── app.js                 ← Arranque, navegación, área de adultos, pill idioma
├── index.html             ← Shell HTML + CSS global + meta PWA
├── manifest.json          ← Metadatos PWA (icono, colores, orientación)
├── sw.js                  ← Service Worker offline-first
├── assets-manifest.json   ← Generado automáticamente por GitHub Action
│
├── core/
│   ├── config.js          cfg() — acceso a app.config.json
│   ├── offline.js         SW, caché, indicador de conexión
│   ├── ui.js              toast, confeti, animarEntrada, haptic
│   ├── perfiles.js        Perfiles con persistencia en localStorage
│   ├── telemetry.js       Registro local de eventos por sesión
│   ├── tts.js             TTS.speak() / TTS.stop() con voces neurales
│   └── audio.js           AudioManager
│
├── themes/
│   └── oceano.js          Fondo SVG animado, variables CSS
│
├── modules/
│   ├── _plantilla/        Plantilla para módulos nuevos
│   ├── ajustes/           Panel de configuración del supervisor
│   ├── mira-y-di/         Vocabulario A–Z con pictogramas y micrófono
│   ├── frases/            Constructor de frases por nivel
│   ├── memorama/          Juego de pares con pictogramas
│   └── toca/              Escucha y Toca — 5 niveles + modo infinito
│
├── data/
│   ├── pictos.json        Catálogo de pictogramas: {id, es, en, ruta_img, art}
│   ├── vocabulario.json   Índice A–Z de IDs por letra: {letra: [ids]}
│   ├── frases.json        Frases con piezas, nivel y lang
│   └── temas.json         Temas para Memorama y Escucha y Toca: {id, label, emoji, tipo, palabras}
│
├── scripts/
│   ├── generar-audio.py        Genera MP3 con edge-tts para todo el catálogo
│   ├── clasificar-temas.py     Clasifica pictos.json en temas CAA/TEA → temas.json
│   ├── editar-vocabulario.py   GUI para curar vocabulario.json por letra
│   ├── test-pronunciacion.py   Prueba TTS interactivo (SSML, IPA, sin guardar archivos)
│   ├── pictos-csv.py           Exporta/importa pictos.json como CSV
│   ├── descargar-pictos.py     Descarga PNGs desde API ARASAAC
│   ├── verificar-pictos.py     Auditoría del catálogo de pictogramas
│   └── limpiar-pictogramas.py  Elimina PNGs huérfanos
│
└── assets/
    ├── img/               Íconos PWA
    ├── ui/                Tiles del home: btn-{id}.png
    ├── pictogramas/       PNGs: {ruta_img}
    └── audio/
        ├── es/            {ruta_img sin .png}.mp3
        ├── en/            {ruta_img sin .png}.mp3
        └── frases/
            ├── es/        {id}.mp3 y {pieza-texto-sanitizado}.mp3
            └── en/        {id}.mp3 y {pieza-texto-sanitizado}.mp3
```

---

### Datos — estructura de pictos.json

Fuente única de verdad para todo el vocabulario. Tiene 554 entradas.

```json
{
  "id":       1130,
  "es":       "oveja",
  "en":       "sheep",
  "ruta_img": "oveja.png",
  "art":      "la"
}
```

El campo `art` (el/la/los) se usa en Escucha y Toca para instrucciones naturales: "Toca **la** oveja".

`vocabulario.json` indexa IDs por letra para Mira y di:

```json
{ "O": [1130, 1045, 1203] }
```

`temas.json` define los temas para Memorama y Escucha y Toca:

```json
{
  "id":       "animales",
  "label":    "Animales",
  "emoji":    "🐾",
  "tipo":     "vocabulario",
  "palabras": [1130, 1045, 1203]
}
```

`tipo` puede ser `"vocabulario"` (Animales, Frutas, Transportes…) o `"lenguaje"` (Verbos, Emociones, Opuestos…).

---

### Generación de audio

MP3 generados con [edge-tts](https://github.com/rany2/edge-tts). Voces: `es-MX-DaliaNeural` · `en-US-AriaNeural`.

```powershell
pip install edge-tts

# Todo el catálogo
python scripts/generar-audio.py

# Solo español
python scripts/generar-audio.py --solo-es

# Solo frases (enunciados completos + piezas de texto)
python scripts/generar-audio.py --solo-frases

# Forzar regeneración
python scripts/generar-audio.py --forzar

# Dry run
python scripts/generar-audio.py --seco
```

**Nota sobre nombres de archivo:** los MP3 de piezas de texto usan `sanitizar_nombre()` para eliminar caracteres inválidos en Windows (`¿`, `!`, espacios → guiones). El front en JS usa la misma lógica mediante `sanitizarNombre()`.

---

### Clasificación de temas

```powershell
pip install sentence-transformers   # solo primera vez

# Clasificar y generar temas.json
python scripts/clasificar-temas.py

# Ver resumen de temas actuales
python scripts/clasificar-temas.py --listar

# Revisar pictos de baja confianza (abre GUI)
python scripts/clasificar-temas.py --revisar

# Actualizar solo un tema
python scripts/clasificar-temas.py --tema animales
```

---

### Editar vocabulario de Mira y di

```powershell
python scripts/editar-vocabulario.py
```

Abre una GUI que muestra todos los pictos por letra. Los ya incluidos en `vocabulario.json` aparecen pre-marcados. Los cambios se guardan al presionar "Guardar vocabulario.json".

---

### Corrección de traducciones

```powershell
python scripts/pictos-csv.py --exportar     # JSON → CSV
# editar scripts/pictos.csv en Excel
python scripts/pictos-csv.py --importar --seco   # ver cambios
python scripts/pictos-csv.py --importar          # aplicar
python scripts/generar-audio.py --solo-en --forzar  # regenerar audios EN
```

---

### Ciclo de vida de un módulo

```
navegarA(mod)
  └── mod.init(container)    montar HTML, cargar datos, registrar eventos
        └── mod.onEnter()    módulo visible al usuario

[Volver al menú]
  └── mod.onLeave()          detener TTS y audio
        ├── mod.pause()      guardar estado (si el módulo lo implementa)
        └── mod.destroy()    limpiar todo (si no hay pause)

[Regresa al módulo]
  ├── mod.resume(container)  restaurar estado — DEBE reconstruir el HTML
  └── mod.init(container)    si no había pause
```

`resume()` debe reconstruir el HTML porque el contenedor puede haber sido limpiado por app.js. Las variables de módulo persisten en memoria entre `pause()` y `resume()`.

---

### API del core

```js
// Configuración
cfg('app.nombre')
cfg('tts.rate', 0.92)            // con fallback

// Voz
TTS.speak('hola', { lang: 'es-MX', rate: 0.92, pitch: 1.2 })
TTS.stop()

// UI
toast('¡Muy bien!', { emoji: '🎉' })
lanzarConfeti({ count: 60, container: _el })
// ⚠️  lanzarConfeti() muta container.style.position a 'relative'.
//     Si el contenedor usa position:absolute;inset:0, restaurar después:
//     lanzarConfeti({ count: 60, container: _el });
//     _el.style.position = 'absolute';
haptic(15)

// Perfiles
Perfiles.getActivo()
Perfiles.getModulosHabilitados()
Perfiles.onChange(callback)
Perfiles.offChange(callback)     // llamar en destroy()

// Telemetría
Telemetry.track('evento', { _modulo: 'mi-modulo', dato: valor })

// Idioma
window.getLang()                 // 'es' | 'en'
window._langConfig               // { es: true, en: false }
window.addEventListener('lang-change', e => {
  const { langConfig } = e.detail;
})
```

---

### Agregar un módulo nuevo

1. Copia `modules/_plantilla/` → `modules/mi-modulo/`
2. Edita `module.js` con `id`, `label`, `emoji`, `orden`, `requierePin`
3. Implementa `init`, `destroy`, `onEnter`, `onLeave` y opcionalmente `pause`/`resume`
4. En `app.js` agrega el import y añade el módulo al array `MODULOS`
5. Agrega `assets/ui/btn-mi-modulo.png` para el tile del home
6. Push — GitHub Action actualiza `assets-manifest.json` automáticamente

---

### Despliegue

La app se despliega automáticamente en GitHub Pages con cada push a `main`. El flujo completo tarda ~2 minutos.

Para forzar actualización en el dispositivo: cierra la app completamente y vuelve a abrirla con conexión.

---

### Dispositivos objetivo

| Dispositivo | Orientación | Resolución |
|------------|-------------|------------|
| iPad Air 4 (principal) | Landscape | 1180×820 pt |
| iPhone 13 (secundario) | Portrait | 390×844 pt |
| iPhone SE 2/3 (terciario) | Portrait | 375×667 pt |

---

### Notas técnicas importantes

- **`lanzarConfeti()` rompe el layout**: muta `container.style.position` a `relative`. Siempre restaurar `position:absolute` después en módulos que usen `inset:0`.
- **Medir dimensiones**: no leer `clientWidth/Height` justo después de mutar el DOM. Usar `ResizeObserver` + caché (ver `_ajustarTamanos` en toca.js).
- **Nombres de audio**: `generar-audio.py` usa `sanitizar_nombre()` para piezas de texto y `ruta_img` para pictos. El JS usa `sanitizarNombre()` espejo exacto. Cualquier divergencia causa 404 silenciosos.
- **CRLF en Windows**: los archivos del repo tienen `\r\n`. Al editar con scripts Python, normalizar primero con `.replace('\r\n', '\n')`.