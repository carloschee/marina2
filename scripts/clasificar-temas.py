#!/usr/bin/env python3
"""
scripts/clasificar-temas.py — Marina 2
Clasifica pictos.json en campos semánticos para CAA/TEA y genera/actualiza
data/temas.json como fuente única de verdad para todos los módulos.

Uso:
  python scripts/clasificar-temas.py                  # clasifica y actualiza temas.json
  python scripts/clasificar-temas.py --seco            # muestra qué haría sin escribir
  python scripts/clasificar-temas.py --tema animales   # actualiza solo ese tema
  python scripts/clasificar-temas.py --listar          # muestra temas actuales con conteo
  python scripts/clasificar-temas.py --revisar         # interactivo: revisa sin clasificar

El clasificador opera en tres capas:
  1. Reglas explícitas — diccionario con asignaciones directas (alta confianza)
  2. Embeddings semánticos — paraphrase-multilingual-MiniLM-L12-v2 (requiere
     sentence-transformers; si no está instalado, solo opera la capa 1)
  3. Revisión manual — cualquier picto sin clasificar entra en cola de revisión

Los temas definidos son compatibles con CAA/TEA: cubren vocabulario nuclear,
necesidades básicas, categorías temáticas y campos funcionales.
"""

import json
import re
import argparse
import sys
from pathlib import Path
from difflib import SequenceMatcher

# ─── Rutas ────────────────────────────────────────────────────────────────────

RAIZ       = Path(__file__).parent.parent
PICTOS     = RAIZ / "data" / "pictos.json"
TEMAS_OUT  = RAIZ / "data" / "temas.json"

# ─── Definición de temas CAA/TEA ─────────────────────────────────────────────

TEMAS_DEF = [
    # ── Vocabulario temático ──────────────────────────────────────────────────
    {
        "id": "animales",
        "label": "Animales",
        "emoji": "🐾",
        "tipo": "vocabulario",
        "centroides": ["animal", "perro", "gato", "pájaro", "pez", "insecto"],
    },
    {
        "id": "frutas",
        "label": "Frutas",
        "emoji": "🍎",
        "tipo": "vocabulario",
        "centroides": ["fruta", "manzana", "naranja", "plátano", "uva"],
    },
    {
        "id": "verduras",
        "label": "Verduras",
        "emoji": "🥦",
        "tipo": "vocabulario",
        "centroides": ["verdura", "vegetal", "zanahoria", "tomate", "lechuga"],
    },
    {
        "id": "alimentos",
        "label": "Alimentos",
        "emoji": "🍕",
        "tipo": "vocabulario",
        "centroides": ["comida", "alimento", "comer", "pan", "arroz", "sopa"],
    },
    {
        "id": "transportes",
        "label": "Transportes",
        "emoji": "🚗",
        "tipo": "vocabulario",
        "centroides": ["transporte", "vehículo", "coche", "avión", "barco", "tren"],
    },
    {
        "id": "animales_marinos",
        "label": "Animales marinos",
        "emoji": "🐠",
        "tipo": "vocabulario",
        "centroides": ["pez", "marino", "tiburón", "ballena", "pulpo", "cangrejo"],
    },
    {
        "id": "insectos",
        "label": "Insectos",
        "emoji": "🦋",
        "tipo": "vocabulario",
        "centroides": ["insecto", "mariposa", "abeja", "mosca", "hormiga"],
    },
    {
        "id": "colores",
        "label": "Colores",
        "emoji": "🎨",
        "tipo": "vocabulario",
        "centroides": ["color", "rojo", "azul", "verde", "amarillo", "naranja"],
    },
    {
        "id": "ropa",
        "label": "Ropa",
        "emoji": "👕",
        "tipo": "vocabulario",
        "centroides": ["ropa", "vestir", "camisa", "pantalón", "zapato", "sombrero"],
    },
    {
        "id": "cuerpo",
        "label": "Cuerpo",
        "emoji": "🫁",
        "tipo": "vocabulario",
        "centroides": ["cuerpo", "mano", "pie", "cabeza", "ojo", "boca"],
    },
    {
        "id": "naturaleza",
        "label": "Naturaleza",
        "emoji": "🌿",
        "tipo": "vocabulario",
        "centroides": ["naturaleza", "árbol", "flor", "montaña", "río", "sol"],
    },
    {
        "id": "hogar",
        "label": "Hogar",
        "emoji": "🏠",
        "tipo": "vocabulario",
        "centroides": ["casa", "hogar", "mueble", "cama", "mesa", "silla", "cocina"],
    },
    {
        "id": "escuela",
        "label": "Escuela",
        "emoji": "📚",
        "tipo": "vocabulario",
        "centroides": ["escuela", "libro", "lápiz", "maestra", "clase", "mochila"],
    },
    {
        "id": "personas",
        "label": "Personas",
        "emoji": "👨‍👩‍👧",
        "tipo": "vocabulario",
        "centroides": ["persona", "familia", "mamá", "papá", "niño", "amigo"],
    },
    # ── Campos funcionales CAA ────────────────────────────────────────────────
    {
        "id": "verbos",
        "label": "Verbos",
        "emoji": "🏃",
        "tipo": "lenguaje",
        "centroides": ["acción", "correr", "comer", "jugar", "hacer", "ir"],
    },
    {
        "id": "emociones",
        "label": "Emociones",
        "emoji": "😊",
        "tipo": "lenguaje",
        "centroides": ["emoción", "feliz", "triste", "enojado", "miedo", "amor"],
    },
    {
        "id": "adjetivos",
        "label": "Adjetivos",
        "emoji": "✨",
        "tipo": "lenguaje",
        "centroides": ["adjetivo", "grande", "pequeño", "bonito", "rápido", "suave"],
    },
    {
        "id": "opuestos",
        "label": "Opuestos",
        "emoji": "↔️",
        "tipo": "lenguaje",
        "centroides": ["opuesto", "grande pequeño", "arriba abajo", "frío caliente"],
    },
    {
        "id": "necesidades_basicas",
        "label": "Necesidades básicas",
        "emoji": "💧",
        "tipo": "lenguaje",
        "centroides": ["necesidad", "agua", "baño", "dormir", "dolor", "ayuda", "hambre"],
    },
    {
        "id": "social",
        "label": "Interacción social",
        "emoji": "👋",
        "tipo": "lenguaje",
        "centroides": ["hola", "gracias", "por favor", "espera", "sí", "no"],
    },
    {
        "id": "tiempo_rutinas",
        "label": "Tiempo y rutinas",
        "emoji": "⏰",
        "tipo": "lenguaje",
        "centroides": ["tiempo", "primero", "después", "hoy", "mañana", "rutina"],
    },
    {
        "id": "lugares",
        "label": "Lugares",
        "emoji": "🏘️",
        "tipo": "vocabulario",
        "centroides": ["lugar", "escuela", "granja", "jardín", "zoológico", "ciudad"],
    },
    {
        "id": "clima",
        "label": "Clima",
        "emoji": "🌦️",
        "tipo": "vocabulario",
        "centroides": ["clima", "lluvia", "nieve", "sol", "viento", "tormenta"],
    },
    {
        "id": "objetos",
        "label": "Objetos",
        "emoji": "📦",
        "tipo": "vocabulario",
        "centroides": ["objeto", "cosa", "instrumento", "herramienta", "juguete"],
    },
]

