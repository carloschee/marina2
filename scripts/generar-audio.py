#!/usr/bin/env python3
"""
scripts/generar-audio.py — Marina 2
Genera archivos MP3 para vocabulario y frases.

  ESPAÑOL → Google Cloud Text-to-Speech (es-US-News-F), vía REST + API key.
            Elegida porque respeta <phoneme alphabet="ipa">, lo que permite
            corregir:
              - "r" suave intermedia que el motor pronunciaba como "rr"
                (ej. "pero" -> sílaba "ro" sonaba "rro")
              - palabras que el motor colapsa/mutila (ej. "sóplale" -> "sople"),
                vía el archivo data/ipa-overrides.json

  INGLÉS  → edge-tts (en-US-AriaNeural), sin cambios — no presenta los
            problemas de pronunciación detectados en español.

Uso:
  pip install edge-tts requests
  export GOOGLE_TTS_API_KEY="tu-api-key"   (ver scripts/GUIA-GOOGLE-TTS.md)
  python scripts/generar-audio.py

Salida:
  assets/audio/es/{ruta_img sin .png}.mp3   ← vocabulario español (Google)
  assets/audio/en/{ruta_img sin .png}.mp3   ← vocabulario inglés (edge-tts)
  assets/audio/frases/es/{id}.mp3           ← frases completas ES (Google)
  assets/audio/frases/es/{pieza}.mp3        ← piezas de texto ES (Google)
  assets/audio/frases/en/{id}.mp3           ← phrases EN (edge-tts)
  assets/audio/frases/en/{pieza}.mp3        ← text pieces EN (edge-tts)

Opciones:
  --forzar          Regenera archivos aunque ya existan
  --solo-es         Solo vocabulario español
  --solo-en         Solo vocabulario inglés
  --solo-frases     Solo frases y piezas (ambos idiomas)
  --seco            Dry run — muestra qué haría sin generar nada
  --concurrencia N  Peticiones simultáneas (default: 5)

── data/ipa-overrides.json ───────────────────────────────────────────────────
Archivo opcional (puede no existir o estar vacío: {}). Mapea texto exacto
(en minúsculas) → transcripción IPA con acento marcado con ˈ (U+02C8,
NO el apóstrofo ASCII '). Solo para palabras/frases ES que la voz mutila.

Ejemplo:
  {
    "¡sóplale!": "ˈso.pla.le",
    "sóplale":   "ˈso.pla.le"
  }

Cuando el texto de un ítem coincide (case-insensitive) con una clave de este
archivo, se sintetiza con <phoneme alphabet="ipa" ph="...">  en vez de texto
plano. El resto del catálogo no se ve afectado.
"""

import asyncio
import base64
import json
import os
import sys
import argparse
import time
from pathlib import Path
from datetime import datetime

try:
    import edge_tts
except ImportError:
    print("❌  edge-tts no está instalado.")
    print("   Ejecuta: pip install edge-tts")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("❌  requests no está instalado.")
    print("   Ejecuta: pip install requests")
    sys.exit(1)

# ─── Configuración ────────────────────────────────────────────────────────────

# Español — Google Cloud TTS
MOTOR_ES         = "google"
VOZ_ES           = "es-US-News-F"
LANG_ES          = "es-US"
CONFIG_ES_GOOGLE = {"speakingRate": 0.92, "pitch": 0.0}   # ≈ antiguo "-8%"
CONFIG_FRASES_GOOGLE = {"speakingRate": 0.88, "pitch": 0.0}  # ≈ antiguo "-12%"

# Inglés — edge-tts (sin cambios)
MOTOR_EN      = "edge"
VOZ_EN        = "en-US-AriaNeural"
CONFIG_EN     = {"rate": "-5%", "volume": "+0%", "pitch": "+0Hz"}

GOOGLE_API_KEY  = os.environ.get("GOOGLE_TTS_API_KEY")
GOOGLE_SYNTH_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"

REINTENTOS    = 3
BACKOFF_BASE  = 1.0

