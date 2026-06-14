#!/usr/bin/env python3
"""
scripts/test-frase-acento.py — Marina 2 (prueba experimental)

Genera una frase completa con la voz elegida (es-US-News-F) para confirmar:
  - Entonación de pregunta (¿qué hacemos?)
  - Entonación de exclamación (¡Sóplale!)
  - Acentuación correcta de "está" y "Sóplale" (esdrújula: SÓ-pla-le)

Frase de prueba:
  "El fuego está caliente ¿qué hacemos? ¡Sóplale!"

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

SALIDA = Path(__file__).parent / "test-frase"
SALIDA.mkdir(exist_ok=True)

FRASE = "El fuego está caliente. ¿Qué hacemos? ¡Sóplale!"


def _ssml(texto: str) -> str:
    return (
        '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
        f'xml:lang="{LANG}">{texto}</speak>'
    )


def sintetizar(nombre_archivo, ssml):
    ruta = SALIDA / nombre_archivo
    body = {
        "input": {"ssml": ssml},
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
    print(f"  ✅ {nombre_archivo}")
    return True


def main():
    print(f"Voz: {VOZ}  |  Lang: {LANG}")
    print(f"Frase: {FRASE}")
    print(f"Generando en {SALIDA}/\n")

    sintetizar("01-frase-completa.mp3", _ssml(FRASE))

    # Adicional: "Sóplale" aislada, para aislar el acento esdrújulo
    sintetizar("02-soplale-aislada.mp3", _ssml("¡Sóplale!"))

    print("\n" + "─" * 60)
    print("Escucha:")
    print("  01-frase-completa → ¿se nota la pregunta en '¿qué hacemos?'")
    print("                      y la exclamación/énfasis en '¡Sóplale!'?")
    print("  02-soplale-aislada → ¿el acento cae en la primera sílaba")
    print("                       (SÓ-pla-le), no en 'pla' ni 'le'?")
    print("─" * 60)


if __name__ == "__main__":
    main()
