#!/usr/bin/env python3
"""
scripts/generar-catalogo-pictos.py — Marina 2
Reconstruye data/pictos.json desde vocabulario.json.bak (solo ES).
Traduce automáticamente al inglés via MyMemory API (gratuita, sin API key).

Estructura de salida:
  {
    "id": 1001,
    "es": "árbol",
    "en": "tree",
    "ruta_img": "arbol.png",
    "tts_es": "árbol",
    "tts_en": "tree"
  }

Uso:
  python scripts/generar-catalogo-pictos.py

Opciones:
  --seco          Muestra qué haría sin escribir nada
  --forzar        Regenera aunque pictos.json ya exista
  --sin-traducir  Deja los campos en/tts_en vacíos (más rápido)
  --concurrencia N  Peticiones paralelas a la API (default: 5)
"""

import asyncio
import json
import re
import sys
import argparse
import time
from pathlib import Path

try:
    import aiohttp
except ImportError:
    print("❌  aiohttp no está instalado.")
    print("   Ejecuta: pip install aiohttp")
    sys.exit(1)

RAIZ         = Path(__file__).parent.parent
VOCAB_BAK    = RAIZ / "data" / "vocabulario.json.bak"
FRASES_BAK   = RAIZ / "data" / "frases.json.bak"
MEMORAMA_BAK = RAIZ / "data" / "memorama.json.bak"
PICTOS_JSON  = RAIZ / "data" / "pictos.json"

TRANSLATE_URL = "https://api.mymemory.translated.net/get"
ID_INICIO     = 1001

# ─── Normalizar nombre de archivo ─────────────────────────────────────────────
def nombre_archivo(texto: str) -> str:
    nombre = texto.lower().strip()
    reemplazos = {
        'á':'a','é':'e','í':'i','ó':'o','ú':'u','ü':'u','ñ':'n',' ':'-',
    }
    for k, v in reemplazos.items():
        nombre = nombre.replace(k, v)
    nombre = re.sub(r'[^a-z0-9\-]', '', nombre)
    nombre = re.sub(r'-+', '-', nombre).strip('-')
    return nombre + '.png'

# ─── Traducción via MyMemory ───────────────────────────────────────────────────
_cache_trad: dict[str, str] = {}

async def traducir(session: aiohttp.ClientSession, texto: str) -> str:
    if texto in _cache_trad:
        return _cache_trad[texto]
    try:
        params = {'q': texto, 'langpair': 'es|en'}
        async with session.get(TRANSLATE_URL, params=params,
                               timeout=aiohttp.ClientTimeout(total=8)) as r:
            if r.status == 200:
                data = await r.json(content_type=None)
                trad = data.get('responseData', {}).get('translatedText', '').strip()
                if trad and trad.upper() != texto.upper():
                    _cache_trad[texto] = trad.lower()
                    return _cache_trad[texto]
    except Exception:
        pass
    _cache_trad[texto] = ''
    return ''

# ─── Recolectar palabras únicas en español ────────────────────────────────────
def recolectar_palabras() -> list[str]:
    palabras = []
    vistas   = set()

    def agregar(p: str):
        p = p.strip()
        if p and p not in vistas:
            vistas.add(p)
            palabras.append(p)

    # 1. Vocabulario ES del .bak
    if VOCAB_BAK.exists():
        with open(VOCAB_BAK, encoding='utf-8') as f:
            vocab = json.load(f)
        for contenido in vocab.values():
            for p in contenido.get('es', []):
                if isinstance(p, str): agregar(p)
    else:
        print(f"⚠️  No se encontró {VOCAB_BAK}")

    # 2. Frases — piezas tipo picto en español
    if FRASES_BAK.exists():
        with open(FRASES_BAK, encoding='utf-8') as f:
            frases = json.load(f)
        for frase in frases:
            if frase.get('lang', 'es') != 'es': continue
            for pieza in frase.get('piezas', []):
                if pieza.get('tipo') == 'picto':
                    t = pieza.get('texto', '')
                    if isinstance(t, str): agregar(t)

    # 3. Memorama — palabras en español del .bak
    if MEMORAMA_BAK.exists():
        with open(MEMORAMA_BAK, encoding='utf-8') as f:
            temas = json.load(f)
        for tema in temas:
            for p in tema.get('palabras', []):
                if isinstance(p, str): agregar(p)
                elif isinstance(p, dict): agregar(p.get('es', ''))

    return palabras

