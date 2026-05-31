# Pendientes Marina 2

> Compartir este archivo al inicio de cada sesión para retomar el contexto.

---

## 🔴 En progreso

- [ ] **Scroll selector frases** — aplicar `modules/frases/frases.js` del último output generado por Claude (fix: `scrollTop = 0` en `_renderSelector` + listener de scroll apuntando a `#fr-selector-wrap`)
- [ ] **Audios con caracteres inválidos** — las piezas de texto que inician con `¿` o `¡` (ej. `"¿qué hacemos?"`) no generaron MP3 antes del fix en `generar-audio.py`. Correr: `python scripts/generar-audio.py --forzar --solo-frases`

---

## 📌 Diseño / decisiones pendientes

- [ ] **Selector de frases en iPhone SE** — evaluar alternativas al layout actual de pills full-width. Opciones en lluvia de ideas: menú desplegable estilizado, modal, pills de ancho automático apiladas. Decidir e implementar.

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

- [x] Menú celular portrait unificado a 1 columna (SE e iPhone 13 iguales)
- [x] Tiles del menú al 25% de altura del contenedor (`grid-template-rows: repeat(4, 1fr)`)
- [x] Pills de frases con color del nivel (no blanco genérico), texto más grande
- [x] Botones 🔊 y × movidos a la tira (visibles en SE)
- [x] Scroll vertical en selector de frases + degradado indicador de continuidad
- [x] `sanitizarNombre()` en `frases.js` y `generar-audio.py` para caracteres inválidos en Windows
- [x] `frases.json` — nuevas entradas: quiero + verbo (×7), primero…después (×2), fuego caliente, autobús de dos pisos
- [x] `pictos.json` — nuevas entradas: quiero (1438), lavar las manos (1433), primero (1434), descansar (1435), hacer popo (1436), hacer pipi (1437), autobús de dos pisos (1439, pendiente PNG)
- [x] `toca-temas.json` — expandido de 1 tema/7 IDs a 10 temas/240 IDs
