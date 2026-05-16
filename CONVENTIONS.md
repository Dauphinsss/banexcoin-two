# BanexReintegra — Convenciones de Código

> **Lectura obligatoria antes de escribir cualquier código.** Estamos construyendo software financiero para Banexcoin Bolivia. Un error de redondeo, una transacción no atómica o un log con información sensible no son bugs de bajo impacto: son fallas de auditoría.
>
> Si una situación no está cubierta acá: **pregunta antes de improvisar.**

---

## Principios fundacionales (no negociables)

1. **El dinero nunca es un `number` en memoria.** Strings + `decimal.js`. Punto.
2. **Toda escritura financiera es atómica.** Si toca dos tablas, va en `prisma.$transaction`.
3. **Toda operación financiera es idempotente.** Reintentar nunca duplica.
4. **Toda operación deja rastro.** `createdAt`, `updatedAt`, hash de origen, quién hizo qué.
5. **El sistema falla cerrado.** En duda, rechaza la operación y pide intervención humana. Nunca aproxima.
6. **Los datos del cliente no aparecen en logs.** PII se anonimiza o se omite.
7. **El sistema es 100% independiente del core de Banexcoin.** Lo dice la ficha técnica. No se viola por conveniencia.

---

## 1. Precisión decimal (la regla más importante)

### 1.1 En PostgreSQL

```prisma
amountBOB    Decimal  @db.Decimal(20, 8)
amountUSDT   Decimal  @db.Decimal(20, 8)
exchangeRate Decimal  @db.Decimal(20, 8)
rebatePercent Decimal @db.Decimal(5, 2)
```

- **Nunca** `Float`, `Real`, `Double`.
- 20 dígitos totales, 8 decimales: cubre desde 10⁻⁸ hasta 10¹² (mucho más que cualquier monto realista).
- Porcentajes: 5 dígitos, 2 decimales (rango 0.00–999.99).

### 1.2 En TypeScript

```typescript
// ✅ Correcto
import { Decimal } from 'decimal.js'

const total = new Decimal('150.00')
const rate = new Decimal('13.20650000')
const usdt = total.dividedBy(rate).toFixed(8)  // string "11.35935297"

// ❌ Prohibido
const total = 150.00              // number, precisión IEEE-754
const usdt = total / 13.2065      // genera "11.359352970620111" (basura al final)
parseFloat("150.00")              // pierde precisión
Number("150.00").toFixed(2)       // funciona por casualidad, no se usa
```

### 1.3 Reglas de oro

- **Decimal.js global config en root de cada package:**
  ```typescript
  Decimal.set({
    precision: 40,
    rounding: Decimal.ROUND_HALF_EVEN,  // "banker's rounding"
    toExpNeg: -20,
    toExpPos: 30,
  })
  ```
- **Banker's rounding (`ROUND_HALF_EVEN`)** es el estándar financiero. NO uses `ROUND_HALF_UP`.
- **Conversión en los límites:** strings hacia adentro de `decimal.js`, strings hacia afuera. Nunca devuelvas un `Decimal` por la API.
- **Prisma devuelve `Decimal` de Prisma**, no de decimal.js. Convertir explícitamente: `new Decimal(row.amountBOB.toString())`.
- **Comparaciones con tolerancia explícita:**
  ```typescript
  const TOLERANCE = new Decimal('0.01')
  if (a.minus(b).abs().lessThan(TOLERANCE)) { /* iguales */ }
  ```

### 1.4 Formato para mostrar (UI)

- BOB: 2 decimales, separador de miles `,`, decimal `.` → `Bs 1,234.56`
- USDT: 8 decimales, formato igual → `1,234.56789012 USDT`
- Porcentaje: 2 decimales → `2.50%`
- Usar `Intl.NumberFormat('es-BO', { ... })` o `decimal.js` con `toFixed` controlado.
- **Nunca** mostrar `Number.toString()` directo en UI con montos.

---

## 2. Idempotencia

### 2.1 Operaciones que DEBEN ser idempotentes

