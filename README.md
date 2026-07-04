# ClinicosDoc

Proyecto **independiente** de [CEO Clínicos / clinicos](https://github.com/ceoclinicos/ceoclinicos.github.io).

- **`app/`** — App Android (Kotlin + Compose)
- **`web/`** — Sitio web ligero (Vite + TypeScript)

## Repositorio en GitHub

Crear un repo **nuevo** (no mezclar con `ceoclinicos.github.io`):

| Campo | Valor sugerido |
|-------|----------------|
| Organización / cuenta | `ceoclinicos` |
| Nombre del repo | `ClinicosDoc` |
| Visibilidad | Public o Private |

## Subir por primera vez

```powershell
cd C:\Users\pc\AndroidStudioProjects\ClinicosDoc
git init
git add .
git status
git commit -m "Initial commit: ClinicosDoc Android + web"
git branch -M main
git remote add origin https://github.com/ceoclinicos/ClinicosDoc.git
git push -u origin main
```

**No subir:** `local.properties`, `ai_keys.properties`, `web/.env`, carpetas `build/` y `node_modules/`.

## Web en línea (GitHub Pages)

Tras el primer `push`:

1. Repo **ClinicosDoc** → **Settings** → **Pages**
2. **Build and deployment** → Source: **GitHub Actions**
3. El workflow `.github/workflows/deploy-web.yml` publica automáticamente en cada push a `main`

URL: **https://clinicosdoc.com** (también https://www.clinicosdoc.com)

URL anterior del proyecto en GitHub Pages: https://ceoclinicos.github.io/ClinicosDoc/

## Probar en local

```powershell
cd web
npm install
npm run dev
```

Abre http://localhost:5173/

## App Android

Abrir la carpeta raíz en Android Studio y ejecutar en emulador o dispositivo.
