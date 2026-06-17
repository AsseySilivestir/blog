# ═══════════════════════════════════════════════════════════════
#  Bantu Blog — Dockerfile (multi-stage, builds Bantu from source)
#  ──────────────────────────────────────────────────────────────
#  WHY MULTI-STAGE?
#    The Bantu binary built on a dev machine targets glibc 2.38,
#    but Render's runtime image only has glibc 2.36.  Building
#    Bantu *inside* Docker guarantees the binary is linked against
#    the exact same glibc it will run against.  No more
#    "GLIBC_2.38 not found" errors.
#
#  ARCHITECTURE
#    Stage 1 (builder)  — compiles the Bantu interpreter from C++17 source
#    Stage 2 (runtime)  — slim image that runs the freshly-built binary
#
#  The Bantu binary v1.2.0+ implements a real HTTP server inside
#  `sua.server.listen()` using POSIX sockets — no Node.js needed.
#
#  Build:  docker build -t bantu-blog .
#  Run:    docker run -p 8080:8080 -v bantu-blog-data:/data bantu-blog
# ═══════════════════════════════════════════════════════════════

# ─── Stage 1: Builder ─────────────────────────────────────────
FROM debian:bookworm-slim AS builder

ENV DEBIAN_FRONTEND=noninteractive

# Build deps:
#   build-essential  g++ make
#   cmake            build system
#   libsqlite3-dev   SQLite headers + libs (for sua.sqlite)
#   libcurl4-gnutls-dev  libcurl-gnutls.so.4 (Bantu binary startup dep)
#   pkg-config       cmake find_package glue
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        cmake \
        pkg-config \
        libsqlite3-dev \
        libcurl4-gnutls-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy Bantu interpreter source
COPY bantu-src/compiler/ ./

# Build (Release, no -march=native so the binary is portable across CPUs)
RUN cmake -S . -B build \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_CXX_FLAGS_RELEASE="-O3 -flto" \
        -DCMAKE_EXE_LINKER_FLAGS_RELEASE="-flto -s" \
    && cmake --build build --parallel "$(nproc)" \
    && file build/bantu \
    && ldd build/bantu

# ─── Stage 2: Runtime ─────────────────────────────────────────
FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# Runtime deps for the freshly-built Bantu binary:
#   libsqlite3-0           SQLite shared lib
#   libcurl3-gnutls        provides libcurl-gnutls.so.4
#   libcurl4               provides libcurl.so.4 (http client)
#   libstdc++6             C++ runtime
#   ca-certificates        TLS roots
#   curl                   healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
        libsqlite3-0 \
        libcurl3-gnutls \
        libcurl4 \
        libstdc++6 \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the freshly-built binary (matches this image's glibc exactly)
COPY --from=builder /build/build/bantu /usr/local/bin/bantu
RUN chmod +x /usr/local/bin/bantu && ldd /usr/local/bin/bantu

# Copy the Bantu backend + frontend
COPY backend/server.b   ./server.b
COPY backend/schema.sql ./schema.sql
COPY backend/seed.sql   ./seed.sql
COPY backend/start.sh   ./start.sh
COPY frontend           ./public

# Persistent SQLite volume
RUN mkdir -p /data
ENV BANTU_BLOG_DB=/data/blog.db
ENV PORT=8080
VOLUME ["/data"]

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -sf http://localhost:8080/api/health || exit 1

# Pure Bantu — no Node.js in the critical path
CMD ["bantu", "run", "server.b"]
