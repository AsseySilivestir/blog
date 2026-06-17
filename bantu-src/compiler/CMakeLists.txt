cmake_minimum_required(VERSION 3.16)
project(bantu VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# ─── Compiler Flags for Maximum Performance ───
if(CMAKE_BUILD_TYPE STREQUAL "Release")
    set(CMAKE_CXX_FLAGS_RELEASE "-O3 -march=native -flto -fuse-linker-plugin")
    set(CMAKE_EXE_LINKER_FLAGS_RELEASE "-flto -s")
endif()

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
    target_link_libraries(bantu PRIVATE pthread sqlite3 curl dl)
endif()

# ─── Install ───
install(TARGETS bantu DESTINATION bin)
