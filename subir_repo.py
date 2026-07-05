#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sube el repositorio ClinicosDoc a GitHub (add + commit + push).
GitHub Actions despliega la web en clinicosdoc.com tras cada push a main.

Uso:
  python subir_repo.py
  python subir_repo.py "mensaje de commit personalizado"
  Doble clic en subir_repo.bat (Windows)
"""

from __future__ import annotations

import subprocess
import sys
from datetime import datetime
from pathlib import Path

# Archivos que nunca deben subirse (doble verificación)
BLOQUEADOS = {
    "local.properties",
    "ai_keys.properties",
    "web/.env",
    ".env",
}


def raiz_repo() -> Path:
    here = Path(__file__).resolve().parent
    r = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        cwd=here,
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        print("Error: no es un repositorio git.")
        sys.exit(1)
    return Path(r.stdout.strip())


def run(cmd: list[str], cwd: Path, check: bool = True) -> subprocess.CompletedProcess[str]:
    print(f"\n> {' '.join(cmd)}")
    r = subprocess.run(cmd, cwd=cwd, text=True, capture_output=True, encoding="utf-8", errors="replace")
    if r.stdout:
        print(r.stdout.rstrip())
    if r.stderr:
        print(r.stderr.rstrip())
    if check and r.returncode != 0:
        print(f"\nFalló (código {r.returncode}).")
        sys.exit(r.returncode)
    return r


def rama_actual(cwd: Path) -> str:
    r = run(["git", "branch", "--show-current"], cwd=cwd)
    return r.stdout.strip() or "main"


def archivos_bloqueados_en_stage(cwd: Path) -> list[str]:
    r = run(["git", "diff", "--cached", "--name-only"], cwd=cwd)
    staged = [l.strip() for l in r.stdout.splitlines() if l.strip()]
    malos = []
    for f in staged:
        norm = f.replace("\\", "/")
        base = Path(f).name
        if base in BLOQUEADOS or norm in BLOQUEADOS or norm.endswith("/ai_keys.properties"):
            malos.append(f)
    return malos


def main() -> None:
    cwd = raiz_repo()
    print("=" * 50)
    print("  ClinicosDoc — Subir a GitHub")
    print(f"  {cwd}")
    print("=" * 50)

    run(["git", "status", "--short"], cwd=cwd, check=False)

    branch = rama_actual(cwd)
    print(f"\nRama: {branch}")

    run(["git", "add", "-A"], cwd=cwd)

    bloqueados = archivos_bloqueados_en_stage(cwd)
    if bloqueados:
        print("\n[!] Se detectaron archivos sensibles en el stage. Abortando:")
        for f in bloqueados:
            print(f"  - {f}")
        run(["git", "reset", "HEAD"], cwd=cwd)
        sys.exit(1)

    diff = run(["git", "diff", "--cached", "--quiet"], cwd=cwd, check=False)
    if diff.returncode == 0:
        print("\nNo hay cambios para commitear.")
        print("Comprobando si hay commits locales sin subir…")
        run(["git", "push", "-u", "origin", branch], cwd=cwd, check=False)
        print("\nListo. Web: https://clinicosdoc.com")
        pausa()
        return

    if len(sys.argv) > 1:
        mensaje = " ".join(sys.argv[1:]).strip()
    else:
        ts = datetime.now().strftime("%Y-%m-%d %H:%M")
        mensaje = f"deploy: actualización {ts}"

    run(["git", "commit", "-m", mensaje], cwd=cwd)
    run(["git", "push", "-u", "origin", branch], cwd=cwd)

    print("\n" + "=" * 50)
    print("  OK - Subido a GitHub")
    print(f"  Commit: {mensaje}")
    print("  GitHub Actions desplegará la web en 1–3 min.")
    print("  https://clinicosdoc.com")
    print("  https://github.com/ceoclinicos/ClinicosDoc/actions")
    print("=" * 50)
    pausa()


def pausa() -> None:
    if sys.stdin.isatty():
        input("\nEnter para cerrar…")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nCancelado.")
        sys.exit(130)
