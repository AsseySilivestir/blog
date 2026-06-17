# ═══════════════════════════════════════════════════════════════
#  Bantu Blog — Dockerfile (pure Node.js + better-sqlite3)
#  ──────────────────────────────────────────────────────────────
#  ARCHITECTURE
#    • Node.js + better-sqlite3 serves HTTP and manages SQLite.
#    • Schema creation + seed data are done in pure SQL inside
#      server.js — NO Bantu binary call at runtime.
#    • The Bantu binary is still bundled for users who want to
#      `docker exec` in and try `bantu run backend/server.b`, but
#      it is NOT required for the blog to function.
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

# Runtime deps: libsqlite3 (better-sqlite3 + optional Bantu binary),
# sqlite3 CLI (manual inspection), ca-certificates (TLS),
# curl (healthcheck), libcurl-gnutls (so Bantu binary can run if invoked)
RUN apt-get update && apt-get install -y --no-install-recommends \
        libsqlite3-0 \
        sqlite3 \
        ca-certificates \
        curl \
        libcurl4 \
        libcurl4-gnutls-dev \
        libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ─── Node modules from builder ────────────────────────────────
COPY --from=builder /build/node_modules ./node_modules

# ─── App code ─────────────────────────────────────────────────
COPY package.json server.js ./
COPY backend/bantu    /usr/local/bin/bantu
COPY backend/server.b ./backend/server.b
COPY backend/schema.sql ./backend/schema.sql
COPY backend/seed.sql   ./backend/seed.sql
COPY backend/start.sh   ./backend/start.sh
COPY frontend           ./public

RUN chmod +x /usr/local/bin/bantu 2>/dev/null || true

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

# ─── Start: Node serves HTTP + initializes schema directly ─────
CMD ["node", "server.js"]
