#!/usr/bin/env python3
"""
scripts/descargar-pictos.py — Marina 2
Lee vocabulario.json, frases.json y memorama.json y descarga los
pictogramas correspondientes desde la API de ARASAAC.

Flujo por palabra:
  1. Busca en api.arasaac.org/api/pictograms/es/search/{palabra}
  2. Toma el primer resultado (_id)
  3. Descarga static.arasaac.org/images/arasaac/{id}/{id}_500.png
  4. Guarda como assets/pictogramas/es/{palabra}.png

Uso:
  pip install aiohttp
  python scripts/descargar-pictos.py

Opciones:
  --forzar          Reemplaza pictogramas aunque ya existan
  --solo-vocab      Solo palabras del vocabulario
  --solo-frases     Solo palabras de frases.json
  --solo-memorama   Solo palabras de memorama.json
  --seco            Dry run — muestra qué descargaría
  --concurrencia N  Peticiones simultáneas (default: 4)
"""

import asyncio
import json
import sys
import argparse
import time
from pathlib import Path
from datetime import datetime
from urllib.parse import quote

try:
    import aiohttp
except ImportError:
    print("❌  aiohttp no está instalado.")
    print("   Ejecuta: pip install aiohttp")
    sys.exit(1)

# ─── Configuración ────────────────────────────────────────────────────────────

API_BASE    = "https://api.arasaac.org/api"
IMG_BASE    = "https://static.arasaac.org/pictograms"
LANG_BUSQ   = "es"       # idioma de búsqueda — siempre español para Marina 2
IMG_SIZE    = 500         # tamaño de imagen (300 o 500)

REINTENTOS  = 3
BACKOFF     = 1.0

RAIZ          = Path(__file__).parent.parent
VOCAB_JSON    = RAIZ / "data" / "vocabulario.json"
FRASES_JSON   = RAIZ / "data" / "frases.json"
MEMORAMA_JSON = RAIZ / "data" / "memorama.json"
PICTOS_JSON   = RAIZ / "data" / "pictos.json"
DIR_PICTOS    = RAIZ / "assets" / "pictogramas" / "es"
LOG_PATH      = RAIZ / "scripts" / "errores-pictos.log"

# Cache de búsquedas para no repetir la misma palabra
_cache_ids: dict[str, int | None] = {}

# ─── Progreso ─────────────────────────────────────────────────────────────────

class Progreso:
    def __init__(self, total: int, prefijo: str = ""):
        self.total   = total
        self.actual  = 0
        self.prefijo = prefijo
        self._inicio = time.monotonic()
        self._ancho  = 28

    def avanzar(self):
        self.actual = min(self.actual + 1, self.total)
        pct     = self.actual / self.total if self.total else 0
        llenos  = int(self._ancho * pct)
        barra   = "█" * llenos + "░" * (self._ancho - llenos)
        elapsed = time.monotonic() - self._inicio
        eta     = (elapsed / self.actual * (self.total - self.actual)) if self.actual else 0
        eta_str = f"{eta:5.1f}s" if eta < 3600 else f"{eta/60:.1f}m"
        print(
            f"\r  {self.prefijo} [{barra}] {self.actual}/{self.total} "
            f"({pct*100:5.1f}%) ETA {eta_str}   ",
            end="", flush=True
        )

    def cerrar(self):
        self.avanzar()
        print()

# ─── API ARASAAC ──────────────────────────────────────────────────────────────

async def buscar_id(session: aiohttp.ClientSession, palabra: str, lang: str = 'es') -> int | None:
    """Busca el _id ARASAAC de una palabra. Retorna el id del primer resultado o None."""
    cache_key = f"{lang}:{palabra}"
    if cache_key in _cache_ids:
        return _cache_ids[cache_key]

    # ARASAAC soporta búsqueda en múltiples idiomas
    lang_api = lang if lang in ('es', 'en', 'fr', 'de', 'it', 'pt') else 'es'
    url = f"{API_BASE}/pictograms/{lang_api}/search/{quote(palabra)}"
    for intento in range(1, REINTENTOS + 1):
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as r:
                if r.status == 200:
                    data = await r.json(content_type=None)
                    if data and isinstance(data, list):
                        pid = data[0].get("_id")
                        _cache_ids[cache_key] = pid
                        return pid
                elif r.status == 404:
                    _cache_ids[cache_key] = None
                    return None
        except Exception:
            pass
        if intento < REINTENTOS:
            await asyncio.sleep(BACKOFF * (2 ** (intento - 1)))

    _cache_ids[cache_key] = None
    return None


