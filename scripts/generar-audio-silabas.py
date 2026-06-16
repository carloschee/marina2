#!/usr/bin/env python3
"""
scripts/generar-audio-silabas.py — Marina 2
Genera un MP3 por sílaba para cada palabra de pictos.json, usando
Google Cloud TTS (es-US-News-F) — la misma voz de generar-audio.py.

Por qué un script separado:
  El módulo Sílabas necesita reproducir cada sílaba por separado. El TTS
  en tiempo real (speechSynthesis del navegador) no puede corregir la
  pronunciación de "r" suave intermedia (sonaba "rro" en vez de "ro") ni
  tiene control de fonemas. Google TTS sí respeta <phoneme alphabet="ipa">,
  así que pre-generamos el audio offline igual que las palabras completas.

Regla de corrección aplicada (validada empíricamente):
  Sílaba intermedia (idx > 0) que empieza con "r" simple (no "rr") →
  se sintetiza con <phoneme ph="ɾ..."> sustituyendo solo la "r" inicial
  por "ɾ" (tap), dejando el resto de la sílaba igual.
    ej. "pero" → sílaba "ro" (idx=1) → ph="ɾo"
        "paracaídas" → sílaba "ra" (idx=1) → ph="ɾa"

  El resto de las sílabas (primera sílaba, o sin "r" inicial simple) se
  sintetizan con texto plano — Google ya las pronuncia correctamente
  (confirmado también para vocales acentuadas solas, ej. "í").

Overrides manuales (casos excepcionales, por palabra+posición específica):
  data/silabas-ipa-overrides.json (opcional), formato por entrada:
    "<ruta_img_sin_.png>-<idx>": "<ipa>"              ← legacy: solo ipa,
                                                          texto = la sílaba misma
    "<ruta_img_sin_.png>-<idx>": ["<texto>", "<ipa_o_null>"]  ← formato completo:
                                                          controla texto E ipa
  ej.: { "arbol-0": "ar" }
       { "tigre-1": ["xgre", "gɾe"] }
  Para cuando una sílaba específica necesita un ajuste que la regla general
  (SILABAS_OVERRIDE) no cubre. Tiene prioridad sobre SILABAS_OVERRIDE.

Reglas generales por sílaba (SILABAS_OVERRIDE, aplican en cualquier palabra):
  Validado empíricamente con es-US-News-F — varias sílabas colisionan con
  palabras inglesas (lectura con fonética inglesa) o con cómo el motor
  procesa "h" muda / clústers consonánticos al inicio:
    'gre' (tigre) → <phoneme ph="gɾe">xgre</phoneme>  (gibberish+fonema)
    'hue' (huevo) → <phoneme ph="we">hue</phoneme>    (fonema, texto original)
    'ho'  (hoja)  → "o" plano                          (quitar "h" muda)
    'rra' (gorra) → "rrá" plano                        (respelling con tilde)
    'to'  (instrumento) → <phoneme ph="to">xto</phoneme>  (gibberish+fonema)
    'go'  (lago)  → ver SILABAS_AUDIO_FIJO (ningún <phoneme> funcionó)
  Patrón "gibberish+fonema": cuando el texto original de la sílaba coincide
  con el lexicón del motor (palabra inglesa o entrada especial), <phoneme>
  con ese texto es ignorado — pero <phoneme> SÍ se aplica si el texto
  interno no coincide con nada del lexicón (se usa un texto sin sentido).

Audio fijo (sílabas que ningún <phoneme> corrige con esta voz):
  scripts/audio-fijo/<archivo>.mp3 — audio grabado/aislado por separado,
  que se COPIA (sin TTS) a cada {base}-{idx}.mp3 donde aparezca esa sílaba.
  Mapeo en SILABAS_AUDIO_FIJO, ej.: {"go": "silaba-GO.mp3"}.
  Validado para "go": <phoneme ph="ɡo"> con CUALQUIER texto interno (incluso
  gibberish) sigue sonando "wo" con es-US-News-F — limitación de la voz
  para esa combinación fonética en aislamiento, no corregible por SSML.
  Si falta el archivo de origen, esas sílabas se omiten (con aviso) sin
  afectar el resto de la corrida.

Salida:
  assets/audio/es/silabas/{ruta_img sin .png}-{idx}.mp3

Uso:
  pip install requests
  export GOOGLE_TTS_API_KEY="tu-api-key"     # solo necesaria si hay sílabas
                                              # nuevas que requieran TTS
  python scripts/generar-audio-silabas.py --seco     # vista previa
  python scripts/generar-audio-silabas.py            # generar

Opciones:
  --forzar          Regenera archivos aunque ya existan
  --solo-corregidas Solo genera/regenera sílabas con alguna corrección
                     (override de palabra inglesa o "r" suave). Útil
                     para aplicar una regla nueva sin rehacer todo el
                     catálogo.
  --seco            Dry run — muestra qué haría sin generar nada
  --concurrencia N  Peticiones simultáneas (default: 5)
"""

