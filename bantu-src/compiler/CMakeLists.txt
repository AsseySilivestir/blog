cmake_minimum_required(VERSION 3.16)
project(bantu VERSION 1.0.0 LANGUAGES CXX C)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# ─── Compiler Flags for Maximum Performance + Portability ───
# NOTE: -march=native is intentionally removed — the binary must run on
# older CPUs (Render's free tier uses generic x86-64).
# We target x86-64-v1 (baseline SSE2) which works on every 64-bit Intel/AMD CPU.
if(CMAKE_BUILD_TYPE STREQUAL "Release")
    set(CMAKE_CXX_FLAGS_RELEASE "-O2 -mtune=generic -fno-lto")
    set(CMAKE_EXE_LINKER_FLAGS_RELEASE "")
endif()

# Always-on compatibility flags
add_compile_options(
    -ffile-prefix-map=${CMAKE_SOURCE_DIR}=.
    -fno-plt
)

# ─── Source Files ───
set(SOURCES
    src/main.cpp
    src/lexer.cpp
    src/parser.cpp
    src/evaluator.cpp
    src/ast.cpp
    src/types.cpp
    src/function.cpp
    src/class.cpp
)

# ─── Compatibility Stub ───
# Provides _ZSt21ios_base_library_initv as a no-op so the binary doesn't
# require GLIBCXX_3.4.32 (only available on GCC 14+ runtimes). This lets
# the binary run on Ubuntu 22.04's libstdc++ (GCC 11).
enable_language(C)
add_library(ios_stub STATIC stubs/ios_base_library_initv.c)
set_target_properties(ios_stub PROPERTIES POSITION_INDEPENDENT_CODE ON)


set(HEADERS
    src/types.hpp
    src/lexer.hpp
    src/parser.hpp
    src/evaluator.hpp
    src/ast.hpp
    src/environment.hpp
    src/function.hpp
    src/class.hpp
    src/server.hpp
    src/template.hpp
)

# ─── Main Executable ───
add_executable(bantu ${SOURCES} ${HEADERS})

target_include_directories(bantu PRIVATE ${CMAKE_SOURCE_DIR}/src)

# ─── Threading Support ───
find_package(Threads REQUIRED)
target_link_libraries(bantu PRIVATE Threads::Threads)

# ─── Platform-Specific Settings ───
if(WIN32)
    target_compile_definitions(bantu PRIVATE _WIN32_WINNT=0x0601)
    target_link_libraries(bantu PRIVATE ws2_32)
endif()

if(UNIX AND NOT APPLE)
    target_link_libraries(bantu PRIVATE pthread sqlite3 curl dl ios_stub)
endif()

# ─── Install ───
install(TARGETS bantu DESTINATION bin)
