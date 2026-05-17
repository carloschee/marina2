#!/usr/bin/env python3
"""
scripts/generar-catalogo-pictos.py — Marina 2
Construye data/pictos.json con IDs únicos y migra vocabulario.json,
frases.json y memorama.json para referenciar por picto_id.

Uso:
  python scripts/generar-catalogo-pictos.py

Opciones:
  --seco    Muestra qué haría sin escribir archivos
  --forzar  Regenera aunque pictos.json ya exista

El catálogo asigna IDs secuenciales (1001, 1002, ...).
Las palabras duplicadas (mismo texto en ES o EN) comparten el mismo ID.
Los homónimos se pueden desambiguar manualmente en pictos.json después.
"""

import json
import argparse
import sys
from pathlib import Path

RAIZ          = Path(__file__).parent.parent
VOCAB_JSON    = RAIZ / "data" / "vocabulario.json"
FRASES_JSON   = RAIZ / "data" / "frases.json"
MEMORAMA_JSON = RAIZ / "data" / "memorama.json"
PICTOS_JSON   = RAIZ / "data" / "pictos.json"

ID_INICIO = 1001

def nombre_archivo(texto, lang, sufijo=""):
    """Genera nombre de archivo PNG normalizado."""
    nombre = texto.lower()
    # Normalizar caracteres especiales
    reemplazos = {
        'á':'a','é':'e','í':'i','ó':'o','ú':'u','ü':'u',
        'ñ':'n',' ':'-','á':'a','é':'e','í':'i','ó':'o','ú':'u',
    }
    for k, v in reemplazos.items():
        nombre = nombre.replace(k, v)
    # Eliminar caracteres no válidos
    nombre = ''.join(c for c in nombre if c.isalnum() or c == '-')
    nombre = nombre.strip('-')
    if sufijo:
        nombre = f"{nombre}-{sufijo}"
    return f"{nombre}.png"


def construir_catalogo(vocab, frases, memorama):
    """
    Recopila todas las palabras de todos los JSONs y asigna IDs únicos.
    Retorna (catalogo, mapa_es, mapa_en) donde mapa_es y mapa_en
    mapean texto → picto_id.
    """
    catalogo = []
    mapa_es  = {}   # texto_es → picto_id
    mapa_en  = {}   # texto_en → picto_id
    siguiente_id = ID_INICIO

    def agregar(texto_es=None, texto_en=None):
        nonlocal siguiente_id
        # Si ya existe en ES, devolver ese ID
        if texto_es and texto_es in mapa_es:
            return mapa_es[texto_es]
        # Si ya existe en EN, devolver ese ID
        if texto_en and texto_en in mapa_en:
            return mapa_en[texto_en]

        pid = siguiente_id
        siguiente_id += 1

        entrada = {
            "id":         pid,
            "arasaac_id": None,
            "es":         texto_es or "",
            "en":         texto_en or "",
            "archivo_es": nombre_archivo(texto_es or texto_en, "es"),
            "archivo_en": nombre_archivo(texto_en or texto_es, "en"),
            "tts_es":     texto_es or "",
            "tts_en":     texto_en or "",
        }
        catalogo.append(entrada)

        if texto_es: mapa_es[texto_es] = pid
        if texto_en: mapa_en[texto_en] = pid
        return pid

    # ── Vocabulario — tiene ES y EN por separado por letra ────────────────────
    for letra, contenido in vocab.items():
        for palabra in contenido.get("es", []):
            agregar(texto_es=palabra)
        for palabra in contenido.get("en", []):
            # Puede que ya exista si ES y EN son la misma palabra (koala, robot...)
            if palabra not in mapa_en:
                agregar(texto_en=palabra)

    # ── Frases — piezas tipo picto ────────────────────────────────────────────
    for frase in frases:
        for pieza in frase.get("piezas", []):
            if pieza.get("tipo") == "picto":
                texto = pieza.get("texto", "").strip()
                if not texto: continue
                lang  = frase.get("lang", "es")
                if lang == "en":
                    if texto not in mapa_en: agregar(texto_en=texto)
                else:
                    if texto not in mapa_es: agregar(texto_es=texto)

    # ── Memorama — campo "palabras" ────────────────────────────────────────────
    for tema in memorama:
        for entrada in tema.get("palabras", []):
            if isinstance(entrada, dict):
                # Ya migrado — tiene picto, es, en
                texto_es = entrada.get("es", "").strip()
                texto_en = entrada.get("en", "").strip()
                if texto_es and texto_es not in mapa_es:
                    agregar(texto_es=texto_es, texto_en=texto_en or None)
                elif texto_en and texto_en not in mapa_en:
                    agregar(texto_en=texto_en)
            else:
                # Aún es string
                texto = str(entrada).strip()
                if texto and texto not in mapa_es:
                    agregar(texto_es=texto)

    return catalogo, mapa_es, mapa_en


def migrar_vocabulario(vocab, mapa_es, mapa_en):
    """Migra vocabulario.json: strings → picto_ids."""
    nuevo = {}
    for letra, contenido in vocab.items():
        nuevo[letra] = {
            "es": [mapa_es[p] for p in contenido.get("es", []) if p in mapa_es],
            "en": [mapa_en[p] for p in contenido.get("en", []) if p in mapa_en],
        }
    return nuevo


