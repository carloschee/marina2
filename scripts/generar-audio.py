#!/usr/bin/env python3
"""
scripts/generar-audio.py — Marina 2
Genera archivos MP3 para vocabulario y frases usando edge-tts.
Voces neurales de Microsoft Edge — gratuito, sin API key.

Uso:
  pip install edge-tts
  python scripts/generar-audio.py

Salida:
  assets/audio/es/{ruta_img sin .png}.mp3   ← vocabulario español
  assets/audio/en/{ruta_img sin .png}.mp3   ← vocabulario inglés
  assets/audio/frases/es/{id}.mp3           ← frases completas ES
  assets/audio/frases/es/{pieza}.mp3        ← piezas de texto ES
  assets/audio/frases/en/{id}.mp3           ← phrases EN
  assets/audio/frases/en/{pieza}.mp3        ← text pieces EN

Opciones:
  --forzar          Regenera archivos aunque ya existan
  --solo-es         Solo vocabulario español
  --solo-en         Solo vocabulario inglés
  --solo-frases     Solo frases y piezas (ambos idiomas)
  --seco            Dry run — muestra qué haría sin generar nada
  --concurrencia N  Peticiones simultáneas a Edge TTS (default: 5)
"""

import asyncio
import json
import sys
import argparse
import time
from pathlib import Path
from datetime import datetime

try:
    import edge_tts
except ImportError:
    print("❌  edge-tts no está instalado.")
    print("   Ejecuta: pip install edge-tts")
    sys.exit(1)

# ─── Configuración ────────────────────────────────────────────────────────────

VOZ_ES        = "es-MX-DaliaNeural"
VOZ_EN        = "en-US-AriaNeural"

CONFIG_ES     = {"rate": "-8%",  "volume": "+0%", "pitch": "+0Hz"}
CONFIG_EN     = {"rate": "-5%",  "volume": "+0%", "pitch": "+0Hz"}
CONFIG_FRASES = {"rate": "-12%", "volume": "+0%", "pitch": "+0Hz"}

REINTENTOS    = 3
BACKOFF_BASE  = 1.0

RAIZ          = Path(__file__).parent.parent
VOCAB_JSON    = RAIZ / "data" / "vocabulario.json"
FRASES_JSON   = RAIZ / "data" / "frases.json"
MEMORAMA_JSON = RAIZ / "data" / "memorama.json"
PICTOS_JSON   = RAIZ / "data" / "pictos.json"
DIR_AUDIO     = RAIZ / "assets" / "audio"
DIR_ES        = DIR_AUDIO / "es"
DIR_EN        = DIR_AUDIO / "en"
DIR_FRASES_ES = DIR_AUDIO / "frases" / "es"
DIR_FRASES_EN = DIR_AUDIO / "frases" / "en"
LOG_PATH      = RAIZ / "scripts" / "errores-audio.log"

# ─── Progreso ─────────────────────────────────────────────────────────────────

class Progreso:
    def __init__(self, total: int, prefijo: str = ""):
        self.total   = total
        self.actual  = 0
        self.prefijo = prefijo
        self._inicio = time.monotonic()
        self._ancho  = 30

    def avanzar(self, n: int = 1):
        self.actual = min(self.actual + n, self.total)
        self._dibujar()

    def _dibujar(self):
        if self.total == 0:
            return
        pct     = self.actual / self.total
        llenos  = int(self._ancho * pct)
        barra   = "█" * llenos + "░" * (self._ancho - llenos)
        elapsed = time.monotonic() - self._inicio
        eta     = (elapsed / self.actual * (self.total - self.actual)) if self.actual else 0
        eta_str = f"{eta:5.1f}s" if eta < 3600 else f"{eta/60:.1f}m"
        print(
            f"\r  {self.prefijo} [{barra}] {self.actual}/{self.total} "
            f"({pct*100:5.1f}%) ETA {eta_str}   ",
            end="", flush=True,
        )

    def cerrar(self):
        self._dibujar()
        print()

# ─── Generación con reintentos ────────────────────────────────────────────────

async def generar_mp3(texto: str, voz: str, config: dict, ruta: Path):
    for intento in range(1, REINTENTOS + 1):
        try:
            communicate = edge_tts.Communicate(
                text=texto, voice=voz,
                rate=config["rate"], volume=config["volume"], pitch=config["pitch"],
            )
            await communicate.save(str(ruta))
            return True
        except Exception as e:
            if intento < REINTENTOS:
                await asyncio.sleep(BACKOFF_BASE * (2 ** (intento - 1)))
            else:
                return False, str(e)
    return False, "desconocido"

