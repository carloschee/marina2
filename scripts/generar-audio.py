#!/usr/bin/env python3
"""
scripts/generar-audio.py — Marina 2
Genera archivos MP3 para vocabulario y frases usando edge-tts.
Voces neurales de Microsoft Edge — gratuito, sin API key.

Uso:
  pip install edge-tts
  python scripts/generar-audio.py

Salida:
  assets/audio/es/{palabra}.mp3         ← vocabulario español
  assets/audio/en/{word}.mp3            ← vocabulary english
  assets/audio/frases/es/{id}.mp3       ← frases completas ES
  assets/audio/frases/es/{pieza}.mp3    ← piezas de texto ES
  assets/audio/frases/en/{id}.mp3       ← phrases EN
  assets/audio/frases/en/{pieza}.mp3    ← text pieces EN

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

VOZ_ES     = "es-MX-DaliaNeural"
VOZ_EN     = "en-US-AriaNeural"

CONFIG_ES     = {"rate": "-8%",  "volume": "+0%", "pitch": "+0Hz"}
CONFIG_EN     = {"rate": "-5%",  "volume": "+0%", "pitch": "+0Hz"}
CONFIG_FRASES = {"rate": "-12%", "volume": "+0%", "pitch": "+0Hz"}

REINTENTOS    = 3          # intentos por archivo antes de contar como error
BACKOFF_BASE  = 1.0        # segundos base para backoff exponencial

RAIZ          = Path(__file__).parent.parent
VOCAB_JSON    = RAIZ / "data" / "vocabulario.json"
FRASES_JSON   = RAIZ / "data" / "frases.json"
DIR_AUDIO     = RAIZ / "assets" / "audio"
DIR_ES        = DIR_AUDIO / "es"
DIR_EN        = DIR_AUDIO / "en"
DIR_FRASES_ES = DIR_AUDIO / "frases" / "es"
DIR_FRASES_EN = DIR_AUDIO / "frases" / "en"
LOG_PATH      = RAIZ / "scripts" / "errores-audio.log"

# ─── Progreso en terminal (sin dependencias externas) ─────────────────────────

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
        pct      = self.actual / self.total
        llenos   = int(self._ancho * pct)
        barra    = "█" * llenos + "░" * (self._ancho - llenos)
        elapsed  = time.monotonic() - self._inicio
        eta      = (elapsed / self.actual * (self.total - self.actual)) if self.actual else 0
        eta_str  = f"{eta:5.1f}s" if eta < 3600 else f"{eta/60:.1f}m"
        print(
            f"\r  {self.prefijo} [{barra}] {self.actual}/{self.total} "
            f"({pct*100:5.1f}%) ETA {eta_str}   ",
            end="", flush=True
        )

    def cerrar(self):
        self._dibujar()
        print()  # newline final

# ─── Generación con reintentos ────────────────────────────────────────────────

async def generar_mp3(texto: str, voz: str, config: dict, ruta: Path) -> bool:
    """
    Intenta generar el MP3 hasta REINTENTOS veces con backoff exponencial.
    Retorna True si tuvo éxito, False si todos los intentos fallaron.
    """
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
                espera = BACKOFF_BASE * (2 ** (intento - 1))  # 1s, 2s, 4s
                await asyncio.sleep(espera)
            else:
                return False, str(e)
    return False, "desconocido"

# ─── Procesamiento concurrente ────────────────────────────────────────────────

async def procesar_lista(
    items:        list,
    lang_code:    str,
    voz:          str,
    config:       dict,
    directorio:   Path,
    forzar:       bool,
    seco:         bool,
    concurrencia: int,
    errores_log:  list,
) -> tuple:
    """
    Procesa una lista de (nombre_archivo, texto) con concurrencia controlada.
    Retorna (generados, omitidos, errores).
    """
    # Separar los que hay que generar de los que ya existen
    pendientes = []
    omitidos   = 0
    for nombre, texto in items:
        ruta   = directorio / (nombre + ".mp3")
        existe = ruta.exists() and ruta.stat().st_size > 0
        if existe and not forzar:
            omitidos += 1
        else:
            pendientes.append((nombre, texto, ruta))

    generados = 0
    errores   = 0

    if not pendientes:
        return generados, omitidos, errores

    progreso  = Progreso(len(pendientes), lang_code)
    semaforo  = asyncio.Semaphore(concurrencia)

    async def _tarea(nombre, texto, ruta):
        nonlocal generados, errores
        async with semaforo:
            if seco:
                generados += 1
                progreso.avanzar()
                return

            resultado = await generar_mp3(texto, voz, config, ruta)

            # generar_mp3 retorna True o (False, motivo)
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

# ─── Log de errores ───────────────────────────────────────────────────────────

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
    print(f"\n📋  Log de errores guardado en: scripts/errores-audio.log")

# ─── Main ─────────────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(description="Generador de audio para Marina 2")
    parser.add_argument("--forzar",          action="store_true")
    parser.add_argument("--solo-es",         action="store_true")
    parser.add_argument("--solo-en",         action="store_true")
    parser.add_argument("--solo-frases",     action="store_true")
    parser.add_argument("--seco",            action="store_true")
    parser.add_argument("--concurrencia",    type=int, default=5,
                        metavar="N", help="Peticiones simultáneas (default: 5)")
    args = parser.parse_args()

    modo_solo_frases = args.solo_frases and not (args.solo_es or args.solo_en)
    conc             = max(1, min(args.concurrencia, 20))  # clamp 1–20

    # ── Vocabulario ──────────────────────────────────────────────────────────
    palabras_es, palabras_en = [], []

    if not modo_solo_frases:
        if not VOCAB_JSON.exists():
            print(f"❌  No se encontró {VOCAB_JSON}"); sys.exit(1)
        with open(VOCAB_JSON, encoding="utf-8") as f:
            vocab = json.load(f)
        es_set, en_set = set(), set()
        for _, contenido in vocab.items():
            for p in contenido.get("es", []):
                if p.strip(): es_set.add(p.strip())
            for p in contenido.get("en", []):
                if p.strip(): en_set.add(p.strip())
        palabras_es = [(p, p) for p in sorted(es_set)]
        palabras_en = [(p, p) for p in sorted(en_set)]

    # ── Frases ───────────────────────────────────────────────────────────────
    frases_es_items = []
    frases_en_items = []
    piezas_texto_es = set()
    piezas_texto_en = set()

    if not args.solo_es and not args.solo_en:
        if not FRASES_JSON.exists():
            if args.solo_frases:
                print(f"❌  No se encontró {FRASES_JSON}"); sys.exit(1)
            else:
                print(f"⚠️  {FRASES_JSON} no encontrado — se omiten las frases")
        else:
            with open(FRASES_JSON, encoding="utf-8") as f:
                frases = json.load(f)

            vocab_es = set(p for p, _ in palabras_es)
            vocab_en = set(p for p, _ in palabras_en)

            for frase in frases:
                fid  = frase.get("id", "").strip()
                lang = frase.get("lang", "es").strip()

                if lang == "en":
                    texto = frase.get("en", frase.get("es", "")).strip()
                    if fid and texto: frases_en_items.append((fid, texto))
                else:
                    texto = frase.get("es", "").strip()
                    if fid and texto: frases_es_items.append((fid, texto))

                ref_vocab = vocab_en if lang == "en" else vocab_es
                ref_set   = piezas_texto_en if lang == "en" else piezas_texto_es
                for pieza in frase.get("piezas", []):
                    if pieza.get("tipo") == "texto":
                        pt = pieza.get("texto", "").strip()
                        if pt and pt not in ref_vocab:
                            ref_set.add(pt)

    piezas_es_items = [(p, p) for p in sorted(piezas_texto_es)]
    piezas_en_items = [(p, p) for p in sorted(piezas_texto_en)]

    # ── Resumen inicial ───────────────────────────────────────────────────────
    total_archivos = sum([
        len(palabras_es) if not args.solo_en  and not args.solo_frases else 0,
        len(palabras_en) if not args.solo_es  and not args.solo_frases else 0,
        len(frases_es_items) + len(piezas_es_items) if not args.solo_es and not args.solo_en else 0,
        len(frases_en_items) + len(piezas_en_items) if not args.solo_es and not args.solo_en else 0,
    ])

    print(f"\n🌊  Marina 2 — Generador de audio")
    print(f"   Concurrencia    : {conc} peticiones simultáneas")
    if not modo_solo_frases:
        print(f"   Vocabulario ES  : {len(palabras_es)} palabras  →  {VOZ_ES}")
        print(f"   Vocabulario EN  : {len(palabras_en)} palabras  →  {VOZ_EN}")
    if frases_es_items or piezas_es_items:
        print(f"   Frases ES       : {len(frases_es_items)} enunciados + {len(piezas_es_items)} piezas")
    if frases_en_items or piezas_en_items:
        print(f"   Frases EN       : {len(frases_en_items)} enunciados + {len(piezas_en_items)} piezas")
    print(f"   Total           : {total_archivos} archivos")
    if args.seco:
        print(f"   ⚡ DRY RUN — no se generará ningún archivo")
    print()

    # ── Crear directorios ─────────────────────────────────────────────────────
    if not args.seco:
        DIR_ES.mkdir(parents=True, exist_ok=True)
        DIR_EN.mkdir(parents=True, exist_ok=True)
        if frases_es_items or piezas_es_items: DIR_FRASES_ES.mkdir(parents=True, exist_ok=True)
        if frases_en_items or piezas_en_items: DIR_FRASES_EN.mkdir(parents=True, exist_ok=True)

    # ── Generar ───────────────────────────────────────────────────────────────
    total_gen = total_omit = total_err = 0
    errores_log = []
    t_inicio = time.monotonic()

    async def run(items, code, voz, cfg, d):
        nonlocal total_gen, total_omit, total_err
        if not items: return
        print(f"📢  {code} ({len(items)} archivos)")
        g, o, e = await procesar_lista(
            items, code, voz, cfg, d,
            args.forzar, args.seco, conc, errores_log
        )
        total_gen += g; total_omit += o; total_err += e
        print(f"   ✅ {g} generados · {o} ya existían · {e} errores\n")

    if not args.solo_en  and not args.solo_frases:
        await run(palabras_es,     "vocab/es",            VOZ_ES, CONFIG_ES,     DIR_ES)
    if not args.solo_es  and not args.solo_frases:
        await run(palabras_en,     "vocab/en",            VOZ_EN, CONFIG_EN,     DIR_EN)
    if not args.solo_es  and not args.solo_en:
        await run(frases_es_items, "frases/es enunciados", VOZ_ES, CONFIG_FRASES, DIR_FRASES_ES)
        await run(piezas_es_items, "frases/es piezas",     VOZ_ES, CONFIG_ES,     DIR_FRASES_ES)
        await run(frases_en_items, "frases/en enunciados", VOZ_EN, CONFIG_FRASES, DIR_FRASES_EN)
        await run(piezas_en_items, "frases/en piezas",     VOZ_EN, CONFIG_EN,     DIR_FRASES_EN)

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