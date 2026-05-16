# BanexReintegra — Pitch

> **Lectura obligatoria antes de tocar UI visible en la demo, flujo de upload o cualquier texto que el jurado vaya a ver.**
>
> El pitch es 3 minutos. Cada segundo cuenta. Cada feature visible debe servir al pitch o no debe estar.

---

## La frase ancla (memorizar)

> **"6 horas a 45 segundos. 50 usuarios a 239. Cero errores."**

Esta frase aparece tres veces en el pitch:
1. En el hook (segundo 10) como tesis.
2. En la demo (segundo 100) como prueba.
3. En el cierre (segundo 160) como golpe final.

Si te olvidas todo lo demás, recuerda esta frase.

---

## La frase de cierre (memorizar)

> **"Esto no es un prototipo. Está dockerizado, testeado, y mañana lo pueden enchufar."**

El jurado de un hackathon ha visto 50 demos. Lo que diferencia un ganador es que parece producción, no concept.

---

## Estructura: 3 minutos

| Tiempo | Bloque | Mensaje |
|---|---|---|
| 0:00–0:15 | Hook | Quién duele y cuánto |
| 0:15–0:45 | Problema | Lo que el brief dice + lo que el brief NO dice |
| 0:45–1:30 | Solución | 4 cosas del brief + 2 extras que descubrimos |
| 1:30–3:00 | Demo en vivo | El Excel real, en pantalla, procesado en 45s |
| 3:00 | Cierre | Cifra ancla + frase de cierre + "gracias" |

---

## Hook (15s)

> "Bolivia paga el **87% de sus compras en efectivo**. Banexcoin está cambiando eso con pagos QR que ahorran al usuario en USDT.
>
> Pero hay un cuello de botella: el cashback que premia ese cambio se calcula **a mano, en Excel, para apenas 50 usuarios**. Hoy se los desenchufamos."

**Notas:**
- El "87%" es un dato real del Banco Central de Bolivia. Si te lo desafían, tienes fuente.
- "Se los desenchufamos" es coloquial — humano. Crea química con el jurado.
- No empezar con "Hola, somos el equipo X". El tiempo es oro. Entrar en el problema.

---

## Problema (30s)

> "Esta es la ficha técnica de Banexcoin. **La leímos completa.** El brief pide cuatro cosas:
> 1. Cargar Excel
> 2. Calcular niveles
> 3. Generar reportes
> 4. Preparar BanexTransfer
>
> Eso lo hace cualquiera.
>
> Lo que el brief no dice explícitamente — pero **está escondido en la hoja Servicios** del Excel que nos dieron — es que **los datos no siempre coinciden con el extracto bancario**.
>
> Sin detección de anomalías, esto es un sistema que paga reintegros que no deberían pagarse."

**Notas:**
- La frase "la leímos completa" comunica diligencia. Sutil pero efectivo.
- Mencionar "hoja Servicios" demuestra que entraste al detalle, no escaneaste.
- El último punto es el gancho: convertimos un nice-to-have en un must-have.

---

## Solución (45s)