# ─── Progreso ─────────────────────────────────────────────────────────────────
class Progreso:
    def __init__(self, total, prefijo=''):
        self.total = total; self.actual = 0
        self.prefijo = prefijo; self._ini = time.monotonic()

    def avanzar(self):
        self.actual = min(self.actual + 1, self.total)
        pct    = self.actual / self.total if self.total else 0
        llenos = int(28 * pct)
        barra  = '█' * llenos + '░' * (28 - llenos)
        el     = time.monotonic() - self._ini
        eta    = (el / self.actual * (self.total - self.actual)) if self.actual else 0
        print(f'\r  {self.prefijo} [{barra}] {self.actual}/{self.total} '
              f'({pct*100:5.1f}%) ETA {eta:5.1f}s   ', end='', flush=True)

    def cerrar(self): self.avanzar(); print()

# ─── Migración de JSONs ──────────────────────────────────────────────────────
async def _migrar_jsons():
    """Actualiza vocabulario.json, frases.json y memorama.json para usar IDs del catálogo."""
    VOCAB_JSON    = RAIZ / "data" / "vocabulario.json"
    FRASES_JSON   = RAIZ / "data" / "frases.json"
    MEMORAMA_JSON = RAIZ / "data" / "memorama.json"

    print('\n🔄  Migrando JSONs al nuevo catálogo...\n')

    # Cargar catálogo y construir mapa es → id
    with open(PICTOS_JSON, encoding='utf-8') as f:
        catalogo = json.load(f)
    mapa_es = {e['es']: e['id'] for e in catalogo}
    print(f'   Catálogo cargado: {len(catalogo)} entradas')

    # ── vocabulario.json ──────────────────────────────────────────────────────
    if VOCAB_BAK.exists():
        with open(VOCAB_BAK, encoding='utf-8') as f:
            vocab_bak = json.load(f)
        nuevo_vocab = {}
        for letra, contenido in vocab_bak.items():
            nuevo_vocab[letra] = {
                'es': [mapa_es[p] for p in contenido.get('es', [])
                       if isinstance(p, str) and p in mapa_es],
                'en': [],  # EN eliminado — el catálogo maneja las traducciones
            }
        _backup_y_guardar(VOCAB_JSON, nuevo_vocab)
        print(f'   ✅ vocabulario.json migrado')

    # ── frases.json ───────────────────────────────────────────────────────────
    if FRASES_BAK.exists():
        with open(FRASES_BAK, encoding='utf-8') as f:
            frases_bak = json.load(f)
        nuevas_frases = []
        for frase in frases_bak:
            nueva = dict(frase)
            nuevas_piezas = []
            for pieza in frase.get('piezas', []):
                nueva_pieza = dict(pieza)
                if pieza.get('tipo') == 'picto':
                    texto = pieza.get('texto', '')
                    if texto in mapa_es:
                        nueva_pieza['picto_id'] = mapa_es[texto]
                        # Mantener 'texto' como fallback TTS
                nuevas_piezas.append(nueva_pieza)
            nueva['piezas'] = nuevas_piezas
            nuevas_frases.append(nueva)
        _backup_y_guardar(FRASES_JSON, nuevas_frases)
        print(f'   ✅ frases.json migrado ({len(nuevas_frases)} frases)')

    # ── memorama.json ─────────────────────────────────────────────────────────
    if MEMORAMA_BAK.exists():
        with open(MEMORAMA_BAK, encoding='utf-8') as f:
            memorama_bak = json.load(f)
    elif (MEMORAMA_JSON).exists():
        with open(MEMORAMA_JSON, encoding='utf-8') as f:
            memorama_bak = json.load(f)
    else:
        memorama_bak = []

    nuevos_temas = []
    for tema in memorama_bak:
        nuevo_tema = dict(tema)
        nuevas_palabras = []
        for p in tema.get('palabras', []):
            texto = p if isinstance(p, str) else p.get('es', '')
            if texto and texto in mapa_es:
                entrada = next(e for e in catalogo if e['id'] == mapa_es[texto])
                nuevas_palabras.append({
                    'picto_id': entrada['id'],
                    'es':       entrada['es'],
                    'en':       entrada['en'],
                    'tts_es':   entrada['tts_es'],
                    'tts_en':   entrada['tts_en'],
                })
            elif texto:
                print(f'   ⚠️  Sin ID para memorama: "{texto}"')
        nuevo_tema['palabras'] = nuevas_palabras
        nuevos_temas.append(nuevo_tema)
    _backup_y_guardar(MEMORAMA_JSON, nuevos_temas)
    print(f'   ✅ memorama.json migrado ({len(nuevos_temas)} temas)')

    print(f'\n✅  Migración completa.')
    print(f'   Backups guardados como .json.bak2')


