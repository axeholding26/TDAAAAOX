# ── Stage 1: Dépendances ──────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV SKIP_ENV_VALIDATION=true
# Active output: "standalone" dans next.config.ts — sans elle, .next/standalone
# n'existe pas et l'étape COPY du runner échoue.
ENV DOCKER_BUILD=1

RUN npm run build

# ── Stage 3: Production ───────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Auth.js refuse les hôtes non déclarés hors Vercel (erreur "UntrustedHost" →
# connexion impossible) : le serveur est derrière votre domaine / reverse proxy.
ENV AUTH_TRUST_HOST=true

CMD ["node", "server.js"]
