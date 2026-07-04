# Clínicos Doc — Web

Versión web **ligera** del proyecto Android. Misma lógica de negocio, sin framework pesado.

## Stack

| Pieza | Elección | Motivo |
|-------|----------|--------|
| Build | [Vite](https://vitejs.dev) | Arranque rápido, bundle pequeño |
| UI | TypeScript + DOM | Sin React/Vue (~0 KB de framework) |
| Datos locales | `localStorage` | Equivalente a SharedPreferences |
| Nube (futuro) | Firebase JS modular | Mismas rutas que `FirestorePaths.kt` |
| IA (futuro) | API REST / Gemini | Misma lógica que `DocumentAiService.kt` |

## Inicio rápido

```bash
cd web
npm install
npm run dev
```

Abre `http://localhost:5173`

## Estructura

```
web/src/
  app/           # Shell, router hash (#/)
  pages/         # Pantallas (home, pacientes, informes, borradores, redactar, plantillas)
  services/      # local-store, document-parser
  shared/        # models, firestore paths, defaults (espejo de Android)
  styles/        # CSS con tokens Navy/Teal
```

## Pantallas incluidas (scaffold)

- Home, Pacientes, Informes, Borradores
- Redactar (demo — guarda borrador local)
- Plantillas: catálogo examen físico **editable**, encabezados/plantillas (stub)
- Navegación inferior en móvil, superior en escritorio

## Próximos pasos sugeridos

1. **`services/ai/`** — portar prompts de `DocumentAiService.kt` + `PhysicalExamPromptBuilder.kt`
2. **`services/sync/`** — Firebase Auth + Firestore (`clinicosdoc_user/{uid}/...`)
3. **Web Speech API** — dictado por voz en el navegador
4. **PDF** — `jspdf` o llamada a API server-side
5. **PWA** — `manifest.json` + service worker para uso offline

## Variables de entorno

Copia `.env.example` → `.env` y completa las claves Firebase/IA cuando las conectes.

## Build producción

```bash
npm run build
```

Salida en `web/dist/` — despliega en Firebase Hosting, Netlify o cualquier estático.
