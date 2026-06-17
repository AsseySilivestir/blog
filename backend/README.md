# Bantu Blog — Backend (Bantu + Sua + SQLite)

A full blog backend written in **Bantu + Sua + SQLite**.

## What this is

A complete blog API with posts, comments, likes, and shares — all powered by:

- **Bantu** — the programming language (African-designed, C-like syntax)
- **Sua** — the Bantu web framework (Express-like routing, SQLite access)
- **SQLite** — file-based database, zero configuration

## Prerequisites

1. **Bantu** binary — get it from https://my-project-five-self.vercel.app/
2. **SQLite** (optional) — only needed if you want to inspect `blog.db` manually

## Setup (one command)

```bash
bantu run server.b
```

That's it. On first run, the backend will:

1. Create `blog.db` (SQLite file) in the current directory
2. Create the schema (posts, comments, likes, shares tables)
3. Seed 3 sample posts with comments, likes, and shares
4. Start the API on http://localhost:8080

Subsequent runs reuse the existing `blog.db` and skip seeding.

## Configuration

Edit the top of `server.b` to change:

```bantu
string $dbPath = "blog.db";  // SQLite database file path
string $port   = "8080";     // Server port
```

## API Endpoints

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

**Create a post:**
```bash
curl -X POST http://localhost:8080/api/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"Hello","body":"My first post","author":"Me"}'
```

**Like a post:**
```bash
curl -X POST http://localhost:8080/api/posts/1/like \
  -H "Content-Type: application/json" \
  -d '{"author":"alice"}'
```

**Add a comment:**
```bash
curl -X POST http://localhost:8080/api/posts/1/comments \
  -H "Content-Type: application/json" \
  -d '{"author":"bob","body":"Nice post!"}'
```

## Files

| File         | Purpose                                                |
|--------------|--------------------------------------------------------|
| `server.b`   | The Bantu backend — full API in one file               |
| `schema.sql` | SQLite schema (for manual inspection / reset)          |
| `seed.sql`   | Seed data (loaded automatically by server.b)           |
| `start.sh`   | Convenience wrapper to start the backend               |
| `README.md`  | This file                                              |

## Inspecting the database

```bash
sqlite3 blog.db
sqlite> .tables
sqlite> SELECT * FROM posts;
sqlite> SELECT COUNT(*) FROM likes;
```

## Deploying the backend

The backend can be deployed to any server that can run the Bantu binary:

- **VPS** (DigitalOcean, Hetzner, etc.) — full control
- **Render** — supports Docker, can run custom binaries
- **Railway** — easy deployment
- **Fly.io** — global, cheap

Vercel cannot host the Bantu backend directly (Vercel only runs Node.js),
but the **frontend works on Vercel in localStorage fallback mode** — see
the README in the project root for details.

## Frontend

The HTML/CSS/JS frontend lives in `/public/blog/` of the main project.
It automatically detects the backend: if `http://localhost:8080/api/health`
responds, it uses the live backend; otherwise it falls back to
localStorage so the demo always works.

## License

MIT — same as the Bantu language.