# ─── Reglas explícitas (capa 1) ───────────────────────────────────────────────
# Asignaciones directas por palabra ES. Aquí van los casos que los embeddings
# no resolverían bien por ser muy específicos o ambiguos.
# Formato: "palabra_es": ["tema_id"] o "palabra_es": ["tema1", "tema2"]

REGLAS = {
    # Animales
    "perro": ["animales"], "gato": ["animales"], "pájaro": ["animales"],
    "caballo": ["animales"], "vaca": ["animales"], "oveja": ["animales"],
    "cerdo": ["animales"], "gallina": ["animales"], "conejo": ["animales"],
    "elefante": ["animales"], "león": ["animales"], "tigre": ["animales"],
    "oso": ["animales"], "jirafa": ["animales"], "cebra": ["animales"],
    "mono": ["animales"], "loro": ["animales"], "pato": ["animales"],
    "ratón": ["animales"], "rana": ["animales"], "sapo": ["animales"],
    "tortuga": ["animales"], "serpiente": ["animales"], "cocodrilo": ["animales"],
    "murciélago": ["animales"], "mariposa": ["animales"], "abeja": ["animales"],
    "araña": ["animales"], "ardilla": ["animales"], "ballena": ["animales"],
    "delfín": ["animales"], "pulpo": ["animales"],
    "alce": ["animales"], "alpaca": ["animales"], "armadillo": ["animales"],
    "avestruz": ["animales"], "buitre": ["animales"], "burro": ["animales"],
    "búfalo": ["animales"], "cabra": ["animales"], "cacatúa": ["animales"],
    "caimán": ["animales"], "camaleón": ["animales"], "camello": ["animales"],
    "canario": ["animales"], "canguro": ["animales"], "capibara": ["animales"],
    "caracol": ["animales"], "carnero": ["animales"], "castor": ["animales"],
    "chimpancé": ["animales"], "cigüeña": ["animales"], "cisne": ["animales"],
    "codorniz": ["animales"], "colibrí": ["animales"], "comadreja": ["animales"],
    "coyote": ["animales"], "cuervo": ["animales"], "cóndor": ["animales"],
    "dromedario": ["animales"], "flamenco": ["animales"], "gallo": ["animales"],
    "ganso": ["animales"], "gaviota": ["animales"], "gorrión": ["animales"],
    "guepardo": ["animales"], "halcón": ["animales"], "hiena": ["animales"],
    "hipopótamo": ["animales"], "hámster": ["animales"], "iguana": ["animales"],
    "jabalí": ["animales"], "lechuza": ["animales"], "leona": ["animales"],
    "leopardo": ["animales"], "lince": ["animales"], "llama": ["animales"],
    "marmota": ["animales"], "mapache": ["animales"], "mariquita": ["animales"],
    "medusa": ["animales"], "mofeta": ["animales"], "morsa": ["animales"],
    "nutria": ["animales"], "orangután": ["animales"], "orca": ["animales"],
    "oso hormiguero": ["animales"], "pangolín": ["animales"], "pantera": ["animales"],
    "pavo": ["animales"], "pavo real": ["animales"], "pelícano": ["animales"],
    "perezoso": ["animales"], "periquito": ["animales"], "puma": ["animales"],
    "rinoceronte": ["animales"], "salamandra": ["animales"], "tarántula": ["animales"],
    "tejón": ["animales"], "tigre": ["animales"], "tití": ["animales"],
    "topo": ["animales"], "toro": ["animales"], "tucán": ["animales"],
    # Animales marinos
    "pez": ["animales", "animales_marinos"],
    "tiburón": ["animales", "animales_marinos"],
    "tiburón ballena": ["animales", "animales_marinos"],
    "pez espada": ["animales", "animales_marinos"],
    "pez martillo": ["animales", "animales_marinos"],
    "pez payaso": ["animales", "animales_marinos"],
    "caballito de mar": ["animales", "animales_marinos"],
    "cangrejo": ["animales", "animales_marinos"],
    "carpa koi": ["animales", "animales_marinos"],
    "anguila": ["animales", "animales_marinos"],
    "foca": ["animales", "animales_marinos"],
    "leon marino": ["animales", "animales_marinos"],
    "manta": ["animales", "animales_marinos"],
    "tortuga marina": ["animales", "animales_marinos"],
    # Insectos
    "avispa": ["animales", "insectos"],
    "ciempiés": ["animales", "insectos"],
    "escorpión": ["animales", "insectos"],
    "libélula": ["animales", "insectos"],
    "mantis": ["animales", "insectos"],
    "mosca": ["animales", "insectos"],
    "saltamontes": ["animales", "insectos"],
    # Frutas
    "manzana": ["frutas"], "naranja": ["frutas", "colores"],
    "plátano": ["frutas"], "uva": ["frutas"], "pera": ["frutas"],
    "fresa": ["frutas"], "sandía": ["frutas"], "melón": ["frutas"],
    "mango": ["frutas"], "piña": ["frutas"], "kiwi": ["frutas"],
    "limón": ["frutas"], "cereza": ["frutas"], "durazno": ["frutas"],
    "frambuesa": ["frutas"], "mora": ["frutas"], "coco": ["frutas"],
    "papaya": ["frutas"], "guayaba": ["frutas"], "maracuyá": ["frutas"],
    "higo": ["frutas"], "ciruela": ["frutas"], "mandarina": ["frutas"],
    "aguacate": ["frutas"],
    # Verduras
    "zanahoria": ["verduras"], "tomate": ["verduras"], "brócoli": ["verduras"],
    "lechuga": ["verduras"], "cebolla": ["verduras"], "ajo": ["verduras"],
    "papa": ["verduras"], "maíz": ["verduras"], "pepino": ["verduras"],
    "espinaca": ["verduras"], "calabaza": ["verduras"],
    # Alimentos
    "pan": ["alimentos"], "arroz": ["alimentos"], "sopa": ["alimentos"],
    "pizza": ["alimentos"], "pasta": ["alimentos"], "ensalada": ["alimentos"],
    "hamburguesa": ["alimentos"], "huevo": ["alimentos"], "leche": ["alimentos"],
    "queso": ["alimentos"], "yogur": ["alimentos"], "jugo": ["alimentos"],
    "agua": ["alimentos", "necesidades_basicas"],
    "pollo": ["animales", "alimentos"], "carne": ["alimentos"],
    # Transportes
    "coche": ["transportes"], "avión": ["transportes"], "barco": ["transportes"],
    "tren": ["transportes"], "autobús": ["transportes"], "bicicleta": ["transportes"],
    "moto": ["transportes"], "camión": ["transportes"], "helicóptero": ["transportes"],
    "cohete": ["transportes"], "submarino": ["transportes"],
    "ambulancia": ["transportes"], "taxi": ["transportes"],
    "globo aerostático": ["transportes"], "canoa": ["transportes"],
    "velero": ["transportes"], "tranvía": ["transportes"], "metro": ["transportes"],
    "teleférico": ["transportes"], "patrulla": ["transportes"],
    "tractor": ["transportes"], "excavadora": ["transportes"],
    "patineta": ["transportes"], "autobús de dos pisos": ["transportes"],
    "limusina": ["transportes"], "jeep": ["transportes"],
    "mototaxi": ["transportes"], "kart": ["transportes"],
    "motoneta": ["transportes"], "segway": ["transportes"],
    "dirigible": ["transportes"], "avioneta": ["transportes"],
    "transbordador espacial": ["transportes"], "todoterreno": ["transportes"],
    "camión escolar": ["transportes"], "tráiler": ["transportes"],
    "paracaídas": ["transportes"],
    # Colores
    "rojo": ["colores"], "azul": ["colores"], "verde": ["colores"],
    "amarillo": ["colores"], "morado": ["colores"], "rosa": ["colores"],
    "negro": ["colores"], "blanco": ["colores"], "gris": ["colores"],
    "marrón": ["colores"], "naranja": ["frutas", "colores"],
    # Cuerpo
    "mano": ["cuerpo"], "pie": ["cuerpo"], "cabeza": ["cuerpo"],
    "ojo": ["cuerpo"], "boca": ["cuerpo"], "nariz": ["cuerpo"],
    "oreja": ["cuerpo"], "diente": ["cuerpo"], "pelo": ["cuerpo"],
    "brazo": ["cuerpo"], "pierna": ["cuerpo"], "rodilla": ["cuerpo"],
    "barriga": ["cuerpo"], "espalda": ["cuerpo"],
    # Necesidades básicas
    "dormir": ["necesidades_basicas", "verbos"],
    "comer": ["necesidades_basicas", "verbos"],
    "baño": ["necesidades_basicas", "hogar"],
    "hacer popo": ["necesidades_basicas"],
    "hacer pipi": ["necesidades_basicas"],
    "lavar las manos": ["necesidades_basicas", "verbos"],
    "descansar": ["necesidades_basicas", "verbos"],
    "ayuda": ["necesidades_basicas", "social"],
    "dolor": ["necesidades_basicas"],
    # Social / interacción
    "hola": ["social"], "gracias": ["social"], "por favor": ["social"],
    "espera": ["social", "verbos"], "sí": ["social"], "no": ["social"],
    "quiero": ["social", "necesidades_basicas"],
    # Verbos
    "jugar": ["verbos"], "correr": ["verbos"], "saltar": ["verbos"],
    "bailar": ["verbos"], "cantar": ["verbos"], "leer": ["verbos"],
    "escribir": ["verbos"], "dibujar": ["verbos"], "hablar": ["verbos"],
    "escuchar": ["verbos"], "mirar": ["verbos"], "tocar": ["verbos"],
    "abrir": ["verbos"], "cerrar": ["verbos"], "dar": ["verbos"],
    "ir": ["verbos"], "venir": ["verbos"],
    # Emociones
    "feliz": ["emociones"], "triste": ["emociones"], "enojado": ["emociones"],
    "miedo": ["emociones"], "amor": ["emociones"], "sorprendido": ["emociones"],
    "asustado": ["emociones"], "contento": ["emociones"],
    # Tiempo / rutinas
    "primero": ["tiempo_rutinas"], "después": ["tiempo_rutinas"],
    "hoy": ["tiempo_rutinas"], "mañana": ["tiempo_rutinas"],
    "antes": ["tiempo_rutinas"], "ahora": ["tiempo_rutinas"],

    # Ropa completa
    "camiseta": ["ropa"], "pantalón": ["ropa"], "falda": ["ropa"],
    "zapatos": ["ropa"], "calcetines": ["ropa"], "abrigo": ["ropa"],
    "bufanda": ["ropa"], "guantes": ["ropa"], "pijama": ["ropa"],
    "shorts": ["ropa"], "chaleco": ["ropa"], "sudadera": ["ropa"],
    "cinturón": ["ropa"], "bolsa": ["ropa"], "sandalias": ["ropa"],
    "tenis": ["ropa"], "corbata": ["ropa"], "delantal": ["ropa"],
    "bañador": ["ropa"], "vestido": ["ropa"], "gorra": ["ropa"],
    "sombrero": ["ropa"], "mochila": ["ropa", "escuela"],
    "botas": ["ropa"], "saco": ["ropa"],

    # Colores extendidos
    "turquesa": ["colores"], "dorado": ["colores"], "plateado": ["colores"],
    "beige": ["colores"], "violeta": ["colores"], "celeste": ["colores"],
    "magenta": ["colores"], "oliva": ["colores"], "coral": ["colores"],
    "índigo": ["colores"], "fucsia": ["colores"], "lima": ["colores"],
    "ocre": ["colores"],

    # Adjetivos
    "grande": ["adjetivos"], "pequeño": ["adjetivos"], "rápido": ["adjetivos"],
    "lento": ["adjetivos"], "caliente": ["adjetivos"], "frío": ["adjetivos"],
    "suave": ["adjetivos"], "duro": ["adjetivos"], "limpio": ["adjetivos"],
    "sucio": ["adjetivos"], "nuevo": ["adjetivos"], "viejo": ["adjetivos"],
    "bonito": ["adjetivos"], "feo": ["adjetivos"], "fuerte": ["adjetivos"],
    "débil": ["adjetivos"], "alto": ["adjetivos"], "bajo": ["adjetivos"],
    "gordo": ["adjetivos"], "delgado": ["adjetivos"], "amargo": ["adjetivos"],
    "brillante": ["adjetivos"], "oscuro": ["adjetivos"],

    # Opuestos
    "arriba": ["opuestos"], "abajo": ["opuestos"], "dentro": ["opuestos"],
    "fuera": ["opuestos"], "cerca": ["opuestos"], "lejos": ["opuestos"],
    "encima": ["opuestos"], "debajo": ["opuestos"], "delante": ["opuestos"],
    "detrás": ["opuestos"], "izquierda": ["opuestos"], "derecha": ["opuestos"],
    "noche": ["opuestos", "tiempo_rutinas"], "día": ["opuestos", "tiempo_rutinas"],
    "entrada": ["opuestos"], "salida": ["opuestos"],
    "inicio": ["opuestos"], "fin": ["opuestos"],
    "abierto": ["opuestos"], "cerrado": ["opuestos"],
    "lleno": ["opuestos"], "vacío": ["opuestos"],

    # Emociones extendidas
    "aburrido": ["emociones"], "emocionado": ["emociones"],
    "tranquilo": ["emociones"], "cansado": ["emociones", "necesidades_basicas"],
    "nervioso": ["emociones"], "orgulloso": ["emociones"],
    "celoso": ["emociones"], "avergonzado": ["emociones"],
    "confundido": ["emociones"], "enamorado": ["emociones"],
    "asqueado": ["emociones"], "frustrado": ["emociones"],
    "esperanzado": ["emociones"], "solitario": ["emociones"],
    "agradecido": ["emociones"], "curioso": ["emociones"],
    "valiente": ["emociones"], "tímido": ["emociones"],
    "llorando": ["emociones"],

    # Verbos adicionales
    "beber": ["verbos", "necesidades_basicas"], "pintar": ["verbos"],
    "llorar": ["verbos", "emociones"], "reír": ["verbos", "emociones"],
    "abrazar": ["verbos", "social"], "besar": ["verbos", "social"],
    "caminar": ["verbos"], "nadar": ["verbos"], "trepar": ["verbos"],
    "empujar": ["verbos"], "jalar": ["verbos"], "volar": ["verbos"],
    "soplar": ["verbos"],

    # Cuerpo extendido
    "cuello": ["cuerpo"], "hombro": ["cuerpo"], "dedo": ["cuerpo"],
    "pecho": ["cuerpo"], "talón": ["cuerpo"], "uña": ["cuerpo"],
    "ceja": ["cuerpo"], "mejilla": ["cuerpo"], "barbilla": ["cuerpo"],
    "codo": ["cuerpo"], "muñeca": ["cuerpo"],

    # Naturaleza extendida
    "sol": ["naturaleza"], "árbol": ["naturaleza"], "flor": ["naturaleza"],
    "luna": ["naturaleza"], "estrella": ["naturaleza"], "nube": ["naturaleza"],
    "lluvia": ["naturaleza"], "nieve": ["naturaleza"], "montaña": ["naturaleza"],
    "volcán": ["naturaleza"], "río": ["naturaleza"], "mar": ["naturaleza"],
    "desierto": ["naturaleza"], "bosque": ["naturaleza"], "piedra": ["naturaleza"],
    "arena": ["naturaleza"], "semilla": ["naturaleza"], "raíz": ["naturaleza"],
    "rama": ["naturaleza"], "hierba": ["naturaleza"], "musgo": ["naturaleza"],
    "cascada": ["naturaleza"], "roca": ["naturaleza"], "hoja": ["naturaleza"],
    "rayo": ["naturaleza"], "arco iris": ["naturaleza"], "fuego": ["naturaleza"],

    # Hogar
    "casa": ["hogar"], "cama": ["hogar"], "mesa": ["hogar"],
    "silla": ["hogar"], "puerta": ["hogar"], "ventana": ["hogar"],
    "lámpara": ["hogar"], "taza": ["hogar"], "vaso": ["hogar"],
    "tijeras": ["hogar"], "llave": ["hogar"], "espejo": ["hogar"],
    "escoba": ["hogar"], "esponja": ["hogar"],

    # Escuela
    "libro": ["escuela"], "escuela": ["escuela", "hogar"],
    "guitarra": ["escuela"], "xilófono": ["escuela"],
    "tambor": ["escuela"], "flauta": ["escuela"],

    # Personas
    "niño": ["personas"], "niña": ["personas"], "bebé": ["personas"],
    "águila": ["animales"],

    # Alimentos adicionales
    "helado": ["alimentos"], "sandwich": ["alimentos"], "galleta": ["alimentos"],
    "pastel": ["alimentos"], "chocolate": ["alimentos"], "jamón": ["alimentos"],
    "frijoles": ["alimentos"], "pescado": ["alimentos", "animales_marinos"],
    "elote": ["alimentos", "verduras"], "nuez": ["alimentos"],
    "waffle": ["alimentos"], "hambre": ["necesidades_basicas"],

    # Animales adicionales que quedaron fuera
    "búho": ["animales"], "gorila": ["animales"], "erizo": ["animales"],
    "gusano": ["animales"], "hormiga": ["animales", "insectos"],
    "koala": ["animales"], "lagarto": ["animales"], "lobo": ["animales"],
    "ornitorrinco": ["animales"], "ocelote": ["animales"],
    "ñu": ["animales"], "ñandú": ["animales"],
    "quetzal": ["animales"], "yegua": ["animales"], "zorro": ["animales"],
    "unicornio": ["animales"],

    # Objetos adicionales sin clasificar
    "corazón": ["objetos"], "dinosaurio": ["animales"], "dragón": ["objetos"],
    "dulce": ["alimentos"], "dedos": ["cuerpo"], "escalera": ["objetos", "hogar"],
    "fruta": ["frutas"], "fuente": ["lugares", "naturaleza"],
    "girasol": ["naturaleza"], "grifo": ["objetos", "hogar"],
    "hada": ["objetos"], "hongo": ["naturaleza"], "iglú": ["lugares"],
    "insecto": ["insectos"], "instrumento": ["objetos"],
    "jabón": ["objetos", "hogar"], "jinete": ["personas"],
    "kayak": ["transportes"], "músico": ["personas"],
    "mapa": ["objetos"], "nido": ["naturaleza"], "natación": ["verbos"],
    "ñame": ["alimentos", "verduras"], "ola": ["naturaleza", "clima"],
    "oruga": ["animales"], "planeta": ["naturaleza"], "paloma": ["animales"],
    "wonton": ["alimentos"], "xochimilco": ["lugares"],
    "yate": ["transportes"], "zapato": ["ropa"],
    "roja": ["colores"], "suky": ["personas"],
    "tienes": ["social"], "daño": ["necesidades_basicas"],
    "sueño": ["necesidades_basicas"], "cielo": ["naturaleza", "clima"],
    "duerme": ["verbos"], "pío": ["animales"],
    "semillas": ["naturaleza"], "afuera": ["opuestos"],
    "nosotros": ["social"], "curamos": ["verbos"],
    "camión de bomberos": ["transportes"],
    "pastelito": ["alimentos"], "mono de nieve": ["objetos"],
    "bombero": ["personas"], "cactus": ["naturaleza"],
    "dientes": ["cuerpo"], "cactus": ["naturaleza"],

    # Lugares
    "escuela": ["lugares", "hogar"], "granja": ["lugares"],
    "jardín": ["lugares", "naturaleza"], "zoológico": ["lugares"],
    "iglesia": ["lugares"], "isla": ["lugares", "naturaleza"],
    "faro": ["lugares"], "casa": ["hogar", "lugares"],

    # Clima
    "lluvia": ["clima", "naturaleza"], "nieve": ["clima", "naturaleza"],
    "sol": ["clima", "naturaleza"], "nube": ["clima", "naturaleza"],
    "rayo": ["clima", "naturaleza"], "arco iris": ["clima", "naturaleza"],
    "calor": ["clima"], "invierno": ["clima"],

    # Objetos — categoría comodín para lo que no encaja en otra parte
    "botón": ["ropa"], "violín": ["objetos"],
    "guitarra": ["objetos"], "xilófono": ["objetos"],
    "flauta": ["objetos"], "tambor": ["objetos"], "ukelele": ["objetos"],
    "pelota": ["objetos"], "yoyo": ["objetos"],
    "muñeca": ["objetos"], "juguete": ["objetos"],
    "dado": ["objetos"], "burbujas": ["objetos"],
    "corona": ["objetos"], "espada": ["objetos"],
    "llave": ["objetos", "hogar"], "rueda": ["objetos"],
    "tijeras": ["objetos", "hogar"], "hacha": ["objetos"],
    "imán": ["objetos"], "jaula": ["objetos"],
    "quinqué": ["objetos"], "hamaca": ["objetos"],
    "jarra": ["objetos", "hogar"], "red": ["objetos"],
    "tubo": ["objetos"], "hueso": ["objetos"],
    "escoba": ["objetos", "hogar"], "esponja": ["objetos", "hogar"],
    "espejo": ["objetos", "hogar"], "vela": ["objetos", "hogar"],
    "lámpara": ["objetos", "hogar"], "dinero": ["objetos"],
    "regalo": ["objetos"], "pelota": ["objetos"],
    "robot": ["objetos"], "nave espacial": ["objetos", "transportes"],

    # Correcciones manuales (GUI)
    "motocicleta": ["transportes"],
    "oso polar": ["animales"],
}