# ─── Procesamiento concurrente ────────────────────────────────────────────────

async def procesar_lista(
    items, lang_code, voz, config, directorio,
    forzar, seco, concurrencia, errores_log,
):
    pendientes = []
    omitidos   = 0
    for nombre, texto in items:
        ruta  = directorio / (nombre + ".mp3")
        existe = ruta.exists() and ruta.stat().st_size > 0
        if existe and not forzar:
            omitidos += 1
        else:
            pendientes.append((nombre, texto, ruta))

    generados = errores = 0
    if not pendientes:
        return generados, omitidos, errores

    progreso = Progreso(len(pendientes), lang_code)
    semaforo = asyncio.Semaphore(concurrencia)

    async def _tarea(nombre, texto, ruta):
        nonlocal generados, errores
        async with semaforo:
            if seco:
                generados += 1
                progreso.avanzar()
                return
            resultado = await generar_mp3(texto, voz, config, ruta)
            if resultado is True:
                generados += 1
            else:
                errores += 1
                _, motivo = resultado
                errores_log.append({
                    "archivo": str(ruta.relative_to(RAIZ)),
                    "texto":   texto,
                    "lang":    lang_code,
                    "error":   motivo,
                    "ts":      datetime.now().isoformat(timespec="seconds"),
                })
            progreso.avanzar()

    await asyncio.gather(*[_tarea(n, t, r) for n, t, r in pendientes])
    progreso.cerrar()
    return generados, omitidos, errores

# ─── Log ──────────────────────────────────────────────────────────────────────

def escribir_log(errores_log: list):
    if not errores_log:
        return
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(f"\n── Ejecución {datetime.now().isoformat(timespec='seconds')} ──\n")
        for e in errores_log:
            f.write(
                f"  [{e['lang']}] {e['archivo']}\n"
                f"       texto : {e['texto']}\n"
                f"       error : {e['error']}\n"
            )
    print(f"\n📋  Log de errores: scripts/errores-audio.log")

