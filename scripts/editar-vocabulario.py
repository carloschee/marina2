#!/usr/bin/env python3
"""
scripts/editar-vocabulario.py — Marina 2
GUI para curar el vocabulario de Mira y di por letra.

Muestra todos los pictos disponibles agrupados por letra inicial,
con las casillas de los que ya están en vocabulario.json pre-marcadas.
Los cambios se guardan de vuelta a vocabulario.json.

También migra vocabulario.json al formato simplificado (solo IDs sin ES/EN).

Uso:
    python scripts/editar-vocabulario.py

Requisitos:
    - tkinter (incluido en Python para Windows)
    - data/pictos.json
    - data/vocabulario.json
"""

import json
import re
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, ttk

# ─── Rutas ────────────────────────────────────────────────────────────────────

RAIZ          = Path(__file__).parent.parent
PICTOS_JSON   = RAIZ / "data" / "pictos.json"
VOCAB_JSON    = RAIZ / "data" / "vocabulario.json"

# ─── Colores Marina 2 ─────────────────────────────────────────────────────────

C_FONDO      = "#07212e"
C_PANEL      = "#0d2f40"
C_PANEL2     = "#0a2535"
C_ACENTO     = "#00e5b0"
C_ACENTO2    = "#38bdf8"
C_TEXTO      = "#e8f4f8"
C_TEXTO_DIM  = "#7ab4c8"
C_BORDE      = "#1a4a5e"
C_WARN       = "#fbbf24"
C_OK         = "#4ade80"
C_ERROR      = "#fb7185"

# ─── Carga ────────────────────────────────────────────────────────────────────

def cargar_pictos():
    with open(PICTOS_JSON, encoding="utf-8") as f:
        return json.load(f)

def cargar_vocab():
    """
    Carga vocabulario.json y normaliza al formato simplificado:
    { "A": [1001, 1004, ...], "B": [...] }
    Migra automáticamente si encuentra el formato antiguo { "A": {"es": [...], "en": [...]} }
    """
    with open(VOCAB_JSON, encoding="utf-8") as f:
        raw = json.load(f)

    normalizado = {}
    migrado = False
    for letra, valor in raw.items():
        if isinstance(valor, dict):
            # Formato antiguo — tomar solo "es", ignorar "en"
            ids = valor.get("es", [])
            migrado = True
        elif isinstance(valor, list):
            ids = valor
        else:
            ids = []
        normalizado[letra] = sorted(set(int(i) for i in ids))

    if migrado:
        print(f"ℹ️  vocabulario.json migrado: eliminada propiedad 'en' (vestigial)")

    return normalizado

def guardar_vocab(vocab):
    with open(VOCAB_JSON, "w", encoding="utf-8") as f:
        json.dump(vocab, f, ensure_ascii=False, indent=2)

# ─── Indexar pictos por letra ─────────────────────────────────────────────────

def indexar_por_letra(pictos):
    """
    Agrupa los pictos por la letra inicial de su nombre ES.
    Devuelve dict: letra → [picto, ...]
    Solo letras A-Z y Ñ, ignorando artículos iniciales (el/la/los/las).
    """
    ARTICULOS = {"el ", "la ", "los ", "las ", "un ", "una "}
    idx = {}
    for p in pictos:
        nombre = p.get("es", "").strip().lower()
        # Quitar artículo inicial si lo hay
        for art in ARTICULOS:
            if nombre.startswith(art):
                nombre = nombre[len(art):]
                break
        if not nombre:
            continue
        letra = nombre[0].upper()
        # Normalizar ñ
        if letra == "Ñ":
            letra = "Ñ"
        elif not letra.isalpha():
            continue
        # Normalizar tildes en letra inicial
        letra = letra.translate(str.maketrans("ÁÉÍÓÚ", "AEIOU"))
        idx.setdefault(letra, []).append(p)

    # Ordenar pictos dentro de cada letra por nombre
    for letra in idx:
        idx[letra].sort(key=lambda p: p.get("es", "").lower())

    return idx

