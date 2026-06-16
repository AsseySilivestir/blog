# Bantu Blog

A complete blog application with **posts, comments, likes, and shares** — built with the
[Bantu programming language](https://github.com/AsseySilivestir/bantu-lang) and the **Sua**
web framework, persisted on **SQLite**.

> Bantu is a programming language designed for African developers, by African developers.
> It uses familiar C-like syntax with English keywords, supports classes and inheritance,
> and includes a built-in web framework called **Sua**.

---

## Project structure

```
.
├── backend/                Bantu + Sua backend (server.b)
│   ├── server.b            The entire API in one Bantu file
│   ├── schema.sql          SQLite schema (for manual inspection)
│   ├── seed.sql            Seed data (loaded automatically on first run)
│   ├── start.sh            Convenience wrapper to run the backend
│   └── README.md           Backend-specific docs
├── frontend/               Pure HTML + CSS + JS frontend
│   ├── index.html          Blog UI
│   ├── style.css           Dark theme styles
│   └── app.js              API client + localStorage fallback
├── vercel.json             Vercel static-hosting config
└── README.md               This file
```

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
- **localStorage fallback** — frontend keeps working even when the backend is offline

---

## Backend (Bantu + Sua + SQLite)

### Prerequisites

- **Bantu binary** — install from https://my-project-five-self.vercel.app/
  (or build from source)
- *(optional)* `sqlite3` CLI — only if you want to inspect the database manually

### Run

```bash
cd backend
bantu run server.b
```

On first run, Bantu will:

1. Create `blog.db` (SQLite file) in the current directory
2. Create the schema (`posts`, `comments`, `likes`, `shares`)
3. Seed 3 sample posts with comments, likes, and shares
4. Register all API routes
5. Start listening on `http://localhost:8080`

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

### Inspect the database

```bash
sqlite3 blog.db
sqlite> .tables
sqlite> SELECT * FROM posts;
sqlite> SELECT COUNT(*) FROM likes;
```

See [`backend/README.md`](./backend/README.md) for full backend docs.

---

## Frontend (HTML + CSS + JS)

The frontend is a single-page app with no framework — just vanilla HTML, CSS, and JS.

- **Dark theme** with Bantu-brand orange accents
- **Auto-detects backend**: tries `http://localhost:8080/api/health` on load
  - If reachable → live mode (all data comes from the SQLite backend)
  - If unreachable → demo mode (all data persists to `localStorage` so the UI
    still works for evaluation)

### Run locally

Just open `frontend/index.html` in a browser, or serve it with any static server:

```bash
cd frontend
python3 -m http.server 5173
# open http://localhost:5173
```

---

## Deploy to Vercel

The frontend is a static site, so Vercel can host it for free.

### Option A — via Vercel dashboard

1. Push this repo to GitHub (already done if you're reading this on GitHub).
2. Go to https://vercel.com/new
3. Import the repo
4. Vercel auto-detects it as a static site (no build step needed)
5. Click **Deploy**

### Option B — via Vercel CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

`vercel.json` is already configured to serve `frontend/` and rewrite routes cleanly.

### Backend on Vercel?

Vercel only runs Node.js serverless functions — it cannot host the Bantu binary.
The frontend detects this and **falls back to localStorage** so the demo always
works. To run the real Bantu + SQLite backend, deploy it to any VPS / Render /
Railway / Fly.io (see `backend/README.md`).

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
