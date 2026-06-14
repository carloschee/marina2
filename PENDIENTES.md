# Pendientes Marina 2

> Compartir este archivo al inicio de cada sesión para retomar el contexto.

---

## 🔴 En progreso / por aplicar al repo

- [ ] **Memorama — layout avanzado corregido** — cambiar en `_renderGrid()` de `48: { cols: 8, filas: 6 }` a `48: { cols: 12, filas: 4 }` y el fallback a `|| { cols: 12, filas: 4 }`. Una línea en `modules/memorama/memorama.js`.
- [ ] **README.md actualizado** — versión 2.1.0, sin referencias a Emi, con marcadores `<!-- 📸 ACTUALIZAR -->` para 4 capturas. Aplicar desde el último output generado.
- [ ] **app.config.json** — actualizar `"version": "2.0.0"` → `"version": "2.1.0"`.
- [ ] **Capturas de pantalla pendientes** para el README (guardar en `assets/readme/`):
  - `menu-ui.PNG` — menú en iPhone 13 portrait (1 columna, 4 tiles que llenan pantalla)
  - `frases-ui.PNG` — módulo Frases con el botón "Elegir frase" y/o modal abierto
  - `toca-acierto.PNG` — Escucha y Toca con las tiles blancas con texto negro
  - `toca-nivel.PNG` — subida de nivel o modo infinito con contador de racha
- [ ] **Tag de release** — tras aplicar todo:
  ```
  git tag -a v2.1.0 -m "v2.1.0 — Modal frases, temas unificados, Toca infinito, fixes de layout"
  git push origin v2.1.0
  ```
  Crear el release en GitHub con el contenido de `RELEASE-2.1.0.md`.

---

## 📌 Diseño / decisiones pendientes

- (ninguna abierta por ahora)

---

## 🔵 Pins (retomar cuando haya tiempo)

- [ ] **Sincronización Google Drive** — diseño acordado completo (sync pasiva + activa, last-write-wins, dos archivos: perfiles y avatares). Bloqueado en: obtener Client ID en Google Cloud Console para arrancar `core/sync.js`.
- [ ] **Accesibilidad** — funciones priorizadas:
  1. Velocidad de voz por perfil (slider en Ajustes → Perfiles)
  2. Reducción de movimiento (toggle que desactiva animaciones del fondo y confeti)
  3. Repetición automática de audio al cargar tarjeta (toggle por perfil)
  4. Tamaño de texto configurable (variable CSS `--escala-texto`)
  5. ARIA labels en elementos interactivos (base para VoiceOver)
- [ ] **Parche ARIA modal PIN** — diffs generados en `accesibilidad-modal-pin.md`: atributos `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap. Pendiente aplicar en `index.html` y `app.js`.

---

## ✅ Resuelto recientemente

### Esta semana
- [x] **Memorama — migración a temas.json** — `TEMAS_URL` apunta a `data/temas.json`. Archivos `memorama.json` y `toca-temas.json` obsoletos.
- [x] **Toca y di — migración a temas.json** — fetch de `toca-temas.json` → `data/temas.json`.
- [x] **temas.json** — fuente única de verdad para Memorama y Escucha y Toca. 24 temas (`vocabulario` + `lenguaje`) generados por `clasificar-temas.py`.
- [x] **pictos.json — 93 animales nuevos** — IDs 1459–1551. Clasificados y asignados a temas.
- [x] **clasificar-temas.py** — clasificador CAA/TEA con 3 capas (reglas, embeddings, revisión manual). GUI integrada con `--revisar`. 437/437 pictos clasificados por reglas explícitas.
- [x] **editar-vocabulario.py** — GUI para curar `vocabulario.json` por letra. Migra formato legacy ES/EN automáticamente.
- [x] **README.md** — reescrito para v2.1.0: sin referencias a nombre propio, arquitectura actualizada (`temas.json`, scripts nuevos, 554 pictos, 3 dispositivos objetivo), advertencia de `lanzarConfeti()` en API del core.
- [x] **RELEASE-2.1.0.md** — notas de release listas para GitHub.
- [x] **Frases — layout iPhone SE** — panel de piezas con scroll propio (`flex:1`), imágenes reducidas a 52px, botón "Elegir frase" fijo al fondo.
- [x] **Frases — scroll en la tira** — `overflow-y: auto` en `#fr-tira-piezas`, auto-scroll al último elemento añadido.

### Sesiones anteriores
- [x] Modal selector de frases, corrección puntual de piezas, audio de pictos por ruta_img
- [x] Toca y di: aciertos progresivos, modo infinito, tiles blancas, fix de miniaturas (ResizeObserver), persistencia
- [x] generar-audio.py: sanitizar_nombre(), test-pronunciacion.py
- [x] Menú celular portrait 1×4, tiles al 25% de altura
- [x] pictos.json: transportes nuevos (1438–1458), frases nuevas

---

## 📝 Notas técnicas (para no re-descubrir)

- **Confeti rompe layout**: `lanzarConfeti({container})` muta `container.style.position` a `relative` y NO lo restaura. Siempre restaurar `position:absolute` después en módulos con `inset:0`.
- **Medición de layout**: no medir `clientWidth/Height` justo después de mutar el DOM. Usar ResizeObserver + cache (ver `_ajustarTamanos` en toca.js).
- **Ciclo de vida módulos**: si exporta `pause`, app.js llama `resume()` al volver. `resume()` debe reconstruir el HTML. Variables de módulo persisten entre pause/resume.
- **Nombres de archivo de audio**: `sanitizar_nombre()` en Python = `sanitizarNombre()` en JS. Cualquier divergencia causa 404 silenciosos.
- **`--solo-frases`** genera solo enunciados de frases, NO pictos individuales. Para audio de picto nuevo correr `--solo-es`.
- **CRLF en Windows**: normalizar con `.replace('\r\n', '\n')` antes de editar con Python.
- **`temas.json`** es la fuente única para Memorama y Toca. Para actualizar tras agregar pictos: `python scripts/clasificar-temas.py`.