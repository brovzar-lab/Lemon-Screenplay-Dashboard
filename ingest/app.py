#!/usr/bin/env python3
"""
app.py — Lemon Studios V9 Screenplay Ingest App
A premium GUI uploader for the V9 analysis pipeline.

Launch:
    python app.py
"""

import hashlib
import json
import os
import queue
import sys
import threading
import tkinter as tk
import uuid
from pathlib import Path
from tkinter import filedialog, font, messagebox, ttk
from typing import Optional

# ── Dependency check ──────────────────────────────────────────────────────────
try:
    import firebase_admin
    from firebase_admin import credentials, storage, firestore
except ImportError:
    messagebox.showerror(
        "Missing Dependency",
        "firebase_admin is not installed.\n\nRun:\n  pip install -r requirements.txt",
    )
    sys.exit(1)

# ── Resolve project paths ─────────────────────────────────────────────────────
HERE = Path(__file__).parent
LOGO_PATH = HERE / "mushroom_logo.png"
SA_PATH = HERE.parent / "lemon-screenplay-dashboard-firebase-adminsdk-fbsvc-2037a834e2.json"
ENV_PATH = HERE.parent / ".env"

# Load .env manually (no dotenv dependency required in GUI)
if ENV_PATH.exists():
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

# ── Constants ─────────────────────────────────────────────────────────────────
INGEST_QUEUE_COLLECTION = "ingest-queue"
VALID_COLLECTIONS = ["LEMON", "BLACK_LIST", "ARCHIVE", "TEST"]
MAX_FILE_SIZE_MB = 50
MODEL_COSTS = {"auto": 0.22, "haiku": 0.06, "sonnet": 0.22, "opus": 0.90, "hybrid": 0.40}
MODEL_LABELS = {
    "auto":   "auto  — smart routing (Haiku→Sonnet, ~$0.06–0.22)",
    "haiku":  "haiku — fast & cheap (~$0.06/script)",
    "sonnet": "sonnet — best balance (~$0.22/script)",
    "opus":   "opus — premium quality (~$0.90/script)",
    "hybrid": "hybrid — Sonnet→Opus promotion (~$0.40/script)",
}

# ── Palette — Magic Mushroom ──────────────────────────────────────────────────
BG       = "#0d0d12"
BG2      = "#13131a"
BG3      = "#1a1a24"
BORDER   = "#2a2038"
GOLD     = "#c084fc"   # purple-ish accent (magic)
GOLD_LT  = "#e879f9"   # bright magenta highlight
ACCENT2  = "#d4a017"   # gold for cost / warnings
TEXT     = "#ede9f6"
TEXT_DIM = "#5b5470"
GREEN    = "#4ade80"
RED      = "#f87171"
BLUE     = "#67e8f9"
ORANGE   = "#fb923c"


# ══════════════════════════════════════════════════════════════════════════════
# Firebase helpers (same logic as lemon_ingest.py)
# ══════════════════════════════════════════════════════════════════════════════

def init_firebase() -> None:
    if firebase_admin._apps:
        return
    env_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if env_path and Path(env_path).exists():
        cred = credentials.Certificate(env_path)
    elif SA_PATH.exists():
        cred = credentials.Certificate(str(SA_PATH))
    else:
        cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {
        "storageBucket": "lemon-screenplay-dashboard.firebasestorage.app"
    })


def upload_pdf(path: Path, collection_id: str, model: str = "auto") -> dict:
    bucket = storage.bucket()
    safe_name = path.name.replace(" ", "_")
    blob_name = f"ingest-queue/{collection_id}/{uuid.uuid4().hex}_{safe_name}"
    blob = bucket.blob(blob_name)
    blob.metadata = {"model": model, "priority": "0", "original_name": path.name}
    blob.upload_from_filename(str(path), content_type="application/pdf")
    return {
        "storage_path": f"gs://{bucket.name}/{blob_name}",
        "blob_name": blob_name,
    }


def discover_pdfs(folder: Path) -> list[Path]:
    return sorted(folder.rglob("*.pdf"))


def file_size_mb(path: Path) -> float:
    return path.stat().st_size / (1024 * 1024)


# ══════════════════════════════════════════════════════════════════════════════
# Mushroom SVG logo (drawn via Canvas — no external PNG needed as fallback)
# ══════════════════════════════════════════════════════════════════════════════