def _backup_y_guardar(path: Path, data):
    if path.exists():
        bak = path.with_suffix('.json.bak2')
        bak.write_text(path.read_text(encoding='utf-8'), encoding='utf-8')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ─── Main ─────────────────────────────────────────────────────────────────────
async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--seco',         action='store_true')
    parser.add_argument('--forzar',       action='store_true')
    parser.add_argument('--sin-traducir', action='store_true')
    parser.add_argument('--concurrencia', type=int, default=5, metavar='N')
    parser.add_argument('--migrar',       action='store_true',
                        help='Solo migrar JSONs existentes usando pictos.json actual (sin regenerar)')
    args = parser.parse_args()

    # ── Modo migración ───────────────────────────────────────────────────────
    if args.migrar:
        if not PICTOS_JSON.exists():
            print(f"❌  No se encontró {PICTOS_JSON}. Genera el catálogo primero.")
            sys.exit(1)
        await _migrar_jsons()
        return

    if PICTOS_JSON.exists() and not args.forzar:
        print(f"⚠️  {PICTOS_JSON} ya existe. Usa --forzar para regenerar.")
        sys.exit(0)

    print('\n🌊  Marina 2 — Generador de catálogo de pictogramas\n')

    palabras = recolectar_palabras()
    print(f'   Palabras únicas en ES : {len(palabras)}')
    print(f'   Traducción            : {"desactivada" if args.sin_traducir else "MyMemory API (ES → EN)"}')
    if args.seco:
        print(f'   ⚡ DRY RUN\n')
        print(f'   Muestra (primeras 5):')
        for p in palabras[:5]:
            print(f'   · {p} → {nombre_archivo(p)}')
        return

    print()

    # ── Traducir ──────────────────────────────────────────────────────────────
    traducciones: dict[str, str] = {p: '' for p in palabras}

    if not args.sin_traducir:
        print(f'📡  Traduciendo {len(palabras)} palabras al inglés...')
        progreso = Progreso(len(palabras), 'traducción')
        semaforo = asyncio.Semaphore(args.concurrencia)

        connector = aiohttp.TCPConnector(limit=args.concurrencia + 2)
        async with aiohttp.ClientSession(connector=connector) as session:
            async def _tarea(p):
                async with semaforo:
                    traducciones[p] = await traducir(session, p)
                    progreso.avanzar()
                    await asyncio.sleep(0.1)
            await asyncio.gather(*[_tarea(p) for p in palabras])

        progreso.cerrar()
        con_trad  = sum(1 for v in traducciones.values() if v)
        sin_trad  = len(traducciones) - con_trad
        print(f'   ✅ {con_trad} traducidas · {sin_trad} sin traducción\n')

    # ── Construir catálogo ────────────────────────────────────────────────────
    catalogo = []
    for i, palabra in enumerate(palabras):
        en = traducciones.get(palabra, '')
        catalogo.append({
            'id':       ID_INICIO + i,
            'es':       palabra,
            'en':       en,
            'ruta_img': nombre_archivo(palabra),
            'tts_es':   palabra,
            'tts_en':   en,
        })

    # ── Backup y guardar ──────────────────────────────────────────────────────
    if PICTOS_JSON.exists():
        bak = PICTOS_JSON.with_suffix('.json.bak')
        bak.write_text(PICTOS_JSON.read_text(encoding='utf-8'), encoding='utf-8')
        print(f'   Backup guardado: {bak.name}')

    with open(PICTOS_JSON, 'w', encoding='utf-8') as f:
        json.dump(catalogo, f, ensure_ascii=False, indent=2)

    sin_en = sum(1 for e in catalogo if not e['tts_en'])
    print(f'✅  data/pictos.json generado — {len(catalogo)} entradas')
    if sin_en:
        print(f'\n⚠️  {sin_en} palabras sin traducción al inglés.')
        print(f'   Búscalas en pictos.json (campo "en" vacío) y corrígelas manualmente.')

    print(f'\n💡  Próximos pasos:')
    print(f'   1. Revisa y ajusta las traducciones en data/pictos.json')
    print(f'   2. Corre con --migrar para actualizar vocabulario.json, frases.json y memorama.json')
    print(f'   3. Mueve los pictogramas a assets/pictogramas/ (sin subcarpeta de idioma)')

if __name__ == '__main__':
    asyncio.run(main())