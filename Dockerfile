# ═══════════════════════════════════════════════════════════════
#  Bantu Blog — Dockerfile (pure Bantu binary, no Node.js wrapper)
#  ──────────────────────────────────────────────────────────────
#  ARCHITECTURE
#    The Bantu binary v1.2.0+ now implements a real HTTP server
#    inside `sua.server.listen()` using POSIX sockets. It accepts
#    connections, parses HTTP, routes to Bantu handler functions,
#    and writes HTTP responses directly — no Node.js needed.
#
#    This Dockerfile ships:
#      • The Bantu binary (with libcurl + libsqlite3 deps)
#      • The server.b backend (full blog API in one Bantu file)
#      • The HTML/CSS/JS frontend (served by Bantu's static middleware)
#      • A persistent /data volume for blog.db
#
#  Build:
#    docker build -t bantu-blog .
#
#  Run:
#    docker run -p 8080:8080 -v bantu-blog-data:/data bantu-blog
#
#  Then open http://localhost:8080
# ═══════════════════════════════════════════════════════════════

FROM node:20-slim
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# Runtime deps for the Bantu binary:
#   libsqlite3-0        — SQLite (for sua.sqlite)
#   libcurl4-gnutls-dev — libcurl-gnutls.so.4 (for sua.http and the Bantu binary's startup)
#   libcurl4            — libcurl.so.4
#   libstdc++6          — C++ runtime
#   ca-certificates     — TLS roots
#   curl                — healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
        libsqlite3-0 \
        libcurl4 \
        libcurl4-gnutls-dev \
        libstdc++6 \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ─── Copy the Bantu backend and frontend ──────────────────────
COPY backend/bantu    /usr/local/bin/bantu
COPY backend/server.b ./server.b
COPY backend/schema.sql ./schema.sql
COPY backend/seed.sql   ./seed.sql
COPY backend/start.sh   ./start.sh
COPY frontend           ./public

RUN chmod +x /usr/local/bin/bantu

# ─── Persistent SQLite volume ─────────────────────────────────
RUN mkdir -p /data
ENV BANTU_BLOG_DB=/data/blog.db
ENV PORT=8080
VOLUME ["/data"]

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -sf http://localhost:8080/api/health || exit 1

# ─── Start: pure Bantu binary runs server.b and serves HTTP ───
CMD ["bantu", "run", "server.b"]