- Procesamiento de uploads (hash SHA-256 del archivo)
- Cálculo de reintegros (un solo `MonthlyRebate` por `(userId, period)`)
- Generación de archivos BanexTransfer (regenerar produce mismo archivo)
- Endpoints de marcado de pago (`PATCH /rebates/:id/mark-paid` — si ya está pagado, devuelve OK sin error)

### 2.2 Patrón

```typescript
// Idempotencia por hash en uploads
const fileHash = createHash('sha256').update(buffer).digest('hex')
const existing = await prisma.upload.findUnique({ where: { fileHash } })

if (existing) {
  return { uploadId: existing.id, wasDuplicate: true }
}

// Idempotencia por unique constraint en cálculo
await prisma.monthlyRebate.upsert({
  where: { userId_period: { userId, period } },
  create: { /* ... */ },
  update: { /* ... */ },
})
```

### 2.3 Reintentos de jobs BullMQ

- Configurar `attempts: 3` con backoff exponencial.
- El job debe poder ejecutarse N veces y producir el mismo estado final.
- Si un job parcialmente falla, primero limpia su salida previa con `deleteMany` antes de reescribir.

---

## 3. Transacciones atómicas

### 3.1 Regla

> Si una operación toca **más de una tabla** o **más de una fila lógica relacionada**, va en una transacción Prisma.

```typescript
// ✅ Correcto
await prisma.$transaction(async (tx) => {
  await tx.user.upsert({ /* ... */ })
  await tx.qRTransaction.createMany({ /* ... */ })
  await tx.monthlyRebate.create({ /* ... */ })
  await tx.upload.update({
    where: { id: uploadId },
    data: { status: 'DONE' },
  })
})

// ❌ Prohibido: escrituras sueltas sin transacción
await prisma.user.upsert(...)
await prisma.qRTransaction.createMany(...)  // si esto falla, queda User huérfano
```

### 3.2 Timeout y aislamiento

- Transacciones largas (bulk inserts): subir el timeout explícitamente.
  ```typescript
  await prisma.$transaction(async (tx) => { ... }, { timeout: 60_000 })
  ```
- Default `READ COMMITTED` está bien para nuestro caso. No usar `SERIALIZABLE` salvo justificación explícita.

---

## 4. Validación de entrada

### 4.1 DTOs con `class-validator` (NestJS)

Todo controller que recibe input externo (HTTP, multipart) usa DTOs anotados.

```typescript
import { IsString, IsNumberString, Matches } from 'class-validator'

export class CreateTierDto {
  @IsString()
  name: string

  @IsNumberString()           // string que parsea a número (mantiene precisión)
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'minAmountBOB debe tener máx 2 decimales' })
  minAmountBOB: string

  @IsNumberString()
  maxAmountBOB: string | null

  @IsNumberString()
  rebatePercent: string
}
```

### 4.2 Reglas

- `ValidationPipe` global con `whitelist: true, forbidNonWhitelisted: true, transform: true`.
- Montos como `string`, validados con regex de decimales.
- **Nunca** confiar en tipos sin validar: `req.body.amount as number` es prohibido.
- Para archivos: validar MIME server-side, no solo extensión.
- Tamaño máximo de upload: 50 MB (env var `MAX_UPLOAD_SIZE_MB`).

### 4.3 En el frontend (islands)

- Validar con feedback inmediato (no esperar al submit).
- Replicar las reglas del backend para UX, pero **nunca confiar solo en el frontend**.

---

## 5. Manejo de errores

### 5.1 Errores tipados

```typescript
// ✅ Definir errores de dominio explícitos
export class DuplicateUploadError extends Error {
  constructor(public readonly existingUploadId: string) {
    super('El archivo ya fue procesado anteriormente')
    this.name = 'DuplicateUploadError'
  }
}

// ✅ Convertir en HTTP en el filter
@Catch(DuplicateUploadError)
export class DuplicateUploadFilter implements ExceptionFilter {
  catch(exc: DuplicateUploadError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse()
    res.status(409).json({
      error: 'DUPLICATE_UPLOAD',
      message: exc.message,
      existingUploadId: exc.existingUploadId,
    })
  }
}
```

