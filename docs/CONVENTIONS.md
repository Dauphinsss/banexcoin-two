# BanexReintegra - Conventions

Estas convenciones definen cómo escribir código y documentación nueva respetando la arquitectura del proyecto.

## Principios No Negociables

- El dinero nunca se maneja como `number` en reglas de negocio.
- Las operaciones financieras deben ser idempotentes.
- Las escrituras financieras relacionadas deben ser atómicas.
- El sistema debe conservar trazabilidad de datos importados.
- Los datos sensibles no deben aparecer en logs, prompts ni errores expuestos al usuario.
- La aplicación es independiente del core de Banexcoin.
- PostgreSQL es la base de datos objetivo.

## Documentación

- `ARCHITECTURE.md` describe estructura técnica y límites del sistema.
- `BD.md` describe modelo de datos y persistencia.
- `CONVENTIONS.md` describe reglas para construir código nuevo.
- `AGENTS.md` guía a agentes de desarrollo.
- `DESIGN.md` describe UX/UI.
- `FLOW.md` describe producto, narrativa y flujo de negocio.

Reglas:

- No incluir bloques largos de código en documentación arquitectónica.
- No duplicar schema de Prisma fuera de `backend/prisma/schema.prisma`.
- No documentar features no implementadas como si fueran estado actual.
- Si algo es aspiracional, marcarlo como pendiente o evolución.
- Usar enlaces relativos cuando un documento dependa de otro.

## Backend

- Un módulo por feature de dominio.
- Controllers solo reciben HTTP, validan entrada mediante DTOs y delegan.
- Services implementan casos de uso de aplicación.
- Agents encapsulan responsabilidades especializadas cuando existe una frontera clara.
- Prisma solo se usa desde backend.
- No crear dependencias circulares entre módulos.
- No poner lógica financiera en controllers.
- No recalcular resultados en endpoints de lectura si ya están persistidos.

## Frontend

- Astro renderiza páginas y layouts.
- React se usa solo en islands interactivas.
- Las llamadas HTTP viven en `frontend/src/lib/api.ts` o módulos equivalentes de cliente API.
- La validación frontend mejora UX, pero no reemplaza la validación backend.
- Textos de usuario en español profesional.
- Mantener accesibilidad básica: labels, estados visibles, navegación responsive y contraste suficiente.

## Paquetes Compartidos

- `packages/types` contiene contratos compartidos.
- `packages/utils` contiene lógica pura compartida.
- Los paquetes compartidos no deben depender de NestJS, Astro, Prisma ni APIs del navegador.
- Si una regla financiera se usa en frontend y backend, debe vivir en `packages/utils`.

## Dinero Y Decimales

- APIs transportan montos como string.
- Base de datos usa Decimal.
- Reglas de negocio usan Decimal compatible, preferiblemente `decimal.js`.
- BOB se presenta con 2 decimales.
- USDT se presenta con 8 decimales.
- No usar `parseFloat`, `Number`, `Math.round` ni aritmética nativa para dinero en lógica financiera.

## Base De Datos

- Cambios de modelo deben revisarse contra `docs/BD.md`.
- Toda escritura que afecte varias tablas debe usar transacción.
- No editar migraciones aplicadas en ambientes compartidos.
- Tiers históricos no deben sobrescribirse sin preservar vigencia.
- Uploads deben mantener hash para idempotencia.
- Movimientos y errores importados deben conservar referencia a origen cuando aplique.

## Errores

- Usar errores de dominio cuando el caso sea esperado.
- Convertir errores de dominio a respuestas HTTP controladas.
- No exponer stack traces, rutas locales, SQL, nombres internos de tablas ni secretos.
- Los mensajes visibles deben ser claros y accionables.

## Logging

- Loguear eventos operativos, no datos sensibles.
- Evitar montos individuales, usernames, cuentas completas y contenido del Excel.
- Hashes pueden registrarse truncados cuando sea útil para soporte.
- Los logs deben ayudar a depurar sin romper confidencialidad.

## IA Y Prompts

- `GEMINI_API_KEY` habilita explicación opcional de anomalías.
- Enviar solo resúmenes agregados al modelo.
- No enviar filas completas del Excel, cuentas completas, usernames ni identificadores sensibles.
- La IA nunca debe bloquear conciliación, reportes ni lectura de resultados.
- Si Gemini falla o no está configurado, devolver una respuesta controlada.

## Testing

- Toda lógica financiera no trivial debe tener tests.
- `packages/utils` debe cubrir reglas puras y casos borde.
- Backend debe cubrir parser, cálculo, conciliación y endpoints críticos.
- No ejecutar Playwright salvo instrucción explícita mientras haya rediseños pendientes.
- Si solo se modifica documentación, no es necesario ejecutar tests.

Comandos backend recomendados cuando aplique:

- `bun run --cwd backend test`.
- `bun run --cwd backend typecheck`.
- `bun run --cwd backend test:e2e` para cambios de integración HTTP.

## TypeScript

- Mantener tipado estricto.
- Evitar `any`; usar `unknown` y validar.
- Evitar casts sin validación previa.
- Preferir tipos compartidos desde `packages/types` cuando crucen frontend/backend.
- Usar nombres claros antes que comentarios explicativos.

## Git

- Commits en inglés.
- Mensajes claros, en imperativo cuando sea posible.
- No reescribir historia sin instrucción explícita.
- No commitear `.env`, secretos, reportes generados ni datos sensibles.

## Antes De Marcar Una Tarea Como Lista

- La implementación respeta la arquitectura modular.
- No hay lógica financiera duplicada innecesariamente.
- El dinero se maneja con Decimal/string.
- Las escrituras críticas son transaccionales.
- La operación es idempotente cuando corresponde.
- Los errores están controlados.
- No se expone información sensible.
- Se ejecutaron las verificaciones necesarias para el tipo de cambio realizado.
