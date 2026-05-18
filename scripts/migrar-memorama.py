#!/usr/bin/env python3
"""
scripts/migrar-memorama.py — Marina 2
Migra data/memorama.json para que cada tema tenga 'palabras' como
array de IDs de pictos.json en lugar de objetos con datos inline.

ANTES:
  { "palabras": [{ "picto_id": 1130, "es": "oveja", "en": "sheep", ... }] }

DESPUÉS:
  { "palabras": [1130, 1045, 1203] }

El módulo memorama.js resolverá los IDs contra pictos.json en runtime.

Uso:
  python scripts/migrar-memorama.py --seco   # ver qué haría
  python scripts/migrar-memorama.py          # aplicar
"""

import json, sys, argparse
from pathlib import Path

RAIZ          = Path(__file__).parent.parent
MEMORAMA_JSON = RAIZ / "data" / "memorama.json"
PICTOS_JSON   = RAIZ / "data" / "pictos.json"

parser = argparse.ArgumentParser()
parser.add_argument("--seco", action="store_true", help="Muestra cambios sin escribir")
args = parser.parse_args()

if not MEMORAMA_JSON.exists():
    print(f"❌  No se encontró {MEMORAMA_JSON}")
    sys.exit(1)

if not PICTOS_JSON.exists():
    print(f"❌  No se encontró {PICTOS_JSON}")
    sys.exit(1)

with open(MEMORAMA_JSON, encoding="utf-8") as f:
    temas = json.load(f)

with open(PICTOS_JSON, encoding="utf-8") as f:
    catalogo = {e["id"]: e for e in json.load(f)}

nuevos_temas = []
total_palabras = 0
sin_id = []

for tema in temas:
    nuevo_tema = {k: v for k, v in tema.items() if k != "palabras"}
    nuevas_palabras = []

    for p in tema.get("palabras", []):
        if isinstance(p, int):
            # Ya es un ID — verificar que existe en pictos.json
            if p in catalogo:
                nuevas_palabras.append(p)
            else:
                print(f"  ⚠️  ID {p} no existe en pictos.json — omitido")
            continue

        if isinstance(p, dict):
            pid = p.get("picto_id")
            if pid and pid in catalogo:
                nuevas_palabras.append(pid)
                total_palabras += 1
                if args.seco:
                    entrada = catalogo[pid]
                    print(f"  [{pid}] {entrada.get('es',''):20s} → {entrada.get('en','')}")
            else:
                # No tiene picto_id válido — intentar buscar por nombre ES
                nombre_es = p.get("es", "").strip()
                match = next((e for e in catalogo.values() if e.get("es") == nombre_es), None)
                if match:
                    nuevas_palabras.append(match["id"])
                    total_palabras += 1
                    if args.seco:
                        print(f"  [resuelto por nombre] {nombre_es} → ID {match['id']}")
                else:
                    sin_id.append({"tema": tema.get("id"), "palabra": p})
                    if args.seco:
                        print(f"  ❌  Sin ID: {p.get('es','?')} en tema '{tema.get('id')}'")
            continue

        if isinstance(p, str):
            # String legacy — buscar por nombre ES
            match = next((e for e in catalogo.values() if e.get("es") == p), None)
            if match:
                nuevas_palabras.append(match["id"])
                total_palabras += 1
            else:
                sin_id.append({"tema": tema.get("id"), "palabra": p})
                if args.seco:
                    print(f"  ❌  Sin match para '{p}' en tema '{tema.get('id')}'")

    nuevo_tema["palabras"] = nuevas_palabras
    nuevos_temas.append(nuevo_tema)
    if args.seco:
        print(f"\nTema '{tema.get('id')}': {len(nuevas_palabras)} palabras")

print(f"\n{'⚡ DRY RUN — ' if args.seco else ''}Resultado:")
print(f"  Temas procesados : {len(nuevos_temas)}")
print(f"  Palabras migradas: {total_palabras}")
if sin_id:
    print(f"  ❌ Sin resolver  : {len(sin_id)}")
    for s in sin_id:
        print(f"     Tema '{s['tema']}': {s['palabra']}")

if args.seco:
    sys.exit(0)

bak = MEMORAMA_JSON.with_suffix(".json.bak")
bak.write_text(MEMORAMA_JSON.read_text(encoding="utf-8"), encoding="utf-8")
print(f"\n  Backup: {bak.name}")

with open(MEMORAMA_JSON, "w", encoding="utf-8") as f:
    json.dump(nuevos_temas, f, ensure_ascii=False, indent=2)

print(f"  ✅  data/memorama.json actualizado")