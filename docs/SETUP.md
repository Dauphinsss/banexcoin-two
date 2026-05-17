# BanexReintegra - Setup

Guía corta para levantar el proyecto y probarlo rápido.

## Requisitos

- `node` 22.12+.
- `bun` 1.1+.
- `git`.
- Acceso a una base PostgreSQL mediante `DATABASE_URL`.

## Variables De Entorno

Crear archivos de entorno desde los ejemplos:

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

Después, configurar `DATABASE_URL` con una URL PostgreSQL válida.

`CEREBRAS_API_KEY` es opcional. Si no está configurada, el backend responde con fallback controlado en la explicación de anomalías.

`UPLOAD_DUPLICATE_MODE` controla qué pasa si subes el mismo archivo otra vez:

- `prod`: bloquea la recarga y conserva el resultado existente.
- `test`: permite reprocesarlo si confirmas la acción desde la UI.

## Instalar Y Preparar

```bash
bun install
bun run db:push
bun run db:seed
bun run --cwd packages/types build
bun run --cwd packages/utils build
```

## Arrancar

```bash
bun run dev
```

Servicios esperados:

- Backend: `http://localhost:3000`.
- Health: `http://localhost:3000/health`.
- Frontend: `http://localhost:4321`.

## Qué Funciona Hoy

- Upload de Excel.
- Preview del archivo.
- Detección de periodo.
- Idempotencia por hash.
- Parseo de `Pago QR` y `EXTRACTO DE PAGOS`.
- Cálculo de tiers y rebates.
- Persistencia en PostgreSQL.
- Conciliación de anomalías y panel de revisión.
- Reportes: Excel, BanexTransfer y balance sheet.
- Editor de niveles con validación e historial.
- Simulador what-if.
- Explicación opcional de anomalías con Cerebras si existe `CEREBRAS_API_KEY`.

## Archivos De Referencia

Los archivos entregados para contexto y pruebas manuales viven en `docs/`:

- `docs/ficha tecnica.pdf`.
- `docs/Reportes Banexcoin Bolivia Hackaton 2026.xlsx`.

Pendiente:

- Refactor del procesamiento para separar mejor responsabilidades internas.
- Endurecimiento de verificación según cambios de diseño.

## Prueba Rápida

1. Abrir `http://localhost:4321/uploads/new`.
2. Subir `docs/Reportes Banexcoin Bolivia Hackaton 2026.xlsx`.
3. Confirmar el preview.
4. Procesar el archivo.

Resultado esperado:

- El upload termina en `DONE`.
- Se crean reintegros.
- Si se sube el mismo archivo otra vez, aparece como duplicado.

## Verificación Útil

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/tiers
curl http://localhost:3000/api/uploads
```

También puedes abrir Prisma Studio:

```bash
bun run db:studio
```

## Tests

Backend y paquetes compartidos:

```bash
bun run --cwd backend test
bun run --cwd backend test:e2e
bun run --cwd packages/utils test
```

Frontend E2E:

```bash
bun run --cwd frontend test:e2e
```

No ejecutar Playwright si la tarea actual explícitamente lo excluye.
