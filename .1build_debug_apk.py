#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para construir APK Debug de ClinicosDoc.
Ejecuta gradlew assembleDebug, muestra el progreso y envía el APK a Telegram.
Por defecto compila UNA sola vez y termina (sin bucle infinito).
"""

import argparse
import subprocess
import sys
import os
import time
import requests
import threading
import platform
from pathlib import Path
from datetime import datetime

# --- Configuración de Telegram ---
TELEGRAM_TOKEN = '7947569013:AAGMWlOx3Ot6OhRRcvlrHxtq5c0IEdc5u9g'
TELEGRAM_CHAT_ID = '1076543246'
TELEGRAM_API_URL = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}"

# Evita compilaciones simultáneas (consola + Telegram)
_build_lock = threading.Lock()
_build_in_progress = False


def print_header():
    """Imprime el encabezado del script"""
    print("=" * 60)
    print("  🚀 CONSTRUYENDO APK DEBUG - CLINICOSDOC")
    print("=" * 60)
    print()


def check_gradlew_exists():
    """Verifica que el archivo gradlew.bat existe"""
    gradlew_path = Path("gradlew.bat")
    if not gradlew_path.exists():
        print("❌ ERROR: No se encontró gradlew.bat en el directorio actual")
        print(f"   Directorio actual: {os.getcwd()}")
        print("   Asegúrate de ejecutar este script desde la raíz del proyecto")
        return False
    return True


def build_apk():
    """Ejecuta el comando para construir el APK"""
    global _build_in_progress

    if not _build_lock.acquire(blocking=False):
        print("⚠️  Ya hay una compilación en curso. Espera a que termine.")
        return False

    _build_in_progress = True
    print("📦 Iniciando construcción del APK Debug...")
    print(f"   Directorio de trabajo: {os.getcwd()}")
    print("   Comando: .\\gradlew.bat assembleDebug --no-daemon")
    print()

    try:
        if sys.platform == "win32":
            command = ".\\gradlew.bat assembleDebug --no-daemon"
        else:
            command = "./gradlew assembleDebug --no-daemon"

        print(f"Ejecutando: {command}")
        print("-" * 60)

        process = subprocess.Popen(
            command,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
            cwd=os.getcwd(),
        )

        output_lines = []
        for line in process.stdout:
            output_lines.append(line)
            print(line, end='', flush=True)

        return_code = process.wait()
        full_output = "".join(output_lines)
        apk_path = Path("app/build/outputs/apk/debug/app-debug.apk")
        build_ok = (
            return_code == 0
            or (
                "BUILD SUCCESSFUL" in full_output
                and apk_path.exists()
            )
        )

        print("-" * 60)
        print(f"Código de salida: {return_code}")

        if return_code != 0 and build_ok:
            print(
                "\n⚠️  Gradle devolvió código distinto de 0, "
                "pero el APK se generó correctamente (BUILD SUCCESSFUL)."
            )

        if not build_ok:
            print("\n❌ ERROR EN LA CONSTRUCCIÓN")
            print("Últimas líneas del output:")
            for line in output_lines[-20:]:
                print(line, end='')

        return build_ok

    except FileNotFoundError:
        print("❌ ERROR: No se encontró gradlew.bat")
        print("   Asegúrate de estar en el directorio raíz del proyecto Android")
        return False
    except KeyboardInterrupt:
        print("\n\n⚠️  Construcción cancelada por el usuario")
        return False
    except Exception as e:
        print(f"\n❌ ERROR inesperado: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        _build_in_progress = False
        _build_lock.release()


def open_folder(path):
    """Abre la carpeta que contiene el archivo en el explorador del sistema"""
    try:
        folder_path = path.parent if isinstance(path, Path) else Path(path).parent

        system = platform.system()
        if system == "Windows":
            os.startfile(str(folder_path))
        elif system == "Darwin":
            subprocess.run(["open", str(folder_path)])
        else:
            subprocess.run(["xdg-open", str(folder_path)])

        print(f"📂 Carpeta abierta: {folder_path}")
        return True
    except Exception as e:
        print(f"⚠️  No se pudo abrir la carpeta: {e}")
        return False


def find_apk(open_dir=True):
    """Busca el APK generado y muestra su información"""
    apk_path = Path("app/build/outputs/apk/debug/app-debug.apk")

    if apk_path.exists():
        size_mb = apk_path.stat().st_size / (1024 * 1024)
        print()
        print("=" * 60)
        print("  ✅ APK DEBUG GENERADO EXITOSAMENTE")
        print("=" * 60)
        print(f"📁 Ubicación: {apk_path.absolute()}")
        print(f"📦 Tamaño: {size_mb:.2f} MB")
        print()
        print("💡 Puedes instalar este APK en tu dispositivo Android")
        print("=" * 60)

        if open_dir:
            print()
            print("📂 Abriendo carpeta del APK...")
            open_folder(apk_path)

        return apk_path

    print()
    print("⚠️  ADVERTENCIA: No se encontró el APK en la ubicación esperada")
    print(f"   Buscado en: {apk_path.absolute()}")

    possible_paths = [
        Path("app-debug.apk"),
        Path("app/build/outputs/apk/app-debug.apk"),
        Path("build/outputs/apk/debug/app-debug.apk"),
    ]

    for path in possible_paths:
        if path.exists():
            print(f"   ✅ Encontrado en: {path.absolute()}")
            if open_dir:
                print()
                print("📂 Abriendo carpeta del APK...")
                open_folder(path)
            return path

    return None


def get_telegram_updates(offset=0, timeout=1):
    """Obtiene actualizaciones (mensajes) de Telegram"""
    try:
        url = f"{TELEGRAM_API_URL}/getUpdates"
        params = {
            'offset': offset,
            'timeout': timeout,
            'allowed_updates': ['message'],
        }

        response = requests.get(url, params=params, timeout=timeout + 5)

        if response.status_code == 200:
            result = response.json()
            if result.get('ok'):
                return result.get('result', [])
        else:
            print(f"⚠️  Error al obtener actualizaciones: {response.status_code}")
            return []
    except Exception as e:
        print(f"⚠️  Error al obtener actualizaciones: {e}")
        return []

    return []


def discard_pending_telegram_updates():
    """Marca como leídos los mensajes pendientes para no reprocesarlos al iniciar."""
    try:
        updates = get_telegram_updates(offset=0, timeout=0)
        if not updates:
            return 0
        last_id = max(update.get('update_id', 0) for update in updates)
        get_telegram_updates(offset=last_id + 1, timeout=0)
        print(f"📭 {len(updates)} mensaje(s) antiguo(s) de Telegram descartado(s)")
        return last_id
    except Exception as e:
        print(f"⚠️  No se pudieron descartar mensajes de Telegram: {e}")
        return 0


def process_telegram_message(message, build_queue):
    """Procesa un mensaje recibido de Telegram"""
    try:
        chat = message.get('chat', {})
        from_user = message.get('from', {})
        text = (message.get('text') or '').strip()
        date = message.get('date', 0)

        msg_date = datetime.fromtimestamp(date).strftime('%Y-%m-%d %H:%M:%S')

        username = from_user.get('username', '')
        first_name = from_user.get('first_name', '')
        user_display = f"@{username}" if username else first_name or "Usuario desconocido"

        chat_id = str(chat.get('id', ''))
        if chat_id != TELEGRAM_CHAT_ID:
            return False

        print()
        print("=" * 60)
        print("📨 MENSAJE RECIBIDO DE TELEGRAM")
        print("=" * 60)
        print(f"👤 De: {user_display}")
        print(f"📅 Fecha: {msg_date}")
        print(f"💬 Mensaje: {text}")
        print("=" * 60)
        print()

        if text.startswith('/'):
            process_command(text.lower(), user_display, build_queue)
        return True
    except Exception as e:
        print(f"⚠️  Error al procesar mensaje: {e}")
        return False


def process_command(command, user, build_queue):
    """Procesa comandos especiales recibidos"""
    print(f"🔧 Comando recibido de {user}: {command}")

    if command == '/status':
        estado = "Compilando..." if _build_in_progress else "En espera"
        print(f"✅ Script en ejecución - Estado: {estado}")
    elif command == '/help':
        print("📋 Comandos disponibles:")
        print("   /status - Ver estado del script")
        print("   /help - Mostrar esta ayuda")
        print("   /build - Encolar una compilación (solo si usas --loop)")
    elif command == '/build':
        if build_queue is not None:
            build_queue.append(True)
            print("📥 Compilación encolada (se ejecutará al terminar la espera actual)")
        else:
            print("ℹ️  El script no está en modo bucle. Ejecútalo de nuevo para compilar.")
    else:
        print(f"❓ Comando desconocido: {command}")
        print("   Usa /help para ver comandos disponibles")


def listen_telegram_messages(stop_event, initial_offset, build_queue):
    """Escucha mensajes de Telegram en un hilo separado"""
    last_update_id = initial_offset

    print("👂 Iniciando escucha de mensajes de Telegram...")
    print("   (Solo informativo; no dispara compilaciones automáticas)")
    print()

    while not stop_event.is_set():
        try:
            updates = get_telegram_updates(offset=last_update_id + 1, timeout=10)

            for update in updates:
                update_id = update.get('update_id', 0)
                last_update_id = max(last_update_id, update_id)

                if 'message' in update:
                    process_telegram_message(update['message'], build_queue)

            time.sleep(1)

        except KeyboardInterrupt:
            print("\n👂 Escucha de mensajes detenida por el usuario")
            stop_event.set()
            break
        except Exception as e:
            print(f"⚠️  Error en escucha de mensajes: {e}")
            time.sleep(5)


def start_telegram_listener(initial_offset, build_queue=None):
    """Inicia el listener de Telegram en un hilo separado"""
    stop_event = threading.Event()
    listener_thread = threading.Thread(
        target=listen_telegram_messages,
        args=(stop_event, initial_offset, build_queue),
        daemon=True,
        name="TelegramListener",
    )
    listener_thread.start()
    return stop_event, listener_thread


def send_apk_to_telegram(apk_path):
    """Envía el APK a Telegram"""
    if not apk_path or not apk_path.exists():
        print("❌ No se puede enviar: APK no encontrado")
        return False

    print()
    print("=" * 60)
    print("  📤 ENVIANDO APK A TELEGRAM")
    print("=" * 60)

    try:
        file_size = apk_path.stat().st_size
        size_mb = file_size / (1024 * 1024)
        max_size = 50 * 1024 * 1024

        if file_size > max_size:
            print(f"❌ ERROR: El archivo es demasiado grande ({size_mb:.2f} MB)")
            print("   Telegram tiene un límite de 50MB por archivo")
            return False

        print(f"📦 Archivo: {apk_path.name}")
        print(f"📊 Tamaño: {size_mb:.2f} MB")
        print("🔄 Conectando con Telegram...")

        url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendDocument"
        timeout = max(300, int(size_mb * 10))

        with open(apk_path, 'rb') as file:
            files = {'document': (apk_path.name, file)}
            data = {'chat_id': TELEGRAM_CHAT_ID}

            print("⬆️  Subiendo archivo...")
            response = requests.post(url, files=files, data=data, timeout=timeout)

        if response.status_code == 200:
            result = response.json()
            if result.get('ok'):
                print("✅ APK enviado exitosamente a Telegram!")
                print("=" * 60)
                return True
            error_msg = result.get('description', 'Error desconocido')
            print(f"❌ ERROR: No se pudo enviar el archivo: {error_msg}")
            print("=" * 60)
            return False

        print(f"❌ ERROR: Código de respuesta: {response.status_code}")
        print(f"   Respuesta: {response.text[:200]}")
        print("=" * 60)
        return False

    except requests.exceptions.Timeout:
        print("❌ ERROR: Tiempo de espera agotado")
        print("=" * 60)
        return False
    except requests.exceptions.RequestException as e:
        print(f"❌ ERROR de conexión: {e}")
        print("=" * 60)
        return False
    except Exception as e:
        print(f"❌ ERROR inesperado: {e}")
        print("=" * 60)
        return False


def check_telegram_connection():
    """Verifica la conexión con Telegram"""
    try:
        url = f"{TELEGRAM_API_URL}/getMe"
        response = requests.get(url, timeout=5)

        if response.status_code == 200:
            result = response.json()
            if result.get('ok'):
                bot_info = result.get('result', {})
                bot_name = bot_info.get('username', 'Desconocido')
                print(f"✅ Conexión con Telegram OK - Bot: @{bot_name}")
                return True

        print("⚠️  No se pudo verificar la conexión con Telegram")
        return False
    except Exception as e:
        print(f"⚠️  Error al verificar conexión con Telegram: {e}")
        return False


def run_build_cycle(send_telegram=True, open_dir=True):
    """Ejecuta un ciclo completo: compilar, localizar APK y enviar a Telegram."""
    success = build_apk()

    if not success:
        print()
        print("❌ ERROR: La construcción del APK falló")
        print("   Revisa los errores mostrados arriba")
        return False

    print()
    print("✅ Construcción completada")
    apk_path = find_apk(open_dir=open_dir)

    if apk_path and send_telegram:
        print()
        print("⏳ Esperando 5 segundos antes de enviar a Telegram...")
        for i in range(5, 0, -1):
            print(f"   {i}...", end='', flush=True)
            time.sleep(1)
        print()
        send_apk_to_telegram(apk_path)

    return True


def ask_yes_no(prompt, default_no=True):
    """Pregunta s/n. Por defecto NO para evitar bucles accidentales."""
    try:
        if not sys.stdin.isatty():
            return False
        suffix = " [s/N]: " if default_no else " [S/n]: "
        answer = input(prompt + suffix).strip().lower()
        if not answer:
            return not default_no
        return answer in ("s", "si", "sí", "y", "yes")
    except (KeyboardInterrupt, EOFError):
        return False


def parse_args():
    parser = argparse.ArgumentParser(
        description="Compila el APK debug de ClinicosDoc y lo envía a Telegram.",
    )
    parser.add_argument(
        "--auto",
        action="store_true",
        help="Compilar de inmediato sin pedir Enter (una sola vez).",
    )
    parser.add_argument(
        "--loop",
        action="store_true",
        help="Permitir varias compilaciones; pregunta explícitamente entre cada una.",
    )
    parser.add_argument(
        "--no-telegram",
        action="store_true",
        help="No enviar el APK a Telegram al terminar.",
    )
    parser.add_argument(
        "--no-open",
        action="store_true",
        help="No abrir la carpeta del APK al terminar.",
    )
    return parser.parse_args()


def main():
    """Función principal"""
    stop_event = None
    args = parse_args()

    try:
        script_dir = Path(__file__).parent.absolute()
        os.chdir(script_dir)

        if not check_gradlew_exists():
            input("\nPresiona Enter para salir...")
            sys.exit(1)

        print("🔍 Verificando conexión con Telegram...")
        telegram_ok = check_telegram_connection()

        initial_offset = 0
        if telegram_ok:
            initial_offset = discard_pending_telegram_updates()
            build_queue = [] if args.loop else None
            stop_event, _ = start_telegram_listener(initial_offset, build_queue)
            print()

        send_telegram = telegram_ok and not args.no_telegram
        open_dir = not args.no_open

        # Modo automático: una sola compilación y salir
        if args.auto:
            print_header()
            run_build_cycle(send_telegram=send_telegram, open_dir=open_dir)
        else:
            # Modo interactivo: por defecto UNA compilación
            while True:
                print_header()
                print(f"📂 Directorio de trabajo: {os.getcwd()}")
                print()
                print("=" * 60)
                print("Presiona Enter para construir el APK Debug")
                print("   (o escribe 'salir' para terminar)")
                print("=" * 60)

                try:
                    respuesta = input("\n> ").strip().lower()
                    if respuesta in ("salir", "s", "exit", "q", "quit"):
                        print("\n👋 ¡Hasta luego!")
                        break
                except (KeyboardInterrupt, EOFError):
                    print("\n\n👋 Saliendo...")
                    break

                print("\n🚀 Iniciando construcción del APK...\n")
                run_build_cycle(send_telegram=send_telegram, open_dir=open_dir)

                # Sin --loop: terminar tras la primera compilación
                if not args.loop:
                    print()
                    print("✅ Proceso finalizado. El script no volverá a compilar solo.")
                    break

                # Con --loop: preguntar explícitamente (no reiniciar con Enter vacío)
                print()
                if not ask_yes_no("¿Deseas compilar otra vez?", default_no=True):
                    print("\n👋 ¡Hasta luego!")
                    break
                print()

        if stop_event:
            print("\n🛑 Deteniendo escucha de mensajes...")
            stop_event.set()
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n\n⚠️  Script cancelado por el usuario")
        if stop_event:
            stop_event.set()
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ ERROR CRÍTICO: {e}")
        import traceback
        traceback.print_exc()
        input("\nPresiona Enter para salir...")
        sys.exit(1)


if __name__ == "__main__":
    main()