import asyncio
import base64
import json
import os
import shutil
import sys
import argparse
import time
from pathlib import Path
from datetime import datetime

try:
    import requests
except ImportError:
    print("❌  requests no está instalado.")
    print("   Ejecuta: pip install requests")
    sys.exit(1)

# ─── Configuración ────────────────────────────────────────────────────────────

VOZ              = "es-US-News-F"
LANG             = "es-US"
CONFIG_SILABA    = {"speakingRate": 0.85, "pitch": 0.0}  # un poco más lento, sílaba aislada

GOOGLE_API_KEY   = os.environ.get("GOOGLE_TTS_API_KEY")
GOOGLE_SYNTH_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"

REINTENTOS    = 3
BACKOFF_BASE  = 1.0

RAIZ              = Path(__file__).parent.parent
PICTOS_JSON       = RAIZ / "data" / "pictos.json"
OVERRIDES_JSON    = RAIZ / "data" / "silabas-ipa-overrides.json"
DIR_SILABAS       = RAIZ / "assets" / "audio" / "es" / "silabas"
LOG_PATH          = RAIZ / "scripts" / "errores-audio-silabas.log"

# ════════════════════════════════════════════════════════════════════════════
#  Silabificador de español — puerto de modules/silabas/silabas.js
#  Reglas: dígrafos ch/ll/rr, qu, gu(e/i) con u muda, diptongos, triptongos,
#  hiatos (incl. hiato por tilde en vocal débil í/ú), grupos consonánticos
#  inseparables (pr,br,tr,dr,cr,gr,fr,pl,bl,cl,gl,fl).
# ════════════════════════════════════════════════════════════════════════════

_VOC_FUERTE       = set('aeoáéó')
_VOC_DEBIL        = set('iuü')
_VOC_DEBIL_TONICA = set('íú')
_TODAS_VOC        = _VOC_FUERTE | _VOC_DEBIL | _VOC_DEBIL_TONICA
_INSEPARABLES = {
    'pr','br','tr','dr','cr','gr','fr',
    'pl','bl','cl','gl','fl',
}


def _forman_diptongo(c1, c2):
    if c1 in _VOC_DEBIL_TONICA or c2 in _VOC_DEBIL_TONICA:
        return False
    f1, f2 = c1 in _VOC_FUERTE, c2 in _VOC_FUERTE
    d1, d2 = c1 in _VOC_DEBIL,  c2 in _VOC_DEBIL
    if f1 and f2:
        return False
    if d1 and d2:
        return True
    if (f1 and d2) or (d1 and f2):
        return True
    return False


