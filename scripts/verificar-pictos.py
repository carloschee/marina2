#!/usr/bin/env python3
"""
scripts/verificar-pictos.py — Marina 2
Cruza el TSV de errores con los archivos existentes en assets/pictogramas/es/
para saber cuáles siguen faltando realmente.

Uso:
  python scripts/verificar-pictos.py

Salida:
  · Consola: resumen de faltantes reales
  · scripts/pictos-faltantes.tsv — solo los que realmente no existen
"""

import csv
import sys
from pathlib import Path
from collections import defaultdict

RAIZ      = Path(__file__).parent.parent
TSV_PATH  = RAIZ / "scripts" / "errores-pictos.tsv"
DIR_ES    = RAIZ / "assets" / "pictogramas" / "es"
OUT_PATH  = RAIZ / "scripts" / "pictos-faltantes.tsv"

def main():
    if not TSV_PATH.exists():
        print(f"❌  No se encontró {TSV_PATH}")
        print(f"   Ejecuta primero: python scripts/descargar-pictos.py")
        sys.exit(1)

    # Leer TSV de errores
    with open(TSV_PATH, encoding='utf-8-sig') as f:
        rows = list(csv.DictReader(f, delimiter='\t'))

    # Deduplicar por palabra — quedarse con la última ejecución
    por_palabra = {}
    for r in rows:
        por_palabra[r['palabra']] = r
    errores = list(por_palabra.values())

    # Cruzar con archivos existentes
    faltantes = []
    resueltos = []

    for r in errores:
        palabra = r['palabra']
        png     = DIR_ES / f"{palabra}.png"
        existe  = png.exists() and png.stat().st_size > 500

        if existe:
            resueltos.append(r)
        else:
            faltantes.append(r)

    # Agrupar faltantes por origen y tipo de error
    por_origen = defaultdict(list)
    for r in faltantes:
        por_origen[r['origen']].append(r)

    sin_id   = [r for r in faltantes if not r.get('id_arasaac', '').strip()]
    con_id   = [r for r in faltantes if r.get('id_arasaac', '').strip()]

    # ── Consola ───────────────────────────────────────────────────────────────
    print(f"\n🌊  Marina 2 — Verificación de pictogramas")
    print(f"   Errores en TSV          : {len(errores)}")
    print(f"   Ya resueltos (PNG existe): {len(resueltos)}")
    print(f"   Siguen faltando         : {len(faltantes)}")
    print()

    if not faltantes:
        print("✅  ¡Todos los pictogramas del TSV ya están resueltos!")
        return

    for origen, items in sorted(por_origen.items()):
        print(f"── {origen} ({len(items)} faltantes):")
        for r in sorted(items, key=lambda x: x['palabra']):
            tipo = "sin ID en ARASAAC" if not r.get('id_arasaac','').strip() else f"id:{r['id_arasaac']}"
            print(f"   {r['palabra']:30s} [{tipo}]")
        print()

    print(f"── Resumen:")
    print(f"   Sin ID en ARASAAC (crear/reemplazar manual): {len(sin_id)}")
    print(f"   Con ID pero sin PNG (reintentar descarga)  : {len(con_id)}")

    if sin_id:
        print(f"\n   Palabras sin ID:")
        for r in sin_id:
            print(f"     [{r['origen']}] {r['palabra']}")

    # ── Guardar TSV de faltantes reales ───────────────────────────────────────
    with open(OUT_PATH, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['origen','palabra','id_arasaac','error'], delimiter='\t')
        writer.writeheader()
        for r in sorted(faltantes, key=lambda x: (x['origen'], x['palabra'])):
            writer.writerow({
                'origen':      r['origen'],
                'palabra':     r['palabra'],
                'id_arasaac':  r.get('id_arasaac', ''),
                'error':       r.get('error', ''),
            })

    print(f"\n📊  TSV de faltantes reales: scripts/pictos-faltantes.tsv")

    if con_id:
        print(f"\n💡  Para reintentar los que tienen ID:")
        print(f"   python scripts/descargar-pictos-playwright.py --tsv scripts/pictos-faltantes.tsv --forzar")

if __name__ == "__main__":
    main()