async def descargar_picto(
    session:     aiohttp.ClientSession,
    palabra:     str,
    origen:      str,
    ruta:        Path,
    forzar:      bool,
    seco:        bool,
    errores_log: list,
    progreso:    Progreso,
    lang:        str = 'es',
) -> str:
    """
    Descarga el pictograma de una palabra.
    Retorna: 'descargado' | 'omitido' | 'no_encontrado' | 'error'
    """
    if ruta.exists() and ruta.stat().st_size > 0 and not forzar:
        progreso.avanzar()
        return 'omitido'

    pid = await buscar_id(session, palabra, lang)
    if pid is None:
        errores_log.append({
            "origen":  origen,
            "palabra": palabra,
            "error":   "No encontrado en ARASAAC",
            "ts":      datetime.now().isoformat(timespec="seconds"),
        })
        progreso.avanzar()
        return 'no_encontrado'

    if seco:
        progreso.avanzar()
        return 'descargado'

    img_url = f"{IMG_BASE}/{pid}/{pid}_{IMG_SIZE}.png"
    ultimo_error = "sin respuesta"
    # Headers necesarios — ARASAAC bloquea sin Referer de su dominio
    headers = {
        "Referer":    "https://arasaac.org/",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept":     "image/png,image/*,*/*;q=0.8",
    }
    for intento in range(1, REINTENTOS + 1):
        try:
            async with session.get(img_url, timeout=aiohttp.ClientTimeout(total=20), headers=headers) as r:
                if r.status == 200:
                    data = await r.read()
                    if len(data) < 500:
                        # Imagen demasiado pequeña — probablemente placeholder de error
                        ultimo_error = f"imagen inválida ({len(data)} bytes)"
                    else:
                        ruta.write_bytes(data)
                        progreso.avanzar()
                        return 'descargado'
                else:
                    ultimo_error = f"HTTP {r.status}"
        except asyncio.TimeoutError:
            ultimo_error = "timeout"
        except Exception as e:
            ultimo_error = str(e)

        if intento < REINTENTOS:
            await asyncio.sleep(BACKOFF * (2 ** (intento - 1)))

    # Todos los intentos fallaron — registrar en log
    errores_log.append({
        "origen":  origen,
        "palabra": palabra,
        "id":      pid,
        "url":     img_url,
        "error":   ultimo_error,
        "ts":      datetime.now().isoformat(timespec="seconds"),
    })
    progreso.avanzar()
    return 'error'


async def procesar_palabras(
    palabras:    list,
    prefijo:     str,
    origen:      str,
    forzar:      bool,
    seco:        bool,
    concurrencia: int,
    errores_log: list,
    lang:        str = 'es',
) -> tuple[int, int, int, int]:
    """
    Descarga pictogramas para una lista de palabras.
    palabras puede ser list[str] o list[tuple(nombre_archivo, palabra_busqueda, lang)]
    Retorna (descargados, omitidos, no_encontrados, errores).
    """
    if not palabras:
        return 0, 0, 0, 0

    print(f"📥  {prefijo} ({len(palabras)} palabras)")
    progreso   = Progreso(len(palabras), prefijo)
    semaforo   = asyncio.Semaphore(concurrencia)
    resultados = []

    connector = aiohttp.TCPConnector(limit=concurrencia + 4)
    async with aiohttp.ClientSession(connector=connector) as session:

        async def _tarea(item):
            async with semaforo:
                # item puede ser str o (nombre_archivo, termino_busqueda, lang)
                if isinstance(item, tuple) and len(item) == 3:
                    nombre_archivo, termino, item_lang = item
                else:
                    nombre_archivo = termino = item
                    item_lang = lang
                ruta = DIR_PICTOS / f"{nombre_archivo}.png"
                res  = await descargar_picto(
                    session, termino, origen, ruta, forzar, seco, errores_log, progreso, item_lang
                )
                resultados.append(res)
                await asyncio.sleep(0.15)

        await asyncio.gather(*[_tarea(p) for p in palabras])

    progreso.cerrar()
    desc    = resultados.count('descargado')
    omit    = resultados.count('omitido')
    no_enc  = resultados.count('no_encontrado')
    err     = resultados.count('error')
    print(f"   ✅ {desc} descargados · {omit} ya existían · {no_enc} no encontrados · {err} errores\n")
    return desc, omit, no_enc, err

