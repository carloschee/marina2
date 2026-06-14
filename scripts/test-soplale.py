#!/usr/bin/env python3
"""
scripts/test-soplale.py — Marina 2 (prueba experimental)

"Sóplale" se sintetiza como "sople" (colapsa sílabas) con es-US-News-F.
Prueba <phoneme alphabet="ipa"> para la PALABRA COMPLETA, con dos variantes
de la marca de acento tónico:

  01-plano.mp3        → "Sóplale" tal cual (referencia: "sople", el bug)
  02-ipa-apostrofe.mp3 → ph="'so.pla.le"  (apóstrofo ASCII U+0027)
  03-ipa-stress.mp3    → ph="ˈso.pla.le"  (marca IPA real U+02C8)

Si 02 o 03 suena "SÓ-pla-le" (3 sílabas, acento en la primera) en vez de
"sople", confirmamos el mecanismo de corrección por palabra completa:
para palabras que el motor mutila, usar <phoneme> con su IPA en
pictos.json (campo nuevo, ej. "ipa": "ˈso.pla.le") y generar su audio así.

Requisitos:
  pip install requests

Variable de entorno requerida:
  GOOGLE_TTS_API_KEY = tu API key de Google Cloud
"""

import base64
import os
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("❌  requests no está instalado. Ejecuta: pip install requests")
    sys.exit(1)

API_KEY = os.environ.get("GOOGLE_TTS_API_KEY")
if not API_KEY:
    print("❌  Falta la variable de entorno GOOGLE_TTS_API_KEY.")
    sys.exit(1)

SYNTH_URL = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={API_KEY}"

VOZ  = "es-US-News-F"
LANG = "es-US"

SALIDA = Path(__file__).parent / "test-soplale"
SALIDA.mkdir(exist_ok=True)


def _ssml(contenido: str) -> str:
    return (
        '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
        f'xml:lang="{LANG}">{contenido}</speak>'
    )


CASOS = [
    ("01-plano.mp3", "¡Sóplale!", "referencia — esperado: 'sople' (bug)"),
    ("02-ipa-apostrofe.mp3",
     '<phoneme alphabet="ipa" ph="\'so.pla.le">¡Sóplale!</phoneme>',
     "IPA con apóstrofo ASCII (U+0027) como marca de acento"),
    ("03-ipa-stress.mp3",
     '<phoneme alphabet="ipa" ph="ˈso.pla.le">¡Sóplale!</phoneme>',
     "IPA con marca de acento real (U+02C8)"),
]


def sintetizar(nombre_archivo, contenido, descripcion):
    ruta = SALIDA / nombre_archivo
    body = {
        "input": {"ssml": _ssml(contenido)},
        "voice": {"languageCode": LANG, "name": VOZ},
        "audioConfig": {"audioEncoding": "MP3"},
    }
    resp = requests.post(SYNTH_URL, json=body, timeout=30)
    if resp.status_code != 200:
        print(f"  ❌ {nombre_archivo} — HTTP {resp.status_code}: {resp.text[:200]}")
        return False
    audio_b64 = resp.json().get("audioContent")
    if not audio_b64:
        print(f"  ❌ {nombre_archivo} — sin audioContent")
        return False
    ruta.write_bytes(base64.b64decode(audio_b64))
    print(f"  ✅ {nombre_archivo:24s} — {descripcion}")
    return True


def main():
    print(f"Voz: {VOZ}  |  Lang: {LANG}")
    print(f"Generando {len(CASOS)} archivos en {SALIDA}/\n")

    for nombre, contenido, desc in CASOS:
        sintetizar(nombre, contenido, desc)

    print("\n" + "─" * 60)
    print("Escucha y compara:")
    print("  01 → 'sople' (el bug, referencia)")
    print("  02 vs 03 → ¿alguna suena 'SÓ-pla-le' (3 sílabas, acento")
    print("             en la primera)?")
    print("─" * 60)
    print("\nSi 02 o 03 funciona:")
    print("  → para palabras que el motor mutila, agregar un campo")
    print("    'ipa' en pictos.json y usar <phoneme> al regenerar")
    print("    el audio de esa palabra completa.")
    print("\nSi ninguna funciona:")
    print("  → 'sóplale' necesitará audio humano grabado, o probar")
    print("    otra voz es-MX/es-US para esta palabra específica.")


if __name__ == "__main__":
    main()