def migrar_frases(frases, mapa_es, mapa_en):
    """Migra frases.json: piezas picto texto → picto_id."""
    nuevas = []
    for frase in frases:
        nueva_frase = dict(frase)
        nuevas_piezas = []
        lang = frase.get("lang", "es")
        mapa = mapa_en if lang == "en" else mapa_es

        for pieza in frase.get("piezas", []):
            nueva_pieza = dict(pieza)
            if pieza.get("tipo") == "picto":
                texto = pieza.get("texto", "").strip()
                if texto in mapa:
                    nueva_pieza["picto_id"] = mapa[texto]
                    # Mantener "texto" como fallback TTS por ahora
            nuevas_piezas.append(nueva_pieza)

        nueva_frase["piezas"] = nuevas_piezas
        nuevas.append(nueva_frase)
    return nuevas


def migrar_memorama(memorama, mapa_es):
    """Migra memorama.json: palabras string → objetos con picto_id."""
    nuevos_temas = []
    for tema in memorama:
        nuevo_tema = dict(tema)
        nuevas_palabras = []
        for entrada in tema.get("palabras", []):
            if isinstance(entrada, dict):
                # Ya migrado
                nuevas_palabras.append(entrada)
            else:
                texto = str(entrada).strip()
                pid   = mapa_es.get(texto)
                nuevas_palabras.append({
                    "picto_id": pid,
                    "es":       texto,
                    "en":       "",      # completar manualmente o con traducción
                    "tts_es":   texto,
                    "tts_en":   "",
                })
        nuevo_tema["palabras"] = nuevas_palabras
        nuevos_temas.append(nuevo_tema)
    return nuevos_temas


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seco",   action="store_true")
    parser.add_argument("--forzar", action="store_true")
    args = parser.parse_args()

    # ── Verificar que pictos.json no exista ya (o --forzar) ───────────────────
    if PICTOS_JSON.exists() and not args.forzar:
        print(f"⚠️  {PICTOS_JSON} ya existe.")
        print(f"   Usa --forzar para regenerar. Los IDs cambiarán.")
        print(f"   Si solo quieres agregar entradas, edita pictos.json manualmente.")
        sys.exit(0)

    # ── Cargar JSONs ──────────────────────────────────────────────────────────
    print("🌊  Marina 2 — Generador de catálogo de pictogramas\n")

    for path, nombre in [(VOCAB_JSON,'vocabulario.json'),(FRASES_JSON,'frases.json'),(MEMORAMA_JSON,'memorama.json')]:
        if not path.exists():
            print(f"❌  No se encontró {path}"); sys.exit(1)

    with open(VOCAB_JSON,    encoding="utf-8") as f: vocab    = json.load(f)
    with open(FRASES_JSON,   encoding="utf-8") as f: frases   = json.load(f)
    with open(MEMORAMA_JSON, encoding="utf-8") as f: memorama = json.load(f)

    # ── Construir catálogo ────────────────────────────────────────────────────
    catalogo, mapa_es, mapa_en = construir_catalogo(vocab, frases, memorama)
    print(f"   Pictogramas únicos encontrados: {len(catalogo)}")
    print(f"   Palabras en ES: {len(mapa_es)}")
    print(f"   Palabras en EN: {len(mapa_en)}")

    # ── Migrar JSONs ──────────────────────────────────────────────────────────
    nuevo_vocab    = migrar_vocabulario(vocab,    mapa_es, mapa_en)
    nuevas_frases  = migrar_frases(frases,        mapa_es, mapa_en)
    nuevo_memorama = migrar_memorama(memorama,     mapa_es)

    print(f"\n   Entradas migradas:")
    print(f"   · vocabulario.json — {sum(len(v['es'])+len(v['en']) for v in nuevo_vocab.values())} referencias")
    print(f"   · frases.json      — {len(nuevas_frases)} frases")
    print(f"   · memorama.json    — {sum(len(t['palabras']) for t in nuevo_memorama)} palabras")

    if args.seco:
        print(f"\n   ⚡ DRY RUN — no se escribió ningún archivo")
        print(f"\n   Muestra del catálogo (primeros 5):")
        for e in catalogo[:5]:
            print(f"   {e}")
        return

    # ── Escribir archivos ─────────────────────────────────────────────────────
    # Backup de los originales
    for path in [VOCAB_JSON, FRASES_JSON, MEMORAMA_JSON]:
        backup = path.with_suffix('.json.bak')
        backup.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
        print(f"\n   Backup: {backup.name}")

    # Escribir
    with open(PICTOS_JSON,    "w", encoding="utf-8") as f:
        json.dump(catalogo,       f, ensure_ascii=False, indent=2)
    with open(VOCAB_JSON,     "w", encoding="utf-8") as f:
        json.dump(nuevo_vocab,    f, ensure_ascii=False, indent=2)
    with open(FRASES_JSON,    "w", encoding="utf-8") as f:
        json.dump(nuevas_frases,  f, ensure_ascii=False, indent=2)
    with open(MEMORAMA_JSON,  "w", encoding="utf-8") as f:
        json.dump(nuevo_memorama, f, ensure_ascii=False, indent=2)

    print(f"\n✅  Archivos generados:")
    print(f"   data/pictos.json     — {len(catalogo)} entradas")
    print(f"   data/vocabulario.json — migrado")
    print(f"   data/frases.json     — migrado")
    print(f"   data/memorama.json   — migrado")
    print(f"\n💡  Próximos pasos:")
    print(f"   1. Revisa data/pictos.json y ajusta homónimos")
    print(f"      (cambia archivo_es/en y tts_es/en donde sea necesario)")
    print(f"   2. Corre descargar-pictos.py con el nuevo catálogo")
    print(f"   3. Corre generar-audio.py con el nuevo catálogo")
    print(f"   4. Actualiza los módulos para leer del catálogo")


if __name__ == "__main__":
    main()