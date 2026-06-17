#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  Bantu Blog — HTTP Server (Node.js wrapper)
//  ──────────────────────────────────────────────────────────────
//  WHY THIS EXISTS
//  ---------------
//  The Bantu binary's `sua.server.listen()` registers routes but
//  does NOT actually start an HTTP listener in the current build
//  (it's a stub that prints status and returns). To get a fully
//  working Bantu Blog on Render/Vercel/Docker, this tiny Node.js
//  wrapper serves the same API against the SAME SQLite database
//  file (`blog.db`) that the Bantu binary creates and seeds.
//
//  WHAT IT DOES
//  ------------
//  1. On boot, it calls `bantu run init.b` — a tiny Bantu script
//     that opens SQLite, creates the schema, and seeds the data
//     (idempotent — runs only when posts table is empty).
//  2. Then it starts an HTTP server on PORT (default 8080) with:
//       GET    /api/health
//       GET    /api/posts
//       GET    /api/posts/:id
//       POST   /api/posts
//       DELETE /api/posts/:id
//       POST   /api/posts/:id/comments
//       POST   /api/posts/:id/like
//       POST   /api/posts/:id/share
//       GET    /api/stats
//     plus CORS + static file serving from ./public
//
//  The DB schema is identical to backend/schema.sql so the same
//  `blog.db` file can also be opened with the `sqlite3` CLI.
// ═══════════════════════════════════════════════════════════════

'use strict';

const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');
const os    = require('os');
const { execFileSync, spawnSync } = require('child_process');

// ─── Config ────────────────────────────────────────────────────
const PORT       = parseInt(process.env.PORT || '8080', 10);
const DB_PATH    = process.env.BANTU_BLOG_DB || '/data/blog.db';
const PUBLIC_DIR = process.env.BANTU_BLOG_PUBLIC || '/app/public';
const BANTU_BIN  = process.env.BANTU_BIN || 'bantu';
const INIT_SCRIPT = path.join(__dirname, 'init.b');

console.log('═══════════════════════════════════════════');
console.log('  Bantu Blog — HTTP Server (Node wrapper)');
console.log('═══════════════════════════════════════════');
console.log(`  Port:      ${PORT}`);
console.log(`  Database:  ${DB_PATH}`);
console.log(`  Public:    ${PUBLIC_DIR}`);
console.log('');

// ─── Step 1: Initialize the SQLite DB via the Bantu binary ─────
// The Bantu binary opens SQLite, creates the schema, seeds data.
// We run a tiny init.b that does only that (no server.listen call).
function initDatabase() {
    if (!fs.existsSync(INIT_SCRIPT)) {
        console.log(`[init] No ${INIT_SCRIPT} found, skipping Bantu init.`);
        return;
    }
    // Rewrite init.b's $dbPath line to point at our target DB
    // (Bantu doesn't expose getenv() to scripts, so we sed at runtime.)
    const initSrc = fs.readFileSync(INIT_SCRIPT, 'utf8');
    const runtimeInit = initSrc.replace(
        /^string \$dbPath = .*$/m,
        `string $dbPath = "${DB_PATH}";`
    );
    const runtimeInitPath = path.join(os.tmpdir(), 'bantu-blog-init.runtime.b');
    fs.writeFileSync(runtimeInitPath, runtimeInit);

    try {
        console.log(`[init] Running: ${BANTU_BIN} run ${runtimeInitPath}`);
        const out = execFileSync(BANTU_BIN, ['run', runtimeInitPath], {
            encoding: 'utf8',
            timeout: 30000,
            env: { ...process.env },
        });
        const lines = (out || '').split('\n').filter(Boolean).slice(-8);
        for (const ln of lines) console.log('  ' + ln);
        console.log('[init] Done.');
    } catch (e) {
        console.warn('[init] Bantu init failed (continuing with empty/existsing DB):', e.message);
    }
}
initDatabase();

// ─── Step 2: Open the same SQLite DB from Node ────────────────
// We use better-sqlite3 if available; otherwise fall back to a
// pure-JS implementation that wraps the `sqlite3` CLI for queries.
let db = null;
let dbBackend = null;
try {
    const Database = require('better-sqlite3');
    db = new Database(DB_PATH, { fileMustExist: false });
    db.pragma('journal_mode = WAL');
    dbBackend = 'better-sqlite3';
    console.log(`[db] Opened with better-sqlite3: ${DB_PATH}`);
} catch (e) {
    console.log(`[db] better-sqlite3 not available (${e.message}), using sqlite3 CLI fallback.`);
    dbBackend = 'cli';
}

// ─── DB helpers ────────────────────────────────────────────────
function dbAll(sql, params = []) {
    if (dbBackend === 'better-sqlite3') {
        return db.prepare(sql).all(...params);
    }
    // CLI fallback: serialize params and run `sqlite3 -json`
    const args = [DB_PATH, '-json', sql];
    let stdin = '';
    if (params.length) {
        // Use .param notation via sqlite3 CLI
        // For simplicity, we'll inline-escape
        const escaped = sql.replace(/\?/g, () => {
            const p = params.shift();
            if (p === null || p === undefined) return 'NULL';
            if (typeof p === 'number') return String(p);
            return "'" + String(p).replace(/'/g, "''") + "'";
        });
        args[2] = escaped;
    }
    const r = spawnSync('sqlite3', args, { encoding: 'utf8' });
    if (r.status !== 0 && r.stderr) {
        console.warn('[db] sqlite3 error:', r.stderr);
    }
    try { return JSON.parse(r.stdout || '[]'); }
    catch { return []; }
}

function dbRun(sql, params = []) {
    if (dbBackend === 'better-sqlite3') {
        const stmt = db.prepare(sql);
        const info = stmt.run(...params);
        return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
    }
    const escaped = sql.replace(/\?/g, () => {
        const p = params.shift();
        if (p === null || p === undefined) return 'NULL';
        if (typeof p === 'number') return String(p);
        return "'" + String(p).replace(/'/g, "''") + "'";
    });
    const r = spawnSync('sqlite3', [DB_PATH, escaped], { encoding: 'utf8' });
    // Get last insert rowid
    const r2 = spawnSync('sqlite3', [DB_PATH, 'SELECT last_insert_rowid() AS id;'], { encoding: 'utf8' });
    const id = parseInt((r2.stdout || '').trim(), 10) || 0;
    return { changes: 1, lastInsertRowid: id };
}

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
