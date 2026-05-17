# BanexReintegra - Architecture

Este documento define la arquitectura técnica del repositorio. No describe el modelo de datos en detalle, no contiene implementaciones y no reemplaza las convenciones de código.

Documentos relacionados:

- [BD.md](BD.md): modelo de datos, entidades, relaciones y criterios de persistencia.
- [CONVENTIONS.md](CONVENTIONS.md): reglas para escribir código nuevo respetando la arquitectura.
- [AGENTS.md](AGENTS.md): contexto operativo para agentes de desarrollo.
- [DESIGN.md](DESIGN.md): criterios visuales y experiencia de usuario.
- [FLOW.md](FLOW.md): historia del producto y flujo end-to-end.

## Estilos Arquitectónicos

BanexReintegra combina estos estilos:

- Monorepo modular con workspaces de Bun.
- Backend modular monolítico con NestJS.
- Arquitectura por capas ligera en backend.
- Frontend Astro con React Islands.
- Dominio compartido parcial mediante paquetes internos.
- Persistencia relacional con PostgreSQL y Prisma.

No es una arquitectura de microservicios. Los módulos separan responsabilidades dentro de un mismo backend desplegable.

## C4 Nivel 1 - Contexto

BanexReintegra es una aplicación independiente para procesar reportes de Banexcoin Bolivia y calcular reintegros mensuales.

Actores principales:

- Operador: carga archivos, revisa resultados y descarga reportes.
- Auditor: consulta trazabilidad, anomalías y reportes generados.
- Sistema Banexcoin: sistema externo donde se usa el archivo operativo generado; no se integra directamente desde esta aplicación.

Sistemas externos:

- PostgreSQL: persistencia principal.
- Gemini API: explicación opcional de anomalías, solo si está configurada.
- Archivos Excel de entrada: fuente operativa del proceso mensual.

Límites del sistema:

- La aplicación no modifica el core de Banexcoin.
- La aplicación no ejecuta pagos reales.
- La salida operativa se entrega como archivo descargable.

## C4 Nivel 2 - Contenedores

### Frontend

Ubicación: `frontend/`.

Responsabilidad:

- Renderizar pantallas operativas con Astro.
- Montar React solo donde hay interacción.
- Consumir la API mediante `frontend/src/lib/api.ts`.
- Validar inputs para mejorar UX, sin reemplazar validación backend.

Tecnologías:

- Astro.
- React Islands.
- Tailwind.
- Playwright para pruebas E2E cuando aplique.

### Backend

Ubicación: `backend/`.

Responsabilidad:

- Exponer API HTTP.
- Validar entradas externas.
- Procesar uploads.
- Parsear archivos.
- Calcular reintegros.
- Conciliar transacciones.
- Explicar anomalías con Gemini cuando `GEMINI_API_KEY` está configurada.
- Generar reportes.
- Persistir datos transaccionalmente.

Tecnologías:

- NestJS.
- Prisma.
- PostgreSQL.
- Vitest.

### Paquetes Compartidos

Ubicación: `packages/`.

Responsabilidad:

- `packages/types`: contratos compartidos entre frontend y backend.
- `packages/utils`: funciones puras compartidas, especialmente reglas de dinero, periodos, tiers y cálculo de reintegros.

Regla:

- Los paquetes compartidos no deben depender de NestJS, Astro, Prisma ni APIs del navegador.

### Base De Datos

Responsabilidad:

- Persistir uploads, movimientos, extractos, tiers, reintegros, anomalías, errores de parseo y reportes generados.

Fuente de verdad:

- El detalle del modelo vive en [BD.md](BD.md).
- El schema ejecutable vive en `backend/prisma/schema.prisma`.

## Backend Modular

Módulos actuales:

- `AppModule`: composición del sistema.
- `HealthModule`: health check.
- `PrismaModule`: acceso compartido a Prisma.
- `ParserModule`: lectura y normalización de archivos Excel.
- `UploadsModule`: recepción de archivos y orquestación del procesamiento actual.
- `TiersModule`: configuración y validación de niveles de cashback.
- `JobsModule`: agentes especializados actuales para cálculo y conciliación.
- `ReconciliationModule`: consulta, resolución y explicación opcional de anomalías.
- `ReportsModule`: generación de archivos descargables.

Reglas de dependencia:

- Controllers reciben HTTP y delegan.
- Services contienen casos de uso de aplicación.
- Agents encapsulan lógica especializada sin conocer HTTP.
- Prisma solo se consume desde backend.
- La lógica financiera pura vive en `packages/utils` cuando deba compartirse o testearse aisladamente.

## Flujo Principal Actual

El flujo implementado actualmente es síncrono desde el punto de vista HTTP:

1. El frontend envía el archivo a la API.
2. `UploadsController` recibe multipart form data.
3. `UploadsService` valida archivo, calcula hash y controla duplicados.
4. `ParserService` interpreta las hojas relevantes.
5. `TierAgent` calcula reintegros usando `packages/utils`.
6. `ReconcileAgent` detecta anomalías contra extractos.
7. `UploadsService` persiste resultados en una transacción Prisma.
8. El frontend consulta resultados y descargas mediante endpoints existentes.

Nota arquitectónica:

- `UploadsService` concentra demasiada responsabilidad. La separación hacia un orquestador y un agente de persistencia queda como refactor posterior, no como estado actual.

## API Implementada

La arquitectura documenta las rutas existentes, no rutas objetivo.

Grupos actuales:

- `GET /health`.
- `/api/uploads` para carga, listado, detalle, reintegros y transacciones.
- `/api/tiers` para tiers, historial, validación y cambios.
- `/api/reconciliation` para estadísticas, anomalías, resolución y explicación opcional.
- `/api/uploads/:id/report` para reporte Excel.
- `/api/uploads/:id/banex-transfer` para archivo operativo.
- `/api/uploads/:id/balance-sheet` para cuadre.

La lista exacta de métodos debe consultarse en los controllers del backend.

## Reglas Arquitectónicas

- Mantener módulos por feature, no un `AppModule` monolítico.
- No poner lógica de negocio en controllers.
- No duplicar reglas financieras entre frontend y backend; extraer a `packages/utils` si aplica.
- No usar `number` para dinero en reglas de negocio.
- Toda escritura financiera que toque varias tablas debe ser transaccional.
- Toda operación crítica debe ser idempotente.
- La documentación de arquitectura no debe incluir código de implementación.
- La base de datos se documenta en `BD.md`, no en este archivo.
- Las convenciones de estilo, testing y commits viven en `CONVENTIONS.md`.

## Evolución Pendiente

Estas mejoras están fuera del estado actual, pero deben respetar la arquitectura modular:

- Extraer la persistencia masiva de `UploadsService` a un componente dedicado.
- Introducir un orquestador de procesamiento si el flujo deja de ser síncrono.
- Formalizar agentes adicionales solo cuando exista una necesidad real.
- Agregar colas o procesamiento asíncrono únicamente si el tamaño de archivos o la operación lo justifican.
