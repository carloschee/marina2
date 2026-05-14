#!/usr/bin/env python3
"""
scripts/generar-audio.py — Marina 2
Genera archivos MP3 para cada palabra del vocabulario usando edge-tts.
Las voces son neurales de Microsoft Edge — gratuito, sin API key, 100% local.

Uso:
  pip install edge-tts asyncio
  python scripts/generar-audio.py

Salida:
  assets/audio/es/{palabra}.mp3
  assets/audio/en/{word}.mp3

Convención: el nombre del archivo = el texto a pronunciar,
igual que los pictogramas. Sin mapeos externos.

Opciones:
  --forzar    Regenera todos los archivos aunque ya existan
  --solo-es   Solo genera español
  --solo-en   Solo genera inglés
  --seco      Muestra qué haría sin generar nada (dry run)
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

# Voces neurales — cambia si prefieres otra voz
VOZ_ES = "es-MX-DaliaNeural"   # Femenina, natural, excelente para niños
VOZ_EN = "en-US-AriaNeural"    # Femenina, clara, natural

# Parámetros de voz — ajustar al gusto
# Rate: velocidad  (+/-%) respecto a la voz base. "-10%" = 10% más lento
# Volume: volumen (+/-%) respecto al valor base
# Pitch: tono (+/-Hz)
CONFIG_ES = {"rate": "-8%",  "volume": "+0%", "pitch": "+0Hz"}
CONFIG_EN = {"rate": "-5%",  "volume": "+0%", "pitch": "+0Hz"}

# Rutas del proyecto (relativas al script, que vive en scripts/)
RAIZ        = Path(__file__).parent.parent
VOCAB_JSON  = RAIZ / "data" / "vocabulario.json"
DIR_AUDIO   = RAIZ / "assets" / "audio"
DIR_ES      = DIR_AUDIO / "es"
DIR_EN      = DIR_AUDIO / "en"

# ─── Generación ───────────────────────────────────────────────────────────────

async def generar_mp3(texto: str, voz: str, config: dict, ruta: Path) -> bool:
    """
    Genera un MP3 para `texto` con la voz y config indicadas.
    Devuelve True si se generó, False si falló.
    """
    try:
        communicate = edge_tts.Communicate(
            text    = texto,
            voice   = voz,
            rate    = config["rate"],
            volume  = config["volume"],
            pitch   = config["pitch"],
        )
        await communicate.save(str(ruta))
        return True
    except Exception as e:
        print(f"   ⚠️  Error al generar '{texto}': {e}")
        return False


async def procesar_idioma(
    palabras:  list[str],
    lang_code: str,
    voz:       str,
    config:    dict,
    directorio: Path,
    forzar:    bool,
    seco:      bool,
) -> tuple[int, int, int]:
    """
    Procesa todas las palabras de un idioma.
    Devuelve (generados, omitidos, errores).
    """
    generados = omitidos = errores = 0

    for palabra in palabras:
        # Nombre de archivo = la palabra tal cual (con tildes y espacios)
        nombre   = palabra + ".mp3"
        ruta     = directorio / nombre
        existe   = ruta.exists() and ruta.stat().st_size > 0

        if existe and not forzar:
            omitidos += 1
            continue

        accion = "regenerar" if existe else "generar"
        print(f"  [{lang_code}] {accion}: {palabra}")

        if seco:
            generados += 1
            continue

        ok = await generar_mp3(palabra, voz, config, ruta)
        if ok:
            generados += 1
        else:
            errores += 1

        # Pausa breve para no saturar el servicio
        await asyncio.sleep(0.3)

    return generados, omitidos, errores


async def main():
    parser = argparse.ArgumentParser(description="Generador de audio para Marina 2")
    parser.add_argument("--forzar",   action="store_true", help="Regenera archivos existentes")
    parser.add_argument("--solo-es",  action="store_true", help="Solo español")
    parser.add_argument("--solo-en",  action="store_true", help="Solo inglés")
    parser.add_argument("--seco",     action="store_true", help="Dry run — no genera archivos")
    args = parser.parse_args()

    # ── Verificar vocabulario ────────────────────────────────────────────────
    if not VOCAB_JSON.exists():
        print(f"❌  No se encontró {VOCAB_JSON}")
        sys.exit(1)

    with open(VOCAB_JSON, encoding="utf-8") as f:
        vocab = json.load(f)

    # ── Recolectar palabras únicas por idioma ────────────────────────────────
    palabras_es: set[str] = set()
    palabras_en: set[str] = set()

    for letra, contenido in vocab.items():
        for p in contenido.get("es", []):
            if p.strip():
                palabras_es.add(p.strip())
        for p in contenido.get("en", []):
            if p.strip():
                palabras_en.add(p.strip())

    palabras_es = sorted(palabras_es)
    palabras_en = sorted(palabras_en)

    print(f"\n🌊  Marina 2 — Generador de audio")
    print(f"   Vocabulario: {VOCAB_JSON.name}")
    print(f"   Palabras ES: {len(palabras_es)}")
    print(f"   Palabras EN: {len(palabras_en)}")
    print(f"   Voz ES:      {VOZ_ES}")
    print(f"   Voz EN:      {VOZ_EN}")
    if args.seco:
        print(f"   ⚡ DRY RUN — no se generará ningún archivo")
    print()

    # ── Crear directorios ────────────────────────────────────────────────────
    if not args.seco:
        DIR_ES.mkdir(parents=True, exist_ok=True)
        DIR_EN.mkdir(parents=True, exist_ok=True)

    total_gen = total_omit = total_err = 0

    # ── Español ──────────────────────────────────────────────────────────────
    if not args.solo_en:
        print(f"📢  Generando español ({len(palabras_es)} palabras)...")
        gen, omit, err = await procesar_idioma(
            palabras_es, "es", VOZ_ES, CONFIG_ES, DIR_ES, args.forzar, args.seco
        )
        total_gen  += gen
        total_omit += omit
        total_err  += err
        print(f"   ✅ {gen} generados · {omit} ya existían · {err} errores\n")

    # ── Inglés ───────────────────────────────────────────────────────────────
    if not args.solo_es:
        print(f"📢  Generando inglés ({len(palabras_en)} palabras)...")
        gen, omit, err = await procesar_idioma(
            palabras_en, "en", VOZ_EN, CONFIG_EN, DIR_EN, args.forzar, args.seco
        )
        total_gen  += gen
        total_omit += omit
        total_err  += err
        print(f"   ✅ {gen} generados · {omit} ya existían · {err} errores\n")

    # ── Resumen ──────────────────────────────────────────────────────────────
    print("─" * 48)
    print(f"  Total generados : {total_gen}")
    print(f"  Total omitidos  : {total_omit}")
    print(f"  Total errores   : {total_err}")

    if total_err:
        print(f"\n⚠️  {total_err} archivo(s) no se pudieron generar.")
        print(f"   Revisa tu conexión — edge-tts requiere internet para")
        print(f"   descargar las voces (el audio generado queda local).")

    print(f"\n🎵  Audio guardado en: {DIR_AUDIO.relative_to(RAIZ)}/")
    print(f"   Estructura: assets/audio/es/{{palabra}}.mp3")
    print(f"               assets/audio/en/{{word}}.mp3")

    if not args.seco and total_gen > 0:
        print(f"\n💡  Próximo paso: actualiza core/tts.js para usar audio")
        print(f"   pregrabado con fallback a SpeechSynthesis.")


if __name__ == "__main__":
    asyncio.run(main())