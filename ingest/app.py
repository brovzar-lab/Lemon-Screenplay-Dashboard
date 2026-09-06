#!/usr/bin/env python3
"""Small macOS launcher for the restart-safe Lemon folder uploader."""

from __future__ import annotations

import os
import shlex
import subprocess
import tempfile
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, ttk


PROJECT_DIR = Path(__file__).resolve().parent.parent
CLI_PYTHON = PROJECT_DIR / "ingest" / ".venv" / "bin" / "python"
CLI_SCRIPT = PROJECT_DIR / "ingest" / "lemon_ingest.py"
CATEGORIES = ("LEMON", "SUBMISSION", "BLKLST", "CONTEST", "OTHER")
MODELS = ("hybrid", "haiku", "sonnet", "opus")


def cli_command(folder: str, category: str, model: str, engine: str = "coverage_v1") -> list[str]:
    return [
        str(CLI_PYTHON),
        str(CLI_SCRIPT),
        "--folder",
        folder,
        "--category",
        category,
        "--model",
        model,
        "--engine",
        engine,
    ]


def open_terminal(folder: str, category: str, model: str, engine: str = "coverage_v1") -> None:
    with tempfile.NamedTemporaryFile("w", suffix=".command", delete=False) as launcher:
        launcher.write("#!/bin/bash\n")
        launcher.write(f"cd {shlex.quote(str(PROJECT_DIR))}\n")
        launcher.write(f"{shlex.join(cli_command(folder, category, model, engine))}\n")
        launcher.write("STATUS=$?\n")
        launcher.write('rm -f "$0"\n')
        launcher.write("exit $STATUS\n")
        path = launcher.name
    os.chmod(path, 0o700)
    subprocess.run(["open", "-a", "Terminal", path], check=True)


def main() -> None:
    if not CLI_PYTHON.is_file():
        raise SystemExit("Run pip install -r ingest/requirements.txt first.")

    root = tk.Tk()
    root.title("Lemon Batch Ingest")
    root.resizable(False, False)

    folder = tk.StringVar()
    category = tk.StringVar(value="LEMON")
    model = tk.StringVar(value="sonnet")
    engine = tk.StringVar(value="coverage_v1")

    frame = ttk.Frame(root, padding=20)
    frame.grid()
    ttk.Label(frame, text="Folder of screenplay PDFs").grid(row=0, column=0, sticky="w")
    ttk.Entry(frame, textvariable=folder, width=52).grid(row=1, column=0, columnspan=2, pady=(4, 14))

    def choose_folder() -> None:
        from tkinter import filedialog

        selected = filedialog.askdirectory(title="Choose the folder of screenplay PDFs")
        if selected:
            folder.set(selected)

    ttk.Button(frame, text="Choose folder", command=choose_folder).grid(row=2, column=0, sticky="w")
    ttk.Label(frame, text="Category").grid(row=3, column=0, sticky="w", pady=(16, 4))
    ttk.Label(frame, text="Model (Coverage uses Sonnet)").grid(row=3, column=1, sticky="w", pady=(16, 4))
    ttk.Combobox(frame, textvariable=category, values=CATEGORIES, state="readonly", width=22).grid(row=4, column=0, sticky="w")
    ttk.Combobox(frame, textvariable=model, values=MODELS, state="readonly", width=22).grid(row=4, column=1, sticky="w")
    ttk.Label(frame, text="Engine (V9 is the legacy fallback)").grid(row=5, column=0, sticky="w", pady=(12, 4))
    ttk.Combobox(frame, textvariable=engine, values=("coverage_v1", "v9"), state="readonly", width=22).grid(row=5, column=1, sticky="w")

    def start() -> None:
        if not Path(folder.get()).is_dir():
            messagebox.showerror("Choose a folder", "Choose the folder that contains the screenplay PDFs.")
            return
        try:
            open_terminal(folder.get(), category.get(), "sonnet" if engine.get() == "coverage_v1" else model.get(), engine.get())
        except (OSError, subprocess.CalledProcessError) as error:
            messagebox.showerror("Could not open Lemon Ingest", str(error))
            return
        root.destroy()

    ttk.Button(frame, text="Review folder in Terminal", command=start).grid(row=6, column=0, columnspan=2, pady=(22, 0))
    root.mainloop()


if __name__ == "__main__":
    main()