# ─── Carga ────────────────────────────────────────────────────────────────────

def cargar_pictos():
    with open(PICTOS, encoding="utf-8") as f:
        return json.load(f)

def cargar_temas():
    if TEMAS_OUT.exists():
        with open(TEMAS_OUT, encoding="utf-8") as f:
            return json.load(f)
    return []

# ─── Capa 1: reglas explícitas ────────────────────────────────────────────────

def clasificar_por_reglas(pictos):
    """Clasifica los pictos usando el diccionario REGLAS."""
    asignaciones = {}  # id → [tema_id]
    for p in pictos:
        clave = p["es"].lower().strip()
        if clave in REGLAS:
            asignaciones[p["id"]] = REGLAS[clave]
    return asignaciones

# ─── Capa 2: embeddings semánticos (opcional) ─────────────────────────────────

def clasificar_por_embeddings(pictos, asignaciones_existentes):
    """
    Clasifica los pictos SIN regla usando similitud de embeddings.
    Requiere: pip install sentence-transformers
    """
    try:
        from sentence_transformers import SentenceTransformer, util
    except ImportError:
        print("ℹ️  sentence-transformers no instalado — solo se usan reglas explícitas.")
        print("   Para clasificación semántica: pip install sentence-transformers")
        return {}

    print("🧠 Cargando modelo de embeddings (primera vez puede tardar)…")
    modelo = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")

    sin_clasificar = [p for p in pictos if p["id"] not in asignaciones_existentes]
    if not sin_clasificar:
        return {}

    print(f"   Clasificando {len(sin_clasificar)} pictos sin regla…")

    # Construir centroides por tema
    centroides_texto = {}
    for t in TEMAS_DEF:
        centroides_texto[t["id"]] = t["centroides"]

    todos_centroides = {
        tid: modelo.encode(textos, convert_to_tensor=True)
        for tid, textos in centroides_texto.items()
    }

    nuevas = {}
    UMBRAL = 0.35  # similitud mínima para asignar

    for p in sin_clasificar:
        texto = p["es"]
        emb = modelo.encode(texto, convert_to_tensor=True)
        mejor_tema = None
        mejor_score = 0.0

        for tid, embs_centroides in todos_centroides.items():
            scores = util.cos_sim(emb, embs_centroides)[0]
            score = float(scores.max())
            if score > mejor_score:
                mejor_score = score
                mejor_tema = tid

        if mejor_score >= UMBRAL and mejor_tema:
            nuevas[p["id"]] = [mejor_tema]
            if mejor_score < 0.50:
                nuevas[p["id"]].append("_revisar")  # marcar baja confianza

    print(f"   Clasificados por embedding: {len([v for v in nuevas.values() if '_revisar' not in v])}")
    print(f"   Requieren revisión (baja confianza): {len([v for v in nuevas.values() if '_revisar' in v])}")
    return nuevas

