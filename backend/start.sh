#!/bin/bash
# ─── Bantu Blog — Quick Start (SQLite) ─────────────────────────
# Runs the Bantu backend with SQLite. The database file (blog.db)
# is created automatically on first run with schema + seed data.
# ─────────────────────────────────────────────────────────────
set -e

BANTU_BIN="${BANTU_BIN:-bantu}"
DB_PATH="${BANTU_BLOG_DB:-blog.db}"

echo "═══════════════════════════════════════════"
echo "  Bantu Blog — Quick Start (SQLite)"
echo "═══════════════════════════════════════════"

if [ ! -f "$DB_PATH" ]; then
    echo "→ Database file '$DB_PATH' does not exist — it will be created automatically on first run."
    echo "→ Schema and seed data will be loaded automatically by server.b"
fi

echo ""
echo "→ Starting Bantu backend..."
echo "  Database: $DB_PATH (SQLite)"
echo "  API:      http://localhost:${PORT:-8080}"
echo "  Press Ctrl+C to stop"
echo ""

exec "$BANTU_BIN" run server.b
