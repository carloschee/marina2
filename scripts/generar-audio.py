#!/usr/bin/env python3
"""
scripts/generar-audio.py — Marina 2
Genera archivos MP3 para cada palabra del vocabulario Y para las frases
usando edge-tts. Las voces son neurales de Microsoft Edge — gratuito,
sin API key, requiere internet solo para descargar los audios.

Uso:
  pip install edge-tts
  python scripts/generar-audio.py

Salida:
  assets/audio/es/{palabra}.mp3      ← palabras del vocabulario
  assets/audio/en/{word}.mp3         ← words from vocabulary
  assets/audio/frases/es/{id}.mp3    ← frases completas
  assets/audio/frases/es/{pieza}.mp3  ← piezas de texto puro

Opciones:
  --forzar       Regenera todos los archivos aunque ya existan
  --solo-es      Solo vocabulario español
  --solo-en      Solo vocabulario inglés
  --solo-frases  Solo frases completas
  --seco         Muestra qué haría sin generar nada (dry run)
"""

import asyncio
import json
import sys
import argparse
from pathlib import Path

try:
    import edge_tts
except ImportError:
    print("❌  edge-tts no está instalado.")
    print("   Ejecuta: pip install edge-tts")
    sys.exit(1)

# ─── Configuración ────────────────────────────────────────────────────────────

VOZ_ES     = "es-MX-DaliaNeural"   # Femenina, natural, excelente para niños
VOZ_EN     = "en-US-AriaNeural"    # Femenina, clara, natural

CONFIG_ES     = {"rate": "-8%",  "volume": "+0%", "pitch": "+0Hz"}
CONFIG_EN     = {"rate": "-5%",  "volume": "+0%", "pitch": "+0Hz"}
CONFIG_FRASES = {"rate": "-12%", "volume": "+0%", "pitch": "+0Hz"}  # más lento para frases

# Rutas
RAIZ       = Path(__file__).parent.parent
VOCAB_JSON = RAIZ / "data" / "vocabulario.json"
FRASES_JSON= RAIZ / "data" / "frases.json"
DIR_AUDIO  = RAIZ / "assets" / "audio"
DIR_ES        = DIR_AUDIO / "es"
DIR_EN        = DIR_AUDIO / "en"
DIR_FRASES_ES = DIR_AUDIO / "frases" / "es"

# ─── Core ─────────────────────────────────────────────────────────────────────

async def generar_mp3(texto: str, voz: str, config: dict, ruta: Path) -> bool:
    try:
        communicate = edge_tts.Communicate(
            text   = texto,
            voice  = voz,
            rate   = config["rate"],
            volume = config["volume"],
            pitch  = config["pitch"],
        )
        await communicate.save(str(ruta))
        return True
    except Exception as e:
        print(f"   ⚠️  Error al generar '{texto}': {e}")
        return False


async def procesar_lista(
    items:      list,   # [(nombre_archivo, texto_a_pronunciar), ...]
    lang_code:  str,
    voz:        str,
    config:     dict,
    directorio: Path,
    forzar:     bool,
    seco:       bool,
) -> tuple:
    generados = omitidos = errores = 0

    for nombre_archivo, texto in items:
        ruta   = directorio / (nombre_archivo + ".mp3")
        existe = ruta.exists() and ruta.stat().st_size > 0

        if existe and not forzar:
            omitidos += 1
            continue

        accion = "regenerar" if existe else "generar"
        print(f"  [{lang_code}] {accion}: {nombre_archivo}")

        if seco:
            generados += 1
            continue

        ok = await generar_mp3(texto, voz, config, ruta)
        if ok:
            generados += 1
        else:
            errores += 1

        await asyncio.sleep(0.3)

    return generados, omitidos, errores