# ─── Construir temas.json ─────────────────────────────────────────────────────

def construir_temas(pictos, asignaciones):
    """
    Construye la lista de temas a partir de las asignaciones.
    Preserva el orden y los IDs existentes en temas.json si ya existe.
    """
    temas_existentes = {t["id"]: t for t in cargar_temas()}
    temas_salida = []

    for defn in TEMAS_DEF:
        tid = defn["id"]
        # IDs de pictos asignados a este tema (excluir marcados _revisar)
        palabras = sorted([
            pid for pid, tids in asignaciones.items()
            if tid in tids and "_revisar" not in tids
        ])

        if tid in temas_existentes:
            # Preservar el tema existente y actualizar solo palabras
            tema = dict(temas_existentes[tid])
            tema["palabras"] = palabras
        else:
            tema = {
                "id":      tid,
                "label":   defn["label"],
                "emoji":   defn["emoji"],
                "tipo":    defn["tipo"],
                "palabras": palabras,
            }
        temas_salida.append(tema)

    return temas_salida

# ─── Listar ───────────────────────────────────────────────────────────────────

def listar_temas():
    if not TEMAS_OUT.exists():
        print("temas.json no existe todavía.")
        return
    temas = cargar_temas()
    print(f"\n{'TEMA':<24} {'TIPO':<12} {'PICTOS':>6}  IDs (primeros 5)")
    print("─" * 70)
    for t in temas:
        primeros = str(t["palabras"][:5])[:-1] + ", …]" if len(t["palabras"]) > 5 else str(t["palabras"])
        print(f"  {t['emoji']} {t['label']:<20} {t.get('tipo',''):<12} {len(t['palabras']):>6}  {primeros}")
    total = sum(len(t["palabras"]) for t in temas)
    print(f"\n  Total asignaciones: {total}  |  Temas: {len(temas)}")

