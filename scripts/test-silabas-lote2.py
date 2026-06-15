#!/usr/bin/env python3
"""
scripts/test-silabas-lote2.py — Marina 2 (prueba experimental, lote 2)

24 sílabas problemáticas reportadas con es-US-News-F, agrupadas por
hipótesis de corrección basada en los patrones ya validados en lote 1:

  A) DELETREA → respelling con tilde, sin <phoneme>
     (patrón validado: "rra"→"rrá", "ho"→"o" también sin tilde)
       lla, bé, ba, bró, lli, rrin, ló, cu

  B) LECTURA EN INGLÉS → <phoneme> con texto interno gibberish
     (patrón validado: "gre"→xgre+gɾe, "to"→xto+to)
       be, jo, cue, ju, jar, yak, gar, je, tie, sue

  C) "H" MUDA → quitar la "h"
     (patrón validado: "ho"→"o")
       ham, hi

  D) CASOS ESPECIALES (hipótesis propia c/u)
       dra  (dragón→"doctora", abreviatura "Dra.") → gibberish+phoneme
       vol  (volcán→"volume")                       → gibberish+phoneme con "b" (v=b en español)
       xo   (xochimilco→deletrea, debería "so")     → respell "so"
       rue  (rueda→"ru", pierde diptongo)           → gibberish+phoneme /rwe/

Cada grupo genera 3 archivos: 00-plano (control del bug), 01-candidato
(hipótesis de corrección), 02-palabra (control: cómo suena en contexto real).

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

SALIDA = Path(__file__).parent / "test-silabas-lote2"
SALIDA.mkdir(exist_ok=True)


def _ssml(contenido: str) -> str:
    return (
        '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
        f'xml:lang="{LANG}">{contenido}</speak>'
    )


def _fonema(ph: str, texto_interno: str) -> str:
    return f'<phoneme alphabet="ipa" ph="{ph}">{texto_interno}</phoneme>'


# Cada grupo: (silaba, palabra_completa, candidato_ssml, nota)
GRUPOS = [
    # ── A) DELETREA → respelling con tilde ───────────────────────────────────
    ("lla",  "ardilla",  "llá",                 "A: deletrea -> respell tilde"),
    ("bé",   "bebé",     "be",                  "A: deletrea 'be e con acento' -> quitar tilde"),
    ("ba",   "ballena",  "bá",                  "A: deletrea -> respell tilde"),
    ("bró",  "brócoli",  "bro",                 "A: deletrea -> quitar tilde"),
    ("lli",  "gallina",  "llí",                 "A: deletrea -> respell tilde"),
    ("rrin", "ornitorrinco", "rrín",            "A: deletrea -> respell tilde (en 'i')"),
    ("ló",   "xilófono", "lo",                  "A: deletrea -> quitar tilde"),
    ("cu",   "curamos",  "cú",                  "A: deletrea -> respell tilde"),

    # ── B) INGLÉS → gibberish + phoneme ──────────────────────────────────────
    ("be",  "abeja",   _fonema("be",  "xbe"),  "B: 'bi' inglés -> gibberish+phoneme"),
    ("jo",  "ajo",     _fonema("xo",  "xjo"),  "B: 'yo' inglés -> gibberish+phoneme /xo/"),
    ("cue", "escuela", _fonema("kwe", "xcue"), "B: 'kiu' inglés -> gibberish+phoneme /kwe/"),
    ("ju",  "juguete", _fonema("xu",  "xju"),  "B: 'yu' inglés -> gibberish+phoneme /xu/"),
    ("jar", "jardín",  _fonema("xar", "xjar"), "B: 'jar' inglés -> gibberish+phoneme /xar/"),
    ("yak", "kayak",   _fonema("ʝak", "xyak"), "B: 'iak' inglés -> gibberish+phoneme /ʝak/"),
    ("gar", "lagarto", _fonema("gar", "xgar"), "B: lectura inglesa -> gibberish+phoneme /gar/"),
    ("je",  "tijeras", _fonema("xe",  "xje"),  "B: 'ye' inglés -> gibberish+phoneme /xe/"),
    ("tie", "tienes",  _fonema("tje", "xtie"), "B: lectura inglesa -> gibberish+phoneme /tje/"),
    ("sue", "sueño",   _fonema("swe", "xsue"), "B: lectura inglesa -> gibberish+phoneme /swe/"),

    # ── C) "H" MUDA → quitar la h ─────────────────────────────────────────────
    ("ham", "hambre",  "am",                   "C: h muda leída en inglés -> quitar h"),
    ("hi",  "higo",    "i",                    "C: h muda leída en inglés -> quitar h"),

    # ── D) Casos especiales ───────────────────────────────────────────────────
    ("dra", "dragón",    _fonema("dra", "xdra"), "D: 'doctora' (abrev. Dra.) -> gibberish+phoneme"),
    ("vol", "volcán",    _fonema("bol", "xvol"), "D: 'volume' (abrev. inglesa) -> gibberish+phoneme /bol/ (v=b)"),
    ("xo",  "xochimilco","so",                   "D: deletrea, debería 'so' -> respell directo"),
    ("rue", "rueda",     _fonema("rwe", "xrue"), "D: pierde diptongo ('ru') -> gibberish+phoneme /rwe/"),
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
        print(f"  ❌ {nombre_archivo} — HTTP {resp.status_code}: {resp.text[:150]}")
        return False
    audio_b64 = resp.json().get("audioContent")
    if not audio_b64:
        print(f"  ❌ {nombre_archivo} — sin audioContent")
        return False
    ruta.write_bytes(base64.b64decode(audio_b64))
    return True


def main():
    total = len(GRUPOS) * 3
    print(f"Voz: {VOZ}  |  Lang: {LANG}")
    print(f"Generando {total} archivos ({len(GRUPOS)} grupos x 3) en {SALIDA}/\n")

    for i, (silaba, palabra, candidato, nota) in enumerate(GRUPOS, 1):
        prefijo = f"{i:02d}-{silaba}"
        ok_plano = sintetizar(f"{prefijo}-00-plano.mp3", silaba, "control (plano)")
        ok_cand  = sintetizar(f"{prefijo}-01-candidato.mp3", candidato, "candidato")
        ok_palab = sintetizar(f"{prefijo}-02-{palabra}.mp3", palabra, "palabra completa")
        estado = "✅" if (ok_plano and ok_cand and ok_palab) else "⚠️"
        print(f"  {estado} {prefijo:10s} ({palabra:14s}) — {nota}")

    print("\n" + "─" * 70)
    print("Para cada grupo NN-silaba, escucha los 3 archivos:")
    print("  00-plano      → debería reproducir el bug reportado")
    print("  01-candidato  → ¿corrige el problema?")
    print("  02-palabra    → cómo suena esa sílaba EN CONTEXTO (la meta)")
    print()
    print("Reporta solo los grupos donde 01-candidato NO suene bien —")
    print("para esos habrá que probar otra hipótesis (como pasó con 'go').")
    print("Los que sí funcionen, se agregan directo a SILABAS_OVERRIDE.")
    print("─" * 70)


if __name__ == "__main__":
    main()