def silabificar(palabra_original: str) -> list[str]:
    palabra = (palabra_original or "").lower().strip()
    if not palabra:
        return []

    chars = list(palabra)
    tokens = []  # [(tipo, raw)] tipo: 'V' o 'C'
    i = 0
    while i < len(chars):
        c = chars[i]
        nxt = chars[i+1] if i+1 < len(chars) else ''
        if c in _TODAS_VOC:
            tokens.append(('V', c)); i += 1; continue
        if (c == 'c' and nxt == 'h') or (c == 'l' and nxt == 'l') or (c == 'r' and nxt == 'r'):
            tokens.append(('C', c+nxt)); i += 2; continue
        if c == 'q' and nxt == 'u':
            tokens.append(('C', 'qu')); i += 2; continue
        if c == 'g' and nxt == 'u' and i+2 < len(chars) and chars[i+2] in ('e','i'):
            tokens.append(('C', 'gu')); i += 2; continue
        tokens.append(('C', c)); i += 1

    nucleos = []
    i = 0
    while i < len(tokens):
        if tokens[i][0] == 'V':
            grupo = [i]
            while i+1 < len(tokens) and tokens[i+1][0] == 'V' and _forman_diptongo(tokens[i][1], tokens[i+1][1]):
                grupo.append(i+1); i += 1
            nucleos.append(grupo)
        i += 1

    if len(nucleos) <= 1:
        return [palabra]

    silabas = []
    cursor = 0

    def tok_str(a, b):
        return ''.join(t[1] for t in tokens[a:b])

    for n, nuc in enumerate(nucleos):
        fin_nuc = nuc[-1]
        sil_ini = 0 if n == 0 else cursor

        if n == len(nucleos) - 1:
            silabas.append(tok_str(sil_ini, len(tokens)))
            break

        c_post_ini = fin_nuc + 1
        c_post_fin = c_post_ini
        while c_post_fin < len(tokens) and tokens[c_post_fin][0] == 'C':
            c_post_fin += 1
        entre = tokens[c_post_ini:c_post_fin]
        k = len(entre)

        if k <= 1:
            coda = 0
        elif k == 2:
            par = entre[0][1] + entre[1][1]
            coda = 0 if par in _INSEPARABLES else 1
        elif k == 3:
            ult2 = entre[1][1] + entre[2][1]
            coda = 1 if ult2 in _INSEPARABLES else 2
        else:
            coda = 2

        fin = c_post_ini + coda
        silabas.append(tok_str(sil_ini, fin))
        cursor = fin

    return silabas

# ─── Reglas de corrección por sílaba ─────────────────────────────────────────

# Sílabas que coinciden con palabras en inglés y que es-US-News-F lee con
# fonética inglesa en vez de española (ej. "go" -> diptongo /oʊ/, suena "wo").
# Coincidencia EXACTA (case-insensitive), en CUALQUIER posición (idx) — a
# diferencia de la regla "r" suave, que solo aplica a sílabas intermedias.
# IPA forzado = lectura española estándar letra-por-letra del español.
# Sílabas para las que ninguna combinación de <phoneme> renderiza el sonido
# correcto con esta voz (validado empíricamente para "go": <phoneme ph="ɡo">
# con CUALQUIER texto interno —incluso gibberish— suena "wo"). En vez de
# sintetizar con Google, se COPIA un archivo de audio fijo (aislado/grabado
# por separado) a cada posición {base}-{idx}.mp3 donde aparezca la sílaba.
#
# Los archivos de origen viven en scripts/audio-fijo/. Si el archivo no
# existe ahí, el script avisa y omite esas sílabas (no rompe el resto).
DIR_AUDIO_FIJO = Path(__file__).parent / "audio-fijo"

SILABAS_AUDIO_FIJO = {
    'go': 'silaba-GO.mp3',
}

