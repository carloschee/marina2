#!/usr/bin/env python3
"""
scripts/descargar-pictos-playwright.py — Marina 2
Usa Playwright (Chromium headless) para descargar pictogramas de ARASAAC
leyendo los IDs del archivo errores-pictos.tsv generado por descargar-pictos.py

Requisitos:
  pip install playwright
  playwright install chromium

Uso:
  python scripts/descargar-pictos-playwright.py

Opciones:
  --tsv RUTA     Ruta al TSV de errores (default: scripts/errores-pictos.tsv)
  --forzar       Reemplaza archivos aunque ya existan
  --seco         Muestra qué descargaría sin descargar nada
  --concurrencia N  Páginas simultáneas (default: 3, max: 5)
  --solo-origen X   Filtrar por origen: vocabulario.json, frases.json, memorama.json
"""

import asyncio
import csv
import sys
import argparse
import time
from pathlib import Path
from datetime import datetime

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("❌  Playwright no está instalado.")
    print("   Ejecuta: pip install playwright && playwright install chromium")
    sys.exit(1)

RAIZ      = Path(__file__).parent.parent
TSV_PATH  = RAIZ / "scripts" / "errores-pictos.tsv"
LOG_PATH  = RAIZ / "scripts" / "errores-pictos-playwright.log"
DIR_ES    = RAIZ / "assets" / "pictogramas" / "es"

# URL de descarga directa por ID — ARASAAC sirve el PNG con esta URL
ARASAAC_DOWNLOAD = "https://api.arasaac.org/api/pictograms/{id}?download=true&skin=white"

# ─── Progreso ─────────────────────────────────────────────────────────────────

class Progreso:
    def __init__(self, total, prefijo=""):
        self.total = total; self.actual = 0
        self.prefijo = prefijo; self._inicio = time.monotonic()

    def avanzar(self):
        self.actual = min(self.actual + 1, self.total)
        pct    = self.actual / self.total if self.total else 0
        llenos = int(28 * pct)
        barra  = "█" * llenos + "░" * (28 - llenos)
        elapsed = time.monotonic() - self._inicio
        eta    = (elapsed / self.actual * (self.total - self.actual)) if self.actual else 0
        print(f"\r  {self.prefijo} [{barra}] {self.actual}/{self.total} ({pct*100:5.1f}%) ETA {eta:5.1f}s   ",
              end="", flush=True)

    def cerrar(self): self.avanzar(); print()

# ─── Descarga via API JSON de ARASAAC ────────────────────────────────────────

async def descargar_con_playwright(page, palabra, pid, ruta, errores_log):
    """
    Usa la API de ARASAAC para obtener la imagen PNG directamente.
    La API devuelve el PNG como binario cuando se llama con download=true.
    """
    url = ARASAAC_DOWNLOAD.format(id=pid)
    try:
        response = await page.request.get(url, timeout=15000)
        if response.status == 200:
            content_type = response.headers.get("content-type", "")
            data = await response.body()
            if len(data) > 500 and ("image" in content_type or data[:8] == b'\x89PNG\r\n\x1a\n'):
                ruta.write_bytes(data)
                return 'descargado'
            else:
                errores_log.append({
                    "palabra": palabra, "id": pid,
                    "error": f"Respuesta inválida ({len(data)} bytes, content-type: {content_type})",
                    "ts": datetime.now().isoformat(timespec="seconds"),
                })
                return 'error'
        else:
            errores_log.append({
                "palabra": palabra, "id": pid,
                "error": f"HTTP {response.status}",
                "ts": datetime.now().isoformat(timespec="seconds"),
            })
            return 'error'
    except Exception as e:
        errores_log.append({
            "palabra": palabra, "id": pid,
            "error": str(e)[:120],
            "ts": datetime.now().isoformat(timespec="seconds"),
        })
        return 'error'

