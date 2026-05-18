#!/usr/bin/env python3
"""
scripts/depurar-pictos.py — Marina 2

Depura data/pictos.json en tres pasos:

  1. LIMPIAR   — elimina los campos redundantes tts_es y tts_en
  2. CORREGIR  — para entradas con en sospechoso (muy largo, con signos,
                 palabras técnicas, etc.) consulta la API de ARASAAC en ES
                 para obtener la keyword en inglés validada por humanos
  3. REPORTAR  — genera scripts/pictos-revisar.tsv con las entradas que
                 quedaron con en vacío o que no se pudieron verificar,
                 para corrección manual

La estructura destino es:
  { "id": 1001, "es": "árbol", "en": "tree", "ruta_img": "arbol.png" }

Uso:
  pip install aiohttp
  python scripts/depurar-pictos.py

Opciones:
  --seco         Muestra qué haría sin modificar pictos.json
  --sin-arasaac  Solo limpia tts_es/tts_en, no consulta ARASAAC
  --forzar-todos Consulta ARASAAC para TODAS las entradas, no solo las sospechosas
  --concurrencia N  Peticiones simultáneas a ARASAAC (default: 4, max: 6)
"""

import asyncio
import csv
import json
import re
import sys
import argparse
import time
from pathlib import Path
from urllib.parse import quote

try:
    import aiohttp
except ImportError:
    print("❌  aiohttp no está instalado. Ejecuta: pip install aiohttp")
    sys.exit(1)

RAIZ       = Path(__file__).parent.parent
PICTOS_JSON = RAIZ / "data" / "pictos.json"
TSV_OUT    = RAIZ / "scripts" / "pictos-revisar.tsv"

API_BASE   = "https://api.arasaac.org/api/pictograms"
REINTENTOS = 3
BACKOFF    = 1.2

# ─── Detección de traducciones sospechosas ────────────────────────────────────
# Patrones que indican que MyMemory dio una traducción incorrecta.
# Patrones individuales — NO unir con | para evitar matches parciales
_PATRONES_SOSPECHOSOS = [
    (r'\d',                                                         'contiene número'),
    (r'[()[\]{}]',                                                  'contiene paréntesis'),
    (r'\b(type|family|assembly|genus|species|order|class|var)\b',  'término técnico'),
    (r'\.\s*$',                                                    'termina con punto'),
    (r'.{35,}',                                                      'texto muy largo'),
    (r'\bthe\b.*\bthe\b',                                        'traducción literal'),
]

def es_sospechoso(en: str) -> bool:
    """True si el campo en parece una mala traducción."""
    if not en or not en.strip():
        return True  # vacío
    for patron, _ in _PATRONES_SOSPECHOSOS:
        if re.search(patron, en.strip(), re.IGNORECASE):
            return True
    return False


# ─── Consulta ARASAAC ─────────────────────────────────────────────────────────
_cache: dict[str, str | None] = {}

async def keyword_arasaac(
    session: aiohttp.ClientSession,
    palabra_es: str,
) -> str | None:
    """
    Busca la keyword en inglés de un pictograma usando la API de ARASAAC.
    Flujo: busca en ES → toma el primer resultado → lee sus keywords EN.
    Devuelve la keyword EN o None si no se encuentra.
    """
    if palabra_es in _cache:
        return _cache[palabra_es]

    url_busqueda = f"{API_BASE}/es/search/{quote(palabra_es)}"

    for intento in range(1, REINTENTOS + 1):
        try:
            async with session.get(
                url_busqueda,
                timeout=aiohttp.ClientTimeout(total=10),
                headers={"Accept": "application/json"},
            ) as r:
                if r.status == 404:
                    _cache[palabra_es] = None
                    return None
                if r.status != 200:
                    raise aiohttp.ClientError(f"HTTP {r.status}")
                resultados = await r.json(content_type=None)
                if not resultados or not isinstance(resultados, list):
                    _cache[palabra_es] = None
                    return None
                arasaac_id = resultados[0].get("_id")
                if not arasaac_id:
                    _cache[palabra_es] = None
                    return None
                break
        except Exception:
            if intento < REINTENTOS:
                await asyncio.sleep(BACKOFF * (2 ** (intento - 1)))
            else:
                _cache[palabra_es] = None
                return None

    # Obtener keywords EN del pictograma encontrado
    url_en = f"{API_BASE}/{arasaac_id}?lang=en"
    for intento in range(1, REINTENTOS + 1):
        try:
            async with session.get(
                url_en,
                timeout=aiohttp.ClientTimeout(total=10),
                headers={"Accept": "application/json"},
            ) as r:
                if r.status != 200:
                    raise aiohttp.ClientError(f"HTTP {r.status}")
                data = await r.json(content_type=None)
                keywords = data.get("keywords", [])
                if keywords:
                    kw = keywords[0].get("keyword", "").strip().lower()
                    _cache[palabra_es] = kw or None
                    return _cache[palabra_es]
                _cache[palabra_es] = None
                return None
        except Exception:
            if intento < REINTENTOS:
                await asyncio.sleep(BACKOFF * (2 ** (intento - 1)))
            else:
                _cache[palabra_es] = None
                return None

    _cache[palabra_es] = None
    return None