# ─── Recolección de palabras ──────────────────────────────────────────────────

def palabras_de_vocab() -> set:
    # Con catálogo: generar tuplas (nombre_archivo, termino_busqueda, lang)
    if PICTOS_JSON.exists():
        with open(PICTOS_JSON, encoding="utf-8") as f:
            catalogo = json.load(f)
        items = set()
        for e in catalogo:
            if e.get("archivo_es") and e.get("es"):
                items.add((e["archivo_es"].replace(".png",""), e["es"], "es"))
            if e.get("archivo_en") and e.get("en"):
                items.add((e["archivo_en"].replace(".png",""), e["en"], "en"))
        return items
    # Legacy: vocabulario.json con strings
    if not VOCAB_JSON.exists():
        print(f"⚠️  {VOCAB_JSON} no encontrado")
        return set()
    with open(VOCAB_JSON, encoding="utf-8") as f:
        vocab = json.load(f)
    palabras = set()
    for contenido in vocab.values():
        for p in contenido.get("es", []):
            if isinstance(p, str) and p.strip():
                palabras.add(p.strip())
    return palabras


def palabras_de_frases() -> set[str]:
    if PICTOS_JSON.exists():
        return set()  # en modo catálogo todo viene de palabras_de_vocab
    if not FRASES_JSON.exists():
        print(f"⚠️  {FRASES_JSON} no encontrado")
        return set()
    with open(FRASES_JSON, encoding="utf-8") as f:
        frases = json.load(f)
    palabras = set()
    for frase in frases:
        for pieza in frase.get("piezas", []):
            if pieza.get("tipo") == "picto":
                t = pieza.get("texto", "")
                if isinstance(t, str) and t.strip():
                    palabras.add(t.strip())
    return palabras


def palabras_de_memorama() -> set[str]:
    if PICTOS_JSON.exists():
        return set()  # en modo catálogo todo viene de palabras_de_vocab
    if not MEMORAMA_JSON.exists():
        print(f"⚠️  {MEMORAMA_JSON} no encontrado")
        return set()
    with open(MEMORAMA_JSON, encoding="utf-8") as f:
        temas = json.load(f)
    palabras = set()
    for tema in temas:
        for p in tema.get("palabras", []):
            if isinstance(p, str) and p.strip():
                palabras.add(p.strip())
            elif isinstance(p, dict) and p.get("es"):
                palabras.add(p["es"].strip())
    return palabras

# ─── Log de errores ───────────────────────────────────────────────────────────

def escribir_log(errores_log: list):
    if not errores_log:
        return
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().isoformat(timespec="seconds")

    # ── Log de texto (legible en consola) ────────────────────────────────────
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(f"\n── Ejecución {ts} ──\n")
        for e in errores_log:
            origen = e.get('origen', '?')
            linea  = f"  {origen} → {e['palabra']}"
            if e.get('id'):  linea += f" (id:{e['id']})"
            linea += f" → {e['error']}"
            if e.get('url'): linea += f"\n    url: {e['url']}"
            linea += "\n"
            f.write(linea)

    # ── TSV (abrir con Excel / Google Sheets) ────────────────────────────────
    tsv_path   = LOG_PATH.with_suffix('.tsv')
    hay_header = tsv_path.exists() and tsv_path.stat().st_size > 0

    with open(tsv_path, "a", encoding="utf-8-sig", newline="") as f:
        # utf-8-sig = BOM para que Excel lo detecte como UTF-8 automáticamente
        if not hay_header:
            f.write("ejecucion\torigen\tpalabra\tid_arasaac\terror\turl\n")
        for e in errores_log:
            fila = "\t".join([
                ts,
                e.get('origen',  ''),
                e.get('palabra', ''),
                str(e.get('id',  '') or ''),
                e.get('error',   ''),
                e.get('url',     ''),
            ])
            f.write(fila + "\n")

    print(f"📋  Log texto : scripts/errores-pictos.log")
    print(f"📊  Log TSV   : scripts/errores-pictos.tsv  (abrir con Excel)")

