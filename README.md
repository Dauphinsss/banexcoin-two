# BanexReintegra

Sistema de cashback automatizado para Banexcoin Bolivia.

> **Documentos guía** (en este orden, antes de tocar código):
> 1. [FLOW.md](FLOW.md) — qué se construye y por qué (estrategia y demo)
> 2. [FEATURES.md](FEATURES.md) — backlog descompuesto por etapas
> 3. [CONVENTIONS.md](CONVENTIONS.md) — estándar de código bancario
> 4. [PITCH.md](PITCH.md) — guion del pitch de 3 minutos
>
> Anexos técnicos: [ARCHITECTURE.md](ARCHITECTURE.md), [agents.md](agents.md), [design.md](design.md), [SKILL.md](SKILL.md).

---

## Stack

- **Frontend:** Astro 4 + React Islands + Tailwind v4
- **Backend:** NestJS + Prisma + BullMQ
- **Base de datos:** SQLite local con Prisma
- **Cola:** Redis 7
- **Monorepo:** Bun workspaces + Turborepo
- **Precisión decimal:** `decimal.js` + `Decimal` en Prisma

---

## Arrancar el proyecto

### 1. Requisitos

- [Bun](https://bun.sh) >= 1.1
- [Docker](https://www.docker.com/) opcional, solo si se usa Redis local con BullMQ
- Node 20+ (Bun ya lo cubre)

### 2. Variables de entorno

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 3. Dependencias

```bash
bun install             # instala todo el monorepo
```

### 4. Base de datos

```bash
bun run db:push         # crea/sincroniza backend/prisma/dev.db
bun run db:seed         # carga los 5 niveles de cashback iniciales
```

### 5. Infraestructura local opcional

```bash
bun run infra:up        # levanta Redis en Docker si usas BullMQ
```

### 6. Desarrollo

```bash
bun run dev             # arranca backend y frontend en paralelo
```

- API: <http://localhost:3000>
- Health check: <http://localhost:3000/health>
- Frontend: <http://localhost:4321>

---

## Estructura

```
banexcoin-two/
├── backend/             # NestJS + Prisma
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── prisma/      # PrismaModule + PrismaService
│       ├── health/      # GET /health
│       ├── app.module.ts
│       └── main.ts
├── frontend/            # Astro + React Islands
├── packages/
│   ├── types/           # DTOs compartidos front ↔ back
│   └── utils/           # tier-engine puro + money helpers + tests
├── docker-compose.yml
├── turbo.json
└── package.json         # bun workspaces
```

---

## Scripts útiles (raíz)

| Script | Hace |
|---|---|
| `bun run dev` | Backend + frontend en paralelo |
| `bun run build` | Build de todo el monorepo |
| `bun run test` | Tests en todos los workspaces |
| `bun run typecheck` | Type-check en todos los workspaces |
| `bun run infra:up` | Redis con Docker para BullMQ |
| `bun run infra:down` | Apaga la infra |
| `bun run db:push` | Aplica schema Prisma a SQLite |
| `bun run db:seed` | Carga niveles de cashback iniciales |
| `bun run db:studio` | Abre Prisma Studio en navegador |

---

## Cimientos terminados (F0)

- ✅ **F0.1** Monorepo Bun + Turborepo con workspaces.
- ✅ **F0.2** SQLite local para datos y Docker Compose opcional para Redis 7.
- ✅ **F0.3** Prisma schema completo (User, Upload, QRTransaction, CashbackTier, MonthlyRebate, Anomaly, ParseError) con `Decimal` en todos los montos.
- ✅ **F0.4** `tier-engine` puro en `packages/utils` con tests Vitest (asignación de niveles, promedio ponderado, casos borde, volumen 5.000 filas).

**Siguiente etapa:** [F1 Ingesta](FEATURES.md#f1--ingesta) — upload, parser, idempotencia.