async def main():
    parser = argparse.ArgumentParser(description="Generador de audio para Marina 2")
    parser.add_argument("--forzar",      action="store_true")
    parser.add_argument("--solo-es",     action="store_true")
    parser.add_argument("--solo-en",     action="store_true")
    parser.add_argument("--solo-frases", action="store_true")
    parser.add_argument("--seco",        action="store_true")
    args = parser.parse_args()

    modo_solo_frases = args.solo_frases and not (args.solo_es or args.solo_en)

    # ── Cargar vocabulario ───────────────────────────────────────────────────
    palabras_es = []
    palabras_en = []

    if not modo_solo_frases:
        if not VOCAB_JSON.exists():
            print(f"❌  No se encontró {VOCAB_JSON}")
            sys.exit(1)

        with open(VOCAB_JSON, encoding="utf-8") as f:
            vocab = json.load(f)

        es_set = set()
        en_set = set()
        for letra, contenido in vocab.items():
            for p in contenido.get("es", []):
                if p.strip(): es_set.add(p.strip())
            for p in contenido.get("en", []):
                if p.strip(): en_set.add(p.strip())

        palabras_es = [(p, p) for p in sorted(es_set)]
        palabras_en = [(p, p) for p in sorted(en_set)]

    # ── Cargar frases ────────────────────────────────────────────────────────
    # Genera audio para:
    #   · La frase completa (id → texto es)
    #   · Las piezas de texto puro (no tienen pictograma propio)
    #     — las piezas "picto" ya tienen su MP3 en assets/audio/es/
    frases_items = []
    piezas_texto_items = []

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

            textos_ya_en_vocab = set(p for p, _ in palabras_es)
            piezas_texto_set   = set()

            for frase in frases:
                fid   = frase.get("id", "").strip()
                texto = frase.get("es", "").strip()
                if fid and texto:
                    frases_items.append((fid, texto))

                # Piezas de tipo "texto" que no son palabras del vocabulario
                for pieza in frase.get("piezas", []):
                    if pieza.get("tipo") == "texto":
                        pt = pieza.get("texto", "").strip()
                        if pt and pt not in textos_ya_en_vocab:
                            piezas_texto_set.add(pt)

            piezas_texto_items = [(p, p) for p in sorted(piezas_texto_set)]

    # ── Resumen ──────────────────────────────────────────────────────────────
    print(f"\n🌊  Marina 2 — Generador de audio")
    if not modo_solo_frases:
        print(f"   Vocabulario ES  : {len(palabras_es)} palabras  →  {VOZ_ES}")
        print(f"   Vocabulario EN  : {len(palabras_en)} palabras  →  {VOZ_EN}")
    if frases_items:
        print(f"   Frases completas: {len(frases_items)} frases    →  {VOZ_ES}")
    if piezas_texto_items:
        print(f"   Piezas de texto : {len(piezas_texto_items)} piezas    →  {VOZ_ES}")
        print(f"   (piezas sin pictograma propio, ej: 'en el cielo', 'rápido'")
        print(f"    → assets/audio/frases/es/{{pieza}}.mp3")
    if args.seco:
        print(f"   ⚡ DRY RUN — no se generará ningún archivo")
    print()

    if not args.seco:
        DIR_ES.mkdir(parents=True, exist_ok=True)
        DIR_EN.mkdir(parents=True, exist_ok=True)
        if frases_items or piezas_texto_items:
            DIR_FRASES_ES.mkdir(parents=True, exist_ok=True)

    total_gen = total_omit = total_err = 0

    # ── Vocabulario español ──────────────────────────────────────────────────
    if palabras_es and not args.solo_en and not args.solo_frases:
        print(f"📢  Vocabulario español ({len(palabras_es)} palabras)...")
        g, o, e = await procesar_lista(palabras_es, "es", VOZ_ES, CONFIG_ES, DIR_ES, args.forzar, args.seco)
        total_gen += g; total_omit += o; total_err += e
        print(f"   ✅ {g} generados · {o} ya existían · {e} errores\n")

    # ── Vocabulario inglés ───────────────────────────────────────────────────
    if palabras_en and not args.solo_es and not args.solo_frases:
        print(f"📢  Vocabulario inglés ({len(palabras_en)} palabras)...")
        g, o, e = await procesar_lista(palabras_en, "en", VOZ_EN, CONFIG_EN, DIR_EN, args.forzar, args.seco)
        total_gen += g; total_omit += o; total_err += e
        print(f"   ✅ {g} generados · {o} ya existían · {e} errores\n")

    # ── Frases completas ─────────────────────────────────────────────────────
    if frases_items and not args.solo_es and not args.solo_en:
        print(f"📢  Frases completas ({len(frases_items)} frases)...")
        g, o, e = await procesar_lista(frases_items, "frases/es", VOZ_ES, CONFIG_FRASES, DIR_FRASES_ES, args.forzar, args.seco)
        total_gen += g; total_omit += o; total_err += e
        print(f"   ✅ {g} generados · {o} ya existían · {e} errores\n")

    # ── Piezas de texto puro ─────────────────────────────────────────────────
    if piezas_texto_items and not args.solo_es and not args.solo_en:
        print(f"📢  Piezas de texto ({len(piezas_texto_items)} piezas)...")
        g, o, e = await procesar_lista(piezas_texto_items, "frases/es", VOZ_ES, CONFIG_ES, DIR_FRASES_ES, args.forzar, args.seco)
        total_gen += g; total_omit += o; total_err += e
        print(f"   ✅ {g} generados · {o} ya existían · {e} errores\n")

    # ── Resumen final ────────────────────────────────────────────────────────
    print("─" * 48)
    print(f"  Total generados : {total_gen}")
    print(f"  Total omitidos  : {total_omit}")
    print(f"  Total errores   : {total_err}")

    if total_err:
        print(f"\n⚠️  {total_err} archivo(s) no se pudieron generar.")
        print(f"   Revisa tu conexión — edge-tts requiere internet.")

    print(f"\n🎵  Audio guardado en: assets/audio/")
    print(f"   assets/audio/es/{{palabra}}.mp3")
    print(f"   assets/audio/en/{{word}}.mp3")
    if frases_items or piezas_texto_items:
        print(f"   assets/audio/frases/es/{{id}}.mp3   ← frases completas")
        print(f"   assets/audio/frases/es/{{pieza}}.mp3 ← piezas de texto")

    if not args.seco and total_gen > 0:
        print(f"\n💡  Haz commit y push — el GitHub Action actualizará")
        print(f"   assets-manifest.json automáticamente.")


if __name__ == "__main__":
    asyncio.run(main())