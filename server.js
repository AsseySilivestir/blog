#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  Bantu Blog — HTTP Server (Node.js, pure-SQLite, no Bantu binary)
//  ──────────────────────────────────────────────────────────────
//  WHY THIS EXISTS
//  ---------------
//  The Bantu binary's `sua.server.listen()` registers routes but
//  does NOT actually start an HTTP listener in the current build
//  (it's a stub that prints status and returns). Also, the Bantu
//  binary depends on libcurl-gnutls.so.4 which is missing on many
//  minimal Linux images (Render, Vercel, slim Docker).
//
//  SOLUTION
//  --------
//  This pure-Node.js server:
//    1. Opens the SQLite DB at $BANTU_BLOG_DB (default /data/blog.db)
//       using better-sqlite3.
//    2. Creates the schema (posts/comments/likes/shares) DIRECTLY
//       via SQL — no Bantu binary needed.
//    3. Seeds 3 sample posts + comments + likes + shares if empty.
//    4. Serves the API on PORT (default 8080):
//         GET    /api/health
//         GET    /api/posts
//         GET    /api/posts/:id
//         POST   /api/posts
//         DELETE /api/posts/:id
//         POST   /api/posts/:id/comments
//         POST   /api/posts/:id/like
//         POST   /api/posts/:id/share
//         GET    /api/stats
//       plus CORS + static file serving from PUBLIC_DIR.
//
//  The DB schema is byte-identical to backend/schema.sql so the
//  same `blog.db` file can also be opened with `bantu run server.b`
//  or the `sqlite3` CLI.
// ═══════════════════════════════════════════════════════════════

'use strict';

const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

// ─── Config ────────────────────────────────────────────────────
const PORT       = parseInt(process.env.PORT || '8080', 10);
const DB_PATH    = process.env.BANTU_BLOG_DB || '/data/blog.db';
const PUBLIC_DIR = process.env.BANTU_BLOG_PUBLIC
                    || path.join(__dirname, 'public');

console.log('═══════════════════════════════════════════');
console.log('  Bantu Blog — HTTP Server (Node.js, pure SQLite)');
console.log('═══════════════════════════════════════════');
console.log(`  Port:      ${PORT}`);
console.log(`  Database:  ${DB_PATH}`);
console.log(`  Public:    ${PUBLIC_DIR}`);
console.log('');

// ─── Ensure the DB directory exists ────────────────────────────
const dbDir = path.dirname(DB_PATH);
try {
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log(`[db] Created directory: ${dbDir}`);
    }
} catch (e) {
    console.warn(`[db] Could not create ${dbDir}: ${e.message}`);
}

// ─── Open SQLite via better-sqlite3 ────────────────────────────
const Database = require('better-sqlite3');
const db = new Database(DB_PATH, { fileMustExist: false });
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
console.log(`[db] Opened with better-sqlite3: ${DB_PATH}`);

