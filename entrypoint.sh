#!/bin/bash
set -e

echo "🚀 Starting OpenLore API..."

# Ensure models directory exists
if [ ! -d "/app/models" ]; then
    echo "📁 Creating models directory..."
    mkdir -p /app/models
fi

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL..."
until pg_isready -h "${POSTGRES_HOST:-postgres}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-openlore}" -q; do
    echo "   PostgreSQL is unavailable - sleeping"
    sleep 2
done
echo "✅ PostgreSQL is ready!"

# Run migrations
echo "🔄 Running database migrations..."
echo "🔍 Database URL: ${DATABASE_URL%%:*}://...@${DATABASE_URL##*@}"
bun run migrate

echo "✅ Migrations complete"

# Execute the main command
exec "$@"
