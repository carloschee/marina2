# Dótir 2

Herramienta modular de comunicación aumentativa, aprendizaje y multimedia para infancias neurodivergentes.

🔗 **App:** [carloschee.github.io/dotir2](https://carloschee.github.io/dotir2/)

---

## Manual de uso

### Primer inicio

Al abrir la app por primera vez se crea automáticamente un perfil **Invitado**. Para crear perfiles personalizados accede a **Ajustes** (ícono ⚙️ en la barra superior) resolviendo la operación matemática que se presenta como acceso protegido.

### Perfiles

Dótir 2 soporta múltiples perfiles. Cada perfil tiene su propio apodo, avatar (emoji o foto), fecha de nacimiento, notas y favoritos del comunicador. El perfil activo se muestra en la barra superior de la app.

Para gestionar perfiles ve a **Ajustes → Perfiles**:

- **Crear** — toca "+ Crear", ingresa el apodo y opcionalmente sube una foto de perfil con recorte circular interactivo
- **Activar** — toca ▶ junto al perfil que deseas usar
- **Editar** — toca ✏️ para modificar cualquier dato
- **Exportar** — toca ⬇️ para descargar el perfil completo como JSON
- **Eliminar** — toca 🗑 (el perfil Invitado no se puede eliminar)

### Módulos visibles por perfil

Desde **Ajustes → Módulos visibles** puedes habilitar o deshabilitar qué módulos aparecen en el menú principal para el perfil activo. Ajustes siempre es accesible.

### Módulos

#### 💬 Comunicador

Tablero de comunicación aumentativa con pictogramas ARASAAC organizados en 9 categorías: Favoritos, Interactuar, Salud, Acciones, Adjetivos, Tiempo, Alimentos, Objetos y Lugares.

- Toca un pictograma para agregarlo a la barra de frase
- Toca 🔊 para que la app pronuncie la frase completa
- Toca ✕ para borrar la frase
- Mantén presionado un pictograma para agregarlo o quitarlo de Favoritos
- Toca 🕐 para ver el historial de frases recientes
- Usa la barra de búsqueda para encontrar cualquier pictograma

#### 🃏 Memorama

Juego de pares con pictogramas temáticos. Al completar un par la app pronuncia su nombre en el idioma seleccionado.

- Elige un tema al iniciar (Frutas, Transportes, Vegetales)
- Selecciona uno o varios idiomas con las banderas en la barra superior
- Toca 🔄 para repartir de nuevo con el mismo tema
- Toca 🎴 Tema para cambiar de tema
- Los pares encontrados aparecen en la barra inferior — tócalos para escuchar su nombre

#### ▶️ Multimedia

Reproductor unificado de música y video. Los contenidos aparecen mezclados en el cintillo inferior ordenados alfabéticamente.

- Toca cualquier item para reproducirlo — 🎵 para audio, 🎬 para video
- Desliza el visualizador horizontalmente para cambiar entre tres modos: Barras, Circular y Espectrograma
- El audio sigue reproduciéndose al cambiar de módulo

#### ⏱ Temporizador

Cuenta regresiva visual con anillos de colores animados a 60fps.

- Toca la esfera para configurar el tiempo
- Elige un preset (1, 2, 5, 10, 15, 20 o 30 min) o ingresa minutos y segundos manualmente
- Toca la esfera durante el conteo para pausar o reanudar
- Al terminar suena una melodía y aparece confeti

#### 📚 Libros

Visor de libros en formato PDF.

- Elige un libro del cintillo inferior
- Desliza horizontalmente o usa los botones ◀ ▶ en la barra superior para cambiar de página

#### ⚙️ Ajustes

Panel de configuración protegido por PIN matemático.

- **Conexión** — verifica el estado de la red
- **Uso sin internet** — descarga todo el contenido para usarlo sin conexión wifi; una vez descargado la app funciona completamente offline
- **Aplicación** — actualiza o reinicia la app
- **Comunicador** — ajusta el tamaño de los pictogramas (Pequeño, Mediano, Grande)
- **Reporte de actividad** — consulta estadísticas de uso del perfil activo (pictogramas más usados, frases, partidas de memorama, medios reproducidos)
- **Módulos visibles** — habilita o deshabilita módulos por perfil
- **Perfiles** — gestiona los perfiles de usuario

### Uso sin internet

1. Abre la app con conexión wifi
2. Ve a **Ajustes → Descargar todo**
3. Espera a que se complete la descarga (incluye pictogramas, audio, video y libros)
4. A partir de ese momento la app funciona completamente fuera del alcance wifi

> No es necesario activar el modo avión del dispositivo. Basta con que el wifi esté encendido aunque no haya cobertura.

### Instalación como app

Dótir 2 es una Progressive Web App (PWA) instalable en cualquier dispositivo:

- **iOS Safari** — toca el botón Compartir → "Agregar a pantalla de inicio"
- **Android Chrome** — toca el menú ⋮ → "Instalar app" o "Agregar a pantalla de inicio"
- **Escritorio** — toca el ícono de instalación en la barra de direcciones del navegador

---

## Detalles técnicos

### Arquitectura

- **PWA instalable** — funciona como app nativa en iOS, Android y escritorio
- **100% offline** — Service Worker con estrategia network-first para código y cache-first para audio y video
- **Sin dependencias** — Vanilla JS con ES Modules, sin frameworks ni bundlers
- **Síntesis de voz (TTS)** — motor compartido con selección automática de voz de alta calidad por idioma y desbloqueo en iOS
- **Arquitectura modular** — cada módulo es independiente con ciclo de vida propio (`init`, `destroy`, `onEnter`, `onLeave`, `pause`, `resume`)
- **Telemetría local** — registro de patrones de uso por perfil almacenado en `localStorage`, exportable como JSON
- **Wake Lock** — mantiene la pantalla encendida durante el uso con fallback para iOS Safari

### Estructura del proyecto

```
dotir2/
├── index.html                  # Shell principal y MODULE_REGISTRY
├── manifest.json               # Configuración PWA
├── sw.js                       # Service Worker
├── core/
│   ├── tts.js                  # Motor de síntesis de voz
│   ├── ui.js                   # Utilidades UI (confeti, toast, animaciones)
│   ├── audio.js                # AudioManager y VideoManager singleton
│   ├── offline.js              # SW registration, precaché, estado de conexión
│   ├── perfiles.js             # Gestión de perfiles de usuario
│   └── telemetry.js            # Registro local de eventos de uso
├── modules/
│   ├── saac/                   # Comunicador SAAC
│   ├── memorama/               # Juego de memoria
│   ├── media/                  # Reproductor multimedia (audio + video)
│   ├── libros/                 # Visor de libros PDF
│   ├── temporizador/           # Temporizador visual
│   └── ajustes/                # Panel de configuración
├── data/
│   ├── saac.json               # Vocabulario y categorías del comunicador
│   ├── memorama-temas.json     # Temas disponibles para memorama
│   ├── memorama-*.json         # Datos de cada tema
│   ├── media.json              # Catálogo unificado de audio y video
│   └── libros.json             # Catálogo de libros
└── assets/
    ├── saac/                   # Pictogramas ARASAAC
    ├── audio/                  # Archivos mp3 e imágenes de portada
    ├── videos/                 # Archivos mp4 e imágenes de miniatura
    ├── libros/                 # Archivos PDF e imágenes de portada
    ├── memorama/               # Imágenes del memorama
    ├── img/                    # Íconos PWA
    └── ui/                     # Imágenes del menú principal
```

### Agregar un nuevo módulo

1. Crear la carpeta `modules/mi-modulo/`
2. Crear `mi-modulo.js` con las funciones exportadas:

```js
export async function init(container) { /* montar UI */ }
export function destroy()             { /* limpiar listeners */ }
export function onEnter()             { /* al navegar hacia aquí */ }
export function onLeave()             { /* al salir */ }
export function pause()               { /* app en segundo plano */ }
export async function resume(container) { /* app regresa */ }
```

3. Crear `module.js` con el descriptor:

```js
import { init, destroy, onEnter, onLeave, pause, resume } from './mi-modulo.js';

export default {
  id:          'mi-modulo',
  label:       'Mi Módulo',
  desc:        'Descripción corta',
  emoji:       '🧩',
  color:       '#6366F1',
  orden:       7,
  habilitado:  true,
  requierePin: false,
  init, destroy, onEnter, onLeave, pause, resume,
  cache: [],
};
```

4. Importar y registrar en `index.html`:

```js
import MiModulo from './modules/mi-modulo/module.js';

const MODULE_REGISTRY = [
  // ... módulos existentes ...
  MiModulo,
].filter(m => m.habilitado && m.id !== 'ajustes')
 .sort((a, b) => a.orden - b.orden);
```

### Desarrollo local

```bash
# Con Python
python3 -m http.server 8080

# Con Node.js
npx serve .
```

---

## Créditos

- **Pictogramas SAAC** — [ARASAAC](https://arasaac.org). Autor: Sergio Palao. Licencia CC BY-NC-SA
- **Fuente** — Nunito, Google Fonts
- **Gráficos e ilustraciones** — Gemini (Google) y ChatGPT (OpenAI)
- **Desarrollo** — Carlos Chee y Claude (Anthropic)

---

## Licencia

Uso educativo y terapéutico. Los pictogramas ARASAAC tienen licencia CC BY-NC-SA y no pueden usarse con fines comerciales.