# ─── Sin clasificar / baja confianza ─────────────────────────────────────────

def mostrar_sin_clasificar(pictos, asignaciones):
    todos_clasificados = set(asignaciones.keys())
    sin = [p for p in pictos if p["id"] not in todos_clasificados]
    if sin:
        print(f"\n⚠️  Sin clasificar ({len(sin)}):")
        for p in sin:
            print(f"   {p['id']:>5}  {p['es']}")
    else:
        print("\n✅ Todos los pictos tienen al menos un tema asignado.")

def mostrar_baja_confianza(pictos, asignaciones):
    """Muestra pictos clasificados con baja confianza por embeddings."""
    pictos_idx = {p["id"]: p for p in pictos}
    baja = [
        (pid, tids) for pid, tids in asignaciones.items()
        if "_revisar" in tids
    ]
    if not baja:
        print("\n✅ Ningún picto requiere revisión manual.")
        return
    print(f"\n🔍 Baja confianza — requieren revisión ({len(baja)}):")
    print(f"   {'ID':>5}  {'ES':<28}  TEMA ASIGNADO")
    print("   " + "─" * 55)
    for pid, tids in sorted(baja):
        p = pictos_idx.get(pid, {})
        temas_limpios = [t for t in tids if t != "_revisar"]
        print(f"   {pid:>5}  {p.get('es', '?'):<28}  {', '.join(temas_limpios)}")
    print()
    print("   Para corregir: agrega la regla explícita en REGLAS y")
    print("   vuelve a correr el script sin --revisar.")

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Clasificador de temas CAA/TEA para Marina 2")
    parser.add_argument("--seco",    action="store_true", help="No escribe archivos")
    parser.add_argument("--listar",  action="store_true", help="Muestra temas actuales y sale")
    parser.add_argument("--revisar", action="store_true", help="Solo muestra pictos sin clasificar")
    parser.add_argument("--tema",    type=str,  help="Actualiza solo este tema (id)")
    parser.add_argument("--embeddings", action="store_true", help="Forzar uso de embeddings aunque haya reglas")
    args = parser.parse_args()

    if args.listar:
        listar_temas()
        return

    pictos = cargar_pictos()
    print(f"📚 Catálogo cargado: {len(pictos)} pictos")

    # Capa 1: reglas
    asignaciones = clasificar_por_reglas(pictos)
    print(f"✅ Clasificados por reglas: {len(asignaciones)}")

    # Capa 2: embeddings (para los que no tienen regla)
    nuevas_emb = clasificar_por_embeddings(pictos, asignaciones)
    asignaciones.update(nuevas_emb)

    if args.revisar:
        try:
            import tkinter  # noqa: F401
            _lanzar_gui(pictos, asignaciones)
        except ImportError:
            print("ℹ️  tkinter no disponible — mostrando en consola.")
            mostrar_sin_clasificar(pictos, asignaciones)
            mostrar_baja_confianza(pictos, asignaciones)
        return

    temas = construir_temas(pictos, asignaciones)

    # Filtrar por tema específico si se pasó --tema
    if args.tema:
        temas = [t for t in temas if t["id"] == args.tema]
        if not temas:
            print(f"❌ Tema '{args.tema}' no encontrado.")
            sys.exit(1)

    # Resumen
    print(f"\n{'TEMA':<24} {'TIPO':<12} {'PICTOS':>6}")
    print("─" * 44)
    for t in temas:
        print(f"  {t['emoji']} {t['label']:<20} {t.get('tipo',''):<12} {len(t['palabras']):>6}")
    total = sum(len(t["palabras"]) for t in temas)
    print(f"\n  Total: {total} asignaciones en {len(temas)} temas")

    mostrar_sin_clasificar(pictos, asignaciones)

    if args.seco:
        print("\n🔍 Modo seco — no se escribió ningún archivo.")
        return

    # Escribir
    if args.tema:
        # Actualizar solo ese tema en el archivo existente
        temas_actuales = cargar_temas()
        tid = args.tema
        idx = next((i for i, t in enumerate(temas_actuales) if t["id"] == tid), None)
        if idx is not None:
            temas_actuales[idx] = temas[0]
        else:
            temas_actuales.append(temas[0])
        temas = temas_actuales

    with open(TEMAS_OUT, "w", encoding="utf-8") as f:
        json.dump(temas, f, ensure_ascii=False, indent=2)
    print(f"\n💾 Escrito: {TEMAS_OUT}")

