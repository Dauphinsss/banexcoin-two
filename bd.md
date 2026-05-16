# BanexReintegra - Primera propuesta de base de datos

Esta propuesta toma como fuente principal `FLOW.md` y sus anexos `design.md` y `agents.md`.
La idea es partir de un modelo que soporte bien:

- carga e idempotencia de archivos
- procesamiento asíncrono por upload
- persistencia auditable de transacciones, reintegros y anomalías
- versionado de tiers por período
- generación posterior de reportes sin recalcular

No es un contrato final. Es una base razonable para analizar antes de bajar a Prisma.

## Criterios de diseño

- La `Carga` es la unidad operativa principal.
- Las transacciones QR y las del extracto se guardan por separado para conservar trazabilidad completa.
- El reintegro mensual se persiste agregado por cuenta/usuario, pero mantiene relación con sus transacciones fuente.
- Los tiers se versionan por vigencia, no se pisan.
- Las anomalías y errores de parseo quedan auditables por carga.

## Diagrama ER en Mermaid

```mermaid
erDiagram
    CARGA ||--o{ TRANSACCION_QR : contiene
    CARGA ||--o{ TRANSACCION_EXTRACTO : contiene
    CARGA ||--o{ ERROR_PARSEO : produce
    CARGA ||--o{ ANOMALIA_CONCILIACION : produce
    CARGA ||--o{ REINTEGRO_MENSUAL : produce
    CARGA ||--o{ REPORTE_GENERADO : genera
    CARGA ||--o| CARGA : reemplaza

    CUENTA_USUARIO ||--o{ TRANSACCION_QR : posee
    CUENTA_USUARIO ||--o{ REINTEGRO_MENSUAL : recibe

    NIVEL_CASHBACK ||--o{ REINTEGRO_MENSUAL : aplica_a

    REINTEGRO_MENSUAL ||--o{ DETALLE_REINTEGRO_MENSUAL : detalla
    TRANSACCION_QR ||--o{ DETALLE_REINTEGRO_MENSUAL : aporta_a

    TRANSACCION_QR ||--o| ANOMALIA_CONCILIACION : puede_originar
    TRANSACCION_EXTRACTO ||--o| ANOMALIA_CONCILIACION : puede_originar

    CARGA {
      string id PK
      string nombre_original
      string ruta_almacenamiento
      string tipo_mime
      int tamano_archivo_bytes
      string hash_archivo UK
      string periodo
      string estado
      int cantidad_filas
      int cantidad_filas_qr
      int cantidad_filas_extracto
      int cantidad_errores_parseo
      int cantidad_anomalias
      string mensaje_error
      string carga_reemplazada_id FK
      datetime procesado_en
      datetime creado_en
      datetime actualizado_en
    }

    CUENTA_USUARIO {
      string id PK
      string id_externo
      string nombre_usuario
      string numero_cuenta UK
      string nombre_mostrado
      boolean activo
      datetime creado_en
      datetime actualizado_en
    }

    TRANSACCION_QR {
      string id PK
      string carga_id FK
      string cuenta_usuario_id FK
      string transaccion_id
      datetime transaccion_en
      decimal monto_bob
      decimal monto_usdt
      decimal tipo_cambio
      decimal comision_bob
      decimal comision_usdt
      boolean conciliado_con_extracto
      json fila_cruda
      datetime creado_en
    }

    TRANSACCION_EXTRACTO {
      string id PK
      string carga_id FK
      string transaccion_id
      datetime transaccion_en
      decimal monto_bob
      string referencia
      json fila_cruda
      datetime creado_en
    }

    ERROR_PARSEO {
      string id PK
      string carga_id FK
      string nombre_hoja
      int numero_fila
      string nombre_columna
      string codigo_error
      string mensaje
      json fila_cruda
      datetime creado_en
    }

    ANOMALIA_CONCILIACION {
      string id PK
      string carga_id FK
      string transaccion_qr_id FK
      string transaccion_extracto_id FK
      string transaccion_id
      string tipo
      decimal monto_qr_bob
      decimal monto_extracto_bob
      decimal delta_bob
      boolean resuelto
      string nota_resolucion
      datetime resuelto_en
      datetime creado_en
    }

    NIVEL_CASHBACK {
      string id PK
      int nivel
      string nombre
      decimal monto_minimo_bob
      decimal monto_maximo_bob
      decimal porcentaje_reintegro
      string periodo_vigencia_desde
      string periodo_vigencia_hasta
      boolean activo
      datetime creado_en
      datetime actualizado_en
    }

    REINTEGRO_MENSUAL {
      string id PK
      string carga_id FK
      string cuenta_usuario_id FK
      string nivel_cashback_id FK
      string periodo
      decimal total_consumido_bob
      decimal total_consumido_usdt
      decimal tipo_cambio_promedio
      decimal porcentaje_reintegro
      decimal reintegro_bob
      decimal reintegro_usdt
      string estado_pago
      boolean exportado
      boolean pagado
      datetime pagado_en
      datetime creado_en
      datetime actualizado_en
    }

    DETALLE_REINTEGRO_MENSUAL {
      string id PK
      string reintegro_mensual_id FK
      string transaccion_qr_id FK
      decimal monto_bob
      decimal monto_usdt
      decimal tipo_cambio
      datetime creado_en
    }

    REPORTE_GENERADO {
      string id PK
      string carga_id FK
      string tipo
      string formato
      string ruta_almacenamiento
      string generado_por
      datetime creado_en
    }
```