# ─── Main ─────────────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(description="Descargador de pictogramas ARASAAC para Marina 2")
    parser.add_argument("--forzar",         action="store_true", help="Reemplaza pictos existentes")
    parser.add_argument("--solo-vocab",     action="store_true", help="Solo vocabulario.json")
    parser.add_argument("--solo-frases",    action="store_true", help="Solo frases.json (piezas picto)")
    parser.add_argument("--solo-memorama",  action="store_true", help="Solo memorama.json")
    parser.add_argument("--seco",           action="store_true", help="Dry run")
    parser.add_argument("--concurrencia",   type=int, default=4, metavar="N",
                        help="Peticiones simultáneas (default: 4, max: 8)")
    args = parser.parse_args()

    conc = max(1, min(args.concurrencia, 8))  # ARASAAC limita peticiones — máx 8

    # Determinar qué fuentes usar
    solo_alguno = args.solo_vocab or args.solo_frases or args.solo_memorama
    usar_vocab    = args.solo_vocab    or not solo_alguno
    usar_frases   = args.solo_frases   or not solo_alguno
    usar_memorama = args.solo_memorama or not solo_alguno

    # Recolectar palabras por fuente (sin duplicados entre sí)
    vocab_p    = palabras_de_vocab()    if usar_vocab    else set()
    frases_p   = palabras_de_frases()   if usar_frases   else set()
    memorama_p = palabras_de_memorama() if usar_memorama else set()

    # Deduplicar: palabras que ya están en vocab no se repiten en frases/memorama
    frases_p   -= vocab_p
    memorama_p -= vocab_p | frases_p

    total = len(vocab_p) + len(frases_p) + len(memorama_p)

    print(f"\n🌊  Marina 2 — Descargador de pictogramas ARASAAC")
    print(f"   Concurrencia    : {conc} peticiones simultáneas")
    print(f"   Vocabulario     : {len(vocab_p)} palabras")
    print(f"   Frases (picto)  : {len(frases_p)} palabras")
    print(f"   Memorama        : {len(memorama_p)} palabras")
    print(f"   Total único     : {total} palabras")
    if args.seco:
        print(f"   ⚡ DRY RUN — no se descargará ningún archivo")
    print()

    if not total:
        print("ℹ️  No hay palabras para descargar.")
        return

    DIR_PICTOS.mkdir(parents=True, exist_ok=True)

    errores_log = []
    total_desc = total_omit = total_no_enc = total_err = 0
    t_inicio = time.monotonic()

    async def run(palabras, prefijo, origen, lang='es'):
        nonlocal total_desc, total_omit, total_no_enc, total_err
        d, o, n, e = await procesar_palabras(
            sorted(palabras) if isinstance(next(iter(palabras), None), str) else palabras,
            prefijo, origen, args.forzar, args.seco, conc, errores_log, lang
        )
        total_desc  += d; total_omit += o
        total_no_enc += n; total_err  += e

    if vocab_p:    await run(vocab_p,    "vocabulario",   "vocabulario.json")
    if frases_p:   await run(frases_p,   "frases (picto)", "frases.json")
    if memorama_p: await run(memorama_p, "memorama",       "memorama.json")

    elapsed = time.monotonic() - t_inicio
    dur_str = f"{elapsed:.1f}s" if elapsed < 60 else f"{elapsed/60:.1f}m"

    print("─" * 50)
    print(f"  Descargados     : {total_desc}")
    print(f"  Ya existían     : {total_omit}")
    print(f"  No encontrados  : {total_no_enc}")
    print(f"  Errores         : {total_err}")
    print(f"  Tiempo total    : {dur_str}")

    if errores_log:
        escribir_log(errores_log)
        print(f"\n⚠️  Palabras no encontradas o con error — ver scripts/errores-pictos.log")
        print(f"   Puedes agregar esos pictogramas manualmente a assets/pictogramas/es/")

    if not args.seco and total_desc > 0:
        print(f"\n💡  Haz commit y push — el GitHub Action actualizará assets-manifest.json")


if __name__ == "__main__":
    asyncio.run(main())