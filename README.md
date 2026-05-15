# Marina 2

App educativa progresiva (PWA) para el desarrollo del lenguaje en niñas y niños con necesidades de comunicación aumentativa y alternativa (CAA). Diseñada y optimizada para **iPad Air 4ª generación** en orientación horizontal, también funciona en iPhone.

Marina 2 utiliza pictogramas del sistema **ARASAAC** para asociar imágenes con palabras y frases, apoyando el desarrollo del vocabulario receptivo y expresivo. La app funciona **100% sin conexión** una vez instalada.

> **Usuario principal:** Emi, 3 años.
> **Adulto responsable:** accede al área de ajustes mediante un gesto oculto o el botón ⚙️ en el header.

---

## Instalación en iPad / iPhone

1. Abre la URL en **Safari** (solo Safari instala PWAs en iOS/iPadOS)
2. Toca **Compartir → Añadir a pantalla de inicio**
3. Confirma el nombre "Marina 2" → **Añadir**
4. Ábrela desde la pantalla de inicio — corre en pantalla completa sin barra del navegador

La primera apertura requiere conexión. Después funciona offline completo.

---

## Módulos

### 🔍 Mira y di

Vocabulario visual por letra del alfabeto. La usuaria explora palabras en español e inglés acompañadas de su pictograma ARASAAC.

**Cómo funciona:**
- Un cintillo horizontal muestra las letras A–Z + Ñ. Las letras sin palabras aparecen deshabilitadas
- Al tocar una letra, se muestra una palabra aleatoria de esa letra con su pictograma
- Los botones ‹ › navegan entre las palabras de la letra seleccionada
- El botón 🔊 reproduce el audio pregrabado (MP3) con fallback a TTS del dispositivo
- El botón 🎙️ activa el micrófono para que la usuaria intente pronunciar la palabra — un medidor visual muestra qué tan cercana fue la pronunciación
- El idioma se controla desde el pill ES/EN del header global

**Contenido:** `data/vocabulario.json` — palabras por letra en ES y EN
**Pictogramas:** `assets/pictogramas/es/` y `assets/pictogramas/en/`
**Audio:** `assets/audio/es/` y `assets/audio/en/`

📸 *Captura sugerida: pantalla completa mostrando la tarjeta de imagen a la izquierda y el panel de controles a la derecha, con una letra activa en el cintillo*

---

### 💬 Frases

Construcción de frases mediante piezas tocables. La usuaria arma frases tocando las piezas en orden — piezas con pictograma (fondo blanco) y piezas de texto puro.

**Cómo funciona:**
- Tres niveles de dificultad seleccionables: ★ Básico, ★★ Intermedio, ★★★ Avanzado
- Cada nivel tiene un color de tema distintivo (azul / violeta / coral) aplicado a toda la UI del módulo
- La tira superior muestra las piezas en el orden en que se tocan
- Al completar la frase:
  - **Orden correcto** → piezas en verde + confeti + TTS lee la frase completa
  - **Orden distinto** → sin penalización visual, TTS lee la frase igualmente
- El botón 🔊 lee lo construido hasta el momento
- El botón × borra la construcción y permite intentarlo de nuevo
- Los pills inferiores permiten cambiar entre frases del nivel activo

**Contenido:** `data/frases.json` — frases con piezas y nivel de dificultad
**Audio piezas:** `assets/audio/es/` (piezas picto) y `assets/audio/frases/es/` (piezas texto y frases completas)

📸 *Captura sugerida 1: selector de nivel con ★★ activo (violeta), tira con piezas construidas*
📸 *Captura sugerida 2: tira completa con piezas en verde y confeti visible*

---

### ⚙️ Ajustes

Panel de configuración para el adulto responsable. Accesible únicamente mediante PIN matemático.

**Cómo acceder:**
- **5 toques rápidos** en la esquina inferior derecha
- **3 toques rápidos** en la esquina superior izquierda
- Botón ⚙️ en el header

El PIN es una suma matemática aleatoria (`a + b = ?`) — evita que la niña acceda accidentalmente.

**Incluye:** gestión de perfiles, módulos habilitados por perfil, descarga offline, reporte de uso, ajustes de TTS, cambio de PIN.