# ─── Progreso ─────────────────────────────────────────────────────────────────
class Progreso:
    def __init__(self, total: int, prefijo: str = ""):
        self.total = total
        self.actual = 0
        self.prefijo = prefijo
        self._inicio = time.monotonic()

    def avanzar(self, texto: str = ""):
        self.actual = min(self.actual + 1, self.total)
        pct     = self.actual / self.total if self.total else 0
        llenos  = int(30 * pct)
        barra   = "█" * llenos + "░" * (30 - llenos)
        elapsed = time.monotonic() - self._inicio
        eta     = (elapsed / self.actual * (self.total - self.actual)) if self.actual else 0
        sufijo  = f" {texto[:28]}" if texto else ""
        print(
            f"\r  {self.prefijo} [{barra}] {self.actual}/{self.total}"
            f" ({pct*100:4.0f}%) ETA {eta:4.0f}s{sufijo:<30}",
            end="", flush=True,
        )

    def cerrar(self):
        self.avanzar()
        print()


# ─── Main ─────────────────────────────────────────────────────────────────────
async def main():
    parser = argparse.ArgumentParser(description="Depurador de pictos.json para Marina 2")
    parser.add_argument("--seco",          action="store_true", help="No modifica pictos.json")
    parser.add_argument("--sin-arasaac",   action="store_true", help="Solo limpia campos, sin consultar ARASAAC")
    parser.add_argument("--forzar-todos",  action="store_true", help="Consulta ARASAAC para todos, no solo sospechosos")
    parser.add_argument("--concurrencia",  type=int, default=4, metavar="N")
    args = parser.parse_args()

    conc = max(1, min(args.concurrencia, 6))  # ARASAAC pide no más de 6 concurrentes

    if not PICTOS_JSON.exists():
        print(f"❌  No se encontró {PICTOS_JSON}")
        sys.exit(1)

    with open(PICTOS_JSON, encoding="utf-8") as f:
        catalogo: list[dict] = json.load(f)

    total = len(catalogo)
    print(f"\n🌊  Marina 2 — Depurador de pictos.json")
    print(f"   Entradas      : {total}")
    if args.seco:
        print(f"   ⚡ DRY RUN — no se escribirá ningún archivo\n")

    # ── Paso 1: identificar campos y entradas sospechosas ────────────────────
    con_tts       = sum(1 for e in catalogo if "tts_es" in e or "tts_en" in e)
    sospechosos   = [e for e in catalogo if es_sospechoso(e.get("en", ""))]
    sin_en        = [e for e in catalogo if not e.get("en", "").strip()]

    print(f"\n📋  Diagnóstico:")
    print(f"   Con tts_es/tts_en (a eliminar) : {con_tts}")
    print(f"   Con en vacío                   : {len(sin_en)}")
    print(f"   Con en sospechoso              : {len(sospechosos)}")

    # Entradas a consultar en ARASAAC
    if args.forzar_todos:
        a_consultar = catalogo[:]
    else:
        a_consultar = sospechosos[:]

    if not args.sin_arasaac:
        print(f"   A consultar en ARASAAC         : {len(a_consultar)}")
    print()

    # ── Paso 2: consultar ARASAAC ────────────────────────────────────────────
    correcciones: dict[int, str] = {}   # id → nueva keyword EN
    no_encontrados: list[dict]   = []

    if not args.sin_arasaac and a_consultar:
        print(f"🌐  Consultando ARASAAC ({conc} simultáneas)...")
        progreso = Progreso(len(a_consultar), "ARASAAC")
        semaforo = asyncio.Semaphore(conc)

        connector = aiohttp.TCPConnector(limit=conc + 2)
        async with aiohttp.ClientSession(connector=connector) as session:
            async def _tarea(entrada: dict):
                async with semaforo:
                    palabra = entrada.get("es", "")
                    kw = await keyword_arasaac(session, palabra)
                    if kw:
                        correcciones[entrada["id"]] = kw
                    else:
                        no_encontrados.append(entrada)
                    progreso.avanzar(palabra)
                    await asyncio.sleep(0.2)   # pausa cortés

            await asyncio.gather(*[_tarea(e) for e in a_consultar])

        progreso.cerrar()
        print(f"   ✅ {len(correcciones)} corregidos via ARASAAC")
        print(f"   ⚠️  {len(no_encontrados)} sin resultado en ARASAAC\n")

    # ── Paso 3: aplicar cambios al catálogo ──────────────────────────────────
    nuevo_catalogo = []
    stats = {"tts_eliminados": 0, "en_corregidos": 0, "sin_en": 0}

    for entrada in catalogo:
        nueva = {
            "id":       entrada["id"],
            "es":       entrada.get("es", ""),
            "en":       entrada.get("en", ""),
            "ruta_img": entrada.get("ruta_img", ""),
        }

        # Contar tts eliminados
        if "tts_es" in entrada or "tts_en" in entrada:
            stats["tts_eliminados"] += 1

        # Aplicar corrección ARASAAC si existe
        if entrada["id"] in correcciones:
            nueva["en"] = correcciones[entrada["id"]]
            stats["en_corregidos"] += 1

        # Limpiar en de puntos o espacios sobrantes
        nueva["en"] = nueva["en"].strip().rstrip(".")

        if not nueva["en"]:
            stats["sin_en"] += 1

        nuevo_catalogo.append(nueva)

    # ── Paso 4: guardar ───────────────────────────────────────────────────────
    print(f"📊  Resultado:")
    print(f"   tts_es/tts_en eliminados : {stats['tts_eliminados']}")
    print(f"   en corregidos via ARASAAC: {stats['en_corregidos']}")
    print(f"   en vacíos restantes      : {stats['sin_en']}")

    if not args.seco:
        # Backup
        bak = PICTOS_JSON.with_suffix(".json.bak2")
        bak.write_text(
            json.dumps(catalogo, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"\n   Backup guardado: {bak.name}")

        # Guardar
        with open(PICTOS_JSON, "w", encoding="utf-8") as f:
            json.dump(nuevo_catalogo, f, ensure_ascii=False, indent=2)
        print(f"   ✅ data/pictos.json actualizado — {len(nuevo_catalogo)} entradas")

    # ── Paso 5: TSV de revisión manual ───────────────────────────────────────
    pendientes = [e for e in nuevo_catalogo if not e.get("en", "").strip()]

    # Añadir los no encontrados en ARASAAC que sí tenían en (para revisión)
    ids_sin_en = {e["id"] for e in pendientes}
    for e in no_encontrados:
        if e["id"] not in ids_sin_en:
            # Tenía en sospechoso y ARASAAC no lo corrigió — incluir para revisión
            entrada_actual = next((x for x in nuevo_catalogo if x["id"] == e["id"]), None)
            if entrada_actual:
                pendientes.append(entrada_actual)

    if pendientes:
        if not args.seco:
            with open(TSV_OUT, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.DictWriter(
                    f,
                    fieldnames=["id", "es", "en_actual", "en_corregido", "ruta_img"],
                    delimiter="\t",
                )
                writer.writeheader()
                for e in sorted(pendientes, key=lambda x: x.get("es", "")):
                    writer.writerow({
                        "id":           e["id"],
                        "es":           e.get("es", ""),
                        "en_actual":    e.get("en", ""),
                        "en_corregido": "",   # columna para llenar a mano
                        "ruta_img":     e.get("ruta_img", ""),
                    })
            print(f"\n📝  {len(pendientes)} entradas para revisión manual:")
            print(f"   scripts/pictos-revisar.tsv")
            print(f"   Rellena la columna 'en_corregido' y corre:")
            print(f"   python scripts/aplicar-correcciones-tsv.py")
        else:
            print(f"\n📝  {len(pendientes)} entradas necesitarían revisión manual.")
    else:
        print(f"\n✅  Todas las entradas tienen campo en válido.")

    print()

if __name__ == "__main__":
    asyncio.run(main())