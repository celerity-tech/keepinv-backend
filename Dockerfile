# --- Builder Stage ---
FROM oven/bun:alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat

# Copy configuration files
COPY package.json bun.lock ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install all dependencies
RUN bun install --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Generate Prisma client
RUN DATABASE_URL="postgresql://localhost:5432" bun prisma generate

# Build the NestJS application
RUN bun run build

# --- Runner Stage ---
FROM oven/bun:alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache libc6-compat

# Copy everything from builder
COPY --from=builder /app ./

EXPOSE 8000

# Run migrations as the OWNER (DIRECT_URL; falls back to DATABASE_URL), then start the app
# as the runtime role (DATABASE_URL = least-privilege app_user, so RLS is enforced).
CMD ["sh", "-c", "until DATABASE_URL=\"${DIRECT_URL:-$DATABASE_URL}\" bunx prisma migrate deploy; do echo 'DB not ready, retrying in 5s...'; sleep 5; done && bun dist/src/main.js"]
