#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
#  build.sh — Build the Bantu interpreter binary
#
#  Produces a portable Linux x86-64 binary that runs on:
#    - Ubuntu 22.04 (Render's free tier)  ← glibc 2.35
#    - Ubuntu 24.04                       ← glibc 2.39
#    - Debian 12 / 13                     ← glibc 2.36 / 2.41
#
#  Compatibility strategy:
#    1. Avoid std::strtol / std::stoull / std::atoi  (pull in __isoc23_*@GLIBC_2.38)
#    2. Avoid std::fmod                                (pulls fmod@GLIBC_2.38)
#    3. Stub out _ZSt21ios_base_library_initv         (pulls GLIBCXX_3.4.32)
#    4. -mtune=generic, no -march=native               (CPU portability)
#
#  Max required after build:
#    GLIBC_2.34, GLIBCXX_3.4.29  →  all ≤ Ubuntu 22.04's runtime
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "▸ Cleaning previous build…"
rm -rf build
mkdir -p build

echo "▸ Compiling ios_base_library_initv stub…"
gcc -O2 -c stubs/ios_base_library_initv.c -o build/ios_stub.o

echo "▸ Compiling bantu (C++17, O2, mtune=generic)…"
g++ -std=c++17 -O2 -mtune=generic -fno-plt -pthread \
    -I src \
    src/main.cpp src/lexer.cpp src/parser.cpp src/evaluator.cpp \
    src/ast.cpp src/types.cpp src/function.cpp src/class.cpp \
    build/ios_stub.o \
    -o build/bantu \
    -lsqlite3 -lcurl -ldl

echo "▸ Built: $(ls -la build/bantu | awk '{print $5, $NF}')"
echo
echo "── glibc requirements ──"
objdump -T build/bantu 2>/dev/null \
    | grep -oE 'GLIBC[X_]*[0-9]+\.[0-9]+' \
    | sort -u
echo
echo "── Max GLIBC required ──"
objdump -T build/bantu 2>/dev/null \
    | grep -oE 'GLIBC_[0-9]+\.[0-9]+' \
    | sort -u | tail -1
echo
echo "── Max GLIBCXX required ──"
objdump -T build/bantu 2>/dev/null \
    | grep -oE 'GLIBCXX_[0-9]+\.[0-9]+\.[0-9]+' \
    | sort -u | tail -1
echo
echo "✓ Build complete."
