#!/usr/bin/env python3
"""
scripts/test-go-2.py — Marina 2 (prueba experimental, ronda 2)

Resultado ronda 1: "go" (con o sin <phoneme>) suena "wo" — el motor
reconoce "go" como palabra inglesa y el lexicón gana sobre <phoneme>.
"gó" (re-deletreo) se lee letra por letra — no es palabra reconocida.

Ronda 2: aislar si <phoneme alphabet="ipa" ph="ɡo"> FUNCIONA EN ABSOLUTO
para esta voz, usando texto interno que NO sea ninguna palabra (ni "go"
ni "gó"), para que el lexicón no tenga nada que decir.

Casos:
  01-xgo.mp3   <phoneme ph="ɡo">xgo</phoneme>   — texto interno gibberish
  02-qux.mp3   <phoneme ph="ɡo">qux</phoneme>   — texto interno totalmente distinto
  03-goe.mp3   <phoneme ph="ɡo">goe</phoneme>   — variante con letra extra
  04-furgoneta.mp3  "furgoneta"                 — control: '-go-' real

Si NINGUNO suena a /go/ (todos suenan como su texto interno leído normal,
o como gibberish deletreado) → <phoneme> con /ɡ/ no funciona para esta voz,
y necesitamos otra estrategia (otra voz, o aceptar la imperfección).

Si ALGUNO sí suena a /go/ → el patrón "texto interno gibberish + ph correcto"
es la solución general.

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

SALIDA = Path(__file__).parent / "test-go-2"
SALIDA.mkdir(exist_ok=True)


def _ssml(contenido: str) -> str:
    return (
        '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
        f'xml:lang="{LANG}">{contenido}</speak>'
    )


CASOS = [
    ("01-xgo.mp3", '<phoneme alphabet="ipa" ph="ɡo">xgo</phoneme>',
     "texto interno 'xgo' (gibberish) + ph='ɡo'"),

    ("02-qux.mp3", '<phoneme alphabet="ipa" ph="ɡo">qux</phoneme>',
     "texto interno 'qux' (totalmente distinto) + ph='ɡo'"),

    ("03-goe.mp3", '<phoneme alphabet="ipa" ph="ɡo">goe</phoneme>',
     "texto interno 'goe' + ph='ɡo'"),

    ("04-furgoneta.mp3", "furgoneta",
     "control — cómo suena el '-go-' real"),
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
    print("Escucha 01, 02, 03 — ¿alguno suena a '/go/' como el de 04?")
    print("  - Si SUENA a 'go' real → el patrón gibberish+ph es la solución")
    print("  - Si suena al TEXTO interno leído normal (ej. 'xgo', 'qux',")
    print("    'goe') → <phoneme> está siendo IGNORADO por completo aquí,")
    print("    no solo por colisión de lexicón — es una limitación del")
    print("    fonema /ɡ/ en esta voz/locale.")
    print("─" * 60)


if __name__ == "__main__":
    main()