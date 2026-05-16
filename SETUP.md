# BanexReintegra — Setup

Guía corta para levantar el proyecto y probarlo rápido.

## Requisitos

- `node` 22.12+
- `bun` 1.1+
- `git`
- `docker` solo si luego quieres Redis para BullMQ

## Variables de entorno

Windows:

```powershell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

macOS / Linux / Git Bash:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

## Instalar y preparar

```bash
bun install
bun run db:push
bun run db:seed
bun run --cwd packages/types build
bun run --cwd packages/utils build
```

Si alguien ya tenía una base local vieja, antes de eso conviene resetear:

```powershell
Remove-Item backend/prisma/dev.db -ErrorAction SilentlyContinue
Remove-Item backend/data/uploads -Recurse -ErrorAction SilentlyContinue
```

## Arrancar

```bash
bun run dev
```

Queda así:
- Backend: `http://localhost:3000`
- Health: `http://localhost:3000/health`
- Frontend: `http://localhost:4321`

## Qué está funcionando hoy

El proyecto ya permite probar un flujo útil:
- upload de Excel
- preview del archivo
- detección de período
- idempotencia por hash
- parseo de `Pago QR` y `EXTRACTO DE PAGOS`
- cálculo de tiers/rebates
- persistencia en SQLite
- conciliación de anomalías y panel
- reportes (Excel, BanexTransfer, Cuadre)
- editor de niveles con validación inline e historial (F7.1)
- simulador what-if con sliders por nivel y comparativa (F8.1)
- explicación de anomalías con Gemini (F9) — requiere `GEMINI_API_KEY`

Todavía no está listo:
- BullMQ y workers
- WebSocket de progreso
- F10 (animaciones, dark mode, pitch deck)

## Prueba rápida

1. Abre `http://localhost:4321/uploads/new`
2. Sube `Reportes Banexcoin Bolivia Hackaton 2026.xlsx`
3. Confirma el preview
4. Procesa el archivo

Resultado esperado:
- el upload termina en `DONE`
- se crean reintegros
- si subes el mismo archivo otra vez, aparece como duplicado

## Verificación útil

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/tiers
curl http://localhost:3000/api/uploads
```

También puedes abrir:

```bash
bun run db:studio
```

## Tests

```bash
bun run --cwd backend test
bun run --cwd backend test:e2e
bun run --cwd packages/utils test
bun run --cwd frontend test:e2e
```

## Reset rápido

```powershell
Remove-Item backend/prisma/dev.db -ErrorAction SilentlyContinue
Remove-Item backend/data/uploads -Recurse -ErrorAction SilentlyContinue
bun run db:push
bun run db:seed
```

## Problemas comunes

`DATABASE_URL` no encontrado:
- copia `backend/.env.example` a `backend/.env`

`@prisma/client did not initialize yet`:
- corre `bun run db:generate`

Puerto `3000` ocupado:
- mata el proceso o cambia `PORT` en `backend/.env`

Frontend no conecta al backend:
- revisa `CORS_ORIGIN=http://localhost:4321`
- revisa `PUBLIC_API_URL=http://localhost:3000`
