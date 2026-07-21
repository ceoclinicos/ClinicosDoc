#!/usr/bin/env python3
"""
Construye un AAB firmado de ClinicosDoc para Google Play.

Gradle firma el bundle usando keystore.properties en la raíz del proyecto.

Uso:
    python build_signed_aab.py
    python build_signed_aab.py --verify
    python build_signed_aab.py --build-only
"""

import argparse
import os
import platform
import shutil
import subprocess
import sys
import traceback
from configparser import ConfigParser
from pathlib import Path


def load_keystore_properties(project_root: Path) -> dict[str, str]:
    props_file = project_root / "keystore.properties"
    if not props_file.exists():
        return {}

    config = ConfigParser()
    config.read_string("[keystore]\n" + props_file.read_text(encoding="utf-8"))
    section = config["keystore"]
    return {
        "storeFile": section.get("storeFile", ""),
        "storePassword": section.get("storePassword", ""),
        "keyAlias": section.get("keyAlias", ""),
        "keyPassword": section.get("keyPassword", ""),
    }


class AABBuilder:
    def __init__(self, project_root: Path | None = None):
        self.project_root = project_root or Path(__file__).parent
        self.gradle_path = self._resolve_gradle()

    def _resolve_gradle(self) -> str | None:
        gradlew = self.project_root / ("gradlew.bat" if os.name == "nt" else "gradlew")
        if gradlew.exists():
            return str(gradlew)
        return shutil.which("gradle")

    def check_requirements(self) -> bool:
        errors: list[str] = []

        if not self.gradle_path:
            errors.append("[ERROR] No se encontró gradlew ni Gradle en el PATH.")

        build_gradle = self.project_root / "app" / "build.gradle.kts"
        if not build_gradle.exists() and not (self.project_root / "app" / "build.gradle").exists():
            errors.append("[ERROR] No se encontró app/build.gradle(.kts).")

        keystore = load_keystore_properties(self.project_root)
        if not keystore.get("storeFile"):
            errors.append("[ERROR] Falta keystore.properties en la raíz del proyecto.")
        elif not Path(keystore["storeFile"]).exists():
            errors.append(f"[ERROR] Keystore no encontrado: {keystore['storeFile']}")

        if errors:
            for error in errors:
                print(error)
            return False

        print("[OK] Requisitos listos")
        print(f"     Keystore: {keystore['storeFile']}")
        print(f"     Alias: {keystore.get('keyAlias', '(sin alias)')}")
        return True

    def build_aab(self, variant: str = "release") -> bool:
        print(f"\n[BUILD] Construyendo AAB ({variant})...")

        cmd = [self.gradle_path, f"bundle{variant.capitalize()}", "--stacktrace"]
        print(f"[INFO] Ejecutando: {' '.join(cmd)}")

        try:
            subprocess.run(cmd, cwd=self.project_root, check=True)
            print("\n[OK] AAB construido y firmado por Gradle")
            return True
        except subprocess.CalledProcessError as exc:
            print(f"\n[ERROR] Falló el build (código {exc.returncode})")
            return False

    def find_aab_file(self, variant: str = "release") -> Path | None:
        candidates = [
            self.project_root / "app" / "build" / "outputs" / "bundle" / variant / f"app-{variant}.aab",
            self.project_root / "app" / "build" / "outputs" / "bundle" / variant / "app.aab",
        ]

        for path in candidates:
            if path.exists():
                return path

        bundle_dir = self.project_root / "app" / "build" / "outputs" / "bundle"
        if bundle_dir.exists():
            aab_files = sorted(bundle_dir.rglob("*.aab"), key=lambda p: p.stat().st_mtime, reverse=True)
            if aab_files:
                return aab_files[0]

        return None

    def verify_signature(self, aab_path: Path) -> bool:
        print("\n[VERIFY] Verificando firma del AAB...")

        jarsigner = shutil.which("jarsigner")
        if not jarsigner:
            print("[WARN] jarsigner no encontrado; instala JDK para verificar.")
            return False

        cmd = [jarsigner, "-verify", "-verbose", "-certs", str(aab_path)]
        try:
            result = subprocess.run(cmd, check=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
            print("[OK] Firma verificada")
            if result.stdout:
                print(result.stdout)
            return True
        except subprocess.CalledProcessError as exc:
            print("[ERROR] La firma no es válida")
            if exc.stderr:
                print(exc.stderr)
            if exc.stdout:
                print(exc.stdout)
            return False

    def open_folder(self, file_path: Path) -> None:
        folder = file_path.parent
        system = platform.system()
        try:
            if system == "Windows":
                os.startfile(str(folder))
            elif system == "Darwin":
                subprocess.run(["open", str(folder)], check=False)
            else:
                subprocess.run(["xdg-open", str(folder)], check=False)
            print(f"[INFO] Carpeta abierta: {folder}")
        except OSError as exc:
            print(f"[WARN] No se pudo abrir la carpeta: {exc}")


def pause_before_exit(code: int = 0) -> None:
    if os.name == "nt":
        try:
            input("\n[PAUSA] Presiona Enter para salir...")
        except (EOFError, KeyboardInterrupt):
            pass
    sys.exit(code)


def main() -> None:
    parser = argparse.ArgumentParser(description="Construye AAB firmado de ClinicosDoc")
    parser.add_argument("--variant", default="release", help="Variante de build (default: release)")
    parser.add_argument("--build-only", action="store_true", help="Solo construir, sin verificar firma")
    parser.add_argument("--verify", action="store_true", help="Verificar firma al terminar")
    parser.add_argument("--project-dir", help="Raíz del proyecto Android")
    args = parser.parse_args()

    project_root = Path(args.project_dir) if args.project_dir else Path(__file__).parent
    builder = AABBuilder(project_root)

    if not builder.check_requirements():
        pause_before_exit(1)

    if not builder.build_aab(args.variant):
        pause_before_exit(1)

    aab_path = builder.find_aab_file(args.variant)
    if not aab_path:
        print("[ERROR] No se encontró el AAB en app/build/outputs/bundle/")
        pause_before_exit(1)

    print(f"[OK] AAB listo: {aab_path}")

    if args.verify and not args.build_only:
        if not builder.verify_signature(aab_path):
            pause_before_exit(1)

    print("\n[READY] Listo para subir a Google Play Console")
    builder.open_folder(aab_path)
    pause_before_exit(0)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[INTERRUPTED] Cancelado por el usuario")
        pause_before_exit(130)
    except Exception:
        print("\n[ERROR CRÍTICO]")
        traceback.print_exc()
        pause_before_exit(1)