### 5.2 Lo que el cliente recibe

Schema unificado de errores:

```typescript
{
  error: string         // código corto: "DUPLICATE_UPLOAD", "VALIDATION_FAILED"
  message: string       // mensaje en español para el usuario
  details?: unknown     // opcional: estructura adicional (lista de campos inválidos)
  traceId?: string      // para soporte
}
```

### 5.3 Lo que NO debe ver el cliente

- Stack traces.
- Nombres de tablas, columnas o relaciones internas.
- Mensajes raw de Prisma o Postgres.
- Rutas de archivos del servidor.
- Hashes internos, IDs de jobs BullMQ.

### 5.4 Logs internos

- Logs estructurados (JSON) con `nestjs-pino` o equivalente.
- Niveles: `fatal`, `error`, `warn`, `info`, `debug`, `trace`.
- Cada error WARN/ERROR debe tener `traceId` correlacionable con el response al cliente.
- **Nunca** loguear PII en claro: cuentas, balances, datos personales.

---

## 6. Logging y observabilidad

### 6.1 Qué loguear

| Evento | Nivel | Incluir |
|---|---|---|
| Upload recibido | info | `uploadId`, `fileHash[:8]`, `rowCount`, NO el contenido |
| Job iniciado | info | `jobId`, `uploadId`, `step` |
| Job completado | info | `jobId`, duración, conteos |
| Anomalía detectada | warn | tipo, conteo (no `transactionId` individual en agregado) |
| Error de parseo | warn | `rowNumber`, `sheetName`, motivo |
| Job fallido | error | `jobId`, mensaje, stack en logs internos solamente |
| Llamada a Claude | info | `model`, `inputTokens`, `outputTokens`, NO el contenido |

### 6.2 Qué NO loguear

- Montos de transacciones individuales en producción.
- Usernames en claro (usar hash o ID interno).
- API keys, secrets, tokens.
- Contenido completo del Excel.
- Respuestas crudas de Claude (pueden contener datos sensibles).

### 6.3 Formato

```json
{
  "level": "info",
  "time": "2025-05-16T12:34:56.789Z",
  "service": "banex-reintegra-api",
  "module": "uploads",
  "traceId": "abc123",
  "uploadId": "upload_xyz",
  "msg": "Upload processed successfully",
  "rebateCount": 239,
  "anomalyCount": 2,
  "durationMs": 12450
}
```

---

## 7. Seguridad

### 7.1 Variables de entorno

- **Nunca** commitear `.env`. Solo `.env.example`.
- Todas las env vars necesarias documentadas en `.env.example` con valores ficticios.
- Validar al arranque que todas las requeridas estén presentes (fallar rápido).
- Secrets: `JWT_SECRET`, `ANTHROPIC_API_KEY`, `DATABASE_URL` (en URL), `REDIS_URL`.

### 7.2 CORS

- Whitelist explícita por origen. **Nunca** `origin: '*'` en producción.
- `credentials: true` solo si se usa cookies / auth header.

### 7.3 Upload de archivos

- Validar MIME real (no solo `originalname`).
- Limitar tamaño (`multer` config).
- Almacenar en directorio fuera del webroot.
- Escanear contra inyecciones de fórmula Excel: celdas que empiezan con `=`, `+`, `-`, `@` se tratan como texto al exportar.

### 7.4 SQL injection

- Prisma previene SQLi por diseño. **Nunca** usar `$queryRawUnsafe` con input de usuario.
- Si hace falta SQL crudo: `$queryRaw` con template tag (parametrizado).

### 7.5 Sanitización a la salida (Excel/CSV)

- Al generar reportes: prefijar con apóstrofe `'` cualquier celda que empiece con `=`, `+`, `-`, `@` para evitar CSV injection en el cliente que abra el archivo.

### 7.6 Rate limiting

- Endpoints públicos (subir archivo, generar IA) usan `@nestjs/throttler`.
- Default: 10 requests / minuto / IP para uploads. 5 / minuto / IP para `POST /reconciliation/explain`.