> "**BanexReintegra** hace las cuatro cosas del brief y dos más:
>
> 1. Carga del Excel con preview e idempotencia por hash SHA-256
> 2. Cálculo por niveles con **promedio ponderado de tipo de cambio** intra-mes
> 3. Reportes en Excel y BanexTransfer listos para ejecutar
> 4. **Cuadre DEBE/HABER** replicando la hoja Saldos del Excel
> 5. **Conciliación automática contra el extracto bancario** (el extra #1)
> 6. **Simulador what-if** para ajustar políticas sin riesgo (el extra #2)
>
> Todo **100% independiente** del sistema actual de Banexcoin, como pide la ficha."

**Notas:**
- Enumerar 6 puntos rápido es difícil. Practica.
- Énfasis con la voz en los extras (#5 y #6).
- "100% independiente" responde directo a una restricción dura del brief.

---

## Demo en vivo (90s) — segundo a segundo

### 0:00–0:10 · Entrar al dashboard

→ Pantalla: dashboard limpio. Período mayo 2025 vacío.

> "Esta es la vista de Lorena, la operadora de Banexcoin. Hoy abre Excel. Mañana, abre esto."

### 0:10–0:25 · Drag & drop

→ Arrastrar el Excel real sobre el dropzone.

→ Preview aparece animado.

> "Detectó 5.325 transacciones de 239 usuarios. Período: abril a mayo 2025. Si subo el mismo archivo dos veces, lo detecta por hash y no duplica nada."

→ Clic en "Procesar".

### 0:25–0:55 · Procesamiento en vivo

→ Barra de progreso WebSocket, etiquetas cambian:
- "Leyendo archivo..."
- "Calculando reintegros..."
- "Conciliando con extracto bancario..." ← **pausa de 1 segundo**
- "Guardando resultados..."
- "Listo."

> "Cruzamos cada pago QR con el extracto bancario. **Esto no estaba en el brief.** Lo descubrimos leyendo la hoja Servicios del Excel."

### 0:55–1:15 · Resultados con counter

→ KPIs aparecen con counter animado:
- **1.847 USDT a reintegrar**
- **239 usuarios beneficiados**
- **2 anomalías detectadas**

→ Clic en el usuario más activo. Drawer lateral se abre.

→ Click en una transacción individual. Modal con `transactionId`, fecha, monto, tasa.

> "Cada reintegro es auditable hasta la transacción atómica. Cumple compliance de día uno."

### 1:15–1:40 · Innovación destacada

→ Volver. Clic en "Explicar con IA ✦" en panel de anomalías.

→ Pantalla muestra respuesta de Claude.

> "Esto es nuestro agente con Claude. En lugar de mostrarle al operador una lista de anomalías, le explica el patrón."

→ Cambio a Simulador. Mover un deslizador del Nivel 4. Gráfico se actualiza en vivo.

> "Esto está corriendo **en tu navegador**. Cero llamadas al servidor. Banexcoin puede simular ajustes antes de comprometerlos."

### 1:40–1:55 · Descarga

→ Clic en "Descargar BanexTransfer". El archivo cae con el formato exacto.

→ Abrir el archivo. Mostrar las columnas idénticas a la hoja `Transfers` del Excel original.

> "Mismo formato que ya usa Banexcoin. Cero fricción operativa."

### 1:55–2:00 · Transición al cierre

→ Volver al dashboard.

→ Mostrar 3 bullets finales.

---

## Cierre (15s)

> "**6 horas a 45 segundos. 50 usuarios a 239. Cero errores manuales.**
>
> Banexcoin pidió un sistema que minimice errores humanos y sea escalable. Aquí está.
>
> Esto no es un prototipo. Está dockerizado, testeado, y mañana lo pueden enchufar. Gracias."

**Notas:**
- Pausa de medio segundo después de "Cero errores manuales". Deja respirar la cifra.
- "Aquí está" señalando la pantalla.
- "Gracias" mirando al jurado, no a la pantalla.

---

## Preguntas anticipadas (Q&A)

### "¿Cómo manejan la precisión decimal?"

> "DECIMAL(20,8) en Postgres, decimal.js en TypeScript, banker's rounding. Nada de floats. Está documentado en CONVENTIONS.md."

### "¿Por qué Astro y no Next.js?"

> "Astro entrega cero JavaScript por defecto. Solo hidratamos las partes interactivas como islands. Más rápido para el operador, más simple para los 3 días."

### "¿Por qué NestJS y no Spring Boot?"

> "Iteración. TypeScript en ambos lados nos permite compartir tipos y reutilizar el motor de cálculo entre back y front. Spring Boot habría sido mejor si tuviéramos meses, no horas."

### "¿Qué pasa si el Excel tiene errores?"

> "Filas inválidas se reportan en una hoja de 'Errores de parseo' del Excel de salida. No abortamos el job entero. Solo si faltan headers críticos."

### "¿Y la seguridad?"

> "Validación con class-validator en cada entrada, SQL injection imposible por Prisma, sanitización a la salida contra CSV injection, rate limiting en endpoints sensibles, sin PII en logs. CONVENTIONS.md tiene los detalles."

### "¿Escalabilidad?"

> "BullMQ con Redis. Hoy procesa 5.325 transacciones en 25 segundos en un solo worker. Para 50.000, agregamos workers — el código no cambia."

### "¿Cómo se integra con el core de Banexcoin?"

> "No se integra. La ficha técnica lo prohíbe: el sistema debe ser independiente. Lorena descarga el archivo BanexTransfer y lo sube al sistema de Banexcoin como ya lo hace hoy. Reemplazamos el cálculo, no el flujo operativo."

### "¿Quién paga las llamadas a Claude?"

> "Una llamada por sesión cuando el operador pide explicación, con cache por hash de las anomalías. Estimación: <$0.10 por procesamiento mensual."

### "¿Auditoría?"

> "Cada upload tiene hash SHA-256, cada reintegro tiene `paidOut` y `paidOutAt`, cada anomalía es trazable. Soft delete en todo lo financiero. El roadmap incluye SSO y roles."

### "¿Pueden mostrarme el código?"

> "Sí — el repo es público. Tests en `packages/utils`, schema Prisma en `backend/prisma`, convenciones en `CONVENTIONS.md`."

---

## Lo que NO mostrar en la demo

- Pantallas vacías (estados sin datos). El dashboard inicial debe tener datos seed.
- Errores rojos en consola del navegador (revisar antes).
- El editor de código. Es una demo de producto, no de programación.
- Modales de "feature en construcción". Si no está listo, no se enseña.
- Animaciones lentas. Todo <300ms.
- El `package.json`, dependencias, "look at our stack". El jurado lo asume.

---

## Lo que SÍ mostrar (en orden de prioridad)

1. ✅ Upload con preview del Excel real.
2. ✅ Barra de progreso WebSocket con mensajes que cuentan la historia.
3. ✅ KPIs con counter animado.
4. ✅ Drilldown de la tabla al drawer al modal de transacción.
5. ✅ Panel de anomalías con "Explicar con IA".
6. ✅ Simulador with sliders moviéndose y gráfico vivo.
7. ✅ Descarga de BanexTransfer + abrir el archivo.
8. ✅ Dashboard final con la cifra "120x".

---

## Backup plan (si algo falla)

### Si la API no responde

- Tener una **versión seed** de DB pre-cargada con el resultado del Excel.
- Si BullMQ no procesa: navegar directamente a `/uploads/:id` del upload ya procesado.

### Si el WebSocket falla

- La pantalla de progreso tiene fallback a polling cada 1s. Practicar para que la latencia perceptible sea similar.

### Si Claude está caído

- "Explicar con IA" tiene respuesta cacheada del Excel del enunciado. La demo no llama al API si hay cache hit.

### Si el archivo Excel no carga

- Tener un archivo backup en USB. Tener el archivo abierto previamente en el navegador (drag desde Finder/Explorer al dropzone).

### Si la pantalla se cuelga

- F5. Sí, en serio. Los datos están en DB, no se pierden.

### Si pierdes el hilo en el pitch

- Volver a la frase ancla: **"6 horas a 45 segundos. 50 usuarios a 239. Cero errores."**
- Tres bullets, tres dedos. Memoria muscular.

---

## Estado emocional

- **Confianza, no arrogancia.** Sabemos qué construimos. No alardeamos.
- **Velocidad, no prisa.** El pitch fluye. Si hablas rápido, el jurado siente nervios.
- **Contacto visual con el jurado**, no con la pantalla. La pantalla es un apoyo, tú eres el mensaje.
- **Pausas estratégicas** después de cifras importantes. La pausa transmite seguridad.

---

## Slides (si las hay)

Solo 6, máximo. Una por bloque de tiempo:

1. **Hook visual** — un dato de Bolivia / pagos digitales (foto, no texto).
2. **El brief desglosado** — lista de las 4 cosas que pide.
3. **Lo que descubrimos** — la frase de la hoja `Servicios` resaltada.
4. **Nuestra solución** — 6 bullets, sin sub-bullets.
5. **Demo** — pantalla compartida del producto en vivo. **No screenshots.**
6. **Cifra final** — solo la frase ancla, en grande, sobre fondo oscuro.

Fuente sugerida: **Inter** o **Aptos**. Tamaños grandes (mínimo 32pt). Fondo oscuro (#0b1526) con acento azul (#1a56db).

---

## Categoría por categoría: cómo el pitch las dispara

| Categoría | Momento del pitch que la dispara |
|---|---|
| **Gran Premio** | Cierre: "Está dockerizado, testeado, mañana lo pueden enchufar" |
| **Solución empresarial** | Solución (segundos 45-90): los 6 puntos + audit trail |
| **Solución social** | Hook: "el 87% paga en efectivo" — inclusión financiera |
| **Mejor pitch** | Toda la estructura. Frase ancla repetida 3 veces. Cierre seco. |
| **Mejor UI/UX** | Demo segundos 25-55: preview, progreso WS, microcopy en español |
| **Innovación tecnológica** | Demo 55-100: Claude explica, simulador en navegador, conciliación |

---

## Checklist 24h antes del pitch

- [ ] Ensayar el pitch completo 5 veces, cronometrado.
- [ ] Tener el archivo Excel del enunciado en el escritorio, listo para arrastrar.
- [ ] Verificar que el seed cargó datos demo.
- [ ] Probar el flujo completo end-to-end sin errores en consola.
- [ ] Tener `docker compose up` corriendo y verificado.
- [ ] Cargar el repo público y compartir el link en las slides.
- [ ] Dormir. El cansancio se transmite.
