#!/usr/bin/env python3
"""
scripts/test-silabas-lote3.py — Marina 2 (prueba experimental, lote 3)

30 sílabas problemáticas nuevas, clasificadas por hipótesis:

  A) DELETREA → respelling con tilde o sin ella
       cin, er, ír, brir, rrar, llu, cer, iz, cío, des, bke, fla, piés

  B) INGLÉS → gibberish + phoneme
       fun, vie, lien, hom (h muda + lectura inglesa), so

  C) DIPTONGO FALSO (acentúa la i/u como vocal separada) → phoneme /je/,/we/,/jo/
       pio, cio (inicio/sucio), nue, nie

  D) CASOS ESPECIALES
       jeep → forzar pronunciación "yip" (inglés); probar respell "yip"
       só   → sóplale, ya en ipa-overrides.json pero como palabra completa;
              la SÍLABA "so" debería tener su propio tratamiento
       to   → caballito de mar, ya en SILABAS_OVERRIDE; confirmar corrida

Cada grupo: 00-plano (control), 01-candidato, 02-palabra (contexto real).
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

SALIDA = Path(__file__).parent / "test-silabas-lote3"
SALIDA.mkdir(exist_ok=True)


def _ssml(c):
    return (f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
            f'xml:lang="{LANG}">{c}</speak>')

def ph(ipa, texto):
    return f'<phoneme alphabet="ipa" ph="{ipa}">{texto}</phoneme>'


# (silaba, palabra_ref, candidato, nota)
GRUPOS = [
    # ── A) DELETREA → respelling ──────────────────────────────────────────────
    ("cin",  "cinturón",    "cín",          "A: deletrea → tilde"),
    ("er",   "leer",        "ér",           "A: deletrea → tilde"),
    ("ír",   "reír",        "ir",           "A: deletrea → quitar tilde"),
    ("brir", "abrir",       "brír",         "A: deletrea → mover tilde a 'i'"),
    ("rrar", "cerrar",      "rrár",         "A: deletrea → tilde en 'a'"),
    ("llu",  "lluvia",      "llú",          "A: deletrea → tilde"),
    ("cer",  "cerca",       "cér",          "A: deletrea → tilde"),
    ("iz",   "izquierda",   "íz",           "A: deletrea → tilde"),
    ("cío",  "vacío",       "cio",          "A: deletrea → quitar tilde (cio sin acento)"),
    ("des",  "descansar",   "dés",          "A: pronuncia 'de.' sin s → tilde fuerza la s"),
    ("bke",  "dirigible",   "blé",          "A: deletrea → respell con 'bl' + tilde"),
    ("fla",  "flamenco",    "flá",          "A: deletrea → tilde"),
    ("piés", "ciempiés",    "pies",         "A: deletrea → quitar tilde"),

    # ── B) INGLÉS → gibberish + phoneme ──────────────────────────────────────
    ("fun",  "confundido",  ph("fun",  "xfun"), "B: inglés → gibberish+ph /fun/"),
    ("lien", "valiente",    ph("ljen", "xlien"), "B: inglés → gibberish+ph /ljen/"),
    ("vie",  "viejo",       ph("bje",  "xvie"), "B: inglés (v=b en ES) → gibberish+ph /bje/"),
    ("so",   "ganso",       ph("so",   "xso"),  "B: inglés → gibberish+ph /so/"),

    # ── C) DIPTONGO FALSO (acentúa vocal débil) → phoneme ────────────────────
    ("pio",  "limpio",      ph("pjo",  "pio"),  "C: acentúa 'i' → ph /pjo/ texto original"),
    ("cio",  "sucio",       ph("sjo",  "cio"),  "C: acentúa 'i' → ph /θjo/ texto original"),
    ("nue",  "nuevo",       ph("nwe",  "nue"),  "C: acentúa 'u' → ph /nwe/ texto original"),
    ("nie",  "nieve",       ph("nje",  "nie"),  "C: acentúa 'i' → ph /nje/ texto original"),

    # ── D) CASOS ESPECIALES ───────────────────────────────────────────────────
    # jeep: se deletrea; en inglés suena "yip". Queremos forzar la
    # pronunciación INGLESA "yip" (es una palabra extranjera usada en ES).
    # Hipótesis: respell como la pronunciación inglesa directamente.
    ("jeep", "jeep",        ph("dʒiːp", "xjeep"), "D: deletrea; forzar pronunciación inglesa /dʒiːp/"),

    # hom: h muda leída como /x/ (pronuncia "jom") + posible lectura inglesa
    ("hom",  "hombro",      "om",           "D: h muda 'jom' → quitar h"),

    # so de sóplale: la SÍLABA "so" puede colisionar con inglés.
    # 'so' ya está cubierto en grupo 17 (ganso), confirmar aquí con sóplale.
    ("só",   "sóplale",     ph("so",   "xso"),  "D: mismo fix que 'so' de ganso"),
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
    total = len(GRUPOS) * 3
    print(f"Voz: {VOZ}  |  Lang: {LANG}")
    print(f"Generando {total} archivos ({len(GRUPOS)} grupos × 3) en {SALIDA}/\n")

    for i, (silaba, palabra, candidato, nota) in enumerate(GRUPOS, 1):
        pref = f"{i:02d}-{silaba}"
        ok = all([
            sintetizar(f"{pref}-00-plano.mp3",      silaba,    "control"),
            sintetizar(f"{pref}-01-candidato.mp3",  candidato, "candidato"),
            sintetizar(f"{pref}-02-{palabra}.mp3",  palabra,   "contexto"),
        ])
        print(f"  {'✅' if ok else '⚠️'} {pref:12s} ({palabra:14s}) — {nota}")

    print("\n" + "─" * 65)
    print("Dime el número de los grupos donde 01-candidato NO suene bien.")
    print("Los que no menciones se agregan directo a SILABAS_OVERRIDE.")
    print("─" * 65)


if __name__ == "__main__":
    main()