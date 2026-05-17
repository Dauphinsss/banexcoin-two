# BanexReintegra - Agent Guide

Este documento orienta a agentes de desarrollo que trabajan en el repositorio. No describe agentes funcionales del producto ni contiene implementaciones.

## Lectura Inicial

Antes de modificar código, revisar en este orden:

1. [README.md](../README.md): entrada del repositorio.
2. [ARCHITECTURE.md](ARCHITECTURE.md): estructura técnica y límites arquitectónicos.
3. [CONVENTIONS.md](CONVENTIONS.md): reglas para escribir código y documentación.
4. [BD.md](BD.md): modelo de datos y persistencia.
5. [FLOW.md](FLOW.md): flujo de producto y contexto de negocio.
6. [DESIGN.md](DESIGN.md): lenguaje visual y UX.

## Contexto Del Proyecto

BanexReintegra automatiza el cálculo de cashback mensual para Banexcoin Bolivia a partir de reportes Excel.

El sistema:

- Recibe archivos de reportes operativos.
- Detecta periodo y valida estructura.
- Calcula reintegros por niveles.
- Concilia pagos QR contra extractos.
- Explica anomalías con Cerebras si la integración está configurada.
- Persiste resultados auditables.
- Genera reportes descargables.

Límites importantes:

- No integra directamente con el core de Banexcoin.
- No ejecuta pagos reales.
- No debe filtrar PII ni datos financieros sensibles en logs o prompts.
- La explicación con IA debe usar resúmenes agregados, no filas completas del Excel.
- PostgreSQL es la base de datos objetivo.

## Estructura Del Repositorio

- `backend/`: API NestJS, Prisma, parser, procesamiento, conciliación y reportes.
- `frontend/`: Astro, React Islands y cliente HTTP.
- `packages/types/`: contratos compartidos.
- `packages/utils/`: lógica pura compartida y testeable.
- `docs/`: documentación técnica y de producto.

## Arquitectura A Respetar

- Backend modular monolítico.
- Módulos por feature.
- Controllers sin lógica de negocio.
- Services para casos de uso.
- Agents como servicios especializados cuando exista una responsabilidad clara.
- Prisma aislado en backend.
- Lógica financiera compartible en `packages/utils`.
- Tipos compartidos en `packages/types`.

Nota:

- La parte funcional de agentes de procesamiento todavía no debe asumirse como implementada si no existe en código.
- No documentar BullMQ, workers o WebSocket como estado actual mientras no estén implementados.

## Métricas Y Reglas Financieras

- Dinero: siempre Decimal/string, nunca `number` para reglas de negocio.
- BOB: 2 decimales para presentación.
- USDT: 8 decimales para presentación.
- Tiers: vigentes por periodo.
- Uploads: idempotencia por hash.
- Escrituras financieras: transacción Prisma cuando afecten varias tablas.
- Lecturas de resultados: no recalcular si el dato ya está persistido.

## Verificación

No ejecutar Playwright salvo instrucción explícita mientras existan cambios de diseño pendientes.

Si se modifica backend:

- Ejecutar `bun run --cwd backend test`.
- Ejecutar `bun run --cwd backend typecheck` cuando el cambio afecte tipos o contratos.
- Ejecutar `bun run --cwd backend test:e2e` si cambia comportamiento HTTP o integración.

Si se modifica `packages/utils`:

- Ejecutar `bun run --cwd packages/utils test`.

Si solo se modifica documentación:

- No hace falta ejecutar tests.
- Revisar enlaces relativos y consistencia entre documentos.

## Convenciones Para Cambios

- Commits en inglés.
- No tocar código no relacionado con la tarea.
- No introducir snippets largos en documentación arquitectónica.
- No duplicar contenido entre documentos; enlazar al documento dueño.
- Si una decisión pertenece a base de datos, va en `BD.md`.
- Si una decisión pertenece a estilo o construcción de código, va en `CONVENTIONS.md`.
- Si una decisión pertenece a estructura del sistema, va en `ARCHITECTURE.md`.
- Si una decisión pertenece a UX/UI, va en `DESIGN.md`.

## Riesgos Frecuentes

- Mezclar documentación aspiracional con estado real.
- Duplicar reglas de negocio entre frontend y backend.
- Convertir `UploadsService` en un servicio demasiado grande.
- Usar `number` para dinero.
- Exponer contenido del Excel en logs, errores o prompts.
- Modificar schema sin revisar reportes, parser y conciliación.

## Estado Arquitectónico Relevante

- El procesamiento actual se orquesta desde `UploadsService`.
- `UploadsService` tiene demasiadas responsabilidades y debe refactorizarse más adelante.
- `TierAgent` y `ReconcileAgent` existen como servicios especializados.
- `AnomalyExplainerAgent` existe como integración opcional con Cerebras bajo demanda.
- La persistencia dedicada y un orquestador separado quedan pendientes.
- El frontend consume rutas implementadas desde `frontend/src/lib/api.ts`.
