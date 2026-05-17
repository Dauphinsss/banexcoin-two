# --- ESTADIO DE COMPILACIÓN ---
FROM oven/bun:alpine AS builder
WORKDIR /app

# Copiamos todo el monorepo (contexto = la raíz del repositorio)
COPY . .

# Instalamos todas las dependencias
RUN bun install --frozen-lockfile

# Generamos el cliente de Prisma dentro de backend
RUN bun run --cwd backend prisma:generate

# Compilamos los paquetes compartidos (types, utils)
RUN bun run build:shared || true

# Compilamos el backend
RUN bun run --cwd backend build

# --- ESTADIO DE PRODUCCIÓN ---
FROM oven/bun:alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copiamos todo desde el builder.
# En un monorepo, es la forma más segura y rápida de asegurar
# que los paquetes locales (workspaces) y prisma funcionen.
COPY --from=builder /app /app

WORKDIR /app/backend

EXPOSE 3000

# Ejecutamos el archivo compilado de NestJS usando el runtime de Bun
CMD ["bun", "run", "dist/main.js"]