// ─── Initialize schema (idempotent) ────────────────────────────
function initSchema() {
    console.log('[init] Creating schema if missing...');

    db.exec(`
        CREATE TABLE IF NOT EXISTS posts (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT NOT NULL,
            body        TEXT NOT NULL,
            author      TEXT NOT NULL DEFAULT 'Anonymous',
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS comments (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id     INTEGER NOT NULL,
            author      TEXT NOT NULL,
            body        TEXT NOT NULL,
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);

        CREATE TABLE IF NOT EXISTS likes (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id     INTEGER NOT NULL,
            author      TEXT NOT NULL,
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(post_id, author),
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);

        CREATE TABLE IF NOT EXISTS shares (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id     INTEGER NOT NULL,
            platform    TEXT NOT NULL DEFAULT 'copy',
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_shares_post_id ON shares(post_id);
    `);
    console.log('[init] Schema ready (posts, comments, likes, shares)');

    // ─── Seed if empty ────────────────────────────────────────
    const row = db.prepare('SELECT COUNT(*) AS n FROM posts').get();
    if (row.n === 0) {
        console.log('[init] Seeding initial blog posts...');
        const insertPost = db.prepare(
            "INSERT INTO posts (title, body, author) VALUES (?, ?, ?)"
        );
        insertPost.run(
            'Welcome to Bantu Blog',
            "This is the very first post on our Bantu-powered blog. Built with the Bantu Programming Language, the Sua web framework, and SQLite.\n\nBantu is designed for African developers, by African developers. It uses familiar C-like syntax with English keywords, supports classes and inheritance, and includes a full web framework called Sua with HTTP routing, SQLite, and PostgreSQL out of the box.\n\nCreate your own posts, leave comments, hit like, and share with friends!",
            'Silivestir'
        );
        insertPost.run(
            'Why Bantu?',
            "Bantu is a programming language designed for African developers, by African developers. Here are the top reasons to use it:\n\n1. Familiar syntax - C-like with variable prefixes\n2. English keywords - print, def, class, each, return\n3. Classes and inheritance - full OOP support\n4. Sua framework - Express-like web server built-in\n5. Database support - SQLite and PostgreSQL out of the box\n6. Real-time ready - channels, WebRTC signaling, STUN/TURN\n\nGive it a try today!",
            'Silivestir'
        );
        insertPost.run(
            'Building with Sua',
            "Sua is the Bantu web framework. It gives you:\n\n- Express-like routing: sua.server.get, sua.server.post\n- Database access: sua.sqlite.exec, sua.sqlite.query\n- HTTP client: sua.http.get, sua.http.post\n- Real-time: channels, broadcast, WebRTC signaling\n\nThis entire blog runs on Sua. The backend is a single Bantu file (server.b) and the frontend is pure HTML, CSS, and JavaScript - no framework needed.",
            'Alice'
        );

        const insertComment = db.prepare(
            "INSERT INTO comments (post_id, author, body) VALUES (?, ?, ?)"
        );
        insertComment.run(1, 'Alice',   'Welcome! Excited to see Bantu growing.');
        insertComment.run(1, 'Bob',     'This is amazing work, Silivestir!');
        insertComment.run(2, 'Charlie', 'Finally a language that feels like home.');
        insertComment.run(3, 'Dave',    'Sua looks really clean. Going to try it tonight.');

        const insertLike = db.prepare(
            "INSERT INTO likes (post_id, author) VALUES (?, ?)"
        );
        insertLike.run(1, 'alice');
        insertLike.run(1, 'bob');
        insertLike.run(1, 'charlie');
        insertLike.run(2, 'alice');
        insertLike.run(2, 'dave');
        insertLike.run(3, 'bob');
        insertLike.run(3, 'eve');

        const insertShare = db.prepare(
            "INSERT INTO shares (post_id, platform) VALUES (?, ?)"
        );
        insertShare.run(1, 'twitter');
        insertShare.run(1, 'facebook');
        insertShare.run(1, 'copy');
        insertShare.run(2, 'twitter');
        insertShare.run(2, 'copy');
        insertShare.run(3, 'whatsapp');

        console.log('[init] Seeded 3 posts, 4 comments, 7 likes, 6 shares');
    } else {
        console.log(`[init] Database already has ${row.n} posts, skipping seed`);
    }
    console.log('[init] Done.');
}
try {
    initSchema();
} catch (e) {
    console.error('[init] FATAL: schema init failed:', e.message);
    console.error(e.stack);
    process.exit(1);
}

// ─── DB query helpers (better-sqlite3 thin wrappers) ───────────
// dbAll(sql, params[]) -> array of rows
// dbRun(sql, params[]) -> { changes, lastInsertRowid }
function dbAll(sql, params = []) {
    return db.prepare(sql).all(...params);
}
function dbRun(sql, params = []) {
    const info = db.prepare(sql).run(...params);
    return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
}
const dbBackend = 'better-sqlite3';

// ─── HTTP helpers ──────────────────────────────────────────────
function sendJson(res, status, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
}

function sendStatic(res, filePath) {
    return new Promise((resolve) => {
        fs.readFile(filePath, (err, data) => {
            if (err) {
                sendJson(res, 404, { error: 'Not found' });
            } else {
                const ext = path.extname(filePath).toLowerCase();
                const types = {
                    '.html': 'text/html; charset=utf-8',
                    '.css':  'text/css; charset=utf-8',
                    '.js':   'application/javascript; charset=utf-8',
                    '.json': 'application/json; charset=utf-8',
                    '.svg':  'image/svg+xml',
                    '.png':  'image/png',
                    '.jpg':  'image/jpeg',
                    '.ico':  'image/x-icon',
                    '.txt':  'text/plain; charset=utf-8',
                };
                res.writeHead(200, {
                    'Content-Type': types[ext] || 'application/octet-stream',
                    'Cache-Control': 'public, max-age=300',
                    'Access-Control-Allow-Origin': '*',
                    'Content-Length': data.length,
                });
                res.end(data);
            }
            resolve();
        });
    });
}

