# Marina 2

App educativa de comunicación aumentativa y alternativa (CAA) para acompañar el desarrollo del lenguaje, basada en pictogramas ARASAAC.
 
Diseñada para usuarios de CAA 🌊

---

## Guía de uso — adulto supervisor

Esta sección es para el adulto supervisor — familiar, docente o terapeuta — que acompaña al usuario durante las sesiones.

### Antes de empezar

La primera vez que abras la app, te recomendamos agregarla a la pantalla de inicio del iPad para que funcione como una aplicación nativa: toca el botón de compartir en Safari y elige **"Agregar a pantalla de inicio"**. Así la app funciona en pantalla completa, sin la barra del navegador, y también funciona sin internet una vez descargada.

![Agregar a la pantalla de inicio](https://raw.githubusercontent.com/carloschee/marina2/refs/heads/main/assets/readme/menu-agregar-inicio.PNG)

---

### La pantalla de inicio

Al abrir la app verás el menú principal con los cuatro módulos disponibles. Cada módulo ocupa una franja horizontal que llena la pantalla — en iPhone el menú es de una columna, en iPad de dos.

<!-- 📸 ACTUALIZAR: captura del menú en iPhone 13 portrait (1 columna, 4 tiles) y/o iPad landscape -->
<!-- Reemplaza: assets/readme/menu-ui.PNG -->
![Menú principal de Marina](https://raw.githubusercontent.com/carloschee/marina2/refs/heads/main/assets/readme/menu-ui.PNG)

El indicador **En línea / Sin conexión** en la esquina superior derecha te muestra si el iPad tiene internet. Si está en verde, todo bien. Si está en rojo, la app seguirá funcionando con los contenidos que ya estén descargados.

---

### El pill de idioma ES / EN

En la esquina superior derecha hay dos botones: **ES** y **EN**. Puedes activar uno, el otro, o ambos:

- **Solo ES** → toda la sesión en español
- **Solo EN** → toda la sesión en inglés
- **ES + EN activos** → la app alterna entre ambos idiomas en cada interacción, ideal para trabajar los dos idiomas en una misma sesión

![Selector de idioma](https://raw.githubusercontent.com/carloschee/marina2/refs/heads/main/assets/readme/menu-pill-lang.jpg)

---

### Ajustes — el área de adultos

El botón ⚙️ en la esquina superior derecha abre el panel de ajustes. Para entrar tienes que resolver una suma matemática sencilla — esto evita que el usuario acceda por accidente.

Desde Ajustes puedes:

- **Gestionar perfiles** — crear el perfil del usuario con su nombre y avatar, y configurar qué módulos puede ver
- **Descargar contenido offline** — descarga todos los pictogramas y audios para que la app funcione sin internet. Recomendamos hacerlo la primera vez conectado a WiFi
- **Consultar el reporte** — un resumen de las sesiones recientes
- **Cambiar el idioma de la voz** — si prefieres ajustar la velocidad o el tono

![Ajustes — descarga offline](https://raw.githubusercontent.com/carloschee/marina2/refs/heads/main/assets/readme/ajustes-descarga.jpg)

![Ajustes — perfiles](https://raw.githubusercontent.com/carloschee/marina2/refs/heads/main/assets/readme/ajustes-usuarios.jpg)

---

### Recomendaciones para la sesión

- La app está diseñada para sesiones cortas y frecuentes — 10 a 15 minutos funcionan muy bien
- En **Escucha y Toca**, el módulo sube la dificultad automáticamente cuando el usuario acierta consecutivamente — no hace falta hacer nada
- Puedes volver al menú en cualquier momento tocando la flecha ‹ en la esquina superior izquierda. El módulo recuerda dónde quedó y al volver retoma desde ahí

---

## Guía de uso — usuario

Esta sección describe lo que ve y hace el usuario en cada módulo.

---

### 🔤 Mira y di

Se muestra una retícula con todas las letras del abecedario. Al tocar una letra aparece un pictograma grande con la palabra. El botón **escucha** reproduce el audio.

![Mira y di](https://raw.githubusercontent.com/carloschee/marina2/refs/heads/main/assets/readme/mira-y-di-ui.PNG)

---

### 💬 Frases

El usuario toca el botón **Elegir frase** para seleccionar qué oración quiere armar. Al elegirla, aparecen las piezas disponibles en la pantalla. Se tocan en el orden correcto para armarlas en la tira de arriba. Al completar la frase, se escucha el audio completo.

Si se equivoca, puede tocar cualquier pieza en la tira para eliminarla junto con las que vienen después y rehacer desde ese punto, sin borrar todo.

Hay tres niveles de dificultad que puedes seleccionar desde la barra superior:
- ⭐ Básico — frases cortas de 2 piezas
- ⭐⭐ Intermedio — frases de 3 o 4 piezas
- ⭐⭐⭐ Avanzado — frases más largas con conectores

<!-- 📸 ACTUALIZAR: captura del módulo Frases con el nuevo modal abierto y/o con piezas en la tira -->
<!-- Reemplaza: assets/readme/frases-ui.PNG -->
![Constructor de frases](https://raw.githubusercontent.com/carloschee/marina2/refs/heads/main/assets/readme/frases-ui.PNG)

---

### 🃏 Memorama

El clásico juego de memoria. El usuario elige un tema y voltea las cartas buscando los pares de pictogramas. Al encontrar un par, escucha el nombre de la imagen.

Hay tres niveles de dificultad:
- ⭐ Fácil — 6 pares
- ⭐⭐ Intermedio — 12 pares
- ⭐⭐⭐ Avanzado — 24 pares

![Memorama](https://raw.githubusercontent.com/carloschee/marina2/refs/heads/main/assets/readme/memorama-ui.PNG)

---

### 👆 Escucha y Toca

Una voz dice el nombre de un pictograma — por ejemplo "Toca la fresa" — y el usuario debe tocar la imagen correcta entre varias opciones.

Hay 5 niveles de dificultad que suben automáticamente al acertar el número requerido de veces **de forma consecutiva** (un error reinicia el contador):

| Nivel | Opciones | Aciertos seguidos para subir |
|-------|----------|------------------------------|
| 1 | 3 imágenes | 3 |
| 2 | 4 imágenes | 4 |
| 3 | 5 imágenes | 5 |
| 4 | 6 imágenes | 6 |
| 5 | 8 imágenes | 8 |

Al completar el nivel 5 entra en **modo reto infinito** 🏆 — rondas continuas con 8 opciones. En este modo se lleva un contador de racha y un récord persistente entre sesiones.

<!-- 📸 ACTUALIZAR: captura de Escucha y Toca con las nuevas tiles blancas con texto negro -->
<!-- Reemplaza: assets/readme/toca-acierto.PNG -->
![Escucha y Toca — acierto](https://raw.githubusercontent.com/carloschee/marina2/refs/heads/main/assets/readme/toca-acierto.PNG)

<!-- 📸 ACTUALIZAR: captura de la subida de nivel o del modo infinito con el contador de racha -->
<!-- Reemplaza: assets/readme/toca-nivel.PNG -->
![Escucha y Toca — nivel](https://raw.githubusercontent.com/carloschee/marina2/refs/heads/main/assets/readme/toca-nivel.PNG)

---

## Opciones de configuración

Toda la configuración de la app vive en el archivo `app.config.json`, en la raíz del proyecto. Puedes editarlo con cualquier editor de texto.

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

| Campo | Qué hace | Valores posibles |
|-------|----------|--------------------|
| `app.nombre` | Nombre que aparece en el header | Cualquier texto |
| `ui.tema` | Tema visual de la app | `"oceano"` (único por ahora) |
| `ui.mostrarPill` | Muestra u oculta el pill ES/EN | `true` / `false` |
| `tts.lang` | Idioma por defecto del TTS | `"es-MX"`, `"en-US"` |
| `tts.rate` | Velocidad de la voz (1 = normal) | `0.7` – `1.2` |
| `tts.pitch` | Tono de la voz (1 = normal) | `0.8` – `1.4` |
| `pin.valorDefecto` | PIN inicial de Ajustes | Número entero |

Los perfiles se gestionan desde la propia app en Ajustes → Perfiles. No es necesario editarlos en código.

---

## Manual técnico

### Stack y arquitectura

Marina 2 es una PWA (Progressive Web App) de arquitectura modular. No usa frameworks — JavaScript vanilla con ES modules, CSS nativo y Service Worker propio.

```
marina2/
├── app.config.json        ← Configuración: nombre, versión, tema, TTS, PIN
├── app.js                 ← Arranque, navegación, área de adultos, pill idioma
├── index.html             ← Shell HTML + CSS global + meta PWA
├── manifest.json          ← Metadatos PWA (icono, colores, orientación)
├── sw.js                  ← Service Worker offline-first
├── assets-manifest.json   ← Generado automáticamente por GitHub Action
│
├── core/                  ← Infraestructura compartida — no modificar
│   ├── config.js          cfg() — acceso a app.config.json
│   ├── offline.js         SW, caché, indicador de conexión
│   ├── ui.js              toast, confeti, animarEntrada, haptic
│   ├── perfiles.js        Perfiles de usuario con persistencia en localStorage
│   ├── telemetry.js       Registro local de eventos por sesión
│   ├── tts.js             TTS.speak() / TTS.stop() con selección de voz premium
│   └── audio.js           AudioManager con control de reproducción
│
├── themes/
│   └── oceano.js          Tema visual: fondo SVG animado, variables CSS
│
├── modules/
│   ├── _plantilla/        Plantilla para módulos nuevos
│   ├── ajustes/           Panel de configuración del adulto supervisor
│   ├── mira-y-di/         Vocabulario A–Z con pictogramas, audio y micrófono
│   ├── frases/            Construcción de frases por nivel
│   ├── memorama/          Juego de pares con pictogramas
│   └── toca/              Escucha y Toca — 5 niveles + modo infinito
│
├── data/
│   ├── pictos.json        Catálogo de pictogramas: {id, es, en, ruta_img, art}
│   ├── vocabulario.json   Índice A–Z de IDs por letra: {letra: [ids]}
│   ├── frases.json        Frases con piezas, nivel y lang
│   └── temas.json         Temas para Memorama y Escucha y Toca
│
├── scripts/
│   ├── generar-audio.py        Genera MP3 con edge-tts para todo el catálogo
│   ├── clasificar-temas.py     Clasifica pictos.json en temas CAA/TEA → temas.json
│   ├── editar-vocabulario.py   GUI para curar vocabulario.json por letra
│   ├── test-pronunciacion.py   Prueba TTS interactivo (SSML, IPA, sin guardar archivos)
│   ├── pictos-csv.py           Exporta/importa pictos.json como CSV para edición
│   ├── descargar-pictos.py     Descarga PNGs desde API ARASAAC
│   ├── verificar-pictos.py     Auditoría del catálogo de pictogramas
│   └── limpiar-pictogramas.py  Elimina PNGs huérfanos
│
├── .github/workflows/
│   └── assets-manifest.yml     Regenera assets-manifest.json en cada push
│
└── assets/
    ├── img/               Íconos PWA (192×192, 512×512)
    ├── ui/                Tiles del home: btn-{id}.png
    ├── pictogramas/       PNGs de ARASAAC: {ruta_img}
    └── audio/
        ├── es/            {ruta_img sin .png}.mp3  — vocabulario ES
        ├── en/            {ruta_img sin .png}.mp3  — vocabulario EN
        └── frases/
            ├── es/        {id}.mp3 y {pieza-texto-sanitizado}.mp3
            └── en/        {id}.mp3 y {pieza-texto-sanitizado}.mp3
```

---

### Datos — estructura de pictos.json

Fuente única de verdad para todo el vocabulario. El catálogo tiene 554 entradas.

```json
{
  "id":       1130,
  "es":       "oveja",
  "en":       "sheep",
  "ruta_img": "oveja.png",
  "art":      "la"
}
```

El campo `art` (el/la) se usa en Escucha y Toca para generar instrucciones naturales: "Toca **la** oveja". Para verbos, adjetivos y adverbios el campo está vacío.

`vocabulario.json` indexa los IDs por letra para Mira y di:

```json
{ "O": [1130, 1045, 1203] }
```

`temas.json` define los temas para Memorama y Escucha y Toca. Es la fuente única de verdad para ambos módulos:

```json
{
  "id":       "animales",
  "label":    "Animales",
  "emoji":    "🐾",
  "tipo":     "vocabulario",
  "palabras": [1130, 1045, 1203]
}
```

El campo `tipo` puede ser `"vocabulario"` (Animales, Frutas, Transportes…) o `"lenguaje"` (Verbos, Emociones, Opuestos…). Memorama los agrupa visualmente por tipo en el selector.

Los módulos resuelven los IDs contra `pictos.json` en runtime. No hay datos duplicados.

---

### Generación de audio

Los MP3 se generan con [edge-tts](https://github.com/rany2/edge-tts) usando voces neurales de Microsoft Edge — gratuito, sin API key.

Voces: `es-MX-DaliaNeural` (ES) · `en-US-AriaNeural` (EN)

```powershell
pip install edge-tts

# Todo el catálogo (vocabulario + frases)
python scripts/generar-audio.py

# Solo español
python scripts/generar-audio.py --solo-es

# Solo frases (enunciados completos + piezas de texto)
python scripts/generar-audio.py --solo-frases

# Forzar regeneración de archivos existentes
python scripts/generar-audio.py --forzar

# Dry run — muestra qué generaría sin crear archivos
python scripts/generar-audio.py --seco
```

**Sobre los nombres de archivo:** los MP3 de piezas de texto usan `sanitizar_nombre()` para eliminar caracteres inválidos en Windows (`¿`, `!`, espacios → guiones, etc.). El front en JS usa la misma lógica mediante `sanitizarNombre()`. Cualquier divergencia entre las dos funciones causa errores silenciosos de audio.

---

### Clasificación de temas

El script `clasificar-temas.py` mantiene `data/temas.json` actualizado cuando se agregan pictogramas nuevos al catálogo.

```powershell
pip install sentence-transformers   # solo la primera vez (~470 MB)

# Clasificar todo el catálogo y generar/actualizar temas.json
python scripts/clasificar-temas.py

# Ver resumen de temas actuales
python scripts/clasificar-temas.py --listar

# Revisar pictogramas de baja confianza (abre GUI)
python scripts/clasificar-temas.py --revisar

# Actualizar solo un tema
python scripts/clasificar-temas.py --tema animales
```

El clasificador opera en tres capas: reglas explícitas (diccionario), embeddings semánticos (modelo multilingüe) y revisión manual con GUI integrada.

---

### Editar vocabulario de Mira y di

```powershell
python scripts/editar-vocabulario.py
```

Abre una GUI que muestra todos los pictogramas disponibles agrupados por letra inicial. Los que ya están incluidos en `vocabulario.json` aparecen pre-marcados. Permite curar exactamente qué ve el usuario en cada letra según sus intereses actuales.

---

### Corrección de traducciones

Para corregir traducciones incorrectas en el catálogo EN:

```powershell
# 1. Exportar a CSV (se abre en Excel/Numbers/Sheets)
python scripts/pictos-csv.py --exportar

# 2. Editar la columna "en" en scripts/pictos.csv

# 3. Ver cambios antes de aplicar
python scripts/pictos-csv.py --importar --seco

# 4. Aplicar
python scripts/pictos-csv.py --importar

# 5. Regenerar solo los audios EN afectados
python scripts/generar-audio.py --solo-en --forzar
```

---

### Service Worker y caché offline

`sw.js` implementa una estrategia offline-first con tres capas:

- **Precaché en install** — descarga el shell completo (HTML, JS, CSS, fuentes) y todos los assets listados en `assets-manifest.json`
- **Cache-first para audio y pictogramas** — los archivos pesados se sirven desde caché sin tocar la red
- **Network-first para navegación** — intenta la red con timeout de 3s, cae a `index.html` en caché si falla

`assets-manifest.json` se regenera automáticamente con GitHub Actions en cada push. No lo edites a mano.

---

### Ciclo de vida de un módulo

```
navegarA(mod)
  └── mod.init(container)    montar HTML, cargar datos, registrar eventos
        └── mod.onEnter()    módulo visible al usuario

[Volver al menú]
  └── mod.onLeave()          detener TTS y audio activo
        ├── mod.pause()      guardar estado si el módulo lo soporta
        └── mod.destroy()    limpiar todo si no hay pause()

[Regresa al módulo]
  ├── mod.resume(container)  restaurar estado guardado
  └── mod.init(container)    arrancar de nuevo si no había pause()
```

`resume()` debe reconstruir el HTML porque `app.js` puede haber limpiado el contenedor. Las variables de módulo en memoria persisten entre `pause()` y `resume()` — úsalas para restaurar el estado visual.

Todos los módulos deben limpiar sus event listeners en `destroy()` y en `onLeave()` deben detener TTS y audio.

---

### Agregar un módulo nuevo

1. Copia `modules/_plantilla/` → `modules/mi-modulo/`
2. Edita `module.js` con `id`, `label`, `emoji`, `orden` y `requierePin`
3. Implementa la lógica en `mi-modulo.js` exportando `init`, `destroy`, `onEnter`, `onLeave` y opcionalmente `pause`/`resume`
4. En `app.js` agrega el import y añade el módulo al array `MODULOS`
5. Agrega `assets/ui/btn-mi-modulo.png` para el tile del home (opcional — hay fallback con emoji)
6. Push — el GitHub Action actualiza `assets-manifest.json` automáticamente

---

### API del core — referencia rápida

```js
// Configuración
cfg('app.nombre')                         // lee app.config.json
cfg('tts.rate', 0.92)                     // con fallback

// Voz
TTS.speak('hola', { lang: 'es-MX', rate: 0.92, pitch: 1.2 })
TTS.stop()

// UI
toast('¡Muy bien!', { emoji: '🎉' })      // notificación temporal
lanzarConfeti({ count: 60, container: _el })
// ⚠️  lanzarConfeti() muta container.style.position a 'relative'.
//     En módulos con position:absolute;inset:0, restaurar después:
//     _el.style.position = 'absolute';
haptic(15)                                // vibración táctil

// Perfiles
Perfiles.getActivo()                      // perfil activo
Perfiles.getModulosHabilitados()          // IDs habilitados para el perfil
Perfiles.onChange(callback)              // suscribirse a cambios
Perfiles.offChange(callback)             // desuscribirse — llamar en destroy()

// Telemetría
Telemetry.track('evento', { _modulo: 'mi-modulo', dato: valor })

// Idioma activo
window.getLang()                          // 'es' | 'en' — respeta pill ES/EN
window._langConfig                        // { es: true, en: false }
// Escuchar cambios de idioma:
window.addEventListener('lang-change', e => {
  const { langConfig } = e.detail;        // { es, en }
})
```

---

### Despliegue

La app se despliega automáticamente en GitHub Pages con cada push a `main`.

URL de producción: `https://carloschee.github.io/marina2/`

El flujo completo de un cambio:
1. Editas código o datos localmente
2. `git add . && git commit -m "..." && git push`
3. GitHub Action regenera `assets-manifest.json`
4. GitHub Pages despliega la nueva versión en ~2 minutos
5. El Service Worker en el iPad detecta la nueva versión en la próxima carga y se actualiza automáticamente

Para forzar la actualización en el iPad sin esperar: cierra la app completamente y vuelve a abrirla con conexión a internet.

---

### Dispositivos objetivo

| Dispositivo | Orientación | Resolución |
|------------|-------------|------------|
| iPad Air 4 (principal) | Landscape | 1180×820 pt |
| iPhone 13 (secundario) | Portrait | 390×844 pt |
| iPhone SE 2/3 (terciario) | Portrait | 375×667 pt |

El CSS usa `env(safe-area-inset-top/bottom)` con `viewport-fit=cover` para respetar el notch y el home indicator en modo standalone.