RAIZ            = Path(__file__).parent.parent
VOCAB_JSON      = RAIZ / "data" / "vocabulario.json"
FRASES_JSON     = RAIZ / "data" / "frases.json"
MEMORAMA_JSON   = RAIZ / "data" / "memorama.json"
PICTOS_JSON     = RAIZ / "data" / "pictos.json"
IPA_OVERRIDES_JSON = RAIZ / "data" / "ipa-overrides.json"
DIR_AUDIO       = RAIZ / "assets" / "audio"
DIR_ES          = DIR_AUDIO / "es"
DIR_EN          = DIR_AUDIO / "en"
DIR_FRASES_ES   = DIR_AUDIO / "frases" / "es"
DIR_FRASES_EN   = DIR_AUDIO / "frases" / "en"
LOG_PATH        = RAIZ / "scripts" / "errores-audio.log"

# ─── Overrides de pronunciación (IPA) ──────────────────────────────────────────

def cargar_ipa_overrides() -> dict:
    """
    Carga data/ipa-overrides.json si existe. Claves en minúsculas para
    comparación case-insensitive. Archivo ausente o vacío -> {}.
    """
    if not IPA_OVERRIDES_JSON.exists():
        return {}
    try:
        with open(IPA_OVERRIDES_JSON, encoding="utf-8") as f:
            data = json.load(f)
        return {str(k).strip().lower(): v for k, v in data.items()}
    except Exception as e:
        print(f"⚠️  No se pudo leer {IPA_OVERRIDES_JSON.name}: {e}")
        return {}


def ipa_para(texto: str, overrides: dict):
    """Devuelve la transcripción IPA si `texto` tiene override, o None."""
    return overrides.get((texto or "").strip().lower())

# ─── Sanitización de nombres de archivo ──────────────────────────────────────

# Caracteres prohibidos en Windows (NTFS) y problemáticos en otros sistemas.
# Incluye signos de puntuación españoles ¿ ¡ y signos comunes ! , ; .
_CHARS_INVALIDOS = str.maketrans({
    '\\': '', '/': '-', ':': '', '*': '', '?': '',
    '"': '',  '<': '',  '>': '', '|': '', '¿': '',
    '¡': '',  '!': '',  ',': '', ';': '', '.': '',
})

def sanitizar_nombre(texto: str) -> str:
    """
    Convierte texto arbitrario en nombre de archivo seguro para
    Windows, macOS y Linux.
      '¿qué hacemos?' → 'que-hacemos'
      '¡sóplale!'     → 'soplale'
      'el sol'        → 'el-sol'
    """
    nombre = texto.strip().lower()
    nombre = nombre.translate(_CHARS_INVALIDOS)
    # Espacios → guión, colapsar guiones múltiples
    nombre = '-'.join(part for part in nombre.split() if part)
    nombre = nombre.strip('-')
    return nombre or "sin-nombre"


# ─── Progreso ─────────────────────────────────────────────────────────────────

class Progreso:
    def __init__(self, total: int, prefijo: str = ""):
        self.total   = total
        self.actual  = 0
        self.prefijo = prefijo
        self._inicio = time.monotonic()
        self._ancho  = 30

    def avanzar(self, n: int = 1):
        self.actual = min(self.actual + n, self.total)
        self._dibujar()

    def _dibujar(self):
        if self.total == 0:
            return
        pct     = self.actual / self.total
        llenos  = int(self._ancho * pct)
        barra   = "█" * llenos + "░" * (self._ancho - llenos)
        elapsed = time.monotonic() - self._inicio
        eta     = (elapsed / self.actual * (self.total - self.actual)) if self.actual else 0
        eta_str = f"{eta:5.1f}s" if eta < 3600 else f"{eta/60:.1f}m"
        print(
            f"\r  {self.prefijo} [{barra}] {self.actual}/{self.total} "
            f"({pct*100:5.1f}%) ETA {eta_str}   ",
            end="", flush=True,
        )

    def cerrar(self):
        self._dibujar()
        print()

# ─── Síntesis: Google Cloud TTS (español) ──────────────────────────────────────

def _es_ipa(valor: str) -> bool:
    # IPA real contiene ˈ (U+02C8) o tiene puntos de separación silábica
    return 'ˈ' in valor or (len(valor) > 2 and '.' in valor)