function readBody(req) {
    return new Promise((resolve) => {
        let s = '';
        req.on('data', c => s += c);
        req.on('end', () => {
            try { resolve(JSON.parse(s || '{}')); }
            catch { resolve({}); }
        });
    });
}

// ─── Route handlers ────────────────────────────────────────────
const handlers = {
    health: (req, res) => sendJson(res, 200, {
        status: 'ok', language: 'Bantu', framework: 'Sua',
        database: 'SQLite', wrapper: 'Node.js', version: '1.1.0',
    }),

    listPosts: (req, res) => {
        const rows = dbAll(`
            SELECT p.id, p.title, p.body, p.author, p.created_at,
                   (SELECT COUNT(*) FROM likes    WHERE post_id = p.id) AS like_count,
                   (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comment_count,
                   (SELECT COUNT(*) FROM shares   WHERE post_id = p.id) AS share_count
            FROM posts p
            ORDER BY p.created_at DESC
        `);
        const posts = rows.map(r => ({
            id: r.id, title: r.title, body: r.body, author: r.author,
            createdAt: r.created_at,
            likes: r.like_count, comments: r.comment_count, shares: r.share_count,
        }));
        sendJson(res, 200, { posts, count: posts.length });
    },

    getPost: (req, res, id) => {
        const rows = dbAll('SELECT * FROM posts WHERE id = ?', [id]);
        if (rows.length === 0) return sendJson(res, 404, { error: 'Post not found' });
        const p = rows[0];
        const likeCount    = dbAll('SELECT COUNT(*) AS n FROM likes    WHERE post_id = ?', [id])[0].n;
        const commentCount = dbAll('SELECT COUNT(*) AS n FROM comments WHERE post_id = ?', [id])[0].n;
        const shareCount   = dbAll('SELECT COUNT(*) AS n FROM shares   WHERE post_id = ?', [id])[0].n;
        const comments = dbAll('SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC', [id])
            .map(c => ({ id: c.id, author: c.author, body: c.body, createdAt: c.created_at }));
        sendJson(res, 200, {
            post: {
                id: p.id, title: p.title, body: p.body, author: p.author,
                createdAt: p.created_at,
                likes: likeCount, comments: commentCount, shares: shareCount,
                commentsList: comments,
            },
        });
    },

    createPost: async (req, res) => {
        const body = await readBody(req);
        if (!body.title || !body.body) return sendJson(res, 400, { error: 'title and body are required' });
        const author = body.author || 'Anonymous';
        const info = dbRun(
            'INSERT INTO posts (title, body, author) VALUES (?, ?, ?)',
            [body.title, body.body, author]
        );
        const rows = dbAll('SELECT * FROM posts WHERE id = ?', [info.lastInsertRowid]);
        sendJson(res, 201, {
            post: {
                id: rows[0].id, title: rows[0].title, body: rows[0].body,
                author: rows[0].author, createdAt: rows[0].created_at,
                likes: 0, comments: 0, shares: 0,
            },
            message: 'Post created',
        });
    },

    deletePost: (req, res, id) => {
        dbRun('DELETE FROM comments WHERE post_id = ?', [id]);
        dbRun('DELETE FROM likes    WHERE post_id = ?', [id]);
        dbRun('DELETE FROM shares   WHERE post_id = ?', [id]);
        dbRun('DELETE FROM posts    WHERE id = ?', [id]);
        sendJson(res, 200, { message: 'Post deleted', id });
    },

    addComment: async (req, res, id) => {
        const body = await readBody(req);
        if (!body.author || !body.body) return sendJson(res, 400, { error: 'author and body are required' });
        const check = dbAll('SELECT id FROM posts WHERE id = ?', [id]);
        if (check.length === 0) return sendJson(res, 404, { error: 'Post not found' });
        const info = dbRun(
            'INSERT INTO comments (post_id, author, body) VALUES (?, ?, ?)',
            [id, body.author, body.body]
        );
        const rows = dbAll('SELECT * FROM comments WHERE id = ?', [info.lastInsertRowid]);
        sendJson(res, 201, {
            comment: {
                id: rows[0].id, postId: id, author: rows[0].author,
                body: rows[0].body, createdAt: rows[0].created_at,
            },
            message: 'Comment added',
        });
    },

    like: async (req, res, id) => {
        const body = await readBody(req);
        const author = body.author || ('guest_' + Math.floor(Math.random() * 90000 + 10000));
        const existing = dbAll('SELECT id FROM likes WHERE post_id = ? AND author = ?', [id, author]);
        if (existing.length > 0) {
            dbRun('DELETE FROM likes WHERE post_id = ? AND author = ?', [id, author]);
            const n = dbAll('SELECT COUNT(*) AS n FROM likes WHERE post_id = ?', [id])[0].n;
            sendJson(res, 200, { liked: false, likes: n, message: 'Unliked' });
        } else {
            dbRun('INSERT INTO likes (post_id, author) VALUES (?, ?)', [id, author]);
            const n = dbAll('SELECT COUNT(*) AS n FROM likes WHERE post_id = ?', [id])[0].n;
            sendJson(res, 200, { liked: true, likes: n, message: 'Liked' });
        }
    },

    share: async (req, res, id) => {
        const body = await readBody(req);
        const platform = body.platform || 'copy';
        dbRun('INSERT INTO shares (post_id, platform) VALUES (?, ?)', [id, platform]);
        const n = dbAll('SELECT COUNT(*) AS n FROM shares WHERE post_id = ?', [id])[0].n;
        sendJson(res, 200, { shared: true, shares: n, message: 'Share recorded' });
    },

    stats: (req, res) => {
        const p = dbAll('SELECT COUNT(*) AS n FROM posts')[0].n;
        const c = dbAll('SELECT COUNT(*) AS n FROM comments')[0].n;
        const l = dbAll('SELECT COUNT(*) AS n FROM likes')[0].n;
        const s = dbAll('SELECT COUNT(*) AS n FROM shares')[0].n;
        sendJson(res, 200, { posts: p, comments: c, likes: l, shares: s });
    },
};

