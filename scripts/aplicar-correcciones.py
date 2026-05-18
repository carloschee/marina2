#!/usr/bin/env python3
"""
scripts/aplicar-correcciones-tsv.py — Marina 2

Lee scripts/pictos-revisar.tsv (generado por depurar-pictos.py),
toma la columna 'en_corregido' y actualiza data/pictos.json.

Solo actualiza entradas donde 'en_corregido' no está vacío.
No toca entradas sin corrección.

Uso:
  python scripts/aplicar-correcciones-tsv.py

Opciones:
  --tsv RUTA   Ruta al TSV (default: scripts/pictos-revisar.tsv)
  --seco       Muestra qué haría sin modificar pictos.json
"""

import csv
import json
import sys
import argparse
from pathlib import Path

RAIZ        = Path(__file__).parent.parent
PICTOS_JSON = RAIZ / "data" / "pictos.json"
TSV_DEFAULT = RAIZ / "scripts" / "pictos-revisar.tsv"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--tsv",  default=str(TSV_DEFAULT))
    parser.add_argument("--seco", action="store_true")
    args = parser.parse_args()

    tsv_path = Path(args.tsv)
    if not tsv_path.exists():
        print(f"❌  No se encontró {tsv_path}")
        sys.exit(1)

    if not PICTOS_JSON.exists():
        print(f"❌  No se encontró {PICTOS_JSON}")
        sys.exit(1)

    # Leer correcciones del TSV
    correcciones: dict[int, str] = {}
    with open(tsv_path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for fila in reader:
            corr = fila.get("en_corregido", "").strip()
            if corr:
                try:
                    correcciones[int(fila["id"])] = corr
                except (ValueError, KeyError):
                    pass

    if not correcciones:
        print("ℹ️  No hay correcciones en el TSV (columna 'en_corregido' vacía).")
        sys.exit(0)

    print(f"\n🌊  Marina 2 — Aplicar correcciones de pictos-revisar.tsv")
    print(f"   Correcciones encontradas: {len(correcciones)}\n")

    with open(PICTOS_JSON, encoding="utf-8") as f:
        catalogo: list[dict] = json.load(f)

    # Aplicar
    aplicadas = 0
    for entrada in catalogo:
        if entrada["id"] in correcciones:
            antes = entrada.get("en", "")
            despues = correcciones[entrada["id"]]
            print(f"   [{entrada['id']}] {entrada.get('es',''):20s}  '{antes}' → '{despues}'")
            if not args.seco:
                entrada["en"] = despues
            aplicadas += 1

    print(f"\n   {aplicadas} entradas actualizadas.")

    if not args.seco:
        bak = PICTOS_JSON.with_suffix(".json.bak3")
        bak.write_text(
            json.dumps(catalogo, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        with open(PICTOS_JSON, "w", encoding="utf-8") as f:
            json.dump(catalogo, f, ensure_ascii=False, indent=2)
        print(f"   ✅ data/pictos.json actualizado")
        print(f"   Backup: {bak.name}")
    else:
        print(f"   ⚡ DRY RUN — no se escribió nada")


if __name__ == "__main__":
    main()