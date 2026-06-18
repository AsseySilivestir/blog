# Bantu Blog — Pure Bantu + Sua + SQLite

A complete blog application with **posts, comments, likes, and shares** — built with the
[Bantu programming language](https://github.com/AsseySilivestir/blog) and the **Sua**
web framework, persisted on **SQLite**.

> **v1.1.0** — The Bantu binary now serves HTTP directly via `sua.server.listen()`.
> No Node.js wrapper, no fallback. Real Bantu serving real HTTP.

---

## Project structure

```
.
├── backend/                Bantu + Sua backend (server.b)
│   ├── bantu               The Bantu binary (Linux x86_64, v1.2.0+)
│   ├── server.b            The entire API in one Bantu file
│   ├── schema.sql          SQLite schema (for manual inspection)
│   ├── seed.sql            Seed data (loaded automatically on first run)
│   ├── start.sh            Convenience wrapper to run the backend
│   └── README.md           Backend-specific docs
├── frontend/               Pure HTML + CSS + JS frontend
│   ├── index.html          Blog UI
│   ├── style.css           Dark theme styles
│   └── app.js              API client + localStorage fallback
├── Dockerfile              Docker image (pure Bantu, no Node.js)
├── render.yaml             Render blueprint (auto-deploy on push)
└── README.md               This file
```

---

## How it works

```
Browser ──HTTP──> Bantu binary (sua.server.listen :8080)
                      │
                      ├──> sua.server.get("/api/posts", handleListPosts)
                      ├──> sua.server.post("/api/posts", handleCreatePost)
                      ├──> sua.server.static("./public")    ← serves frontend
                      └──> sua.sqlite.open("/data/blog.db") ← SQLite
```

The Bantu binary is a C++ tree-walking interpreter. In v1.2.0+ the
`sua.server.listen(port)` function:

1. Opens a real POSIX socket
2. Binds to `0.0.0.0:port`
3. Accepts connections in a loop
4. For each request: parses HTTP, matches routes (with `:param` support),
   builds `$req` (method/path/params/query/headers/body) and `$res`
   (json/send/status/set/redirect with chaining) objects, calls the
   Bantu handler function, then writes the HTTP response back.
5. Static files are served from the directory passed to `sua.server.static()`.

No Node.js, no Python, no nginx — just Bantu.

---

## Features

- **Posts** — create, list, view, delete
- **Comments** — add comments to any post
- **Likes** — toggle like / unlike (one like per author per post)
- **Shares** — record share events (Twitter, Facebook, WhatsApp, copy-link)
- **Stats** — aggregate counts across all entities
- **CORS** — open CORS for easy integration with any frontend
- **Static serving** — backend serves the frontend from `./public`
- **SQLite** — zero-config file database, created automatically on first run
- **Persistent volume** — `/data/blog.db` survives container restarts on Render/Docker
- **localStorage fallback** — frontend keeps working even if the backend is offline

---

## Backend (Bantu + Sua + SQLite)

### Run locally

```bash
cd backend
./bantu run server.b
```

On first run, Bantu will:

1. Try `/data/blog.db`; if not writable, use `./blog.db`
2. Create the schema (`posts`, `comments`, `likes`, `shares`)
3. Seed 3 sample posts with comments, likes, and shares
4. Register all API routes
5. Start listening on `http://0.0.0.0:8080` (real HTTP server)

### API endpoints

| Method   | Endpoint                       | Description              |
|----------|--------------------------------|--------------------------|
| GET      | `/api/health`                  | Health check             |
| GET      | `/api/posts`                   | List all posts           |
| GET      | `/api/posts/:id`               | Get one post + comments  |
| POST     | `/api/posts`                   | Create a post            |
| DELETE   | `/api/posts/:id`               | Delete a post            |
| POST     | `/api/posts/:id/comments`      | Add a comment            |
| POST     | `/api/posts/:id/like`          | Like / unlike a post     |
| POST     | `/api/posts/:id/share`         | Record a share           |
| GET      | `/api/stats`                   | Aggregate stats          |
| OPTIONS  | `/*`                           | CORS preflight           |

### Example requests

```bash
# Create a post
curl -X POST http://localhost:8080/api/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"Hello","body":"My first post","author":"Me"}'

# Like a post
curl -X POST http://localhost:8080/api/posts/1/like \
  -H "Content-Type: application/json" \
  -d '{"author":"alice"}'

# Add a comment
curl -X POST http://localhost:8080/api/posts/1/comments \
  -H "Content-Type: application/json" \
  -d '{"author":"bob","body":"Nice post!"}'
```

---

## Deploy

### Render (recommended — already configured)

The included `render.yaml` lets Render auto-deploy on every push to `main`:

1. Push this repo to GitHub (already done if you're reading this on GitHub)
2. Go to https://render.com/i/deploy
3. Pick the `AsseySilivestir/blog` repo
4. Render reads `render.yaml` and creates:
   - A Docker web service
   - A 1 GB persistent disk at `/data` (so `blog.db` survives restarts)
   - HTTPS endpoint at `https://bantu-blog.onrender.com`

### Docker

```bash
docker build -t bantu-blog .
docker run -p 8080:8080 -v bantu-blog-data:/data bantu-blog
```

### Vercel (frontend only)

The frontend in `/frontend/` is a static site and can be hosted on Vercel.
The backend must run on a long-lived server (Render, Railway, Fly.io, VPS) —
Vercel only runs Node.js serverless functions and cannot host the Bantu binary.

---

## Why Bantu?

Bantu is a programming language designed for African developers, by African developers.

- Familiar C-like syntax with `$` variable prefixes
- English keywords: `print`, `def`, `class`, `each`, `return`, `if`, `while`
- Full OOP support — classes, inheritance, methods
- Built-in **Sua** web framework (Express-like, real HTTP server)
- SQLite and PostgreSQL out of the box
- Real-time ready — channels, broadcast, WebRTC signaling

---

## License

MIT — same as the Bantu language.