# ─── App ──────────────────────────────────────────────────────────────────────

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Editor de vocabulario — Mira y di — Marina 2")
        self.geometry("1000x700")
        self.minsize(800, 550)
        self.configure(bg=C_FONDO)

        self.pictos     = cargar_pictos()
        self.vocab      = cargar_vocab()
        self.por_letra  = indexar_por_letra(self.pictos)
        self.letra_actual = None
        self.vars_check = {}   # picto_id → BooleanVar
        self.cambios_pendientes = False

        self._build()
        # Seleccionar primera letra disponible
        letras = sorted(self.por_letra.keys())
        if letras:
            self._cargar_letra(letras[0])

    # ── Construcción de UI ────────────────────────────────────────────────────

    def _build(self):
        # ── Header ──
        hdr = tk.Frame(self, bg=C_FONDO, pady=12)
        hdr.pack(fill="x", padx=20)
        tk.Label(hdr, text="Editor de vocabulario — Mira y di",
                 font=("Helvetica", 16, "bold"),
                 bg=C_FONDO, fg=C_ACENTO).pack(side="left")
        self.lbl_estado = tk.Label(hdr, text="", font=("Helvetica", 10),
                                   bg=C_FONDO, fg=C_OK)
        self.lbl_estado.pack(side="right")

        # ── Cuerpo: panel izq (letras) + panel der (pictos) ──
        body = tk.Frame(self, bg=C_FONDO)
        body.pack(fill="both", expand=True, padx=20)

        # Panel de letras
        izq = tk.Frame(body, bg=C_PANEL, pady=12, padx=8,
                       highlightthickness=1, highlightbackground=C_BORDE,
                       width=110)
        izq.pack(side="left", fill="y", padx=(0, 10), pady=(0, 10))
        izq.pack_propagate(False)

        tk.Label(izq, text="LETRA", font=("Helvetica", 9, "bold"),
                 bg=C_PANEL, fg=C_TEXTO_DIM).pack(pady=(0, 8))

        # Canvas scrollable para las letras
        c_letras = tk.Canvas(izq, bg=C_PANEL, highlightthickness=0, width=90)
        sb_letras = ttk.Scrollbar(izq, orient="vertical", command=c_letras.yview)
        self.frm_letras = tk.Frame(c_letras, bg=C_PANEL)
        self.frm_letras.bind("<Configure>",
            lambda e: c_letras.configure(scrollregion=c_letras.bbox("all")))
        c_letras.create_window((0, 0), window=self.frm_letras, anchor="nw")
        c_letras.configure(yscrollcommand=sb_letras.set)
        c_letras.pack(side="left", fill="both", expand=True)
        sb_letras.pack(side="right", fill="y")
        self._build_letras()

        # Panel derecho — pictos de la letra seleccionada
        der = tk.Frame(body, bg=C_PANEL, padx=16, pady=12,
                       highlightthickness=1, highlightbackground=C_BORDE)
        der.pack(side="right", fill="both", expand=True, pady=(0, 10))

        # Header del panel derecho
        top = tk.Frame(der, bg=C_PANEL)
        top.pack(fill="x", pady=(0, 10))
        self.lbl_letra = tk.Label(top, text="",
                                   font=("Helvetica", 28, "bold"),
                                   bg=C_PANEL, fg=C_ACENTO)
        self.lbl_letra.pack(side="left")
        self.lbl_conteo = tk.Label(top, text="",
                                    font=("Helvetica", 11),
                                    bg=C_PANEL, fg=C_TEXTO_DIM)
        self.lbl_conteo.pack(side="left", padx=(12, 0))

        # Botones seleccionar/deseleccionar todos
        btns = tk.Frame(top, bg=C_PANEL)
        btns.pack(side="right")
        for txt, cmd in [("Todos", self._seleccionar_todos),
                         ("Ninguno", self._deseleccionar_todos)]:
            tk.Button(btns, text=txt, command=cmd,
                      bg=C_PANEL2, fg=C_TEXTO_DIM,
                      activebackground=C_BORDE,
                      relief="flat", padx=10, pady=4,
                      cursor="hand2", font=("Helvetica", 10)
                      ).pack(side="left", padx=2)

        # Búsqueda
        busq = tk.Frame(der, bg=C_PANEL)
        busq.pack(fill="x", pady=(0, 10))
        tk.Label(busq, text="🔍", bg=C_PANEL, fg=C_TEXTO_DIM,
                 font=("Helvetica", 12)).pack(side="left")
        self.var_busq = tk.StringVar()
        self.var_busq.trace_add("write", lambda *_: self._filtrar())
        entry = tk.Entry(busq, textvariable=self.var_busq,
                         bg=C_PANEL2, fg=C_TEXTO,
                         insertbackground=C_TEXTO,
                         relief="flat", font=("Helvetica", 11),
                         highlightthickness=1,
                         highlightbackground=C_BORDE,
                         highlightcolor=C_ACENTO)
        entry.pack(side="left", fill="x", expand=True, padx=(6, 0), ipady=4)

        # Grid scrollable de pictos
        wrap = tk.Frame(der, bg=C_PANEL)
        wrap.pack(fill="both", expand=True)
        self.canvas = tk.Canvas(wrap, bg=C_PANEL, highlightthickness=0)
        sb = ttk.Scrollbar(wrap, orient="vertical", command=self.canvas.yview)
        self.frm_pictos = tk.Frame(self.canvas, bg=C_PANEL)
        self.frm_pictos.bind("<Configure>",
            lambda e: self.canvas.configure(
                scrollregion=self.canvas.bbox("all")))
        self.canvas.create_window((0, 0), window=self.frm_pictos, anchor="nw")
        self.canvas.configure(yscrollcommand=sb.set)
        self.canvas.pack(side="left", fill="both", expand=True)
        sb.pack(side="right", fill="y")
        self.canvas.bind_all("<MouseWheel>",
            lambda e: self.canvas.yview_scroll(int(-1*(e.delta/120)), "units"))

        # ── Barra inferior ──
        bar = tk.Frame(self, bg=C_FONDO, pady=12)
        bar.pack(fill="x", padx=20)
        self.btn_guardar = tk.Button(
            bar, text="💾  Guardar vocabulario.json",
            command=self._guardar,
            bg=C_ACENTO, fg=C_FONDO, activebackground="#00c49a",
            relief="flat", padx=20, pady=10, cursor="hand2",
            font=("Helvetica", 12, "bold"))
        self.btn_guardar.pack(side="left")
        tk.Label(bar,
                 text="Los cambios aplican inmediatamente al recargar Mira y di.",
                 font=("Helvetica", 10), bg=C_FONDO, fg=C_TEXTO_DIM
                 ).pack(side="left", padx=16)
        self.lbl_cambios = tk.Label(bar, text="", font=("Helvetica", 10, "bold"),
                                    bg=C_FONDO, fg=C_WARN)
        self.lbl_cambios.pack(side="right")

        # Guardar al cerrar si hay cambios
        self.protocol("WM_DELETE_WINDOW", self._al_cerrar)

    def _build_letras(self):
        """Construye los botones de letra en el panel izquierdo."""
        for widget in self.frm_letras.winfo_children():
            widget.destroy()
        self.btns_letra = {}
        letras = sorted(self.por_letra.keys())
        for letra in letras:
            en_vocab = len(self.vocab.get(letra, [])) > 0
            total    = len(self.por_letra.get(letra, []))
            asignados = len(self.vocab.get(letra, []))
            btn = tk.Button(
                self.frm_letras,
                text=f"{letra}\n{asignados}/{total}",
                command=lambda l=letra: self._cargar_letra(l),
                bg=C_PANEL2 if not en_vocab else C_PANEL,
                fg=C_ACENTO if en_vocab else C_TEXTO_DIM,
                activebackground=C_BORDE,
                relief="flat", width=8, pady=6,
                cursor="hand2",
                font=("Helvetica", 10, "bold" if en_vocab else "normal"),
            )
            btn.pack(fill="x", pady=1)
            self.btns_letra[letra] = btn

    # ── Carga de letra ────────────────────────────────────────────────────────

    def _cargar_letra(self, letra):
        # Guardar selección actual antes de cambiar
        if self.letra_actual and self.letra_actual != letra:
            self._aplicar_seleccion_actual()

        self.letra_actual = letra
        self.var_busq.set("")
        self._renderizar_pictos(self.por_letra.get(letra, []))
        self.lbl_letra.config(text=letra)
        self._actualizar_conteo()

        # Resaltar botón activo
        for l, btn in self.btns_letra.items():
            btn.config(relief="solid" if l == letra else "flat",
                       highlightbackground=C_ACENTO if l == letra else C_BORDE)

    def _renderizar_pictos(self, pictos_lista):
        """Dibuja los pictos como checkboxes en el grid."""
        for w in self.frm_pictos.winfo_children():
            w.destroy()
        self.vars_check = {}

        ids_en_vocab = set(self.vocab.get(self.letra_actual, []))
        COLS = 4

        for i, p in enumerate(pictos_lista):
            fila = i // COLS
            col  = i % COLS

            pid  = p["id"]
            var  = tk.BooleanVar(value=pid in ids_en_vocab)
            var.trace_add("write", lambda *_, l=self.letra_actual: self._marcar_cambio())
            self.vars_check[pid] = var

            celda = tk.Frame(self.frm_pictos, bg=C_PANEL,
                             padx=8, pady=8,
                             highlightthickness=1,
                             highlightbackground=C_BORDE)
            celda.grid(row=fila, column=col, padx=4, pady=4, sticky="nsew")
            self.frm_pictos.grid_columnconfigure(col, weight=1)

            cb = tk.Checkbutton(
                celda,
                text=p.get("es", ""),
                variable=var,
                bg=C_PANEL, fg=C_TEXTO,
                selectcolor=C_FONDO,
                activebackground=C_PANEL,
                activeforeground=C_ACENTO,
                font=("Helvetica", 10, "bold"),
                anchor="w", cursor="hand2",
                wraplength=160,
            )
            cb.pack(fill="x")

            # ID pequeño como referencia
            tk.Label(celda, text=f"ID {pid}",
                     font=("Helvetica", 8), bg=C_PANEL,
                     fg=C_TEXTO_DIM).pack(anchor="w")

        self.canvas.yview_moveto(0)

    def _filtrar(self):
        """Filtra los pictos de la letra actual según el texto de búsqueda."""
        busq = self.var_busq.get().lower().strip()
        pictos_letra = self.por_letra.get(self.letra_actual, [])
        if busq:
            filtrados = [p for p in pictos_letra
                         if busq in p.get("es", "").lower()
                         or busq in p.get("en", "").lower()]
        else:
            filtrados = pictos_letra
        self._renderizar_pictos(filtrados)

    # ── Selección ─────────────────────────────────────────────────────────────

    def _seleccionar_todos(self):
        for var in self.vars_check.values():
            var.set(True)

    def _deseleccionar_todos(self):
        for var in self.vars_check.values():
            var.set(False)

    def _aplicar_seleccion_actual(self):
        """Guarda en memoria la selección de la letra actual."""
        if not self.letra_actual:
            return
        seleccionados = sorted(
            pid for pid, var in self.vars_check.items() if var.get()
        )
        self.vocab[self.letra_actual] = seleccionados

    def _actualizar_conteo(self):
        letra = self.letra_actual
        total     = len(self.por_letra.get(letra, []))
        asignados = len(self.vocab.get(letra, []))
        self.lbl_conteo.config(
            text=f"{asignados} de {total} incluidos"
        )

    def _marcar_cambio(self):
        self.cambios_pendientes = True
        self.lbl_cambios.config(text="● Cambios sin guardar")

    # ── Guardar ───────────────────────────────────────────────────────────────

    def _guardar(self):
        # Aplicar selección de la letra activa antes de guardar
        self._aplicar_seleccion_actual()
        # Eliminar letras vacías
        vocab_limpio = {k: v for k, v in self.vocab.items() if v}
        guardar_vocab(vocab_limpio)
        self.vocab = vocab_limpio
        self.cambios_pendientes = False
        self.lbl_cambios.config(text="")
        self.lbl_estado.config(text="✅ vocabulario.json guardado", fg=C_OK)
        # Actualizar contadores de letras
        self._build_letras()
        self._actualizar_conteo()

    def _al_cerrar(self):
        if self.cambios_pendientes:
            resp = messagebox.askyesnocancel(
                "Cambios sin guardar",
                "Hay cambios sin guardar. ¿Guardar antes de cerrar?"
            )
            if resp is True:
                self._guardar()
                self.destroy()
            elif resp is False:
                self.destroy()
            # None = cancelar → no cerrar
        else:
            self.destroy()

# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    for ruta, nombre in [(PICTOS_JSON, "data/pictos.json"),
                         (VOCAB_JSON, "data/vocabulario.json")]:
        if not ruta.exists():
            print(f"❌ No se encontró {nombre} en {ruta}")
            raise SystemExit(1)
    App().mainloop()