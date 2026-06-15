#!/usr/bin/env python3
"""
scripts/test-go.py — Marina 2 (prueba experimental)

La sílaba "go" suena "wo" (lectura inglesa de "go") incluso con
<phoneme alphabet="ipa" ph="ɡo"> (script-g correcto, U+0261). Hipótesis:
el motor tiene una entrada de diccionario para la PALABRA "go" que tiene
prioridad sobre <phoneme> cuando el texto visible coincide exactamente.

Prueba: cambiar el TEXTO VISIBLE dentro de <phoneme> (no afecta nada en
nuestro pipeline — el audio generado es el único output) a algo que NO
sea la palabra inglesa "go", para evitar ese lookup de diccionario.

Casos:
  01-plano.mp3       "go" tal cual                          (control, esperado "wo")
  02-phoneme-go.mp3  <phoneme ph="ɡo">go</phoneme>          (ya probado, falla)
  03-phoneme-Go.mp3  <phoneme ph="ɡo">Go</phoneme>          (mayúscula — ¿lexicón case-sensitive?)
  04-texto-go2.mp3   <phoneme ph="ɡo">go.</phoneme>         (texto con punto, no es "go" exacto)
  05-respell-go.mp3  "gó" plano, SIN phoneme                 (re-deletreo, evita "go" inglés)
  06-respell-ipa.mp3 <phoneme ph="ɡo">gó</phoneme>          (re-deletreo + phoneme)
  07-furgoneta.mp3   "furgoneta" completa                    (control: cómo SUENA "go" real)

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

SALIDA = Path(__file__).parent / "test-go"
SALIDA.mkdir(exist_ok=True)


def _ssml(contenido: str) -> str:
    return (
        '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
        f'xml:lang="{LANG}">{contenido}</speak>'
    )


CASOS = [
    ("01-plano.mp3", "go",
     "control — esperado: suena 'wo' (bug)"),

    ("02-phoneme-go.mp3", '<phoneme alphabet="ipa" ph="ɡo">go</phoneme>',
     "ya probado — falla, sigue 'wo'"),

    ("03-phoneme-Go.mp3", '<phoneme alphabet="ipa" ph="ɡo">Go</phoneme>',
     "mayúscula inicial — ¿lexicón case-sensitive?"),

    ("04-texto-go-punto.mp3", '<phoneme alphabet="ipa" ph="ɡo">go.</phoneme>',
     "texto con punto — no coincide exacto con 'go'"),

    ("05-respell-go.mp3", "gó",
     "re-deletreo SIN phoneme — evita lexicón de 'go' inglés"),

    ("06-respell-ipa.mp3", '<phoneme alphabet="ipa" ph="ɡo">gó</phoneme>',
     "re-deletreo + phoneme"),

    ("07-furgoneta.mp3", "furgoneta",
     "control — cómo suena el '-go-' real dentro de la palabra"),
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
    print("Escucha en orden y busca cuál(es) suenan como el '-go-' de 07:")
    print("  01 → referencia del bug ('wo')")
    print("  02 → ya sabemos que falla")
    print("  03, 04, 05, 06 → candidatos")
    print("─" * 60)
    print("\nEl primero que suene correcto (igual al 'go' de 'furgoneta')")
    print("es el patrón a usar en SILABAS_OVERRIDE_FONEMA.")
    print("\nSi 05 (respell SIN phoneme) funciona, es la solución más simple:")
    print("  no necesita <phoneme> en absoluto, solo cambiar el texto que")
    print("  se envía a Google para esa sílaba específica.")


if __name__ == "__main__":
    main()