# Overrides combinados: sílaba (lowercase) -> (texto_a_enviar, ipa_o_None)
#
#   - ipa is None  → sintetizar texto_a_enviar como texto plano
#   - ipa is str   → <phoneme alphabet="ipa" ph="{ipa}">{texto_a_enviar}</phoneme>
#
# texto_a_enviar puede ser:
#   - la sílaba misma (cuando solo se necesita el fonema)
#   - una respelling en texto plano (cuando NO se necesita fonema, ej. "rrá")
#   - texto gibberish (cuando el fonema funciona pero el texto original
#     dispara colisión de lexicón — mismo patrón que "go", validado para
#     "gre" y "to": <phoneme ph="..."> con texto interno gibberish SÍ
#     funciona; con el texto original ("gre"/"to") no)
#
# Todas las entradas validadas empíricamente, voz es-US-News-F:
SILABAS_OVERRIDE = {
    # ── Lote 1 ──
    'gre': ('xgre', 'gɾe'),   # tigre — deletreaba; gibberish+phoneme funciona
    'hue': ('hue',  'we'),    # huevo — sonaba "jue"; phoneme con texto original funciona
    'ho':  ('o',    None),    # hoja  — sonaba "jo"; quitar "h" (sin phoneme) funciona
    'rra': ('rrá',  None),    # gorra — deletreaba; respelling con tilde (sin phoneme) funciona
    'to':  ('xto',  'to'),    # instrumento — sonaba "tu"; gibberish+phoneme funciona

    # ── Lote 2: A) deletrea -> respelling (con o sin tilde) ──
    'lla':  ('llá', None),    # ardilla/estrella/silla/llave — deletreaba
    'ba':   ('bá',  None),    # ballena/escoba/guayaba — deletreaba
    'bró':  ('bro', None),    # brócoli — deletreaba "be-ere-o-con-acento..."
    'lli':  ('llí', None),    # gallina — deletreaba
    'rrin': ('rrín', None),   # ornitorrinco — deletreaba
    'ló':   ('lo',  None),    # xilófono/zoológico — deletreaba "ele-o-con-acento"
    'cu':   ('cú',  None),    # curamos/maracuyá — deletreaba

    # ── Lote 2: B) lectura en inglés -> gibberish + phoneme ──
    'be':  ('xbe',  'be'),    # abeja/nube/bomberos — sonaba "bi" (inglés)
    'jo':  ('xjo',  'xo'),    # ajo/ojo — sonaba "yo" (inglés)
    'cue': ('xcue', 'kwe'),   # escuela — sonaba "kiu" (inglés)
    'ju':  ('xju',  'xu'),    # juguete/jugo — sonaba "yu" (inglés)
    'jar': ('xjar', 'xar'),   # jardín — sonaba "jar" (inglés)
    'gar': ('xgar', 'gar'),   # lagarto — lectura inglesa
    'je':  ('xje',  'xe'),    # tijeras — sonaba "ye" (inglés)
    'tie': ('xtie', 'tje'),   # tienes — lectura inglesa
    'sue': ('xsue', 'swe'),   # sueño — lectura inglesa

    # ── Lote 2: C) "h" muda -> quitar la h ──
    'ham': ('am', None),      # hambre — h muda leída en inglés
    'hi':  ('i',  None),      # higo — h muda leída en inglés

    # ── Lote 2: D) casos especiales ──
    'vol': ('xvol', 'bol'),   # volcán — sonaba "volume" (v=b en español)
    'xo':  ('so',   None),    # xochimilco — deletreaba, "x" náhuatl = /s/
    'rue': ('xrue', 'rwe'),   # rueda — perdía el diptongo, sonaba "ru"

    # ── Lote 2b: casos que requirieron una segunda iteración ──
    'bé':  ('xbe',  'be'),    # bebé — mismo patrón que 'be' (es la misma sílaba con tilde)
    'yak': ('xyak', 'jak'),   # kayak — gibberish+phoneme /jak/ (no /ʝak/, y sin 'xiak')
    'dra': ('drá',  None),    # dragón — respelling con tilde (sin phoneme); evita colisión con "Dra."

    # ── Lote 3: A) deletrea → respelling ──
    'cin':  ('cín',  None),   # cinturón
    'ír':   ('ir',   None),   # reír — quitar tilde
    'brir': ('brír', None),   # abrir
    'rrar': ('rrár', None),   # cerrar
    'llu':  ('llú',  None),   # lluvia
    'iz':   ('íz',   None),   # izquierda
    'cío':  ('cio',  None),   # vacío — quitar tilde
    'bke':  ('blé',  None),   # dirigible
    'fla':  ('flá',  None),   # flamenco
    'piés': ('pies', None),   # ciempiés — quitar tilde

    # ── Lote 3: B) inglés → gibberish + phoneme ──
    'fun':  ('xfun',  'fun'),  # confundido
    'lien': ('xlien', 'ljen'), # valiente/caliente
    'vie':  ('xvie',  'bje'),  # viejo — v=b en español
    'so':   ('xso',   'so'),   # ganso/sóplale

    # ── Lote 3: C) diptongo falso → phoneme con texto original ──
    'pio':  ('pio',  'pjo'),   # limpio — acentuaba la 'i'
    'cio':  ('cio',  'sjo'),   # sucio/inicio — acentuaba la 'i'
    'nue':  ('nue',  'nwe'),   # nuevo — acentuaba la 'u'
    'nie':  ('nie',  'nje'),   # nieve/quitanieves — acentuaba la 'i'

    # ── Lote 3: D) casos especiales ──
    'hom':  ('om',   None),    # hombro — h muda leída como /x/
    # 'jeep': sin corrección — el plano ya suena aceptable

    # ── Lote 3b ──
    'cer':  ('xcer', 'ser'),   # cerca/cerdo/hacer — deletreaba
    'des':  ('xdes', 'des'),   # descansar — pronunciaba 'de.' sin s
    'er':   ('xer',  'er'),    # leer — deletreaba
}

