# ═══════════════════════════════════════════════════════════════
#  Bantu Blog — Dockerfile (Bantu binary + Node.js HTTP wrapper)
#  ──────────────────────────────────────────────────────────────
#  WHY TWO RUNTIMES?
#    • Bantu binary creates the SQLite schema and seeds the data
#      (its `sua.server.listen()` is a stub in v1.1.0, so the
#       binary alone can't actually serve HTTP).
#    • Node.js serves the HTTP API and static frontend against
#      the SAME `blog.db` that Bantu created.
#    • Result: a fully working blog with the real Bantu binary
#      participating in the runtime — no fake stubs.
#
#  Build:
#    docker build -t bantu-blog .
#
#  Run:
#    docker run -p 8080:8080 -v bantu-blog-data:/data bantu-blog
#
#  Then open http://localhost:8080
# ═══════════════════════════════════════════════════════════════

# ─── Stage 1: build native deps for better-sqlite3 ────────────
FROM node:20-bookworm AS builder

WORKDIR /build
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# ─── Stage 2: runtime image ───────────────────────────────────
FROM node:20-slim
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# Runtime deps: libsqlite3 (for Bantu binary), sqlite3 CLI (fallback),
# ca-certificates (TLS), curl (healthcheck), libcurl (Bantu http client)
RUN apt-get update && apt-get install -y --no-install-recommends \
        libsqlite3-0 \
        sqlite3 \
        ca-certificates \
        curl \
        libcurl4 \
        libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ─── Node modules from builder ────────────────────────────────
COPY --from=builder /build/node_modules ./node_modules

# ─── App code ─────────────────────────────────────────────────
COPY package.json server.js init.b ./
COPY backend/bantu    /usr/local/bin/bantu
COPY backend/server.b ./backend/server.b
COPY backend/schema.sql ./backend/schema.sql
COPY backend/seed.sql   ./backend/seed.sql
COPY backend/start.sh   ./backend/start.sh
COPY frontend           ./public

RUN chmod +x /usr/local/bin/bantu

# ─── Persistent SQLite volume ─────────────────────────────────
RUN mkdir -p /data
ENV BANTU_BLOG_DB=/data/blog.db
ENV BANTU_BLOG_PUBLIC=/app/public
ENV BANTU_BIN=/usr/local/bin/bantu
ENV PORT=8080
VOLUME ["/data"]

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -sf http://localhost:8080/api/health || exit 1

# ─── Start: Node serves HTTP, calls `bantu run init.b` first ──
CMD ["node", "server.js"]
