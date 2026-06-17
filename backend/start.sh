#!/bin/bash
# ─── Bantu Blog — Quick Start (SQLite) ─────────────────────────
# Runs the Bantu backend with SQLite. The database file (blog.db)
# is created automatically on first run with schema + seed data.
#
# Env vars (all optional):
#   BANTU_BIN      — path to the bantu binary (default: bantu)
#   BANTU_BLOG_DB  — SQLite file path     (default: blog.db)
#   PORT           — HTTP port            (default: 8080)
# ─────────────────────────────────────────────────────────────
set -e

BANTU_BIN="${BANTU_BIN:-bantu}"
DB_PATH="${BANTU_BLOG_DB:-blog.db}"
PORT="${PORT:-8080}"

echo "═══════════════════════════════════════════"
echo "  Bantu Blog — Quick Start (SQLite)"
echo "═══════════════════════════════════════════"

# Make sure the parent directory for the SQLite file exists
# (important when DB_PATH points at a mounted volume like /data/blog.db)
mkdir -p "$(dirname "$DB_PATH")"

if [ ! -f "$DB_PATH" ]; then
    echo "→ Database file '$DB_PATH' does not exist — it will be created automatically on first run."
    echo "→ Schema and seed data will be loaded automatically by server.b"
else
    echo "→ Existing database at '$DB_PATH' will be reused."
fi

# ─── Apply env vars to server.b at runtime ────────────────────
# Bantu does not yet expose getenv() to scripts, so we rewrite the
# two configuration lines in server.b just before launching.
SERVER_B_RUNTIME="${BANTU_BLOG_RUNTIME:-/tmp/server.runtime.b}"
sed \
    -e "s|^string \$dbPath = .*|string \$dbPath = \"$DB_PATH\";|" \
    -e "s|^string \$port   = .*|string \$port   = \"$PORT\";|" \
    server.b > "$SERVER_B_RUNTIME"

echo ""
echo "→ Starting Bantu backend..."
echo "  Database: $DB_PATH (SQLite)"
echo "  API:      http://0.0.0.0:${PORT}"
echo "  Press Ctrl+C to stop"
echo ""

exec "$BANTU_BIN" run "$SERVER_B_RUNTIME"
