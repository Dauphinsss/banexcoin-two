# --- ESTADIO DE COMPILACIÓN ---
FROM oven/bun:alpine AS builder
WORKDIR /app

# Copiamos los archivos de dependencias de Bun
COPY package*.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# --- ESTADIO DE PRODUCCIÓN ---
FROM oven/bun:alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json bun.lock ./
# Instala solo las dependencias necesarias para producción
RUN bun install --production --frozen-lockfile

COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Ejecutamos el archivo compilado de NestJS usando el runtime de Bun
CMD ["bun", "run", "dist/main.js"]