# ─── Main ─────────────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(description="Descargador de pictogramas ARASAAC con Playwright")
    parser.add_argument("--tsv",          default=str(TSV_PATH), help="Ruta al TSV de errores")
    parser.add_argument("--forzar",       action="store_true")
    parser.add_argument("--seco",         action="store_true")
    parser.add_argument("--concurrencia", type=int, default=3, metavar="N")
    parser.add_argument("--solo-origen",  default=None, metavar="X",
                        help="Filtrar por origen: vocabulario.json, frases.json, memorama.json")
    args = parser.parse_args()

    tsv_path = Path(args.tsv)
    if not tsv_path.exists():
        print(f"❌  No se encontró {tsv_path}")
        print(f"   Ejecuta primero: python scripts/descargar-pictos.py")
        sys.exit(1)

    # Leer TSV
    with open(tsv_path, encoding='utf-8-sig') as f:
        rows = list(csv.DictReader(f, delimiter='\t'))

    # Filtrar: solo los que tienen ID (HTTP 404), excluir los "No encontrado en ARASAAC"
    pendientes = [r for r in rows if r.get('id_arasaac', '').strip() and 'HTTP' in r.get('error', '')]

    if args.solo_origen:
        pendientes = [r for r in pendientes if r['origen'] == args.solo_origen]

    # Excluir los que ya existen
    if not args.forzar:
        pendientes = [r for r in pendientes
                      if not (DIR_ES / f"{r['palabra']}.png").exists()
                      or (DIR_ES / f"{r['palabra']}.png").stat().st_size < 500]

    conc = max(1, min(args.concurrencia, 5))

    print(f"\n🌊  Marina 2 — Descargador Playwright")
    print(f"   Pictogramas pendientes : {len(pendientes)}")
    print(f"   Concurrencia           : {conc} páginas simultáneas")
    if args.solo_origen:
        print(f"   Filtro origen          : {args.solo_origen}")
    if args.seco:
        print(f"   ⚡ DRY RUN")
    print()

    if not pendientes:
        print("✓ No hay pictogramas pendientes.")
        return

    DIR_ES.mkdir(parents=True, exist_ok=True)

    errores_log  = []
    descargados  = 0
    errores_n    = 0
    progreso     = Progreso(len(pendientes), "pictogramas")
    semaforo     = asyncio.Semaphore(conc)
    t_inicio     = time.monotonic()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            extra_http_headers={"Referer": "https://arasaac.org/"},
        )

        async def _tarea(row):
            nonlocal descargados, errores_n
            async with semaforo:
                palabra = row['palabra']
                pid     = row['id_arasaac'].strip()
                ruta    = DIR_ES / f"{palabra}.png"

                if args.seco:
                    descargados += 1
                    progreso.avanzar()
                    return

                page = await context.new_page()
                try:
                    resultado = await descargar_con_playwright(page, palabra, pid, ruta, errores_log)
                    if resultado == 'descargado':
                        descargados += 1
                    else:
                        errores_n += 1
                finally:
                    await page.close()

                progreso.avanzar()
                await asyncio.sleep(0.2)  # cortesía con el servidor

        await asyncio.gather(*[_tarea(r) for r in pendientes])
        await context.close()
        await browser.close()

    progreso.cerrar()
    elapsed = time.monotonic() - t_inicio
    dur_str = f"{elapsed:.1f}s" if elapsed < 60 else f"{elapsed/60:.1f}m"

    print(f"─" * 48)
    print(f"  Descargados  : {descargados}")
    print(f"  Errores      : {errores_n}")
    print(f"  Tiempo       : {dur_str}")

    if errores_log:
        LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(f"\n── Ejecución {datetime.now().isoformat(timespec='seconds')} ──\n")
            for e in errores_log:
                f.write(f"  {e['palabra']} (id:{e['id']}) → {e['error']}\n")
        print(f"\n⚠️  {errores_n} errores — ver scripts/errores-pictos-playwright.log")

    if not args.seco and descargados > 0:
        print(f"\n💡  Haz commit y push — el GitHub Action actualizará assets-manifest.json")


if __name__ == "__main__":
    asyncio.run(main())