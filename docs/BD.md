# BanexReintegra - Base De Datos

Este documento describe el modelo de datos y los criterios de persistencia. La implementación ejecutable vive en `backend/prisma/schema.prisma`.

## Motor

La base de datos principal es PostgreSQL.

Prisma es la capa de acceso y migración. Los modelos deben mantener compatibilidad con PostgreSQL y no asumir SQLite.

## Principios

- `Upload` es la unidad operativa principal del procesamiento.
- Cada archivo se identifica por hash para evitar duplicados.
- Los movimientos financieros se normalizan en una entidad canónica.
- Los detalles especializados viven en tablas complementarias.
- Los extractos se persisten como evidencia de conciliación.
- Los reintegros se guardan como agregados mensuales auditables.
- Los errores de parseo y anomalías no se pierden.
- Los tiers se versionan por periodo.
- Los reportes se generan desde datos persistidos, no desde el archivo original.

## Entidades Principales

### Upload

Representa un archivo recibido, su estado de procesamiento, metadatos, hash, conteos y relación con resultados generados.

Uso arquitectónico:

- Controlar idempotencia.
- Agrupar transacciones, extractos, reintegros, anomalías y errores.
- Permitir auditoría por archivo.

### UserAccount

Representa una cuenta operativa beneficiaria o participante de movimientos.

Regla:

- `accountNumber` es el identificador operativo más estable.
- `username`, `displayName` y `externalId` son datos complementarios.

### LedgerTransaction

Representa el movimiento financiero canónico importado desde el Excel.

Uso arquitectónico:

- Evitar una tabla diferente por cada hoja.
- Unificar conciliación, reportes y trazabilidad.
- Mantener referencia al upload, hoja, fila y transacción externa.

### QrTransactionDetail

Contiene detalle específico de movimientos QR cuando aplica.

Uso arquitectónico:

- Separar campos QR de la entidad canónica.
- Evitar columnas nulas o ambiguas en movimientos que no son QR.

### TransferDetail

Contiene detalle específico de transferencias internas.

Uso arquitectónico:

- Representar emisor y receptor.
- Soportar reconstrucción operativa de archivos de transferencia.

### BankExtractEntry

Representa una fila de extracto bancario usada como evidencia de conciliación.

Uso arquitectónico:

- Hacer reproducible la conciliación.
- Trazar anomalías contra evidencia persistida.
- Permitir auditoría posterior sin depender del archivo original.

### CashbackTier

Representa una regla de nivel de cashback con vigencia temporal.

Regla:

- Un cambio de política no debe destruir la configuración histórica.
- La vigencia se resuelve por periodo.

### MonthlyRebate

Representa el reintegro mensual agregado por cuenta y upload.

Uso arquitectónico:

- Servir como resultado financiero principal.
- Permitir estados operativos como exportado o pagado.
- Evitar recalcular en endpoints de lectura.

### MonthlyRebateItem

Vincula un reintegro mensual con los movimientos que lo originaron.

Uso arquitectónico:

- Permitir drilldown auditable.
- Reconstruir el cálculo sin volver a parsear el Excel.

### ReconciliationAnomaly

Representa una diferencia detectada entre movimientos importados y extractos.

Tipos vigentes:

- `NO_EXTRACT`.
- `NO_QR`.
- `AMOUNT_MISMATCH`.
- `INVALID_RATE` si la lógica lo produce o lo reporta.

### ParseError

Representa una fila inválida o problema de lectura del archivo.

Regla:

- Errores por fila deben conservarse cuando el archivo puede procesarse parcialmente.

### GeneratedReport

Representa metadata de reportes generados si se decide persistirlos.

Regla:

- Si el reporte se genera bajo demanda y no se almacena, esta entidad puede mantenerse sin uso o eliminarse en una migración futura.

## Relaciones Clave

- Un upload contiene movimientos, extractos, errores, anomalías, reintegros y reportes.
- Una cuenta puede tener muchos movimientos y reintegros.
- Un movimiento puede tener detalle QR o detalle de transferencia.
- Un reintegro mensual tiene múltiples items vinculados a movimientos.
- Una anomalía puede apuntar a un movimiento, a un extracto o a ambos.
- Un tier puede estar asociado a muchos reintegros históricos.

## Constraints E Índices

Reglas esperadas:

- Hash único por upload.
- Cuenta única por número operativo.
- Movimiento único por upload, servicio y transacción externa.
- Reintegro único por upload y cuenta.
- Índices por `uploadId` en tablas hijas.
- Índices por periodo para uploads y reintegros.
- Índices por tipo y resolución en anomalías.
- Índices por transactionId para conciliación.

## Dinero Y Precisión

- Montos BOB, USDT, comisiones, tasas y porcentajes usan Decimal.
- Las APIs deben transportar montos como string.
- La lógica de negocio debe operar con `decimal.js` o Decimal compatible.
- No usar `Float`, `Double` ni `number` para reglas financieras.

## Auditoría

Toda entidad financiera o de configuración debe conservar trazabilidad suficiente:

- Identificador del upload origen.
- Fecha de creación.
- Fecha de actualización cuando aplique.
- Hash del archivo fuente en `Upload`.
- Hoja y fila de origen cuando el dato proviene del Excel.

## Migraciones

- Las migraciones deben representar cambios reales del schema.
- No editar migraciones ya aplicadas en ambientes compartidos.
- No crear compatibilidad hacia atrás salvo que existan datos persistidos que lo requieran.
- Antes de cambiar relaciones o constraints, revisar impacto en parser, reportes y conciliación.
