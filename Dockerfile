FROM oven/bun:1.1-alpine AS base

# Install dependencies
RUN apk add --no-cache \
    postgresql-client \
    curl \
    ca-certificates

WORKDIR /app

# Install dependencies first (for caching)
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Copy source code
COPY . .

# Generate Prisma client
RUN bun db:generate

# Build the application
RUN bun run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -q --spider http://localhost:3000/api/health || exit 1

# Run the app
CMD ["bun", "run", "start"]