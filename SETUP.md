# BanexReintegra — Setup

> Guía paso a paso para levantar el sistema desde cero. Si esto no funciona en tu máquina, es un bug del documento — abre un issue.
>
> Tiempo estimado: **5 minutos** la primera vez. **30 segundos** las siguientes.

---

## Índice

1. [Prerrequisitos](#1-prerrequisitos)
2. [Clonar y entrar](#2-clonar-y-entrar)
3. [Variables de entorno](#3-variables-de-entorno)
4. [Instalar dependencias](#4-instalar-dependencias)
5. [Base de datos](#5-base-de-datos)
6. [Redis (opcional)](#6-redis-opcional)
7. [Arrancar en desarrollo](#7-arrancar-en-desarrollo)
8. [Verificar que funciona](#8-verificar-que-funciona)
9. [Cargar el Excel de prueba](#9-cargar-el-excel-de-prueba)
10. [Tests automatizados](#10-tests-automatizados)
11. [Comandos útiles del día a día](#11-comandos-útiles-del-día-a-día)
12. [Resetear el sistema](#12-resetear-el-sistema)
13. [Troubleshooting](#13-troubleshooting)
14. [Estructura del repo](#14-estructura-del-repo)

---

## 1. Prerrequisitos

### Obligatorios

| Herramienta | Versión mínima | Instalar |
|---|---|---|
| **Bun** | 1.1+ | <https://bun.sh> · Windows: `powershell -c "irm bun.sh/install.ps1 \| iex"` |
| **Git** | cualquiera reciente | <https://git-scm.com> |

### Opcional (solo si vas a usar BullMQ — F4 en adelante)

| Herramienta | Por qué |
|---|---|
| **Docker Desktop** | Levanta Redis local sin instalarlo manualmente |

### Verificar que están

```bash
bun --version       # debe imprimir 1.1.x o superior
git --version
docker --version    # solo si vas a usar Redis
```

---

## 2. Clonar y entrar

```bash
git clone <repo-url> banexcoin-two
cd banexcoin-two
```

Si ya estás aquí, sigue.

---

## 3. Variables de entorno

El proyecto tiene **tres** archivos de entorno. Hay que copiar los `.example` a `.env` en cada uno.

### Windows (PowerShell)

```powershell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

### Linux / macOS / Git Bash

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Qué contiene cada uno (resumen)

| Archivo | Para qué |
|---|---|
| `.env` (raíz) | Variables compartidas (DATABASE_URL, REDIS_URL, ANTHROPIC_API_KEY) |
| `backend/.env` | Configuración del API (CORS, host, límites, tesorería) |
| `frontend/.env` | URLs del API y del propio frontend |

**Importante:** los `.env` están en `.gitignore`. Nunca los commitees. Si necesitas compartir secrets con tu equipo, usa un canal seguro.

### Variables que conviene revisar

```bash
# backend/.env
PORT=3000                                 # puerto del API
CORS_ORIGIN=http://localhost:4321         # debe coincidir con la URL del frontend
MAX_UPLOAD_SIZE_MB=50                     # límite de tamaño de los Excel
UPLOAD_STORAGE_DIR=./data/uploads         # dónde se guardan los archivos subidos
RECONCILE_TOLERANCE_BOB=0.01              # tolerancia para anomalías AMOUNT_MISMATCH
TREASURY_ACCOUNT_NUMBER=10000             # cuenta origen del BanexTransfer

# frontend/.env
PUBLIC_API_URL=http://localhost:3000      # debe apuntar al backend
PUBLIC_APP_URL=http://localhost:4321      # opcional, para links autoreferentes
```

Para el hackathon los valores por defecto sirven.

---

## 4. Instalar dependencias

Desde la raíz del repo:

```bash
bun install
```

Esto:
- Instala todo el monorepo (backend, frontend, packages/types, packages/utils)
- Ejecuta `postinstall` que corre `prisma generate` automáticamente

**Tiempo:** ~30 segundos la primera vez, ~5 segundos en re-instalaciones.

Si ves errores raros al final, mira [Troubleshooting](#13-troubleshooting).

---

## 5. Base de datos

El proyecto usa **SQLite local** — no necesitas Postgres ni Docker para empezar. La DB vive en `backend/prisma/dev.db`, gitignored.

### Crear el schema

```bash
bun run db:push
```

Esto sincroniza el `schema.prisma` con un archivo SQLite nuevo. Si la DB ya existe, solo aplica los cambios.

**Resultado esperado:**
```
🚀  Your database is now in sync with your Prisma schema.
```

### Cargar datos iniciales

```bash
bun run db:seed
```

**Resultado esperado:**
```
Seed completado: 5 niveles cargados.
```

Esto inserta los 5 niveles de cashback (Básico, Bronce, Plata, Oro, Platino) que vienen de la ficha técnica de Banexcoin.

### Ver la DB en vivo

```bash
bun run db:studio
```

Abre Prisma Studio en <http://localhost:5555>. Útil para inspeccionar registros sin escribir SQL.

---

## 6. Redis (opcional)

**Solo lo necesitas cuando arranquemos F4 (BullMQ workers).** Por ahora puedes saltarte este paso.

Si quieres tenerlo listo:

```bash
bun run infra:up
```

Verificar que arrancó:
```bash
docker compose ps
# debe mostrar banex-redis healthy
```

Para apagarlo:
```bash
bun run infra:down
```

---

## 7. Arrancar en desarrollo

```bash
bun run dev
```

Esto levanta **backend** y **frontend** en paralelo gracias a Turborepo.

**Resultado esperado** en consola:

```
backend:dev:    Nest application successfully started
backend:dev:    Banex Reintegra API escuchando en http://0.0.0.0:3000
frontend:dev:   astro v4.x.x ready in 850 ms
frontend:dev:   Local    http://localhost:4321
```

URLs activas:
- API: <http://localhost:3000>
- Health: <http://localhost:3000/health>
- Frontend: <http://localhost:4321>

Para detener: `Ctrl + C` en la terminal.

---

## 8. Verificar que funciona

### Health check del API

```bash
curl http://localhost:3000/health
```

**Respuesta esperada:**
```json
{
  "status": "ok",
  "service": "banex-reintegra-api",
  "version": "0.1.0",
  "timestamp": "2026-05-16T12:34:56.789Z",
  "checks": {
    "database": { "status": "ok" }
  }
}
```

Si `database` viene en `error`, [revisa la sección 5](#5-base-de-datos).

### Frontend

Abre <http://localhost:4321> en el navegador. Debes ver:
- Sidebar con: Dashboard, Subir Excel, Reintegros, Conciliación, Niveles, Simulador
- Tarjeta principal con CTA "Subir reporte mensual →"
- Lista de estado de implementación (F0 ✓, F1 ✓, etc.)

---

## 9. Cargar el Excel de prueba

El archivo `Reportes Banexcoin Bolivia Hackaton 2026.xlsx` que vino con la ficha está en la raíz del repo.

### Paso a paso

1. Abre <http://localhost:4321/uploads/new>
2. Arrastra `Reportes Banexcoin Bolivia Hackaton 2026.xlsx` al dropzone (o haz clic en "Seleccionar archivo")
3. Espera ~2 segundos a que aparezca el preview

**Preview esperado:**
- Transacciones: **5,325**
- Usuarios únicos: **239**
- Período detectado: **2025-04** o **2025-05** (según donde caigan más filas)
- Tabla con las primeras 20 filas

4. Clic en "Procesar 5,325 transacciones"
5. Pantalla verde: "Archivo aceptado y encolado para procesamiento" + `uploadId`

### Verificar idempotencia

Vuelve a arrastrar el mismo archivo. Debe aparecer pantalla amarilla:
> "Este archivo ya fue procesado anteriormente"

Esto confirma que el hash SHA-256 detectó el duplicado. **Comportamiento correcto.**

### Verificar en DB

```bash
bun run db:studio
```

- Tabla `Upload`: una fila con `status: PENDING`, `fileHash` (64 chars hex), `fileSizeBytes`
- Tabla `CashbackTier`: 5 filas

### Verificar el archivo en disco

```bash
ls backend/data/uploads/
```

Verás un archivo `<hash-sha256>.xlsx`. Ese es el archivo persistido.

---

## 10. Tests automatizados

### Suite completa

```bash
bun run test
```

Ejecuta todos los tests del monorepo vía Turborepo.

### Solo lógica pura (rápido, sin DB)

```bash
bun run --cwd packages/utils test
```

**Resultado esperado:** 32 tests pasando.
- `tier-engine.test.ts` — 17 tests (asignación de niveles, promedio ponderado, fronteras, volumen)
- `money.test.ts` — 9 tests (precisión decimal, banker's rounding)
- `period.test.ts` — 6 tests (detección de período YYYY-MM)

### Solo backend

```bash
bun run --cwd backend test
```

**Resultado esperado:** 8 tests del parser pasando, incluyendo un benchmark de 1000 filas <2 segundos.

### En modo watch

```bash
bun run --cwd packages/utils test:watch
```

Re-ejecuta los tests cada vez que guardes un archivo.

---

## 11. Comandos útiles del día a día

### Desarrollo

| Comando | Hace |
|---|---|
| `bun run dev` | Backend + frontend en paralelo |
| `bun run build` | Build de producción de todo |
| `bun run typecheck` | Type-check sin emitir |
| `bun run lint` | ESLint en todos los workspaces |
| `bun run test` | Tests en todos los workspaces |

### Base de datos

| Comando | Hace |
|---|---|
| `bun run db:push` | Sincroniza schema → DB (sin migración formal) |
| `bun run db:migrate` | Crea una migración versionada |
| `bun run db:seed` | Carga datos iniciales (5 niveles) |
| `bun run db:studio` | Abre Prisma Studio en navegador |
| `bun run db:generate` | Regenera el cliente Prisma (raro que lo necesites) |

### Infra

| Comando | Hace |
|---|---|
| `bun run infra:up` | Levanta Redis con Docker |
| `bun run infra:down` | Apaga Redis |
| `bun run infra:logs` | Sigue los logs de Redis |

### Solo backend

```bash
cd backend
bun run dev            # solo el API (sin frontend)
bun run test           # solo tests del backend
```

### Solo frontend

```bash
cd frontend
bun run dev            # solo Astro
bun run build          # build estático
```

---

## 12. Resetear el sistema

Si quieres empezar de cero (DB nueva, archivos limpios):

```bash
# 1. Detén el dev server (Ctrl + C)

# 2. Borra la DB y los archivos subidos
# Windows
Remove-Item backend/prisma/dev.db -ErrorAction SilentlyContinue
Remove-Item backend/data/uploads -Recurse -ErrorAction SilentlyContinue

# Linux / macOS / Git Bash
rm -f backend/prisma/dev.db
rm -rf backend/data/uploads

# 3. Recrea
bun run db:push
bun run db:seed

# 4. Arranca de nuevo
bun run dev
```

---

## 13. Troubleshooting

### `Cannot find module '@banex/types'` o `@banex/utils`

Las dependencias del monorepo no se enlazaron. Solución:

```bash
bun install
```

Si persiste:
```bash
rm -rf node_modules backend/node_modules frontend/node_modules packages/*/node_modules
bun install
```

### `Cannot find module '@prisma/client'`

Falta generar el cliente Prisma:

```bash
bun run db:generate
```

### `PrismaClientInitializationError: Can't reach database`

La DB no existe o el `DATABASE_URL` está mal:

1. Revisa `backend/.env` → `DATABASE_URL` debe ser `file:./dev.db` (relativo a `backend/prisma/`)
2. Corre `bun run db:push` para crearla

### El frontend no se conecta al backend

CORS o URL mal configurada:

1. Revisa `backend/.env` → `CORS_ORIGIN=http://localhost:4321`
2. Revisa `frontend/.env` → `PUBLIC_API_URL=http://localhost:3000`
3. Recarga el frontend con `Ctrl + Shift + R`

### El dropzone no acepta mi archivo

- Extensión: solo `.xlsx` o `.xls`
- Tamaño máximo: 50 MB (configurable en `backend/.env`)
- Si arrastras desde Outlook/Drive, primero guárdalo en disco

### `409 DUPLICATE_UPLOAD` al subir

**Esto es comportamiento correcto.** El sistema detectó por hash SHA-256 que ya procesaste ese archivo. Si quieres reprocesarlo, primero borra el registro:

```bash
bun run db:studio
# borra la fila en Upload manualmente
# luego sube de nuevo
```

O resetea el sistema completo (sección 12).

### Tests fallan con `Cannot find module 'vitest'`

Solo en el backend:

```bash
bun install
# si persiste:
cd backend && bun add -d vitest
```

### El backend no arranca: `EADDRINUSE :::3000`

Otro proceso está usando el puerto 3000. Opciones:

```bash
# Windows: encontrar y matar
netstat -ano | findstr :3000
taskkill /PID <pid> /F

# O cambia el puerto en backend/.env
# PORT=3001
# y en frontend/.env también:
# PUBLIC_API_URL=http://localhost:3001
```

### En Windows: `bun install` falla con permisos

Ejecuta PowerShell como administrador y reintenta. O usa Windows Terminal con WSL.

### El Excel se sube pero queda en `PENDING` para siempre

**Esto es lo esperado en este momento del desarrollo.** F4 (workers BullMQ) todavía no está implementado. Cuando esté, el upload pasará a `PROCESSING` y luego a `DONE` automáticamente.

---

## 14. Estructura del repo

```
banexcoin-two/
├── README.md                # visión general
├── SETUP.md                 # este documento
├── FLOW.md                  # flujo end-to-end y estrategia de premios
├── FEATURES.md              # backlog descompuesto (F0...F10)
├── CONVENTIONS.md           # estándar de código bancario
├── PITCH.md                 # guion del pitch de 3 min
├── ARCHITECTURE.md          # detalles técnicos del monorepo
├── agents.md                # mapa de agentes backend
├── design.md                # sistema de diseño
├── SKILL.md                 # decisiones de stack
│
├── backend/                 # NestJS API
│   ├── prisma/
│   │   ├── schema.prisma    # modelo de datos
│   │   ├── seed.ts          # niveles iniciales
│   │   └── dev.db           # SQLite (gitignored)
│   ├── data/uploads/        # archivos subidos (gitignored)
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── prisma/          # PrismaService + Module global
│       ├── health/          # GET /health
│       ├── parser/          # ParseService (Pago QR + Extracto)
│       └── uploads/         # POST/GET /api/uploads
│
├── frontend/                # Astro + React Islands
│   └── src/
│       ├── pages/
│       │   ├── index.astro
│       │   └── uploads/new.astro
│       ├── islands/
│       │   └── upload/UploadDropzone.tsx
│       ├── layouts/AppShell.astro
│       └── lib/api.ts
│
├── packages/
│   ├── types/               # DTOs compartidos
│   │   └── src/             # UploadStatus, AnomalyType, etc.
│   └── utils/               # lógica pura testeada
│       └── src/
│           ├── tier-engine.ts    # núcleo del cashback
│           ├── money.ts          # decimal.js helpers
│           └── period.ts         # detección YYYY-MM
│
├── docker-compose.yml       # solo Redis (opcional)
├── turbo.json
├── package.json             # bun workspaces
└── Reportes Banexcoin Bolivia Hackaton 2026.xlsx   # Excel de prueba
```

---

## Qué probar la primera vez (checklist)

- [ ] `bun --version` imprime `1.1.x` o superior
- [ ] Los tres `.env` están copiados desde sus `.example`
- [ ] `bun install` terminó sin errores
- [ ] `bun run db:push` creó `backend/prisma/dev.db`
- [ ] `bun run db:seed` imprimió "5 niveles cargados"
- [ ] `bun run dev` arranca backend y frontend
- [ ] <http://localhost:3000/health> devuelve `status: ok`
- [ ] <http://localhost:4321> muestra el dashboard
- [ ] Subir el Excel de prueba → preview con 5.325 transacciones y 239 usuarios
- [ ] Subir el mismo Excel dos veces → pantalla amarilla de duplicado
- [ ] `bun run --cwd packages/utils test` → 32 tests pasan
- [ ] `bun run --cwd backend test` → 8 tests del parser pasan

Si todo lo anterior funcionó, el sistema está listo para que sigamos con **F2 Cálculo**.

---

## Soporte

Si algo no funciona y no está cubierto acá:

1. Relee la sección [13. Troubleshooting](#13-troubleshooting)
2. Verifica que estás en la rama correcta (`git status`)
3. Revisa que no haya cambios sin commit que rompan algo (`git diff`)
4. Como último recurso: [reset completo](#12-resetear-el-sistema)
