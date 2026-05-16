# BanexReintegra - Technical Notes

Este documento conserva notas técnicas de planificación. La fuente normativa de arquitectura es [ARCHITECTURE.md](ARCHITECTURE.md).

## Stack Actual

- Frontend: Astro + React Islands.
- Backend: NestJS + Prisma.
- Base de datos: PostgreSQL.
- Paquetes compartidos: Bun workspaces en `packages/types` y `packages/utils`.
- Tests backend y utilidades: Vitest.
- Tests frontend E2E: Playwright, solo cuando se indique explícitamente.

## Decisiones Prácticas

- Astro evita una SPA completa y permite hidratar solo islands interactivas.
- NestJS permite organizar el backend por módulos de feature.
- Prisma acelera persistencia y migraciones sobre PostgreSQL.
- `packages/utils` concentra lógica pura que debe reutilizarse o testearse aisladamente.
- `packages/types` evita contratos duplicados entre frontend y backend.

## Reglas De Trabajo

- No documentar features futuras como implementadas.
- Si se cambia persistencia, revisar [BD.md](BD.md).
- Si se cambia estructura de módulos, revisar [ARCHITECTURE.md](ARCHITECTURE.md).
- Si se cambia estilo de código o testing, revisar [CONVENTIONS.md](CONVENTIONS.md).
- Mantener commits en inglés.

## Pendientes Técnicos Relevantes

- Reducir responsabilidades de `UploadsService`.
- Separar persistencia masiva del flujo de upload.
- Endurecer validaciones de entorno para PostgreSQL.
- Mantener documentación sincronizada con rutas y módulos implementados.