---

## Área de adultos

| Gesto | Dónde |
|---|---|
| 5 toques rápidos | Esquina inferior derecha |
| 3 toques rápidos | Esquina superior izquierda |

---

## Estructura del repo

```
marina2/
├── app.config.json        ← Configurar nombre, tema, TTS, PIN
├── app.js                 ← Arranque, navegación, área de adultos
├── index.html             ← Shell HTML + CSS + imports de módulos
├── manifest.json          ← Metadatos PWA
├── sw.js                  ← Service worker offline-first
├── assets-manifest.json   ← Generado automáticamente por GitHub Action
│
├── core/                  ← Infraestructura — NO MODIFICAR
│   ├── config.js          cfg() — lee app.config.json
│   ├── offline.js         SW, caché, indicador de conexión
│   ├── ui.js              toast, confeti, animarEntrada
│   ├── perfiles.js        Perfiles de usuario
│   ├── telemetry.js       Registro local de eventos
│   ├── tts.js             TTS.speak(), selección automática de voz
│   └── audio.js           AudioManager, VideoManager, MediaStop
│
├── themes/
│   └── oceano.js          Tema "Océano Pixar" — rayos de sol, burbujas
│
├── modules/
│   ├── _plantilla/        ← Copiar para crear módulo nuevo
│   ├── ajustes/           Panel de configuración del adulto
│   ├── mira-y-di/         Vocabulario por letra con pictogramas
│   └── frases/            Construcción de frases por nivel
│
├── data/
│   ├── vocabulario.json   Palabras A–Z en ES y EN
│   └── frases.json        Frases con piezas y niveles 1–3
│
├── scripts/
│   └── generar-audio.py   Genera MP3 con edge-tts
│
├── .github/workflows/
│   └── assets-manifest.yml  Regenera assets-manifest.json en cada push
│
└── assets/
    ├── img/               Íconos PWA
    ├── ui/                Tiles del home (btn-{id}.png)
    ├── pictogramas/
    │   ├── es/            {palabra}.png
    │   └── en/            {word}.png
    └── audio/
        ├── es/            {palabra}.mp3
        ├── en/            {word}.mp3
        └── frases/
            └── es/        {id-frase}.mp3 y {pieza-texto}.mp3
```

---

## Generar audios

```powershell
pip install edge-tts

python .\scripts\generar-audio.py           # todo el vocabulario
python .\scripts\generar-audio.py --solo-frases   # solo frases
python .\scripts\generar-audio.py --seco          # dry run
python .\scripts\generar-audio.py --forzar        # regenerar todo
```

Voces: `es-MX-DaliaNeural` (ES) · `en-US-AriaNeural` (EN)

---

## Agregar un módulo

1. Copia `modules/_plantilla/` → `modules/mi-modulo/`
2. Edita `module.js` con los metadatos
3. Implementa la lógica en `mi-modulo.js`
4. En `app.js`: agrega el import y el módulo al array `MODULOS`
5. Agrega `assets/ui/btn-mi-modulo.png` para el tile del home
6. Push — el GitHub Action actualiza `assets-manifest.json`

---

## Core — referencia rápida

```js
cfg('app.nombre')                    // lee app.config.json
TTS.speak('hola', { lang: 'es-MX' }) // síntesis de voz
TTS.stop()
toast('¡Muy bien!', 'ok')           // notificación
lanzarConfeti({ container: _el })   // celebración
Perfiles.getActivo()                // perfil activo
Perfiles.onChange(cb)               // suscribirse a cambios
Perfiles.offChange(cb)              // desuscribirse en destroy()
Telemetry.track('evento', { _modulo: 'mi-modulo' })
```

---

## Ciclo de vida de un módulo

```
navegarA(mod)
  └── mod.init(container)   montar HTML, cargar datos, registrar eventos
        └── mod.onEnter()   módulo visible

[Volver]
  └── mod.onLeave()         detener TTS y audio
        └── mod.pause()     mantener estado (si existe)
              o
        └── mod.destroy()   limpiar todo

[Regresa al módulo]
  └── mod.resume(container) restaurar estado (si existe)
        o
  └── mod.init(container)   arrancar de nuevo
```