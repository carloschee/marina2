#!/usr/bin/env python3
"""
scripts/test-silabas-lote4.py — Marina 2 (prueba experimental, lote 4)

8 sílabas nuevas:
  hal (halcón)          → h muda leída como "jal" → quitar h → "al"
  hie (hiena)           → h muda leída como "jie" → quitar h → "ie"
  hu  (huracán)         → h muda leída como "ju"  → quitar h → "u"
                          (riesgo: "u" sola puede sonar rara → segunda hipótesis:
                           ph /u/ con texto "xu")
  car (buque de carga)  → lectura inglesa → gibberish+phoneme /kar/
  ble (convertible)     → deletrea → respelling con tilde "blé"
  mio (camioneta)       → diptongo falso, acentúa la i → ph /mjo/ texto original
                          (mismo patrón que pio→pjo, cio→sjo)

Requisitos:
  pip install requests
Variable de entorno: GOOGLE_TTS_API_KEY
"""

import base64, os, sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("❌  pip install requests"); sys.exit(1)

API_KEY = os.environ.get("GOOGLE_TTS_API_KEY")
if not API_KEY:
    print("❌  Falta GOOGLE_TTS_API_KEY."); sys.exit(1)

SYNTH_URL = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={API_KEY}"
VOZ, LANG = "es-US-News-F", "es-US"
SALIDA = Path(__file__).parent / "test-silabas-lote4"
SALIDA.mkdir(exist_ok=True)

def _ssml(c):
    return (f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
            f'xml:lang="{LANG}">{c}</speak>')

def ph(ipa, texto):
    return f'<phoneme alphabet="ipa" ph="{ipa}">{texto}</phoneme>'

GRUPOS = [
    # ── hal (halcón) ──────────────────────────────────────────────────────────
    ("hal",  "halcón",         "al",                "h muda → quitar h"),
    # ── hie (hiena) ───────────────────────────────────────────────────────────
    ("hie",  "hiena",          "ie",                "h muda → quitar h"),
    # ── hu (huracán) ──────────────────────────────────────────────────────────
    # Dos hipótesis: quitar h (simple) vs phoneme /u/ con gibberish
    ("hu-a", "huracán",        "u",                 "h muda → quitar h (¿suena 'u'?)"),
    ("hu-b", "huracán",        ph("u", "xu"),       "h muda → gibberish+phoneme /u/"),
    # ── car (buque de carga / montacargas) ────────────────────────────────────
    ("car",  "carga",          ph("kar", "xcar"),   "inglés → gibberish+phoneme /kar/"),
    # ── ble (convertible) ─────────────────────────────────────────────────────
    ("ble",  "convertible",    "blé",               "deletrea → respelling con tilde"),
    # ── mio (camioneta) ───────────────────────────────────────────────────────
    ("mio",  "camioneta",      ph("mjo", "mio"),    "diptongo falso → ph /mjo/ texto original"),
]


def sintetizar(nombre, contenido, desc):
    ruta = SALIDA / nombre
    body = {
        "input": {"ssml": _ssml(contenido)},
        "voice": {"languageCode": LANG, "name": VOZ},
        "audioConfig": {"audioEncoding": "MP3"},
    }
    resp = requests.post(SYNTH_URL, json=body, timeout=30)
    if resp.status_code != 200:
        print(f"  ❌ {nombre} — HTTP {resp.status_code}: {resp.text[:120]}")
        return False
    audio_b64 = resp.json().get("audioContent")
    if not audio_b64:
        print(f"  ❌ {nombre} — sin audioContent"); return False
    ruta.write_bytes(base64.b64decode(audio_b64))
    return True


def main():
    print(f"Voz: {VOZ}  |  Lang: {LANG}")
    print(f"Generando archivos en {SALIDA}/\n")

    for i, (silaba, palabra, candidato, nota) in enumerate(GRUPOS, 1):
        pref = f"{i:02d}-{silaba}"
        ok = all([
            sintetizar(f"{pref}-00-plano.mp3",     silaba,    "control"),
            sintetizar(f"{pref}-01-candidato.mp3", candidato, nota),
            sintetizar(f"{pref}-02-{palabra}.mp3", palabra,   "contexto"),
        ])
        print(f"  {'✅' if ok else '⚠️'} {pref:12s} ({palabra:14s}) — {nota}")

    print("\n" + "─" * 60)
    print("Dime los números de grupo donde 01-candidato NO suene bien.")
    print("Para 'hu' (grupos 03 y 04): dime cuál de los dos suena mejor.")
    print("─" * 60)


if __name__ == "__main__":
    main()