// ─── HTTP server ───────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
    const u = url.parse(req.url, true);
    const pathname = u.pathname;
    const method = req.method;

    // CORS preflight
    if (method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        });
        return res.end();
    }

    // API routes
    if (pathname === '/api/health')              return handlers.health(req, res);
    if (pathname === '/api/posts' && method === 'GET')  return handlers.listPosts(req, res);
    if (pathname === '/api/posts' && method === 'POST') return handlers.createPost(req, res);
    if (pathname === '/api/stats')               return handlers.stats(req, res);

    let m;
    if ((m = pathname.match(/^\/api\/posts\/(\d+)$/))) {
        const id = parseInt(m[1], 10);
        if (method === 'GET')    return handlers.getPost(req, res, id);
        if (method === 'DELETE') return handlers.deletePost(req, res, id);
    }
    if ((m = pathname.match(/^\/api\/posts\/(\d+)\/comments$/)) && method === 'POST') {
        return handlers.addComment(req, res, parseInt(m[1], 10));
    }
    if ((m = pathname.match(/^\/api\/posts\/(\d+)\/like$/)) && method === 'POST') {
        return handlers.like(req, res, parseInt(m[1], 10));
    }
    if ((m = pathname.match(/^\/api\/posts\/(\d+)\/share$/)) && method === 'POST') {
        return handlers.share(req, res, parseInt(m[1], 10));
    }

    // Static files
    if (method === 'GET') {
        let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
        // Prevent path traversal
        if (!filePath.startsWith(PUBLIC_DIR)) {
            return sendJson(res, 403, { error: 'Forbidden' });
        }
        // If path is a directory or doesn't exist, fall back to index.html (SPA mode)
        try {
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
        } catch {
            // Try .html suffix
            if (!path.extname(filePath)) {
                const tryHtml = filePath + '.html';
                if (fs.existsSync(tryHtml)) filePath = tryHtml;
                else return sendJson(res, 404, { error: 'Not found' });
            } else {
                return sendJson(res, 404, { error: 'Not found' });
            }
        }
        return sendStatic(res, filePath);
    }

    sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log(`  Blog API ready on http://0.0.0.0:${PORT}`);
    console.log(`  Database: ${DB_PATH} (SQLite via ${dbBackend})`);
    console.log('  Endpoints:');
    console.log('    GET    /api/health');
    console.log('    GET    /api/posts');
    console.log('    GET    /api/posts/:id');
    console.log('    POST   /api/posts');
    console.log('    DELETE /api/posts/:id');
    console.log('    POST   /api/posts/:id/comments');
    console.log('    POST   /api/posts/:id/like');
    console.log('    POST   /api/posts/:id/share');
    console.log('    GET    /api/stats');
    console.log('═══════════════════════════════════════════');
});

// Keep the process alive and handle shutdown gracefully
process.on('SIGTERM', () => { console.log('[shutdown] SIGTERM'); server.close(() => process.exit(0)); });
process.on('SIGINT',  () => { console.log('[shutdown] SIGINT');  server.close(() => process.exit(0)); });