## Lectura del modelo

### 1. `Carga`

Es el centro del proceso. Representa el archivo recibido, su hash, su estado y los conteos finales del procesamiento.

Campos importantes:

- `file_hash` para idempotencia
- `estado` para `PENDING | PROCESSING | DONE | FAILED | SUPERSEDED`
- `carga_reemplazada_id` para el caso de reemplazo de período
- `processed_at` para auditoría operativa

### 2. `CuentaUsuario`

Agrupa al beneficiario desde la óptica operativa. El identificador más confiable parece ser `account_number`, mientras `username` o `external_id` pueden cambiar o venir incompletos.

### 3. `TransaccionQR`

Guarda cada fila válida de `Pago QR`. Es la fuente del cálculo de reintegros.

Sugerencia de constraint:

- unique compuesto en `carga_id + transaccion_id`

Si después confirmamos que `transaccion_id` es globalmente único, podríamos endurecerlo más.

### 4. `TransaccionExtracto`

Conviene separarla de `TransaccionQR` porque su semántica es distinta: no participa en tiers, solo en conciliación. Esto simplifica trazabilidad y evita meter columnas nulas en una tabla única de transacciones.

### 5. `ErrorParseo`

Responde directo al flujo y a `PersistenceAgent`: guardar filas problemáticas sin abortar todo el job.

Útil para:

- mostrar errores por hoja/fila
- exportarlos luego en reportes
- reentrenar reglas de parsing más adelante

### 6. `AnomaliaConciliacion`

Representa la salida del `ReconcileAgent`.

Tipos esperados:

- `NO_EXTRACT`
- `NO_QR`
- `AMOUNT_MISMATCH`
- posible extensión futura: `INVALID_RATE`

Dejé `resolved`, `resolution_note` y `resolved_at` porque el flujo ya contempla resolución manual desde UI.

### 7. `NivelCashback`

Modelo versionado por vigencia mensual.

Idea central:

- no actualizar tiers históricos
- cerrar vigencia con `valid_to_period`
- buscar tiers activos para el período procesado

### 8. `ReintegroMensual`

Es el agregado mensual por usuario/cuenta para una carga.

Lo pensé con doble semántica:

- resultado financiero auditable
- objeto operativo que puede marcarse como exportado o pagado

Constraint sugerido:

- unique compuesto en `carga_id + cuenta_usuario_id`

### 9. `DetalleReintegroMensual`

Esta tabla no siempre aparece en propuestas iniciales, pero acá vale mucho la pena.
Nos da el puente entre el agregado mensual y cada transacción que lo compone.

Eso habilita:

- drilldown real en auditoría
- reconstrucción exacta del cálculo
- reportes explicables sin recalcular

### 10. `ReporteGenerado`

Es opcional, pero la incluyo como decisión abierta útil.
Si los reportes se generan on-demand y nunca se almacenan, esta tabla puede desaparecer.
Si queremos trazabilidad de descargas o caching de archivos generados, sirve.

## Constraints recomendados

- `carga.hash_archivo` unique
- `cuenta_usuario.numero_cuenta` unique
- `transaccion_qr (carga_id, transaccion_id)` unique
- `transaccion_extracto (carga_id, transaccion_id)` index
- `reintegro_mensual (carga_id, cuenta_usuario_id)` unique
- índices por `carga_id` en tablas hijas
- índice por `periodo` en `carga` y `reintegro_mensual`
- índice por `tipo, resuelto` en `anomalia_conciliacion`

## Tipos y enums sugeridos

### `carga.estado`

- `PENDING`
- `PROCESSING`
- `DONE`
- `FAILED`
- `SUPERSEDED`

### `anomalia_conciliacion.tipo`

- `NO_EXTRACT`
- `NO_QR`
- `AMOUNT_MISMATCH`
- `INVALID_RATE`

### `reintegro_mensual.estado_pago`

- `PENDING`
- `EXPORTED`
- `PAID`
- `BLOCKED`

## Decisiones abiertas para analizar

1. `period` como `string YYYY-MM` o como `date`.
   Mi recomendación inicial: `string YYYY-MM`, porque el negocio opera por mes y simplifica vigencias de tiers.

2. Si `CuentaUsuario` representa una cuenta o una persona.
   Mi recomendación inicial: cuenta operativa, porque el Excel y BanexTransfer parecen girar alrededor de la cuenta.

3. Si `GeneratedReport` se persiste o no.
   Mi recomendación inicial: no hacerlo en la primera versión, salvo que queramos auditoría de exportaciones.

4. Si `Carga` debe permitir más de un `DONE` por período.
   Mi recomendación inicial: sí, pero marcando el anterior como `SUPERSEDED` para conservar historial.

5. Si conviene agregar una tabla `tier_config_set`.
   Solo la sumaría si el versionado de tiers se vuelve más complejo o queremos agrupar explícitamente una "política" completa.

## Recomendación práctica

Si te parece bien esta dirección, el siguiente paso natural sería convertir esto en:

1. un `schema.prisma` inicial
2. enums y constraints reales
3. una versión simplificada si queremos llegar más rápido al hackathon