### 7.7 Llamadas a Claude (LLM)

- **No enviar PII** al modelo. Anonimizar usernames antes de enviarlos a la API.
- Limitar `max_tokens` para acotar costos.
- Cachear respuestas por hash del input.
- Manejar fallos del API: timeout 30s, fallback UI.

---

## 8. Audit trail

### 8.1 Campos obligatorios en modelos financieros

```prisma
model MonthlyRebate {
  // ... datos del reintegro
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  paidOut     Boolean   @default(false)
  paidOutAt   DateTime?
  paidOutBy   String?               // user/sistema que marcó como pagado
  supersededBy String?              // si fue reemplazado por un recálculo
}
```

### 8.2 Trazabilidad

- Cada `MonthlyRebate` debe poder rastrearse hasta sus `QRTransaction[]` origen.
- Cada `QRTransaction` debe poder rastrearse hasta su `Upload`.
- Cada `Upload` debe tener `fileHash` que permite verificar el archivo original.
- **Nunca borrar físicamente** registros financieros. Soft delete (`deletedAt: DateTime?`) o `status: SUPERSEDED`.

### 8.3 Versionado de configuración

- `CashbackTier` tiene `validFrom` y `validTo`. Cambiar un tier NO modifica el registro existente: crea uno nuevo y cierra el anterior.
- Esto permite recalcular reintegros pasados con la configuración vigente en ese momento.

---

## 9. TypeScript estricto

### 9.1 tsconfig

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### 9.2 Reglas

- **Nunca** `any` salvo en límites con librerías sin tipos. Comentar el porqué.
- **Nunca** `as` cast sin validación previa. Usar `zod` o type guards.
- Tipos compartidos entre back y front viven en `packages/types`.
- Enums string, no numéricos: `enum UploadStatus { PENDING = 'PENDING', ... }`.

### 9.3 DTOs

- Backend define el DTO con `class-validator` y exporta la interfaz a `packages/types`.
- Frontend importa la interfaz desde `packages/types`, no redefine.

---

## 10. Estructura de módulos NestJS

### 10.1 Un módulo por feature de dominio

```
backend/src/
  uploads/
    uploads.module.ts
    uploads.controller.ts
    uploads.service.ts
    dto/
      create-upload.dto.ts
    errors/
      duplicate-upload.error.ts
```

### 10.2 Capas

- **Controllers** solo orquestan: reciben DTOs, llaman a services, devuelven responses. Ni una línea de lógica de negocio.
- **Services** contienen lógica de aplicación. Pueden llamarse entre sí.
- **Repositories** son thin wrappers sobre Prisma. Útiles si una query se repite >2 veces.
- **Agents** (workers BullMQ) son services especializados con responsabilidad única.

### 10.3 Inyección de dependencias

- Constructor injection siempre. No `@Inject()` salvo tokens.
- `private readonly` en el constructor.
- Evitar el service locator pattern.

---

## 11. Testing

### 11.1 Obligatorio

- `packages/utils/tier-engine.ts` — 15+ casos.
- `packages/utils/money.ts` — operaciones decimales.
- `apps/api/src/jobs/agents/reconcile.agent.ts` — cada tipo de anomalía.
- Cualquier función con lógica financiera.

### 11.2 No obligatorio (pero bienvenido)

- Controllers (testear con e2e si hace falta, no unit).
- Componentes React puramente visuales.
- DTOs (la validación es declarativa).

### 11.3 Convención

```typescript
// tier-engine.test.ts
import { describe, it, expect } from 'vitest'
import { calculateRebates } from './tier-engine'

describe('calculateRebates', () => {
  describe('asignación de tier', () => {
    it('asigna Nivel 1 cuando el gasto está justo en el mínimo', () => {
      // arrange
      const input = { /* ... */ }
      // act
      const result = calculateRebates(input)
      // assert
      expect(result[0].tierId).toBe(1)
    })
  })
})
```

- Estructura: `describe` por feature, `it` por caso. Nombres en español aceptados.
- AAA (Arrange-Act-Assert) explícito.
- Una sola aserción lógica por test (puede tener varias `expect` si todas validan la misma cosa).