def _google_synthesize_sync(texto: str, override, voz: str, lang: str,
                             speaking_rate: float, pitch: float) -> bytes:
    # override puede ser:
    #   None          -> texto plano sin corrección
    #   IPA (con ˈ o puntos) -> <phoneme alphabet='ipa' ph='...'>
    #   texto plano   -> respelling directo (ej. 'combertible')
    if override and _es_ipa(override):
        contenido = f'<phoneme alphabet="ipa" ph="{override}">{texto}</phoneme>'
        body_input = {
            "ssml": (
                '<speak version="1.0" '
                'xmlns="http://www.w3.org/2001/10/synthesis" '
                f'xml:lang="{lang}">{contenido}</speak>'
            )
        }
    elif override:
        # Respelling: enviar el texto alternativo directamente como texto plano
        body_input = {"text": override}
    else:
        body_input = {"text": texto}

    body = {
        "input": body_input,
        "voice": {"languageCode": lang, "name": voz},
        "audioConfig": {
            "audioEncoding": "MP3",
            "speakingRate": speaking_rate,
            "pitch": pitch,
        },
    }
    resp = requests.post(
        GOOGLE_SYNTH_URL, params={"key": GOOGLE_API_KEY}, json=body, timeout=30
    )
    resp.raise_for_status()
    audio_b64 = resp.json().get("audioContent")
    if not audio_b64:
        raise RuntimeError(f"Respuesta sin audioContent: {resp.text[:200]}")
    return base64.b64decode(audio_b64)

# ─── Generación con reintentos (despacha por motor) ───────────────────────────

async def generar_mp3(texto: str, motor: str, voz: str, lang: str,
                       config: dict, ruta: Path, ipa=None):
    for intento in range(1, REINTENTOS + 1):
        try:
            if motor == "edge":
                communicate = edge_tts.Communicate(
                    text=texto, voice=voz,
                    rate=config["rate"], volume=config["volume"], pitch=config["pitch"],
                )
                await communicate.save(str(ruta))
            else:  # "google"
                data = await asyncio.to_thread(
                    _google_synthesize_sync, texto, ipa, voz, lang,
                    config["speakingRate"], config["pitch"],
                )
                ruta.write_bytes(data)
            return True
        except Exception as e:
            if intento < REINTENTOS:
                await asyncio.sleep(BACKOFF_BASE * (2 ** (intento - 1)))
            else:
                return False, str(e)
    return False, "desconocido"

# ─── Procesamiento concurrente ────────────────────────────────────────────────

async def procesar_lista(
    items, lang_code, motor, voz, lang, config, directorio,
    forzar, seco, concurrencia, errores_log,
):
    """items: lista de (nombre_archivo, texto, ipa_o_None)"""
    pendientes = []
    omitidos   = 0
    for nombre, texto, ipa in items:
        ruta  = directorio / (nombre + ".mp3")
        existe = ruta.exists() and ruta.stat().st_size > 0
        if existe and not forzar:
            omitidos += 1
        else:
            pendientes.append((nombre, texto, ipa, ruta))

    generados = errores = 0
    if not pendientes:
        return generados, omitidos, errores

    progreso = Progreso(len(pendientes), lang_code)
    semaforo = asyncio.Semaphore(concurrencia)

    async def _tarea(nombre, texto, ipa, ruta):
        nonlocal generados, errores
        async with semaforo:
            if seco:
                generados += 1
                progreso.avanzar()
                return
            resultado = await generar_mp3(texto, motor, voz, lang, config, ruta, ipa)
            if resultado is True:
                generados += 1
            else:
                errores += 1
                _, motivo = resultado
                errores_log.append({
                    "archivo": str(ruta.relative_to(RAIZ)),
                    "texto":   texto,
                    "lang":    lang_code,
                    "error":   motivo,
                    "ts":      datetime.now().isoformat(timespec="seconds"),
                })
            progreso.avanzar()

    await asyncio.gather(*[_tarea(n, t, i, r) for n, t, i, r in pendientes])
    progreso.cerrar()
    return generados, omitidos, errores

# ─── Log ──────────────────────────────────────────────────────────────────────

