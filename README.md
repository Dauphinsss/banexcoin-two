# BanexReintegra

Sistema de cashback automatizado para Banexcoin Bolivia.

> **¿Quieres arrancar el sistema ya?** → [docs/SETUP.md](docs/SETUP.md)
>
> **Documentos guía** (en este orden, antes de tocar código):
> 1. [FLOW.md](docs/FLOW.md) — qué se construye y por qué (estrategia y demo)
> 2. [FEATURES.md](docs/FEATURES.md) — backlog descompuesto por etapas
> 3. [CONVENTIONS.md](docs/CONVENTIONS.md) — estándar de código bancario
> 4. [PITCH.md](docs/PITCH.md) — guion del pitch de 3 minutos
>
> Anexos técnicos: [ARCHITECTURE.md](docs/ARCHITECTURE.md), [BD.md](docs/BD.md), [AGENTS.md](docs/AGENTS.md), [DESIGN.md](docs/DESIGN.md), [SKILL.md](docs/SKILL.md).

---

## Stack

- **Frontend:** Astro 4 + React Islands + Tailwind v4
- **Backend:** NestJS + Prisma
- **Base de datos:** PostgreSQL con Prisma
- **Procesamiento:** síncrono en backend actualmente; separación interna pendiente
- **Monorepo:** Bun workspaces + Turborepo
- **Precisión decimal:** `decimal.js` + `Decimal` en Prisma

---

## Arrancar el proyecto

### 1. Requisitos

- [Bun](https://bun.sh) >= 1.1
- [Docker](https://www.docker.com/) opcional para infraestructura local futura
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
bun run infra:up        # levanta infraestructura local opcional
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
├── docs/                 # Documentación técnica y de producto
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
| `bun run infra:up` | Infraestructura local opcional |
| `bun run infra:down` | Apaga la infra |
| `bun run db:push` | Aplica schema Prisma a PostgreSQL |
| `bun run db:seed` | Carga niveles de cashback iniciales |
| `bun run db:studio` | Abre Prisma Studio en navegador |

---

## Cimientos terminados (F0)

- ✅ **F0.1** Monorepo Bun + Turborepo con workspaces.
- ✅ **F0.2** PostgreSQL para datos y Docker Compose opcional para infraestructura local.
- ✅ **F0.3** Prisma schema completo (User, Upload, QRTransaction, CashbackTier, MonthlyRebate, Anomaly, ParseError) con `Decimal` en todos los montos.
- ✅ **F0.4** `tier-engine` puro en `packages/utils` con tests Vitest (asignación de niveles, T/C histórico auditado, casos borde, volumen 5.000 filas).

**Siguiente etapa:** [F1 Ingesta](docs/FEATURES.md#f1--ingesta) — upload, parser, idempotencia.
