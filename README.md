# Bantu Blog

A complete blog application with **posts, comments, likes, and shares** — built with the
[Bantu programming language](https://github.com/AsseySilivestir/bantu-lang), the **Sua**
web framework, **SQLite** for storage, and a tiny **Node.js HTTP wrapper** (because
Bantu v1.1.0's `sua.server.listen()` is a stub).

> Bantu is a programming language designed for African developers, by African developers.
> It uses familiar C-like syntax with English keywords, supports classes and inheritance,
> and includes a built-in web framework called **Sua**.

---

## Project structure

```
.
├── Dockerfile              Docker image: Bantu binary + Node.js HTTP wrapper
├── render.yaml             One-click Render blueprint (web service + 1 GB disk)
├── vercel.json             Vercel static-hosting config (frontend only)
├── package.json            Node deps (better-sqlite3)
├── server.js               Node.js HTTP server (the actual API listener)
├── init.b                  Bantu script — creates schema + seeds data
├── .dockerignore
├── .gitignore
├── README.md
├── backend/                Bantu + Sua + SQLite (the language reference impl)
│   ├── bantu               Linux x86_64 Bantu binary (committed for Docker)
│   ├── server.b            Original Bantu-only backend (reference)
│   ├── schema.sql          SQLite schema (for manual inspection)
│   ├── seed.sql            Seed data
│   ├── start.sh            Wrapper to run `bantu run server.b` locally
│   └── README.md
└── frontend/               Pure HTML + CSS + JS frontend
    ├── index.html
    ├── style.css
    └── app.js              (uses relative API URLs by default)
```

---

## Features

- **Posts** — create, list, view, delete
- **Comments** — add comments to any post
- **Likes** — toggle like / unlike (one like per author per post)
- **Shares** — record share events (Twitter, Facebook, WhatsApp, copy-link)
- **Stats** — aggregate counts across all entities
- **CORS** — open CORS for easy integration with any frontend
- **Static serving** — backend serves the frontend from `/app/public`
- **SQLite** — zero-config file database, created automatically on first run
- **Persistent volume** — `/data/blog.db` survives container restarts on Render
- **localStorage fallback** — frontend keeps working even when the backend is offline
- **Healthcheck** — `GET /api/health` returns 200 with version info

---

## Why Node.js + Bantu in the same container?

The Bantu binary v1.1.0 ships with `sua.server.listen()` as a **stub** — it prints
"Listening on port 8080" and returns immediately without actually binding a socket.
The full HTTP server code exists in `bantu-lang/compiler/src/server.hpp` but isn't
wired up to the script-level `listen()` call.

To ship a working blog today, we use a hybrid:

| Layer | What it does |
|-------|--------------|
| `bantu run init.b` | Opens SQLite, creates schema, seeds sample posts |
| `node server.js`   | Serves the HTTP API + static frontend against the same `blog.db` |

Both layers share the **same SQLite database file** — so the Bantu binary is a real
runtime participant (it owns DB initialization), and Node handles HTTP I/O until
Bantu's `sua.server.listen()` becomes a real listener in a future release.

---

## Deploy to Render (one click)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

1. Click the button above (or go to https://render.com/i/deploy)
2. Pick the `AsseySilivestir/blog` repo
3. Render reads `render.yaml` and creates:
   - A Docker web service (free tier)
   - A 1 GB persistent disk mounted at `/data`
   - An HTTPS endpoint at `https://bantu-blog.onrender.com`
4. Click **Deploy** — first build takes ~3 minutes (mostly `apt-get` + `npm install`)
5. Once healthy, open the URL — your blog is live with real backend + SQLite

### Manual Render deploy

1. https://dashboard.render.com/select-repo
2. Pick `AsseySilivestir/blog`
3. Render auto-detects `Dockerfile`
4. Set environment variables:
   - `PORT` = `8080`
   - `BANTU_BLOG_DB` = `/data/blog.db`
   - `BANTU_BLOG_PUBLIC` = `/app/public`
5. Add a **disk** (1 GB free) mounted at `/data`
6. Deploy

---

## Deploy to Vercel (frontend only)

Vercel only runs Node.js serverless functions — it can't run the Bantu binary or
a long-lived HTTP server. But the static frontend works on Vercel with
**localStorage fallback** so the demo always works.

1. Push this repo to GitHub (already done if you're reading this on GitHub)
2. Go to https://vercel.com/new
3. Import `AsseySilivestir/blog`
4. Vercel auto-detects it as a static site (no build step)
5. Click **Deploy** — your blog frontend is live at `https://blog-xxx.vercel.app`

For Vercel + live backend, deploy the backend to Render (above) and set
`window.BANTU_BLOG_API = 'https://bantu-blog.onrender.com'` in `frontend/index.html`.

---

## Run locally with Docker

```bash
docker build -t bantu-blog .
docker run -p 8080:8080 -v bantu-blog-data:/data bantu-blog
```

Then open http://localhost:8080.

---

## Run locally without Docker

```bash
# 1. Install Node deps
npm install

# 2. (Optional) Initialize the DB with the Bantu binary
bantu run init.b    # creates blog.db in /data (set BANTU_BLOG_DB to override)

# 3. Start the HTTP server
BANTU_BLOG_DB=./blog.db BANTU_BLOG_PUBLIC=./frontend npm start
```

Then open http://localhost:8080.

---

## API endpoints

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

## Why Bantu?

Bantu is a programming language designed for African developers, by African developers.

- Familiar C-like syntax with `$` variable prefixes
- English keywords: `print`, `def`, `class`, `each`, `return`, `if`, `while`
- Full OOP support — classes, inheritance, methods
- Built-in **Sua** web framework (Express-like)
- SQLite and PostgreSQL out of the box
- Real-time ready — channels, broadcast, WebRTC signaling

---

## License

MIT — same as the Bantu language.
