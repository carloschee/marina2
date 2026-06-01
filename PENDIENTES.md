# Pendientes Marina 2

> Compartir este archivo al inicio de cada sesión para retomar el contexto.

---

## 🔴 En progreso / por aplicar al repo

- (nada pendiente de aplicar — todo lo trabajado está en el repo)

---

## 📌 Diseño / decisiones pendientes

- (ninguna abierta por ahora)

---

## 🔵 Pins (retomar cuando haya tiempo)

- [ ] **Sincronización Google Drive** — diseño acordado completo (sync pasiva + activa, last-write-wins, dos archivos: perfiles y avatares). Bloqueado en: obtener Client ID en Google Cloud Console para arrancar `core/sync.js`.
- [ ] **Accesibilidad** — funciones priorizadas para Emi:
  1. Velocidad de voz por perfil (slider en Ajustes → Perfiles)
  2. Reducción de movimiento (toggle que desactiva animaciones del fondo y confeti)
  3. Repetición automática de audio al cargar tarjeta (toggle por perfil)
  4. Tamaño de texto configurable (variable CSS `--escala-texto`)
  5. ARIA labels en elementos interactivos (base para VoiceOver)
- [ ] **Parche ARIA modal PIN** — diffs generados en `accesibilidad-modal-pin.md`: atributos `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap. Pendiente aplicar en `index.html` y `app.js`.

---

## ✅ Resuelto recientemente

### Sesión de hoy
- [x] **VERIFICADO EN REPO: Toca y di — fix de miniaturas** — confirmado que las opciones ya no aparecen en miniatura en ningún nivel/ronda/modo infinito.
- [x] **Toca y di — tiles fondo blanco + texto negro** — opciones con `background:#fff`, texto `#07212e`, sombra suave.
- [x] **APLICADO AL REPO: Modal selector de frases** — el modal reemplazó el panel con scroll, funcionando.
- [x] **APLICADO AL REPO: Audios generados en su totalidad** — regenerados todos los MP3 (piezas de texto con nombres sanitizados). Pendiente menor: limpiar duplicados con espacios si se desea, pero ya no afecta.
- [x] **APLICADO AL REPO: Pronunciación "sóplale" (picto 1440)** — corregida, ahora suena "só-pla-le".
- [x] **Frases — modal selector** — reemplazado el panel con scroll de pills por botón "Elegir frase" + modal a pantalla completa (mismo patrón que Toca/Memorama). No abre automáticamente al entrar; cambiar de nivel solo cambia el color de presentación. Libera espacio vertical en iPhone SE.
- [x] **Frases — corrección puntual de piezas** — tocar una pieza en la tira la quita junto con las posteriores (rehacer desde ahí), devolviéndolas a disponibles. Mantiene la secuencia sin huecos.
- [x] **Frases — audio de pictos por ruta_img** — `_urlAudioPicto()` resuelve el MP3 desde `ruta_img` del catálogo, no desde `pieza.texto` (arregla "autobús de dos pisos" → `autobus-dos-pisos.mp3`).
- [x] **Frases — audio de piezas de texto** — usa `sanitizarNombre()` para el nombre de archivo (ej. "¿qué hacemos?" → `qué-hacemos.mp3`), verificado contra el manifiesto. TTS fallback usa el texto original.
- [x] **Frases — orden render/audio** — `_tocarPieza` ahora renderiza la tira ANTES de reproducir audio (la UI nunca depende del audio).
- [x] **Toca y di — fix de miniaturas** — causa raíz: `lanzarConfeti` mutaba `_el.style.position` a `relative`, colapsando la altura del grid. Solución: helper `_confeti()` que restaura `position:absolute`, + ResizeObserver que cachea el tamaño real del grid (`_gridW/_gridH`) para que `_ajustarTamanos` no dependa del timing de medición.
- [x] **Toca y di — aciertos progresivos por nivel** — `ACIERTOS_POR_NIVEL = [3,4,5,6,8]` (antes constante única). Un fallo reinicia el contador de aciertos consecutivos.
- [x] **Toca y di — modo infinito** — rondas continuas sin overlay de "nivel completado", contador de racha visible, récord en localStorage (`marina2_toca_mejor_racha`), overlay de fallo con puntuación y aviso de récord.
- [x] **Toca y di — persistencia al volver al menú** — `resume()` reconstruye HTML (patrón memorama) y restaura el estado del header. Conserva nivel/aciertos. (Nota: el SET en curso se reconstruye — decidido como aceptable, no se restaura el objetivo exacto.)
- [x] **generar-audio.py — sanitizar_nombre()** — elimina caracteres inválidos en Windows (`¿ ¡ ! ? , ; . : * " < > | \`), espacios → guiones. Arregla el error `[Errno 22]` al crear `¿qué hacemos?.mp3`.
- [x] **test-pronunciacion.py** — script interactivo con pygame para probar pronunciación TTS al vuelo (sin guardar archivos). Soporta texto plano, SSML completo (`/s`), fonema IPA (`/f`), cambio de voz (`/v`) y velocidad (`/r`).
- [x] **toca-temas.json — transportes** — expandido a 37 IDs (24 originales + 13 nuevos transportes). Excluidos astronauta (1443, persona) y papalote (1450, juguete).
- [x] **pictos.json** — 15 transportes nuevos (1441-1455) + entradas previas. autobús de dos pisos (1439) con MP3 ya publicado en GitHub Pages.
- [x] **frases.json** — agregadas: "el fuego está caliente ¿qué hacemos? ¡sóplale!" (nivel 3, con piezas el/está/¿qué hacemos?) y "autobús de dos pisos es muy alto" (nivel 2).

### Sesiones anteriores
- [x] Menú celular portrait unificado a 1 columna (SE e iPhone 13 iguales)
- [x] Tiles del menú al 25% de altura del contenedor (`grid-template-rows: repeat(4, 1fr)`)
- [x] Botones 🔊 y × movidos a la tira de frases (visibles en SE)
- [x] `frases.json` — quiero + verbo (×7), primero…después (×2)
- [x] `pictos.json` — quiero (1438), lavar las manos (1433), primero (1434), descansar (1435), hacer popo (1436), hacer pipi (1437)
- [x] `toca-temas.json` — expandido de 1 tema/7 IDs a 10 temas/240 IDs

---

## 📝 Notas técnicas (para no re-descubrir)

- **Confeti rompe layout**: `lanzarConfeti({container})` muta `container.style.position` a `relative` y NO lo restaura. Cualquier módulo cuyo `_el` use `position:absolute;inset:0` debe restaurarlo después de cada confeti (ver helper `_confeti` en toca.js / línea en `_onFraseCompleta` de frases.js).
- **Medición de layout**: no medir `clientWidth/Height` justo después de mutar el DOM (condición de carrera). Usar ResizeObserver + cache, como en `_ajustarTamanos` de toca.js.
- **Ciclo de vida módulos**: si exporta `pause`, app.js llama `resume()` al volver (no `init()`). `resume()` debe reconstruir el HTML porque el contenedor puede haber sido limpiado. Variables de módulo persisten entre pause/resume.
- **Nombres de archivo de audio**: el script `generar-audio.py` usa `sanitizar_nombre()` para piezas de texto y `ruta_img` para pictos. El front debe pedir esos mismos nombres (`sanitizarNombre()` en JS es espejo del Python).
- **`--solo-frases`** genera solo enunciados completos de frases, NO pictos individuales. Para audio de un picto nuevo correr sin `--solo-frases` (o `--solo-es`).
- **Archivos del repo tienen CRLF** (Windows). Al editar con scripts, normalizar a `\n` primero.