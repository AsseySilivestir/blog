// ═══════════════════════════════════════════════════════════════
//  Bantu Blog — DB Initializer (runs at container boot)
//  ──────────────────────────────────────────────────────────────
//  Opens the SQLite database, creates the schema if missing, and
//  seeds 3 sample posts + comments + likes + shares when the
//  posts table is empty. Called by server.js before the HTTP
//  listener starts.
//
//  Env: this script reads $dbPath from the runtime copy that
//  start.sh produces. We just hardcode /data/blog.db here and
//  let start.sh sed it if needed.
// ═══════════════════════════════════════════════════════════════

string $dbPath = "/data/blog.db";
print "[init] Bantu DB initializer";
print "[init] Database: " + $dbPath;

dict $conn = sua.sqlite.open($dbPath);
if (!$conn.connected) {
    print "[init] ERROR: Cannot open SQLite database";
    exit(1);
}

// ─── Schema ───────────────────────────────────────────────────
sua.sqlite.exec("CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body TEXT NOT NULL, author TEXT NOT NULL DEFAULT 'Anonymous', created_at TEXT NOT NULL DEFAULT (datetime('now')));");
sua.sqlite.exec("CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, author TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE);");
sua.sqlite.exec("CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);");
sua.sqlite.exec("CREATE TABLE IF NOT EXISTS likes (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, author TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(post_id, author), FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE);");
sua.sqlite.exec("CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);");
sua.sqlite.exec("CREATE TABLE IF NOT EXISTS shares (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, platform TEXT NOT NULL DEFAULT 'copy', created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE);");
sua.sqlite.exec("CREATE INDEX IF NOT EXISTS idx_shares_post_id ON shares(post_id);");
print "[init] Schema ready";

// ─── Seed if empty ────────────────────────────────────────────
list $existing = sua.sqlite.query("SELECT COUNT(*) AS n FROM posts;");
number $existingCount = 0;
if (len($existing) > 0) {
    $existingCount = num($existing[0].n);
}

if ($existingCount == 0) {
    print "[init] Seeding initial blog posts...";
    sua.sqlite.exec("INSERT INTO posts (title, body, author) VALUES ('Welcome to Bantu Blog', 'This is the very first post on our Bantu-powered blog. Built with the Bantu Programming Language, the Sua web framework, and SQLite.\n\nBantu is designed for African developers, by African developers. It uses familiar C-like syntax with English keywords, supports classes and inheritance, and includes a full web framework called Sua with HTTP routing, SQLite, and PostgreSQL out of the box.\n\nCreate your own posts, leave comments, hit like, and share with friends!', 'Silivestir');");
    sua.sqlite.exec("INSERT INTO posts (title, body, author) VALUES ('Why Bantu?', 'Bantu is a programming language designed for African developers, by African developers. Here are the top reasons to use it:\n\n1. Familiar syntax - C-like with variable prefixes\n2. English keywords - print, def, class, each, return\n3. Classes and inheritance - full OOP support\n4. Sua framework - Express-like web server built-in\n5. Database support - SQLite and PostgreSQL out of the box\n6. Real-time ready - channels, WebRTC signaling, STUN/TURN\n\nGive it a try today!', 'Silivestir');");
    sua.sqlite.exec("INSERT INTO posts (title, body, author) VALUES ('Building with Sua', 'Sua is the Bantu web framework. It gives you:\n\n- Express-like routing: sua.server.get, sua.server.post\n- Database access: sua.sqlite.exec, sua.sqlite.query\n- HTTP client: sua.http.get, sua.http.post\n- Real-time: channels, broadcast, WebRTC signaling\n\nThis entire blog runs on Sua. The backend is a single Bantu file (server.b) and the frontend is pure HTML, CSS, and JavaScript - no framework needed.', 'Alice');");

    sua.sqlite.exec("INSERT INTO comments (post_id, author, body) VALUES (1, 'Alice', 'Welcome! Excited to see Bantu growing.');");
    sua.sqlite.exec("INSERT INTO comments (post_id, author, body) VALUES (1, 'Bob', 'This is amazing work, Silivestir!');");
    sua.sqlite.exec("INSERT INTO comments (post_id, author, body) VALUES (2, 'Charlie', 'Finally a language that feels like home.');");
    sua.sqlite.exec("INSERT INTO comments (post_id, author, body) VALUES (3, 'Dave', 'Sua looks really clean. Going to try it tonight.');");

    sua.sqlite.exec("INSERT INTO likes (post_id, author) VALUES (1, 'alice');");
    sua.sqlite.exec("INSERT INTO likes (post_id, author) VALUES (1, 'bob');");
    sua.sqlite.exec("INSERT INTO likes (post_id, author) VALUES (1, 'charlie');");
    sua.sqlite.exec("INSERT INTO likes (post_id, author) VALUES (2, 'alice');");
    sua.sqlite.exec("INSERT INTO likes (post_id, author) VALUES (2, 'dave');");
    sua.sqlite.exec("INSERT INTO likes (post_id, author) VALUES (3, 'bob');");
    sua.sqlite.exec("INSERT INTO likes (post_id, author) VALUES (3, 'eve');");

    sua.sqlite.exec("INSERT INTO shares (post_id, platform) VALUES (1, 'twitter');");
    sua.sqlite.exec("INSERT INTO shares (post_id, platform) VALUES (1, 'facebook');");
    sua.sqlite.exec("INSERT INTO shares (post_id, platform) VALUES (1, 'copy');");
    sua.sqlite.exec("INSERT INTO shares (post_id, platform) VALUES (2, 'twitter');");
    sua.sqlite.exec("INSERT INTO shares (post_id, platform) VALUES (2, 'copy');");
    sua.sqlite.exec("INSERT INTO shares (post_id, platform) VALUES (3, 'whatsapp');");
    print "[init] Seeded 3 posts, 4 comments, 7 likes, 6 shares";
} else {
    print "[init] Database already has " + str($existingCount) + " posts, skipping seed";
}

print "[init] Done.";
