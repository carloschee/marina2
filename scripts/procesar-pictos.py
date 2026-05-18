#!/usr/bin/env python3
# Script para procesar pictos cuando tengan errores.
# =============================================================================
# Exporta pictos.json a csv:        python scripts/pictos-csv.py --exportar
# Prueba de importación             python scripts/pictos-csv.py --importar --seco
# Importa csv a pictos.json         python scripts/pictos-csv.py --importar
# =============================================================================
"""
scripts/pictos-csv.py — Marina 2
Convierte entre data/pictos.json y scripts/pictos.csv para edición manual.

Uso:
  python scripts/pictos-csv.py --exportar        # JSON → CSV
  python scripts/pictos-csv.py --importar        # CSV → JSON
  python scripts/pictos-csv.py --importar --seco # ver cambios sin escribir
  python scripts/pictos-csv.py --importar --csv otra-ruta.csv
"""

import csv, json, sys, argparse
from pathlib import Path

RAIZ        = Path(__file__).parent.parent
PICTOS_JSON = RAIZ / "data" / "pictos.json"
CSV_DEFAULT = Path(__file__).parent / "pictos.csv"

parser = argparse.ArgumentParser(description="Convierte pictos.json ↔ CSV")
grupo  = parser.add_mutually_exclusive_group(required=True)
grupo.add_argument("--exportar", action="store_true", help="JSON → CSV")
grupo.add_argument("--importar", action="store_true", help="CSV → JSON")
parser.add_argument("--csv",  default=str(CSV_DEFAULT), metavar="RUTA", help="Ruta al CSV")
parser.add_argument("--seco", action="store_true", help="Solo con --importar: muestra cambios sin escribir")
args = parser.parse_args()

csv_path = Path(args.csv)

# ─── EXPORTAR: JSON → CSV ─────────────────────────────────────────────────────
if args.exportar:
    if not PICTOS_JSON.exists():
        print(f"❌  No se encontró {PICTOS_JSON}")
        sys.exit(1)

    with open(PICTOS_JSON, encoding="utf-8") as f:
        catalogo = json.load(f)

    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["id", "es", "en", "ruta_img"])
        writer.writeheader()
        for e in catalogo:
            writer.writerow({
                "id":       e["id"],
                "es":       e.get("es", ""),
                "en":       e.get("en", ""),
                "ruta_img": e.get("ruta_img", ""),
            })

    print(f"✅  {len(catalogo)} entradas exportadas → {csv_path.name}")
    print(f"   Edita la columna 'en', guarda y corre:")
    print(f"   python scripts/pictos-csv.py --importar")

# ─── IMPORTAR: CSV → JSON ─────────────────────────────────────────────────────
else:
    if not csv_path.exists():
        print(f"❌  No se encontró {csv_path}")
        sys.exit(1)

    with open(csv_path, encoding="utf-8-sig", newline="") as f:
        filas = {int(r["id"]): r for r in csv.DictReader(f)}

    # Cargar original para detectar cambios
    original = {}
    if PICTOS_JSON.exists():
        with open(PICTOS_JSON, encoding="utf-8") as f:
            for e in json.load(f):
                original[e["id"]] = e

    nuevo_catalogo = []
    cambios = 0

    for fid, fila in sorted(filas.items()):
        entrada = {
            "id":       fid,
            "es":       fila["es"].strip(),
            "en":       fila["en"].strip(),
            "ruta_img": fila["ruta_img"].strip(),
        }
        nuevo_catalogo.append(entrada)

        prev = original.get(fid, {})
        if prev.get("en", "") != entrada["en"] or prev.get("es", "") != entrada["es"]:
            cambios += 1
            if args.seco:
                print(f"  [{fid}] {entrada['es']:25s}  '{prev.get('en','')}' → '{entrada['en']}'")

    print(f"\n{len(nuevo_catalogo)} entradas · {cambios} cambios detectados")

    if args.seco:
        print("⚡ DRY RUN — no se escribió nada")
        sys.exit(0)

    bak = PICTOS_JSON.with_suffix(".json.bak4")
    if PICTOS_JSON.exists():
        bak.write_text(PICTOS_JSON.read_text(encoding="utf-8"), encoding="utf-8")
        print(f"   Backup: {bak.name}")

    with open(PICTOS_JSON, "w", encoding="utf-8") as f:
        json.dump(nuevo_catalogo, f, ensure_ascii=False, indent=2)
    print(f"✅  data/pictos.json actualizado")

    if cambios > 0:
        print(f"\n💡  Regenera los audios en inglés:")
        print(f"   python scripts/generar-audio.py --solo-en --forzar")