def escribir_log(errores_log: list):
    if not errores_log:
        return
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(f"\n── Ejecución {datetime.now().isoformat(timespec='seconds')} ──\n")
        for e in errores_log:
            f.write(
                f"  [{e['lang']}] {e['archivo']}\n"
                f"       texto : {e['texto']}\n"
                f"       error : {e['error']}\n"
            )
    print(f"\n📋  Log de errores: scripts/errores-audio.log")

# ─── Main ─────────────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(description="Generador de audio para Marina 2")
    parser.add_argument("--forzar",       action="store_true")
    parser.add_argument("--solo-es",      action="store_true")
    parser.add_argument("--solo-en",      action="store_true")
    parser.add_argument("--solo-frases",  action="store_true")
    parser.add_argument("--seco",         action="store_true")
    parser.add_argument("--concurrencia", type=int, default=5, metavar="N")
    args = parser.parse_args()

    modo_solo_frases = args.solo_frases and not (args.solo_es or args.solo_en)
    conc             = max(1, min(args.concurrencia, 20))

    # ── Verificar API key de Google si se va a generar algo en español ────────
    necesita_es = not args.solo_en
    if necesita_es and not args.seco and not GOOGLE_API_KEY:
        print("❌  Falta la variable de entorno GOOGLE_TTS_API_KEY.")
        print("   El español ahora se genera con Google Cloud TTS.")
        print("   Ver scripts/GUIA-GOOGLE-TTS.md para obtener una API key.")
        print("   (Para generar solo inglés sin la key: --solo-en)")
        sys.exit(1)

    ipa_overrides = cargar_ipa_overrides()
    if ipa_overrides:
        print(f"📖  {len(ipa_overrides)} override(s) de pronunciación cargados "
              f"desde data/ipa-overrides.json")

    # ── Vocabulario desde pictos.json ────────────────────────────────────────
    # Estructura: { "id", "es", "en", "ruta_img" }
    # nombre_archivo = ruta_img sin .png
    # texto_tts      = es (español) / en (inglés)
    # Cada item: (nombre_archivo, texto, ipa_o_None)
    palabras_es, palabras_en = [], []

    if not modo_solo_frases:
        if PICTOS_JSON.exists():
            with open(PICTOS_JSON, encoding="utf-8") as f:
                catalogo = json.load(f)

            palabras_es = [
                (e["ruta_img"].replace(".png", ""), e["es"], ipa_para(e["es"], ipa_overrides))
                for e in catalogo if e.get("ruta_img") and e.get("es")
            ]
            palabras_en = [
                (e["ruta_img"].replace(".png", ""), e["en"], None)
                for e in catalogo if e.get("ruta_img") and e.get("en")
            ]

            # Agregar palabras de memorama que no estén ya en pictos.json
            if MEMORAMA_JSON.exists():
                rutas_es = {nombre for nombre, _, _ in palabras_es}
                rutas_en = {nombre for nombre, _, _ in palabras_en}
                with open(MEMORAMA_JSON, encoding="utf-8") as f:
                    temas_mem = json.load(f)
                extra_es, extra_en = [], []
                for tema in temas_mem:
                    for p in tema.get("palabras", []):
                        if isinstance(p, dict):
                            ruta = (p.get("ruta_img") or "").replace(".png", "")
                            es   = p.get("es", "").strip()
                            en   = p.get("en", "").strip()
                            if ruta and es and ruta not in rutas_es:
                                extra_es.append((ruta, es, ipa_para(es, ipa_overrides)))
                                rutas_es.add(ruta)
                            if ruta and en and ruta not in rutas_en:
                                extra_en.append((ruta, en, None))
                                rutas_en.add(ruta)
                palabras_es += extra_es
                palabras_en += extra_en

    # ── Frases desde frases.json ─────────────────────────────────────────────
    frases_es_items = frases_en_items = []
    piezas_es_items = piezas_en_items = []
    piezas_picto_es_items = piezas_picto_en_items = []

    if not args.solo_es and not args.solo_en:
        if FRASES_JSON.exists():
            with open(FRASES_JSON, encoding="utf-8") as f:
                frases = json.load(f)

            catalogo_lookup = {}
            if PICTOS_JSON.exists():
                with open(PICTOS_JSON, encoding="utf-8") as f:
                    catalogo_lookup = {e["id"]: e for e in json.load(f)}

            vocab_es = vocab_en = set()
            if PICTOS_JSON.exists():
                vocab_es = {e["es"] for e in catalogo_lookup.values() if e.get("es")}
                vocab_en = {e["en"] for e in catalogo_lookup.values() if e.get("en")}

            _frases_es, _frases_en = [], []
            _piezas_txt_es, _piezas_txt_en = set(), set()
            _piezas_picto_es, _piezas_picto_en = set(), set()

            for frase in frases:
                fid  = frase.get("id", "").strip()
                lang_f = frase.get("lang", "es").strip()

                if lang_f == "en":
                    texto = frase.get("en", frase.get("es", "")).strip()
                    if fid and texto:
                        _frases_en.append((fid, texto))
                    ref_vocab        = vocab_en
                    ref_piezas_txt   = _piezas_txt_en
                    ref_piezas_picto = _piezas_picto_en
                    ref_dir_audio    = DIR_EN
                    lang_key         = "en"
                else:
                    texto = frase.get("es", "").strip()
                    if fid and texto:
                        _frases_es.append((fid, texto))
                    ref_vocab        = vocab_es
                    ref_piezas_txt   = _piezas_txt_es
                    ref_piezas_picto = _piezas_picto_es
                    ref_dir_audio    = DIR_ES
                    lang_key         = "es"

                for pieza in frase.get("piezas", []):
                    if pieza.get("tipo") == "texto":
                        pt = pieza.get("texto", "").strip()
                        if pt and pt not in ref_vocab:
                            ref_piezas_txt.add(pt)

                    elif pieza.get("tipo") == "picto":
                        pid = pieza.get("picto_id")
                        if pid and catalogo_lookup:
                            entrada = catalogo_lookup.get(pid)
                            if entrada:
                                nombre = entrada["ruta_img"].replace(".png", "")
                                tts    = entrada.get(lang_key) or entrada.get("es", "")
                                ruta_mp3 = ref_dir_audio / (nombre + ".mp3")
                                if not ruta_mp3.exists() or ruta_mp3.stat().st_size == 0:
                                    ref_piezas_picto.add((nombre, tts))
                        else:
                            pt = pieza.get("texto", "").strip()
                            if pt:
                                nombre_safe = sanitizar_nombre(pt)
                                ruta_mp3 = ref_dir_audio / (nombre_safe + ".mp3")
                                if not ruta_mp3.exists() or ruta_mp3.stat().st_size == 0:
                                    ref_piezas_picto.add((nombre_safe, pt))

            frases_es_items = [(fid, texto, ipa_para(texto, ipa_overrides)) for fid, texto in _frases_es]
            frases_en_items = [(fid, texto, None) for fid, texto in _frases_en]
            piezas_es_items = [(sanitizar_nombre(p), p, ipa_para(p, ipa_overrides)) for p in sorted(_piezas_txt_es)]
            piezas_en_items = [(sanitizar_nombre(p), p, None) for p in sorted(_piezas_txt_en)]
            piezas_picto_es_items = [(n, t, ipa_para(t, ipa_overrides)) for n, t in sorted(_piezas_picto_es, key=lambda x: x[0])]
            piezas_picto_en_items = [(n, t, None) for n, t in sorted(_piezas_picto_en, key=lambda x: x[0])]

    # ── Resumen inicial ───────────────────────────────────────────────────────
    print(f"\n🌊  Marina 2 — Generador de audio")
    print(f"   Concurrencia    : {conc} peticiones simultáneas")
    print(f"   Voz ES          : {VOZ_ES}  (Google Cloud TTS)")
    print(f"   Voz EN          : {VOZ_EN}  (edge-tts)")
    if not modo_solo_frases:
        print(f"   Vocabulario ES  : {len(palabras_es)} palabras")
        print(f"   Vocabulario EN  : {len(palabras_en)} palabras")
    if frases_es_items or piezas_es_items or piezas_picto_es_items:
        print(f"   Frases ES       : {len(frases_es_items)} enunciados · "
              f"{len(piezas_es_items)} piezas texto · "
              f"{len(piezas_picto_es_items)} piezas picto sin MP3")
    if frases_en_items or piezas_en_items or piezas_picto_en_items:
        print(f"   Frases EN       : {len(frases_en_items)} enunciados · "
              f"{len(piezas_en_items)} piezas texto · "
              f"{len(piezas_picto_en_items)} piezas picto sin MP3")
    if args.seco:
        print(f"   ⚡ DRY RUN — no se generará ningún archivo")
    print()

    # ── Crear directorios ─────────────────────────────────────────────────────
    if not args.seco:
        DIR_ES.mkdir(parents=True, exist_ok=True)
        DIR_EN.mkdir(parents=True, exist_ok=True)
        if frases_es_items or piezas_es_items:
            DIR_FRASES_ES.mkdir(parents=True, exist_ok=True)
        if frases_en_items or piezas_en_items:
            DIR_FRASES_EN.mkdir(parents=True, exist_ok=True)

    # ── Generar ───────────────────────────────────────────────────────────────
    total_gen = total_omit = total_err = 0
    errores_log = []
    t_inicio = time.monotonic()

    async def run(items, code, motor, voz, lang, cfg, d):
        nonlocal total_gen, total_omit, total_err
        if not items:
            return
        print(f"📢  {code} ({len(items)} archivos)")
        g, o, e = await procesar_lista(
            items, code, motor, voz, lang, cfg, d,
            args.forzar, args.seco, conc, errores_log,
        )
        total_gen += g; total_omit += o; total_err += e
        print(f"   ✅ {g} generados · {o} ya existían · {e} errores\n")

    if not args.solo_en  and not args.solo_frases:
        await run(palabras_es, "vocab/es", MOTOR_ES, VOZ_ES, LANG_ES, CONFIG_ES_GOOGLE, DIR_ES)
    if not args.solo_es  and not args.solo_frases:
        await run(palabras_en, "vocab/en", MOTOR_EN, VOZ_EN, "en-US", CONFIG_EN, DIR_EN)
    if not args.solo_es  and not args.solo_en:
        await run(frases_es_items,       "frases/es enunciados",   MOTOR_ES, VOZ_ES, LANG_ES, CONFIG_FRASES_GOOGLE, DIR_FRASES_ES)
        await run(piezas_es_items,       "frases/es piezas texto", MOTOR_ES, VOZ_ES, LANG_ES, CONFIG_ES_GOOGLE,     DIR_FRASES_ES)
        await run(piezas_picto_es_items, "frases/es picto",        MOTOR_ES, VOZ_ES, LANG_ES, CONFIG_ES_GOOGLE,     DIR_ES)
        await run(frases_en_items,       "frases/en enunciados",   MOTOR_EN, VOZ_EN, "en-US", CONFIG_EN,            DIR_FRASES_EN)
        await run(piezas_en_items,       "frases/en piezas texto", MOTOR_EN, VOZ_EN, "en-US", CONFIG_EN,            DIR_FRASES_EN)
        await run(piezas_picto_en_items, "frases/en picto",        MOTOR_EN, VOZ_EN, "en-US", CONFIG_EN,            DIR_EN)

    # ── Resumen final ─────────────────────────────────────────────────────────
    elapsed = time.monotonic() - t_inicio
    dur_str = f"{elapsed:.1f}s" if elapsed < 60 else f"{elapsed/60:.1f}m"

    print("─" * 48)
    print(f"  Total generados : {total_gen}")
    print(f"  Total omitidos  : {total_omit}")
    print(f"  Total errores   : {total_err}")
    print(f"  Tiempo total    : {dur_str}")

    if errores_log:
        escribir_log(errores_log)
        print(f"\n⚠️  {total_err} error(es) — ver scripts/errores-audio.log")
        print(f"   Para reintentar: python scripts/generar-audio.py --forzar")

    if not args.seco and total_gen > 0:
        print(f"\n💡  Haz commit y push — el GitHub Action actualizará assets-manifest.json")


if __name__ == "__main__":
    asyncio.run(main())