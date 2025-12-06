FROM oven/bun:1-debian AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lockb* ./

RUN bun install --frozen-lockfile --production

FROM base AS build
RUN apt-get update && apt-get install -y python3 make g++ gcc && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile
COPY . .

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000

# Install postgresql-client for pg_isready
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 bunuser

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build --chown=bunuser:nodejs /app .

# Create models directory
RUN mkdir -p /app/models && \
    chown -R bunuser:nodejs /app/models

# Copy entrypoint script
COPY --chown=bunuser:nodejs entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

USER bunuser

EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["bun", "run", "start"]