# ─── Main ─────────────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(description="Generador de audio para Marina 2")
    parser.add_argument("--forzar",       action="store_true")
    parser.add_argument("--solo-es",      action="store_true")
    parser.add_argument("--solo-en",      action="store_true")
    parser.add_argument("--solo-frases",  action="store_true")
    parser.add_argument("--seco",         action="store_true")
    parser.add_argument("--concurrencia", type=int, default=5, metavar="N")
    args = parser.parse_args()

    modo_solo_frases = args.solo_frases and not (args.solo_es or args.solo_en)
    conc             = max(1, min(args.concurrencia, 20))

    # ── Vocabulario desde pictos.json ────────────────────────────────────────
    # Estructura: { "id", "es", "en", "ruta_img" }
    # nombre_archivo = ruta_img sin .png
    # texto_tts      = es (español) / en (inglés)
    palabras_es, palabras_en = [], []

    if not modo_solo_frases:
        if PICTOS_JSON.exists():
            with open(PICTOS_JSON, encoding="utf-8") as f:
                catalogo = json.load(f)

            # Usar ruta_img como nombre de archivo y es/en como texto TTS
            palabras_es = [
                (e["ruta_img"].replace(".png", ""), e["es"])
                for e in catalogo if e.get("ruta_img") and e.get("es")
            ]
            palabras_en = [
                (e["ruta_img"].replace(".png", ""), e["en"])
                for e in catalogo if e.get("ruta_img") and e.get("en")
            ]

            # Agregar palabras de memorama que no estén ya en pictos.json
            if MEMORAMA_JSON.exists():
                rutas_es = {nombre for nombre, _ in palabras_es}
                rutas_en = {nombre for nombre, _ in palabras_en}
                with open(MEMORAMA_JSON, encoding="utf-8") as f:
                    temas_mem = json.load(f)
                extra_es, extra_en = [], []
                for tema in temas_mem:
                    for p in tema.get("palabras", []):
                        if isinstance(p, dict):
                            ruta = (p.get("ruta_img") or "").replace(".png", "")
                            es   = p.get("es", "").strip()
                            en   = p.get("en", "").strip()
                            if ruta and es and ruta not in rutas_es:
                                extra_es.append((ruta, es))
                                rutas_es.add(ruta)
                            if ruta and en and ruta not in rutas_en:
                                extra_en.append((ruta, en))
                                rutas_en.add(ruta)
                palabras_es += extra_es
                palabras_en += extra_en

        else:
            # Fallback: leer vocabulario.json con strings simples
            if not VOCAB_JSON.exists():
                print(f"❌  No se encontró ni {PICTOS_JSON} ni {VOCAB_JSON}")
                sys.exit(1)
            with open(VOCAB_JSON, encoding="utf-8") as f:
                vocab = json.load(f)
            es_set, en_set = set(), set()
            for _, contenido in vocab.items():
                for p in contenido.get("es", []):
                    if isinstance(p, str) and p.strip():
                        es_set.add(p.strip())
                for p in contenido.get("en", []):
                    if isinstance(p, str) and p.strip():
                        en_set.add(p.strip())
            palabras_es = [(p, p) for p in sorted(es_set)]
            palabras_en = [(p, p) for p in sorted(en_set)]

    # ── Frases ───────────────────────────────────────────────────────────────
    frases_es_items = frases_en_items = []
    piezas_es_items = piezas_en_items = []
    piezas_picto_es_items = piezas_picto_en_items = []

    if not args.solo_es and not args.solo_en:
        if not FRASES_JSON.exists():
            if args.solo_frases:
                print(f"❌  No se encontró {FRASES_JSON}")
                sys.exit(1)
            else:
                print(f"⚠️  {FRASES_JSON} no encontrado — se omiten las frases")
        else:
            with open(FRASES_JSON, encoding="utf-8") as f:
                frases = json.load(f)

            # Lookup de catálogo para resolver picto_id → ruta/texto
            catalogo_lookup = {}
            if PICTOS_JSON.exists():
                with open(PICTOS_JSON, encoding="utf-8") as f:
                    cat = json.load(f)
                catalogo_lookup = {e["id"]: e for e in cat}

            vocab_es = {nombre for nombre, _ in palabras_es}
            vocab_en = {nombre for nombre, _ in palabras_en}

            _frases_es, _frases_en = [], []
            _piezas_txt_es, _piezas_txt_en = set(), set()
            _piezas_picto_es, _piezas_picto_en = set(), set()

            for frase in frases:
                fid  = frase.get("id", "").strip()
                lang = frase.get("lang", "es").strip()

                if lang == "en":
                    texto = frase.get("en", frase.get("es", "")).strip()
                    if fid and texto:
                        _frases_en.append((fid, texto))
                    ref_vocab        = vocab_en
                    ref_piezas_txt   = _piezas_txt_en
                    ref_piezas_picto = _piezas_picto_en
                    ref_dir_audio    = DIR_EN
                    lang_key         = "en"
                else:
                    texto = frase.get("es", "").strip()
                    if fid and texto:
                        _frases_es.append((fid, texto))
                    ref_vocab        = vocab_es
                    ref_piezas_txt   = _piezas_txt_es
                    ref_piezas_picto = _piezas_picto_es
                    ref_dir_audio    = DIR_ES
                    lang_key         = "es"

                for pieza in frase.get("piezas", []):
                    if pieza.get("tipo") == "texto":
                        pt = pieza.get("texto", "").strip()
                        if pt and pt not in ref_vocab:
                            ref_piezas_txt.add(pt)

                    elif pieza.get("tipo") == "picto":
                        pid = pieza.get("picto_id")
                        if pid and catalogo_lookup:
                            entrada = catalogo_lookup.get(pid)
                            if entrada:
                                # ruta_img como nombre, es/en como TTS
                                nombre = entrada["ruta_img"].replace(".png", "")
                                tts    = entrada.get(lang_key) or entrada.get("es", "")
                                ruta_mp3 = ref_dir_audio / (nombre + ".mp3")
                                if not ruta_mp3.exists() or ruta_mp3.stat().st_size == 0:
                                    ref_piezas_picto.add((nombre, tts))
                        else:
                            # Legacy: texto directamente
                            pt = pieza.get("texto", "").strip()
                            if pt:
                                ruta_mp3 = ref_dir_audio / (pt + ".mp3")
                                if not ruta_mp3.exists() or ruta_mp3.stat().st_size == 0:
                                    ref_piezas_picto.add((pt, pt))

            frases_es_items       = _frases_es
            frases_en_items       = _frases_en
            piezas_es_items       = [(p, p) for p in sorted(_piezas_txt_es)]
            piezas_en_items       = [(p, p) for p in sorted(_piezas_txt_en)]
            piezas_picto_es_items = sorted(_piezas_picto_es, key=lambda x: x[0])
            piezas_picto_en_items = sorted(_piezas_picto_en, key=lambda x: x[0])

    # ── Resumen inicial ───────────────────────────────────────────────────────
    print(f"\n🌊  Marina 2 — Generador de audio")
    print(f"   Concurrencia    : {conc} peticiones simultáneas")
    if not modo_solo_frases:
        print(f"   Vocabulario ES  : {len(palabras_es)} palabras  →  {VOZ_ES}")
        print(f"   Vocabulario EN  : {len(palabras_en)} palabras  →  {VOZ_EN}")
    if frases_es_items or piezas_es_items or piezas_picto_es_items:
        print(f"   Frases ES       : {len(frases_es_items)} enunciados · "
              f"{len(piezas_es_items)} piezas texto · "
              f"{len(piezas_picto_es_items)} piezas picto sin MP3")
    if frases_en_items or piezas_en_items or piezas_picto_en_items:
        print(f"   Frases EN       : {len(frases_en_items)} enunciados · "
              f"{len(piezas_en_items)} piezas texto · "
              f"{len(piezas_picto_en_items)} piezas picto sin MP3")
    if args.seco:
        print(f"   ⚡ DRY RUN — no se generará ningún archivo")
    print()

    # ── Crear directorios ─────────────────────────────────────────────────────
    if not args.seco:
        DIR_ES.mkdir(parents=True, exist_ok=True)
        DIR_EN.mkdir(parents=True, exist_ok=True)
        if frases_es_items or piezas_es_items:
            DIR_FRASES_ES.mkdir(parents=True, exist_ok=True)
        if frases_en_items or piezas_en_items:
            DIR_FRASES_EN.mkdir(parents=True, exist_ok=True)

    # ── Generar ───────────────────────────────────────────────────────────────
    total_gen = total_omit = total_err = 0
    errores_log = []
    t_inicio = time.monotonic()

    async def run(items, code, voz, cfg, d):
        nonlocal total_gen, total_omit, total_err
        if not items:
            return
        print(f"📢  {code} ({len(items)} archivos)")
        g, o, e = await procesar_lista(
            items, code, voz, cfg, d,
            args.forzar, args.seco, conc, errores_log,
        )
        total_gen += g; total_omit += o; total_err += e
        print(f"   ✅ {g} generados · {o} ya existían · {e} errores\n")

    if not args.solo_en  and not args.solo_frases:
        await run(palabras_es,           "vocab/es",               VOZ_ES, CONFIG_ES,     DIR_ES)
    if not args.solo_es  and not args.solo_frases:
        await run(palabras_en,           "vocab/en",               VOZ_EN, CONFIG_EN,     DIR_EN)
    if not args.solo_es  and not args.solo_en:
        await run(frases_es_items,       "frases/es enunciados",   VOZ_ES, CONFIG_FRASES, DIR_FRASES_ES)
        await run(piezas_es_items,       "frases/es piezas texto", VOZ_ES, CONFIG_ES,     DIR_FRASES_ES)
        await run(piezas_picto_es_items, "frases/es picto",        VOZ_ES, CONFIG_ES,     DIR_ES)
        await run(frases_en_items,       "frases/en enunciados",   VOZ_EN, CONFIG_FRASES, DIR_FRASES_EN)
        await run(piezas_en_items,       "frases/en piezas texto", VOZ_EN, CONFIG_EN,     DIR_FRASES_EN)
        await run(piezas_picto_en_items, "frases/en picto",        VOZ_EN, CONFIG_EN,     DIR_EN)

    # ── Resumen final ─────────────────────────────────────────────────────────
    elapsed = time.monotonic() - t_inicio
    dur_str = f"{elapsed:.1f}s" if elapsed < 60 else f"{elapsed/60:.1f}m"

    print("─" * 48)
    print(f"  Total generados : {total_gen}")
    print(f"  Total omitidos  : {total_omit}")
    print(f"  Total errores   : {total_err}")
    print(f"  Tiempo total    : {dur_str}")

    if errores_log:
        escribir_log(errores_log)
        print(f"\n⚠️  {total_err} error(es) — ver scripts/errores-audio.log")
        print(f"   Para reintentar: python scripts/generar-audio.py --forzar")

    if not args.seco and total_gen > 0:
        print(f"\n💡  Haz commit y push — el GitHub Action actualizará assets-manifest.json")


if __name__ == "__main__":
    asyncio.run(main())