#!/usr/bin/env python3
"""
scripts/test-silabas-varias.py — Marina 2 (prueba experimental)

Cinco sílabas problemáticas nuevas con es-US-News-F:
  - "gre" (tigre)       → se deletrea ("ge-erre-e")
  - "rra" (gorra)       → se deletrea ("erre-erre-a")
  - "hue" (huevo)       → suena "jue" (h muda leída como /x/)
  - "ho"  (hoja)        → suena "jo"  (h muda leída como /x/)
  - "to"  (instrumento) → suena "tu" (colisión con palabra inglesa "to",
                          MISMO patrón que "go"→"wo" — ya resuelto con
                          SILABAS_AUDIO_FIJO en generar-audio-silabas.py)

Para "hue"/"ho": la "h" es muda en español — hipótesis simple es QUITARLA.
Para "gre"/"rra": probar fonema con texto interno gibberish (como con "go")
y respelling con tilde.

Cada grupo incluye un control con la PALABRA COMPLETA (donde la sílaba
suena correcta) como referencia.

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

SALIDA = Path(__file__).parent / "test-silabas-varias"
SALIDA.mkdir(exist_ok=True)


def _ssml(contenido: str) -> str:
    return (
        '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
        f'xml:lang="{LANG}">{contenido}</speak>'
    )


CASOS = [
    # ── Grupo "gre" (tigre: ti-gre) ──────────────────────────────────────────
    ("g01-gre-plano.mp3", "gre",
     "control — esperado: deletrea 'ge-erre-e'"),
    ("g02-gre-phoneme-xgre.mp3", '<phoneme alphabet="ipa" ph="gɾe">xgre</phoneme>',
     "texto interno gibberish 'xgre' + ph='gɾe' (g + r suave + e)"),
    ("g03-gre-respell.mp3", "gré",
     "re-deletreo con tilde — ¿evita el deletreo letra por letra?"),
    ("g04-tigre.mp3", "tigre",
     "control — cómo suena '-gre' real"),

    # ── Grupo "rra" (gorra: go-rra) ──────────────────────────────────────────
    ("r01-rra-plano.mp3", "rra",
     "control — esperado: deletrea 'erre-erre-a'"),
    ("r02-rra-phoneme-xrra.mp3", '<phoneme alphabet="ipa" ph="ra">xrra</phoneme>',
     "texto interno gibberish 'xrra' + ph='ra' (rr fuerte/trill + a)"),
    ("r03-rra-respell.mp3", "rrá",
     "re-deletreo con tilde"),
    ("r04-gorra.mp3", "gorra",
     "control — cómo suena '-rra' real"),

    # ── Grupo "hue" (huevo: hue-vo) ───────────────────────────────────────────
    ("h01-hue-plano.mp3", "hue",
     "control — esperado: suena 'jue'"),
    ("h02-hue-sin-h.mp3", "ue",
     "quitar la 'h' muda — ¿suena 'ue' correcto?"),
    ("h03-hue-phoneme.mp3", '<phoneme alphabet="ipa" ph="we">hue</phoneme>',
     "fonema /we/ manteniendo texto 'hue'"),
    ("h04-huevo.mp3", "huevo",
     "control — cómo suena '-hue-' real"),

    # ── Grupo "ho" (hoja: ho-ja) ───────────────────────────────────────────────
    ("o01-ho-plano.mp3", "ho",
     "control — esperado: suena 'jo'"),
    ("o02-ho-sin-h.mp3", "o",
     "quitar la 'h' muda — ¿suena 'o' correcto, no deletrea?"),
    ("o03-ho-phoneme.mp3", '<phoneme alphabet="ipa" ph="o">ho</phoneme>',
     "fonema /o/ manteniendo texto 'ho'"),
    ("o04-hoja.mp3", "hoja",
     "control — cómo suena '-ho-' real"),

    # ── Grupo "to" (instrumento: ins-tru-men-to) ──────────────────────────────
    # Mismo patrón que "go"→"wo": colisión con palabra inglesa "to" /tuː/.
    ("t01-to-plano.mp3", "to",
     "control — esperado: suena 'tu' (colisión con 'to' inglés)"),
    ("t02-to-phoneme-xto.mp3", '<phoneme alphabet="ipa" ph="to">xto</phoneme>',
     "texto interno gibberish 'xto' + ph='to' (mismo patrón que se probó para 'go')"),
    ("t03-to-respell.mp3", "tó",
     "re-deletreo con tilde"),
    ("t04-instrumento.mp3", "instrumento",
     "control — cómo suena '-to' real al final de la palabra"),
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
    print(f"  ✅ {nombre_archivo:28s} — {descripcion}")
    return True


def main():
    print(f"Voz: {VOZ}  |  Lang: {LANG}")
    print(f"Generando {len(CASOS)} archivos en {SALIDA}/\n")

    for nombre, contenido, desc in CASOS:
        sintetizar(nombre, contenido, desc)

    print("\n" + "─" * 60)
    print("GRUPO gre (g01-g04): ¿g02 o g03 suenan a sílaba 'gre' real")
    print("  (sin deletrear), comparado con g04 (tigre)?")
    print()
    print("GRUPO rra (r01-r04): ¿r02 o r03 suenan a 'rra' real")
    print("  (sin deletrear), comparado con r04 (gorra)?")
    print()
    print("GRUPO hue (h01-h04): ¿h02 (sin 'h') o h03 (phoneme) suenan")
    print("  a 'hue' correcto, comparado con h04 (huevo)?")
    print()
    print("GRUPO ho (o01-o04): ¿o02 (sin 'h') o o03 (phoneme) suenan")
    print("  a 'ho' correcto (NO deletreado), comparado con o04 (hoja)?")
    print()
    print("GRUPO to (t01-t04): ¿t02 o t03 suenan a 'to' real (no 'tu'),")
    print("  comparado con t04 (instrumento)?")
    print("  Si NINGUNO funciona (como pasó con 'go'), agregar 'to' a")
    print("  SILABAS_AUDIO_FIJO en generar-audio-silabas.py.")
    print("─" * 60)


if __name__ == "__main__":
    main()