def _resolucion_silaba(silaba: str, idx: int):
    """
    Devuelve (texto_a_enviar, ipa_o_None) para sintetizar esta sílaba.

    (Las sílabas en SILABAS_AUDIO_FIJO se manejan aparte, por copia de
    archivo — no llegan a esta función.)

    Prioridad:
      1) SILABAS_OVERRIDE — coincidencia exacta, cualquier posición.
      2) "r" simple (no "rr") al inicio de una sílaba intermedia (idx>0) →
         <phoneme ph="ɾ..."> sustituyendo solo la "r" inicial, texto =
         la sílaba misma.
      3) Sin corrección: (silaba, None).
    """
    clave = silaba.lower()
    if clave in SILABAS_OVERRIDE:
        return SILABAS_OVERRIDE[clave]

    if idx > 0 and len(silaba) >= 2 and silaba[0] == 'r' and silaba[1] != 'r':
        return (silaba, 'ɾ' + silaba[1:])

    return (silaba, None)

# ─── Overrides manuales ──────────────────────────────────────────────────────

def cargar_overrides() -> dict:
    if not OVERRIDES_JSON.exists():
        return {}
    try:
        with open(OVERRIDES_JSON, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"⚠️  No se pudo leer {OVERRIDES_JSON.name}: {e}")
        return {}

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

# ─── Síntesis Google TTS ────────────────────────────────────────────────────

def _google_synthesize_sync(texto: str, ipa, voz: str, lang: str,
                             speaking_rate: float, pitch: float) -> bytes:
    if ipa:
        contenido = f'<phoneme alphabet="ipa" ph="{ipa}">{texto}</phoneme>'
        body_input = {
            "ssml": (
                '<speak version="1.0" '
                'xmlns="http://www.w3.org/2001/10/synthesis" '
                f'xml:lang="{lang}">{contenido}</speak>'
            )
        }
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


async def generar_mp3(texto, ipa, ruta: Path):
    for intento in range(1, REINTENTOS + 1):
        try:
            data = await asyncio.to_thread(
                _google_synthesize_sync, texto, ipa, VOZ, LANG,
                CONFIG_SILABA["speakingRate"], CONFIG_SILABA["pitch"],
            )
            ruta.write_bytes(data)
            return True
        except Exception as e:
            if intento < REINTENTOS:
                await asyncio.sleep(BACKOFF_BASE * (2 ** (intento - 1)))
            else:
                return False, str(e)
    return False, "desconocido"