# ─── GUI de revisión (integrada) ─────────────────────────────────────────────
# Se activa con --revisar. Requiere tkinter (incluido en Python para Windows).
# Si tkinter no está disponible, --revisar cae a salida de texto en consola.

C_FONDO     = "#07212e"
C_PANEL     = "#0d2f40"
C_PANEL2    = "#0a2535"
C_ACENTO    = "#00e5b0"
C_ACENTO2   = "#38bdf8"
C_TEXTO     = "#e8f4f8"
C_TEXTO_DIM = "#7ab4c8"
C_BORDE     = "#1a4a5e"
C_WARN      = "#fbbf24"
C_ERROR     = "#fb7185"
C_OK        = "#4ade80"


def _guardar_regla(palabra_es: str, temas_seleccionados: list):
    """Inserta o reemplaza la regla en el diccionario REGLAS de este mismo archivo."""
    ruta = Path(__file__)
    with open(ruta, encoding="utf-8") as f:
        contenido = f.read()
    clave = palabra_es.lower().strip()
    temas_str = json.dumps(temas_seleccionados, ensure_ascii=False)
    nueva_linea = f'    "{clave}": {temas_str},'
    patron = re.compile(
        r'\s*"' + re.escape(clave) + r'"\s*:\s*\[.*?\],?',
        re.MULTILINE
    )
    if patron.search(contenido):
        contenido = patron.sub("\n" + nueva_linea, contenido)
    else:
        # Insertar justo antes del "}" que cierra el diccionario REGLAS
        contenido = contenido.replace(
            "\n}\n\n# ─── Carga",
            f"\n    # Corrección manual\n{nueva_linea}\n}}\n\n# ─── Carga",
            1
        )
    with open(ruta, "w", encoding="utf-8") as f:
        f.write(contenido)