def draw_mushroom(canvas: tk.Canvas, cx: int, cy: int, size: int = 60) -> None:
    """Draw a stylised mushroom on a tk.Canvas."""
    r = size // 2
    # Cap
    canvas.create_arc(cx - r, cy - r, cx + r, cy + int(r * 0.5),
                      start=0, extent=180, fill=GOLD, outline="", style=tk.CHORD)
    # Cap highlight
    canvas.create_arc(cx - int(r * 0.55), cy - int(r * 0.85),
                      cx - int(r * 0.05), cy - int(r * 0.2),
                      start=30, extent=90, fill=GOLD_LT, outline="", style=tk.ARC,
                      width=2)
    # Gills underline
    canvas.create_arc(cx - int(r * 1.1), cy - int(r * 0.25),
                      cx + int(r * 1.1), cy + int(r * 0.55),
                      start=0, extent=180, fill=BG, outline=GOLD, style=tk.CHORD, width=1)
    # Stem
    stem_w = int(r * 0.35)
    stem_h = int(r * 0.85)
    canvas.create_rounded_rect = lambda *a, **kw: None  # placeholder
    canvas.create_rectangle(
        cx - stem_w, cy + int(r * 0.15),
        cx + stem_w, cy + int(r * 0.15) + stem_h,
        fill="#e8dcc8", outline="", )
    # Stem highlight
    canvas.create_rectangle(
        cx - stem_w + 4, cy + int(r * 0.2),
        cx - 2, cy + int(r * 0.15) + stem_h - 6,
        fill="#f5f0e8", outline="")
    # Dots on cap
    for dx, dy in [(-int(r * 0.4), -int(r * 0.5)), (int(r * 0.25), -int(r * 0.65))]:
        canvas.create_oval(cx + dx - 3, cy + dy - 3, cx + dx + 3, cy + dy + 3,
                           fill="#1a1200", outline="")


# ══════════════════════════════════════════════════════════════════════════════
# Main Application
# ══════════════════════════════════════════════════════════════════════════════

class MushroomApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("🍄 Lemon Ingest V9")
        self.configure(bg=BG)
        self.resizable(False, False)
        self.geometry("760x750")

        # Try to load png logo; fall back to canvas mushroom
        self._logo_img: Optional[tk.PhotoImage] = None
        if LOGO_PATH.exists():
            try:
                self._logo_img = tk.PhotoImage(file=str(LOGO_PATH))
                # Scale down to ~72px display size
                w, h = self._logo_img.width(), self._logo_img.height()
                factor = max(1, w // 72)
                if factor > 1:
                    self._logo_img = self._logo_img.subsample(factor, factor)
                # Set window icon
                self.iconphoto(True, self._logo_img)
            except Exception:
                self._logo_img = None

        self._folder: Optional[Path] = None
        self._pdfs: list[Path] = []
        self._upload_queue: queue.Queue = queue.Queue()
        self._uploading = False

        # Model & collection vars
        self._model_var = tk.StringVar(value="hybrid")
        self._collection_var = tk.StringVar(value="BLACK_LIST")
        self._dry_run_var = tk.BooleanVar(value=False)

        self._build_ui()
        self._poll_queue()

    # ── UI build ──────────────────────────────────────────────────────────────

    def _build_ui(self):
        self._build_header()
        self._build_folder_section()
        self._build_options_section()
        self._build_action_bar()
        self._build_log_section()
        self._build_footer()

    def _build_header(self):
        header = tk.Frame(self, bg=BG, pady=0)
        header.pack(fill="x", padx=0, pady=0)

        # Top magic bar — gradient-ish via two frames
        tk.Frame(self, bg=GOLD_LT, height=1).pack(fill="x")
        tk.Frame(self, bg=GOLD, height=2).pack(fill="x")

        inner = tk.Frame(header, bg=BG2, pady=18)
        inner.pack(fill="x")
        tk.Frame(self, bg=BORDER, height=1).pack(fill="x")

        # Logo area
        logo_frame = tk.Frame(inner, bg=BG2)
        logo_frame.pack()

        if self._logo_img:
            tk.Label(logo_frame, image=self._logo_img, bg=BG2).pack(side="left", padx=(0, 14))
        else:
            cnv = tk.Canvas(logo_frame, width=64, height=70, bg=BG2, highlightthickness=0)
            cnv.pack(side="left", padx=(0, 14))
            draw_mushroom(cnv, 32, 30, size=54)

        text_frame = tk.Frame(logo_frame, bg=BG2)
        text_frame.pack(side="left", anchor="w")

        title_font = font.Font(family="Helvetica Neue", size=22, weight="bold")
        sub_font   = font.Font(family="Helvetica Neue", size=11)
        badge_font = font.Font(family="Courier", size=9, weight="bold")

        tk.Label(text_frame, text="Lemon Ingest", font=title_font,
                 fg=GOLD_LT, bg=BG2).pack(anchor="w")
        tk.Label(text_frame, text="V9 Screenplay Upload  ·  Lemon Studios",
                 font=sub_font, fg=TEXT_DIM, bg=BG2).pack(anchor="w")

        badge = tk.Label(text_frame, text=" ✦ V9 · ARCHAEOLOGY ENGINE ✦ ",
                         font=badge_font, fg=GOLD_LT, bg="#1a0a2e",
                         padx=8, pady=3, relief="flat")
        badge.pack(anchor="w", pady=(5, 0))

    def _build_folder_section(self):
        tk.Frame(self, bg=BORDER, height=1).pack(fill="x")
        section = tk.Frame(self, bg=BG, padx=24, pady=18)
        section.pack(fill="x")

        label_font = font.Font(family="Helvetica Neue", size=11, weight="bold")
        path_font  = font.Font(family="Courier", size=10)
        meta_font  = font.Font(family="Helvetica Neue", size=10)

        tk.Label(section, text="📁  SCREENPLAY FOLDER", font=label_font,
                 fg=GOLD, bg=BG).grid(row=0, column=0, sticky="w")

        # Drop zone frame
        drop = tk.Frame(section, bg=BG3, relief="flat",
                        highlightbackground=BORDER, highlightthickness=1)
        drop.grid(row=1, column=0, columnspan=2, sticky="ew", pady=(8, 0))
        section.columnconfigure(0, weight=1)

        self._path_label = tk.Label(
            drop, text="  No folder selected — click Browse or drag & drop",
            font=path_font, fg=TEXT_DIM, bg=BG3, anchor="w",
            padx=14, pady=12, wraplength=560, justify="left",
        )
        self._path_label.pack(side="left", fill="x", expand=True)

        browse_btn = tk.Button(
            drop, text="Browse…", command=self._browse_folder,
            bg=BG2, fg=GOLD, activebackground=BG3, activeforeground=GOLD_LT,
            relief="flat", font=font.Font(family="Helvetica Neue", size=11, weight="bold"),
            padx=16, pady=10, cursor="hand2", bd=0,
        )
        browse_btn.pack(side="right", padx=4, pady=4)

        # PDF meta row
        self._meta_label = tk.Label(section, text="", font=meta_font,
                                    fg=TEXT_DIM, bg=BG, anchor="w")
        self._meta_label.grid(row=2, column=0, sticky="w", pady=(6, 0))

    def _build_options_section(self):
        tk.Frame(self, bg=BORDER, height=1).pack(fill="x")
        section = tk.Frame(self, bg=BG, padx=24, pady=18)
        section.pack(fill="x")

        label_font = font.Font(family="Helvetica Neue", size=11, weight="bold")
        opt_font   = font.Font(family="Helvetica Neue", size=11)
        small_font = font.Font(family="Helvetica Neue", size=9)

        # ── Model picker ──────────────────────────────────────────────────────
        tk.Label(section, text="🤖  ANALYSIS MODEL", font=label_font,
                 fg=GOLD, bg=BG).grid(row=0, column=0, sticky="w", pady=(0, 8))

        model_frame = tk.Frame(section, bg=BG)
        model_frame.grid(row=1, column=0, columnspan=3, sticky="ew")
        section.columnconfigure(0, weight=1)

        for i, (mkey, mlabel) in enumerate(MODEL_LABELS.items()):
            col, row = i % 3, i // 3
            rb = tk.Radiobutton(
                model_frame, text=mlabel, variable=self._model_var, value=mkey,
                font=opt_font, fg=TEXT, bg=BG, selectcolor=BG3,
                activebackground=BG, activeforeground=GOLD_LT,
                command=self._update_cost, anchor="w",
                relief="flat", indicatoron=True, cursor="hand2",
            )
            rb.grid(row=row, column=col, sticky="w", padx=(0, 20), pady=3)

        # ── Collection picker ─────────────────────────────────────────────────
        tk.Frame(section, bg=BORDER, height=1).grid(
            row=3, column=0, columnspan=3, sticky="ew", pady=14)

        tk.Label(section, text="🗂  COLLECTION", font=label_font,
                 fg=GOLD, bg=BG).grid(row=4, column=0, sticky="w", pady=(0, 8))

        coll_frame = tk.Frame(section, bg=BG)
        coll_frame.grid(row=5, column=0, columnspan=3, sticky="ew")

        for i, coll in enumerate(VALID_COLLECTIONS):
            colors = [GOLD, BLUE, TEXT_DIM, ORANGE]
            rb = tk.Radiobutton(
                coll_frame, text=coll, variable=self._collection_var, value=coll,
                font=font.Font(family="Courier", size=11, weight="bold"),
                fg=colors[i % len(colors)], bg=BG, selectcolor=BG3,
                activebackground=BG, activeforeground=GOLD_LT,
                relief="flat", indicatoron=True, cursor="hand2",
            )
            rb.grid(row=0, column=i, sticky="w", padx=(0, 24))

        # ── Dry run ───────────────────────────────────────────────────────────
        tk.Checkbutton(
            section, text="Dry run (preview only — no files uploaded)",
            variable=self._dry_run_var,
            font=small_font, fg=TEXT_DIM, bg=BG, selectcolor=BG3,
            activebackground=BG, activeforeground=TEXT,
            relief="flat", cursor="hand2",
        ).grid(row=6, column=0, sticky="w", pady=(14, 0))

        # ── Cost estimate ─────────────────────────────────────────────────────
        self._cost_label = tk.Label(
            section, text="", font=small_font, fg=TEXT_DIM, bg=BG, anchor="e")
        self._cost_label.grid(row=6, column=2, sticky="e", pady=(14, 0))

    def _build_action_bar(self):
        tk.Frame(self, bg=BORDER, height=1).pack(fill="x")
        bar = tk.Frame(self, bg=BG2, padx=24, pady=14)
        bar.pack(fill="x")

        self._upload_btn = tk.Button(
            bar, text="  🍄  Upload to V9 Pipeline  ",
            command=self._start_upload,
            bg=GOLD, fg="#0d0d12",
            activebackground=GOLD_LT, activeforeground="#0d0d12",
            font=font.Font(family="Helvetica Neue", size=13, weight="bold"),
            relief="flat", padx=20, pady=10, cursor="hand2", bd=0,
        )
        self._upload_btn.pack(side="left")

        self._progress = ttk.Progressbar(bar, mode="determinate", length=260)
        self._progress.pack(side="left", padx=20, pady=4)

        self._status_label = tk.Label(
            bar, text="Ready", fg=TEXT_DIM, bg=BG2,
            font=font.Font(family="Helvetica Neue", size=10))
        self._status_label.pack(side="left")

        # Style progressbar
        style = ttk.Style(self)
        style.theme_use("default")
        style.configure("TProgressbar", troughcolor=BG3, background=GOLD_LT,
                        thickness=8, borderwidth=0)

    def _build_log_section(self):
        tk.Frame(self, bg=BORDER, height=1).pack(fill="x")
        section = tk.Frame(self, bg=BG, padx=24, pady=12)
        section.pack(fill="both", expand=True)

        log_header = tk.Frame(section, bg=BG)
        log_header.pack(fill="x")

        tk.Label(log_header, text="📋  UPLOAD LOG", fg=GOLD, bg=BG,
                 font=font.Font(family="Helvetica Neue", size=10, weight="bold")).pack(side="left")

        clear_btn = tk.Button(
            log_header, text="Clear", command=self._clear_log,
            bg=BG, fg=TEXT_DIM, relief="flat",
            font=font.Font(family="Helvetica Neue", size=9),
            cursor="hand2", bd=0, padx=4,
        )
        clear_btn.pack(side="right")

        log_frame = tk.Frame(section, bg=BG3,
                             highlightbackground=BORDER, highlightthickness=1)
        log_frame.pack(fill="both", expand=True, pady=(8, 0))

        self._log = tk.Text(
            log_frame, bg=BG3, fg=TEXT, relief="flat",
            font=font.Font(family="Courier", size=10),
            wrap="word", state="disabled", padx=10, pady=8,
            insertbackground=GOLD, selectbackground=GOLD, selectforeground=BG,
        )
        scrollbar = tk.Scrollbar(log_frame, command=self._log.yview,
                                 troughcolor=BG3, bg=BORDER,
                                 activebackground=GOLD, relief="flat")
        self._log["yscrollcommand"] = scrollbar.set
        scrollbar.pack(side="right", fill="y")
        self._log.pack(fill="both", expand=True)

        # Define tags
        self._log.tag_config("gold",  foreground=GOLD)
        self._log.tag_config("green", foreground=GREEN)
        self._log.tag_config("red",   foreground=RED)
        self._log.tag_config("dim",   foreground=TEXT_DIM)
        self._log.tag_config("bold",  font=font.Font(family="Courier", size=10, weight="bold"))
        self._log.tag_config("blue",  foreground=BLUE)

    def _build_footer(self):
        tk.Frame(self, bg=BORDER, height=1).pack(fill="x")
        footer = tk.Frame(self, bg=BG, pady=8)
        footer.pack(fill="x")
        tk.Label(
            footer,
            text="All analysis runs on VPS daemon  ·  Results appear in Lemon Dashboard automatically",
            fg=TEXT_DIM, bg=BG,
            font=font.Font(family="Helvetica Neue", size=9),
        ).pack()

    # ── Interactions ──────────────────────────────────────────────────────────

    def _browse_folder(self):
        path = filedialog.askdirectory(title="Select Screenplay Folder")
        if path:
            self._set_folder(Path(path))

    def _set_folder(self, folder: Path):
        self._folder = folder
        self._pdfs = discover_pdfs(folder)
        self._path_label.config(text=f"  {folder}", fg=TEXT)

        if not self._pdfs:
            self._meta_label.config(text="⚠  No PDF files found in this folder.", fg=ORANGE)
        else:
            total_mb = sum(file_size_mb(p) for p in self._pdfs)
            oversized = sum(1 for p in self._pdfs if file_size_mb(p) > MAX_FILE_SIZE_MB)
            msg = f"✓  {len(self._pdfs)} PDFs found  ·  {total_mb:.1f} MB total"
            if oversized:
                msg += f"  ·  ⚠ {oversized} oversized (>{MAX_FILE_SIZE_MB}MB, will be skipped)"
            self._meta_label.config(text=msg, fg=GREEN if not oversized else ORANGE)
        self._update_cost()

    def _update_cost(self):
        if not self._pdfs:
            self._cost_label.config(text="")
            return
        model = self._model_var.get()
        cost = MODEL_COSTS.get(model, 0.22)
        valid = [p for p in self._pdfs if file_size_mb(p) <= MAX_FILE_SIZE_MB]
        est = len(valid) * cost
        self._cost_label.config(
            text=f"Est. cost: ~${est:.2f}  ({len(valid)} scripts × ${cost:.2f})",
            fg=TEXT_DIM,
        )

    def _clear_log(self):
        self._log.config(state="normal")
        self._log.delete("1.0", "end")
        self._log.config(state="disabled")

    def _log_write(self, msg: str, tag: str = ""):
        self._log.config(state="normal")
        if tag:
            self._log.insert("end", msg + "\n", tag)
        else:
            self._log.insert("end", msg + "\n")
        self._log.see("end")
        self._log.config(state="disabled")

    # ── Upload ────────────────────────────────────────────────────────────────

    def _start_upload(self):
        if self._uploading:
            return
        if not self._folder or not self._pdfs:
            messagebox.showwarning("No folder", "Please select a folder with PDF screenplays first.")
            return

        pdfs = [p for p in self._pdfs if file_size_mb(p) <= MAX_FILE_SIZE_MB]
        if not pdfs:
            messagebox.showwarning("No valid files", "All files are oversized (>50MB).")
            return

        model = self._model_var.get()
        collection = self._collection_var.get()
        dry_run = self._dry_run_var.get()
        cost = MODEL_COSTS.get(model, 0.22)
        est = len(pdfs) * cost

        confirm_msg = (
            f"{len(pdfs)} PDFs  ·  {sum(file_size_mb(p) for p in pdfs):.1f} MB\n"
            f"Collection: {collection}\n"
            f"Model: {model}\n"
            f"Est. cost: ~${est:.2f}\n\n"
            + ("⚠ DRY RUN — no files will be uploaded." if dry_run else
               "Files will be uploaded and queued for V9 analysis.")
        )
        if not messagebox.askyesno("Confirm Upload", confirm_msg):
            return

        self._uploading = True
        self._upload_btn.config(state="disabled", bg=BG3, fg=TEXT_DIM)
        self._progress["value"] = 0
        self._progress["maximum"] = len(pdfs)

        self._log_write("─" * 60, "dim")
        self._log_write(f"✦  Starting V9 upload — {collection} / {model}", "gold")
        if dry_run:
            self._log_write("  DRY RUN — no files will be uploaded.", "blue")
        self._log_write("─" * 60, "dim")

        thread = threading.Thread(
            target=self._upload_worker,
            args=(pdfs, collection, model, dry_run),
            daemon=True,
        )
        thread.start()

    def _upload_worker(self, pdfs: list[Path], collection: str, model: str, dry_run: bool):
        msg = self._upload_queue.put

        try:
            if not dry_run:
                msg(("status", "Connecting to Firebase…"))
                init_firebase()
                msg(("status", "Connected ✓"))
        except Exception as e:
            msg(("log", f"✗ Firebase connection failed: {e}", "red"))
            msg(("done", None))
            return

        results = []
        for i, pdf in enumerate(pdfs):
            if dry_run:
                msg(("log", f"  [dry-run] Would upload: {pdf.name}", "dim"))
                msg(("progress", i + 1))
                results.append({"filename": pdf.name, "status": "dry_run"})
                continue

            msg(("status", f"Uploading {i+1}/{len(pdfs)}  {pdf.name[:40]}"))
            try:
                result = upload_pdf(pdf, collection, model=model)
                result["filename"] = pdf.name
                result["status"] = "queued"
                results.append(result)
                msg(("log", f"  ✓  {pdf.name}", "green"))
                msg(("progress", i + 1))
            except Exception as e:
                results.append({"filename": pdf.name, "status": "error", "error": str(e)})
                msg(("log", f"  ✗  {pdf.name}  —  {e}", "red"))
                msg(("progress", i + 1))

        # Summary
        queued  = sum(1 for r in results if r["status"] == "queued")
        dry     = sum(1 for r in results if r["status"] == "dry_run")
        errors  = sum(1 for r in results if r["status"] == "error")

        msg(("log", "─" * 60, "dim"))
        if dry_run:
            msg(("log", f"✓ Dry run complete — {dry} files previewed", "blue"))
        else:
            msg(("log", f"✓  {queued} queued   ✗  {errors} failed", "gold"))
            msg(("log", "VPS daemon will pick up queued scripts automatically.", "dim"))
            msg(("log", "Results appear in the Lemon Dashboard as they complete.", "dim"))

            # Save JSON log
            if self._folder:
                try:
                    log_path = self._folder / f".lemon_ingest_{uuid.uuid4().hex[:8]}.json"
                    with open(log_path, "w") as f:
                        json.dump(results, f, indent=2, default=str)
                    msg(("log", f"Log saved: {log_path}", "dim"))
                except Exception:
                    pass

        msg(("status", "Done ✓"))
        msg(("done", None))

    def _poll_queue(self):
        try:
            while True:
                item = self._upload_queue.get_nowait()
                kind = item[0]
                if kind == "log":
                    _, text, *rest = item
                    tag = rest[0] if rest else ""
                    self._log_write(text, tag)
                elif kind == "progress":
                    self._progress["value"] = item[1]
                elif kind == "status":
                    self._status_label.config(text=item[1])
                elif kind == "done":
                    self._uploading = False
                    self._upload_btn.config(state="normal", bg=GOLD, fg="#111111")
        except queue.Empty:
            pass
        self.after(80, self._poll_queue)


# ══════════════════════════════════════════════════════════════════════════════
# Entry point
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    app = MushroomApp()
    app.mainloop()