---

## 12. Estilo de código

### 12.1 ESLint + Prettier

Ya configurados. **No deshabilitar reglas** sin discutir.

### 12.2 Naming

| Caso | Convención |
|---|---|
| Archivos | `kebab-case.ts` |
| Clases | `PascalCase` |
| Interfaces | `PascalCase` sin prefijo `I` |
| Variables, funciones | `camelCase` |
| Constantes globales | `SCREAMING_SNAKE_CASE` |
| Tipos genéricos | `T`, `K`, `V` o nombres descriptivos en PascalCase |
| Booleanos | `isX`, `hasX`, `canX`, `shouldX` |

### 12.3 Comentarios

- **Por defecto no escribir.** Los nombres deben hablar.
- Solo cuando el "por qué" no es obvio: invariantes ocultas, decisiones contraintuitivas, workarounds documentados.
- **Nunca** comentar lo que el código ya dice.

### 12.4 Funciones

- Máximo 30 líneas, ideal <15.
- Una responsabilidad. Si una función hace dos cosas, partirla.
- Parámetros: máximo 3. Si son más, usar objeto.
- Retornos múltiples solo si reducen anidación.

### 12.5 Inmutabilidad

- `const` por defecto. `let` solo cuando hay reasignación intencional.
- No mutar inputs: si una función recibe un array, no `push` en él. Devolver uno nuevo.
- `readonly` en interfaces para campos que no deben cambiar después de creación.

---

## 13. Git

### 13.1 Commits

- En español, presente, imperativo: "agrega validación de hash", "corrige cálculo de promedio ponderado".
- Prefijo opcional por tipo: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Cuerpo del commit explica el **porqué**, no el qué.

### 13.2 Branches

- `main` siempre desplegable.
- Feature branches: `feature/F1.3-parse-pago-qr` (referencia el ID del FEATURES.md).
- `fix/...` para bugs.

### 13.3 Lo que NO va al repo

- `.env` (solo `.env.example`).
- Archivos del Excel original (datos ficticios pero práctica correcta).
- Reportes generados (`/tmp`, `/outputs`).
- Credenciales en código.

---

## 14. Cosas que vas a querer hacer y que están prohibidas

| Tentación | Por qué está prohibida | Alternativa |
|---|---|---|
| `parseFloat(monto)` | Pierde precisión | `new Decimal(monto)` |
| `Math.round(x * 100) / 100` | Punto flotante traicionero | `decimal.toFixed(2)` |
| `await prisma.X.create(); await prisma.Y.create()` | No es atómico | `$transaction([...])` |
| `console.log(transaccion)` en producción | Loguea PII | Logger estructurado con campos filtrados |
| `catch (e) { return null }` | Oculta bugs | Manejar tipos específicos y/o relanzar |
| Hardcodear tiers en código | Cambian sin redeploy | Tabla `CashbackTier` en DB |
| Usar `any` para "salir del paso" | Rompe el tipado en cascada | `unknown` + type guard, o tipar bien |
| Cambiar un commit ya pusheado | Reescribe historia auditable | Crear commit nuevo de corrección |
| Ignorar warnings de TS | Se acumulan | Resolverlos o anotar con razón |
| `git push --force` a `main` | Pierde historial | Nunca. Siempre PR. |

---

## 15. Antes de marcar una tarea como hecha

Checklist mínima:

- [ ] Tipos estrictos, sin `any`.
- [ ] Si toca dinero: `decimal.js` + `Decimal(20,8)` en DB.
- [ ] Si escribe en DB: transacción atómica.
- [ ] Si es endpoint público: DTO validado.
- [ ] Si es operación crítica: idempotente.
- [ ] Si tiene lógica no trivial: test.
- [ ] Si lo ve el usuario: textos en español, sin tecnicismos.
- [ ] No introduce `console.log`.
- [ ] No filtra PII en logs.
- [ ] Pasa `lint` y `build` sin warnings.

Si una de estas no se cumple: **no está hecho**. Está empezado.