def _regenerar_temas():
    """Ejecuta main() del propio script para regenerar temas.json."""
    import subprocess
    proc = subprocess.run(
        [sys.executable, str(Path(__file__))],
        capture_output=True, text=True, encoding="utf-8",
        cwd=str(RAIZ)
    )
    return proc.returncode == 0, proc.stdout + proc.stderr


def _detectar_pendientes_gui(pictos, asignaciones, temas):
    """Devuelve lista de pictos que requieren revisión para la GUI."""
    asignados = {pid for t in temas for pid in t.get("palabras", [])}
    baja = [
        {
            "id": p["id"], "es": p["es"], "en": p.get("en", ""),
            "tipo": "baja_confianza",
            "temas_actuales": [t["id"] for t in temas if p["id"] in t.get("palabras", [])],
        }
        for p in pictos
        if asignaciones.get(p["id"]) and "_revisar" in asignaciones[p["id"]]
    ]
    sin = [
        {
            "id": p["id"], "es": p["es"], "en": p.get("en", ""),
            "tipo": "sin_tema", "temas_actuales": [],
        }
        for p in pictos if p["id"] not in asignados
    ]
    return baja + sin


def _lanzar_gui(pictos, asignaciones):
    """Lanza la ventana tkinter de revisión de temas."""
    import tkinter as tk
    from tkinter import messagebox, ttk

    temas = cargar_temas()

    class App(tk.Tk):
        def __init__(self):
            super().__init__()
            self.title("Revisar temas — Marina 2")
            self.geometry("900x650")
            self.minsize(750, 500)
            self.configure(bg=C_FONDO)
            self.pictos_idx = {p["id"]: p for p in pictos}
            self.temas = temas
            self.pendientes = _detectar_pendientes_gui(pictos, asignaciones, temas)
            self.idx = 0
            self.vars_check = {}
            self._build()
            if self.pendientes:
                self._cargar(0)
            else:
                self._vacio()

        def _build(self):
            # Header
            hdr = tk.Frame(self, bg=C_FONDO, pady=12)
            hdr.pack(fill="x", padx=20)
            tk.Label(hdr, text="Revisar clasificación de temas",
                     font=("Helvetica", 16, "bold"),
                     bg=C_FONDO, fg=C_ACENTO).pack(side="left")
            self.lbl_prog = tk.Label(hdr, text="", font=("Helvetica", 11),
                                     bg=C_FONDO, fg=C_TEXTO_DIM)
            self.lbl_prog.pack(side="right")

            # Cuerpo
            body = tk.Frame(self, bg=C_FONDO)
            body.pack(fill="both", expand=True, padx=20)

            # Panel izquierdo — info picto
            izq = tk.Frame(body, bg=C_PANEL, padx=20, pady=20,
                           highlightthickness=1, highlightbackground=C_BORDE,
                           width=280)
            izq.pack(side="left", fill="both", padx=(0,10), pady=(0,10))
            izq.pack_propagate(False)

            tk.Label(izq, text="PICTOGRAMA", font=("Helvetica", 9, "bold"),
                     bg=C_PANEL, fg=C_TEXTO_DIM).pack(anchor="w")
            self.lbl_id  = tk.Label(izq, text="", font=("Helvetica", 11),
                                    bg=C_PANEL, fg=C_TEXTO_DIM)
            self.lbl_id.pack(anchor="w", pady=(2,0))
            self.lbl_es  = tk.Label(izq, text="", font=("Helvetica", 22, "bold"),
                                    bg=C_PANEL, fg=C_TEXTO, wraplength=240)
            self.lbl_es.pack(anchor="w", pady=(6,2))
            self.lbl_en  = tk.Label(izq, text="", font=("Helvetica", 13, "italic"),
                                    bg=C_PANEL, fg=C_TEXTO_DIM)
            self.lbl_en.pack(anchor="w")
            tk.Frame(izq, bg=C_BORDE, height=1).pack(fill="x", pady=14)
            tk.Label(izq, text="TIPO DE REVISIÓN", font=("Helvetica", 9, "bold"),
                     bg=C_PANEL, fg=C_TEXTO_DIM).pack(anchor="w")
            self.lbl_tipo = tk.Label(izq, text="", font=("Helvetica", 11),
                                     bg=C_PANEL, fg=C_WARN,
                                     wraplength=240, justify="left")
            self.lbl_tipo.pack(anchor="w", pady=(4,0))
            tk.Frame(izq, bg=C_BORDE, height=1).pack(fill="x", pady=14)

            nav = tk.Frame(izq, bg=C_PANEL)
            nav.pack(fill="x")
            for txt, cmd, side in [("◀ Anterior", self._anterior, "left"),
                                    ("Siguiente ▶", self._siguiente, "right")]:
                tk.Button(nav, text=txt, command=cmd,
                          bg=C_PANEL2, fg=C_TEXTO, activebackground=C_BORDE,
                          relief="flat", padx=10, pady=6, cursor="hand2",
                          font=("Helvetica", 10)
                          ).pack(side=side, expand=True, fill="x",
                                 padx=(0,4) if side=="left" else (4,0))

            # Panel derecho — checkboxes de temas
            der = tk.Frame(body, bg=C_PANEL, padx=20, pady=20,
                           highlightthickness=1, highlightbackground=C_BORDE)
            der.pack(side="right", fill="both", expand=True, pady=(0,10))
            tk.Label(der, text="TEMAS ASIGNADOS", font=("Helvetica", 9, "bold"),
                     bg=C_PANEL, fg=C_TEXTO_DIM).pack(anchor="w")
            tk.Label(der, text="Marca todos los temas que correspondan",
                     font=("Helvetica", 10), bg=C_PANEL, fg=C_TEXTO_DIM
                     ).pack(anchor="w", pady=(2,12))

            wrap = tk.Frame(der, bg=C_PANEL)
            wrap.pack(fill="both", expand=True)
            canvas = tk.Canvas(wrap, bg=C_PANEL, highlightthickness=0)
            sb = ttk.Scrollbar(wrap, orient="vertical", command=canvas.yview)
            self.frm_checks = tk.Frame(canvas, bg=C_PANEL)
            self.frm_checks.bind("<Configure>",
                lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
            canvas.create_window((0,0), window=self.frm_checks, anchor="nw")
            canvas.configure(yscrollcommand=sb.set)
            canvas.pack(side="left", fill="both", expand=True)
            sb.pack(side="right", fill="y")
            canvas.bind_all("<MouseWheel>",
                lambda e: canvas.yview_scroll(int(-1*(e.delta/120)), "units"))
            self._build_checks()

            # Barra inferior
            bar = tk.Frame(self, bg=C_FONDO, pady=12)
            bar.pack(fill="x", padx=20)
            self.btn_save = tk.Button(
                bar, text="✅  Guardar y siguiente",
                command=self._guardar_siguiente,
                bg=C_ACENTO, fg=C_FONDO, activebackground="#00c49a",
                relief="flat", padx=20, pady=10, cursor="hand2",
                font=("Helvetica", 12, "bold"))
            self.btn_save.pack(side="left")
            tk.Button(bar, text="Omitir", command=self._siguiente,
                      bg=C_PANEL, fg=C_TEXTO_DIM, activebackground=C_BORDE,
                      relief="flat", padx=16, pady=10, cursor="hand2",
                      font=("Helvetica", 11)
                      ).pack(side="left", padx=(8,0))
            tk.Button(bar, text="⚡ Regenerar temas.json",
                      command=self._regenerar,
                      bg=C_PANEL2, fg=C_ACENTO2, activebackground=C_BORDE,
                      relief="flat", padx=16, pady=10, cursor="hand2",
                      font=("Helvetica", 11)
                      ).pack(side="right")
            self.lbl_estado = tk.Label(bar, text="", font=("Helvetica", 10),
                                       bg=C_FONDO, fg=C_OK)
            self.lbl_estado.pack(side="right", padx=12)

        def _build_checks(self):
            self.vars_check = {}
            grupos = {}
            for t in self.temas:
                grupos.setdefault(t.get("tipo","otro"), []).append(t)
            for tipo, items in grupos.items():
                tk.Label(self.frm_checks, text=tipo.upper(),
                         font=("Helvetica", 8, "bold"),
                         bg=C_PANEL, fg=C_TEXTO_DIM
                         ).pack(anchor="w", pady=(10,2))
                for t in items:
                    var = tk.BooleanVar(value=False)
                    self.vars_check[t["id"]] = var
                    tk.Checkbutton(
                        self.frm_checks,
                        text=f"{t.get('emoji','')}  {t['label']}",
                        variable=var,
                        bg=C_PANEL, fg=C_TEXTO, selectcolor=C_FONDO,
                        activebackground=C_PANEL, activeforeground=C_ACENTO,
                        font=("Helvetica", 11), anchor="w", cursor="hand2",
                    ).pack(fill="x", pady=1)

        def _cargar(self, idx):
            self.idx = idx
            item = self.pendientes[idx]
            self.lbl_id.config(text=f"ID {item['id']}")
            self.lbl_es.config(text=item["es"])
            self.lbl_en.config(text=item.get("en",""))
            self.lbl_tipo.config(text={
                "baja_confianza": "⚠️ Baja confianza (embedding inseguro)",
                "sin_tema":       "❌ Sin tema asignado",
            }.get(item.get("tipo",""), "🔍 Requiere revisión"))
            self.lbl_prog.config(text=f"{idx+1} / {len(self.pendientes)}")
            for tid, var in self.vars_check.items():
                var.set(tid in item.get("temas_actuales", []))

        def _vacio(self):
            self.lbl_es.config(text="✅ Sin pendientes", fg=C_OK)
            self.lbl_id.config(text="")
            self.lbl_en.config(text="Todos los pictos tienen tema asignado")
            self.lbl_tipo.config(text="")
            self.lbl_prog.config(text="0 pendientes")
            self.btn_save.config(state="disabled")

        def _anterior(self):
            if self.idx > 0: self._cargar(self.idx - 1)

        def _siguiente(self):
            if self.idx < len(self.pendientes) - 1:
                self._cargar(self.idx + 1)

        def _guardar_siguiente(self):
            if not self.pendientes: return
            item = self.pendientes[self.idx]
            sel = [tid for tid, var in self.vars_check.items() if var.get()]
            if not sel:
                messagebox.showwarning("Sin temas",
                    "Selecciona al menos un tema antes de guardar.")
                return
            try:
                _guardar_regla(item["es"], sel)
                self.lbl_estado.config(
                    text=f"✅ {item['es']} → {', '.join(sel)}", fg=C_OK)
                self.pendientes.pop(self.idx)
                if self.pendientes:
                    self._cargar(min(self.idx, len(self.pendientes)-1))
                else:
                    self._vacio()
            except Exception as e:
                messagebox.showerror("Error al guardar", str(e))

        def _regenerar(self):
            self.lbl_estado.config(text="⏳ Regenerando…", fg=C_WARN)
            self.update()
            ok, salida = _regenerar_temas()
            if ok:
                self.lbl_estado.config(text="✅ temas.json regenerado", fg=C_OK)
            else:
                messagebox.showerror("Error al regenerar", salida[-500:])
                self.lbl_estado.config(text="❌ Error", fg=C_ERROR)

    App().mainloop()


if __name__ == "__main__":
    main()