# ─── Main ─────────────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(description="Generador de audio por sílaba para Marina 2")
    parser.add_argument("--forzar",       action="store_true")
    parser.add_argument("--solo-corregidas", action="store_true")
    parser.add_argument("--seco",         action="store_true")
    parser.add_argument("--concurrencia", type=int, default=5, metavar="N")
    args = parser.parse_args()
    conc = max(1, min(args.concurrencia, 20))

    if not PICTOS_JSON.exists():
        print(f"❌  No existe {PICTOS_JSON}")
        sys.exit(1)

    with open(PICTOS_JSON, encoding="utf-8") as f:
        catalogo = json.load(f)

    overrides = cargar_overrides()
    if overrides:
        print(f"📖  {len(overrides)} override(s) de sílaba cargados desde {OVERRIDES_JSON.name}")

    # ── Construir la lista de items: (nombre_archivo, texto, ipa) ────────────
    # copias: lista de (origen, destino) para sílabas con SILABAS_AUDIO_FIJO
    items = []
    copias = []
    n_con_fix = n_sin_fix = n_fijas = 0
    n_fijas_sin_origen = 0
    for e in catalogo:
        ruta_img = e.get("ruta_img")
        es       = e.get("es")
        if not ruta_img or not es:
            continue
        base = ruta_img.replace(".png", "")
        silabas = silabificar(es)

        for idx, silaba in enumerate(silabas):
            clave_silaba = silaba.lower()
            nombre = f"{base}-{idx}"
            ruta_destino = DIR_SILABAS / (nombre + ".mp3")

            # ── Audio fijo (copia, no TTS) ──────────────────────────────────
            if clave_silaba in SILABAS_AUDIO_FIJO:
                n_fijas += 1
                origen = DIR_AUDIO_FIJO / SILABAS_AUDIO_FIJO[clave_silaba]
                if not origen.exists():
                    n_fijas_sin_origen += 1
                    continue
                copias.append((origen, ruta_destino))
                continue

            clave_override = f"{base}-{idx}"
            if clave_override in overrides:
                val = overrides[clave_override]
                if isinstance(val, str):
                    # Formato legacy: solo ipa, texto = la sílaba misma.
                    texto_envio, ipa = silaba, val
                else:
                    # Formato [texto, ipa_o_null]
                    texto_envio, ipa = val[0], val[1]
            else:
                texto_envio, ipa = _resolucion_silaba(silaba, idx)

            corregida = (ipa is not None) or (texto_envio != silaba)
            if corregida:
                n_con_fix += 1
            else:
                n_sin_fix += 1
                if args.solo_corregidas:
                    continue  # omitir sílabas sin corrección en este modo

            items.append((nombre, texto_envio, ipa))

    # ── Calcular pendientes (lo que realmente falta generar con TTS) ─────────
    pendientes = []
    omitidos = 0
    for nombre, texto, ipa in items:
        ruta = DIR_SILABAS / (nombre + ".mp3")
        if ruta.exists() and ruta.stat().st_size > 0 and not args.forzar:
            omitidos += 1
        else:
            pendientes.append((nombre, texto, ipa, ruta))

    # ── Verificar API key de Google solo si hay sílabas PENDIENTES de TTS ────
    if pendientes and not args.seco and not GOOGLE_API_KEY:
        print("❌  Falta la variable de entorno GOOGLE_TTS_API_KEY.")
        print("   Ver scripts/GUIA-GOOGLE-TTS.md.")
        print(f"   ({len(pendientes)} sílaba(s) pendientes requieren síntesis con Google TTS)")
        sys.exit(1)

    # ── Resumen inicial ───────────────────────────────────────────────────────
    print(f"\n🌊  Marina 2 — Generador de audio por sílaba")
    print(f"   Concurrencia       : {conc} peticiones simultáneas")
    print(f"   Voz                : {VOZ}  (Google Cloud TTS)")
    print(f"   Palabras           : {len(catalogo)}")
    print(f"   Sílabas con fix 'ɾ': {n_con_fix}")
    print(f"   Sílabas sin fix    : {n_sin_fix}")
    if n_fijas:
        print(f"   Sílabas audio fijo : {n_fijas}  (copiadas desde scripts/audio-fijo/)")
        if n_fijas_sin_origen:
            for clave, archivo in SILABAS_AUDIO_FIJO.items():
                ruta = DIR_AUDIO_FIJO / archivo
                if not ruta.exists():
                    print(f"   ⚠️  Falta {ruta.relative_to(RAIZ)} — "
                          f"{n_fijas_sin_origen} sílaba(s) '{clave}' sin copiar")
    if args.solo_corregidas:
        print(f"   ⚙️  --solo-corregidas: generando solo {n_con_fix} sílabas con corrección")
    else:
        print(f"   Total a generar    : {len(items)}  ({len(pendientes)} pendientes, {omitidos} ya existían)")
        print(f"   Total a copiar     : {len(copias)}")
    if args.seco:
        print(f"   ⚡ DRY RUN — no se generará ni copiará ningún archivo")
    print()

    if not args.seco:
        DIR_SILABAS.mkdir(parents=True, exist_ok=True)

    # ── Copiar audio fijo ──────────────────────────────────────────────────────
    copiados = copias_omitidas = 0
    for origen, destino in copias:
        if destino.exists() and not args.forzar:
            copias_omitidas += 1
            continue
        if args.seco:
            copiados += 1
            continue
        shutil.copyfile(origen, destino)
        copiados += 1

    if copias or n_fijas:
        print(f"📋  silabas/es audio fijo: {copiados} copiados · {copias_omitidas} ya existían")
        print()

    print(f"📢  silabas/es ({len(pendientes)} pendientes, {omitidos} ya existían)")

    generados = errores = 0
    errores_log = []
    t_inicio = time.monotonic()

    if pendientes:
        progreso = Progreso(len(pendientes), "silabas/es")
        semaforo = asyncio.Semaphore(conc)

        async def _tarea(nombre, texto, ipa, ruta):
            nonlocal generados, errores
            async with semaforo:
                if args.seco:
                    generados += 1
                    progreso.avanzar()
                    return
                resultado = await generar_mp3(texto, ipa, ruta)
                if resultado is True:
                    generados += 1
                else:
                    errores += 1
                    _, motivo = resultado
                    errores_log.append({
                        "archivo": str(ruta.relative_to(RAIZ)),
                        "texto": texto, "ipa": ipa, "error": motivo,
                        "ts": datetime.now().isoformat(timespec="seconds"),
                    })
                progreso.avanzar()

        await asyncio.gather(*[_tarea(*p) for p in pendientes])
        progreso.cerrar()

    elapsed = time.monotonic() - t_inicio
    dur_str = f"{elapsed:.1f}s" if elapsed < 60 else f"{elapsed/60:.1f}m"

    print("─" * 48)
    print(f"  Generados : {generados}")
    print(f"  Omitidos  : {omitidos}")
    print(f"  Errores   : {errores}")
    print(f"  Tiempo    : {dur_str}")

    if errores_log:
        LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(f"\n── Ejecución {datetime.now().isoformat(timespec='seconds')} ──\n")
            for e in errores_log:
                f.write(f"  {e['archivo']}\n    texto: {e['texto']!r}  ipa: {e['ipa']!r}\n    error: {e['error']}\n")
        print(f"\n⚠️  {errores} error(es) — ver scripts/errores-audio-silabas.log")
        print(f"   Para reintentar: python scripts/generar-audio-silabas.py --forzar")


if __name__ == "__main__":
    asyncio.run(main())