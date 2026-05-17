FROM oven/bun:1.3.11 AS builder

WORKDIR /app

COPY package.json bun.lock ./
COPY backend/package.json ./backend/package.json
COPY packages/types/package.json ./packages/types/package.json
COPY packages/utils/package.json ./packages/utils/package.json

RUN bun install --frozen-lockfile

COPY backend ./backend
COPY packages ./packages

RUN bun run build:shared
RUN bun run --cwd backend prisma:generate
RUN bun run --cwd backend build

FROM oven/bun:1.3.11 AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/backend/package.json ./backend/package.json
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma

EXPOSE 3000

CMD ["node", "backend/dist/main.js"]
