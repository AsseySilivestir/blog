// ═══════════════════════════════════════════════════════════════
//  BANTU BLOG — Backend (Bantu + Sua + SQLite)
//  Full CRUD: posts, comments, likes, shares
//  Run: bantu server.b
//  Database: blog.db (SQLite, file-based, no setup needed)
// ═══════════════════════════════════════════════════════════════

print "═══════════════════════════════════════════";
print "  Bantu Blog Backend v1.1.0";
print "  Bantu + Sua + SQLite";
print "═══════════════════════════════════════════";

// ─── Configuration ─────────────────────────────────────────────
// Database path: prefer /data/blog.db (Docker/Render persistent volume),
// fall back to ./blog.db for local dev.
string $dbPath = "/data/blog.db";
// Test if /data is writable; if not, use local file
dict $probe = sua.sqlite.open($dbPath);
if (!$probe.connected) {
    $dbPath = "blog.db";
    print "[INFO] /data not writable, using local: " + $dbPath;
} else {
    print "[INFO] Using persistent volume: " + $dbPath;
}
string $port = "8080";

print "Database: " + $dbPath;
print "Opening SQLite...";

// ─── Open SQLite Database ──────────────────────────────────────
dict $conn = sua.sqlite.open($dbPath);
if (!$conn.connected) {
    print "[ERROR] Cannot open SQLite database.";
    exit(1);
}
print "[OK] Connected to SQLite at " + $conn.path;

// ─── Initialize Schema ─────────────────────────────────────────
sua.sqlite.exec("CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body TEXT NOT NULL, author TEXT NOT NULL DEFAULT 'Anonymous', created_at TEXT NOT NULL DEFAULT (datetime('now')));");

sua.sqlite.exec("CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, author TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE);");
sua.sqlite.exec("CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);");

sua.sqlite.exec("CREATE TABLE IF NOT EXISTS likes (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, author TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(post_id, author), FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE);");
sua.sqlite.exec("CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);");

sua.sqlite.exec("CREATE TABLE IF NOT EXISTS shares (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, platform TEXT NOT NULL DEFAULT 'copy', created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE);");
sua.sqlite.exec("CREATE INDEX IF NOT EXISTS idx_shares_post_id ON shares(post_id);");

print "[OK] Schema initialized (posts, comments, likes, shares)";

// ─── Seed data (only if posts table is empty) ──────────────────
list $existing = sua.sqlite.query("SELECT COUNT(*) AS n FROM posts;");
number $existingCount = 0;
if (len($existing) > 0) {
    $existingCount = num($existing[0].n);
}

if ($existingCount == 0) {
    print "[OK] Seeding initial blog posts...";
    sua.sqlite.exec("INSERT INTO posts (title, body, author) VALUES ('Welcome to Bantu Blog', 'This is the very first post on our Bantu-powered blog. Built with the Bantu Programming Language, the Sua web framework, and SQLite.\n\nBantu is designed for African developers, by African developers. It uses familiar C-like syntax with English keywords, supports classes and inheritance, and includes a full web framework called Sua with HTTP routing, SQLite, and PostgreSQL out of the box.\n\nCreate your own posts, leave comments, hit like, and share with friends!', 'Silivestir');");
    sua.sqlite.exec("INSERT INTO posts (title, body, author) VALUES ('Why Bantu?', 'Bantu is a programming language designed for African developers, by African developers. Here are the top reasons to use it:\n\n1. Familiar syntax - C-like with variable prefixes\n2. English keywords - print, def, class, each, return\n3. Classes and inheritance - full OOP support\n4. Sua framework - Express-like web server built-in\n5. Database support - SQLite and PostgreSQL out of the box\n6. Real-time ready - channels, WebRTC signaling, STUN/TURN\n\nGive it a try today!', 'Silivestir');");
    sua.sqlite.exec("INSERT INTO posts (title, body, author) VALUES ('Building with Sua', 'Sua is the Bantu web framework. It gives you:\n\n- Express-like routing: sua.server.get, sua.server.post\n- Database access: sua.sqlite.exec, sua.sqlite.query\n- HTTP client: sua.http.get, sua.http.post\n- Real-time: channels, broadcast, WebRTC signaling\n\nThis entire blog runs on Sua. The backend is a single Bantu file (server.b) and the frontend is pure HTML, CSS, and JavaScript - no framework needed.', 'Alice');");

    // Seed comments
    sua.sqlite.exec("INSERT INTO comments (post_id, author, body) VALUES (1, 'Alice', 'Welcome! Excited to see Bantu growing.');");
    sua.sqlite.exec("INSERT INTO comments (post_id, author, body) VALUES (1, 'Bob', 'This is amazing work, Silivestir!');");
    sua.sqlite.exec("INSERT INTO comments (post_id, author, body) VALUES (2, 'Charlie', 'Finally a language that feels like home.');");
    sua.sqlite.exec("INSERT INTO comments (post_id, author, body) VALUES (3, 'Dave', 'Sua looks really clean. Going to try it tonight.');");

    // Seed likes
    sua.sqlite.exec("INSERT INTO likes (post_id, author) VALUES (1, 'alice');");
    sua.sqlite.exec("INSERT INTO likes (post_id, author) VALUES (1, 'bob');");
    sua.sqlite.exec("INSERT INTO likes (post_id, author) VALUES (1, 'charlie');");
    sua.sqlite.exec("INSERT INTO likes (post_id, author) VALUES (2, 'alice');");
    sua.sqlite.exec("INSERT INTO likes (post_id, author) VALUES (2, 'dave');");
    sua.sqlite.exec("INSERT INTO likes (post_id, author) VALUES (3, 'bob');");
    sua.sqlite.exec("INSERT INTO likes (post_id, author) VALUES (3, 'eve');");

    // Seed shares
    sua.sqlite.exec("INSERT INTO shares (post_id, platform) VALUES (1, 'twitter');");
    sua.sqlite.exec("INSERT INTO shares (post_id, platform) VALUES (1, 'facebook');");
    sua.sqlite.exec("INSERT INTO shares (post_id, platform) VALUES (1, 'copy');");
    sua.sqlite.exec("INSERT INTO shares (post_id, platform) VALUES (2, 'twitter');");
    sua.sqlite.exec("INSERT INTO shares (post_id, platform) VALUES (2, 'copy');");
    sua.sqlite.exec("INSERT INTO shares (post_id, platform) VALUES (3, 'whatsapp');");

    print "[OK] Seeded 3 initial posts with comments, likes, shares";
} else {
    print "[OK] Database already has " + str($existingCount) + " posts, skipping seed";
}

// ─── Helper: escape SQL strings ────────────────────────────────
def esc($s) {
    if (!$s) { return ""; }
    string $out = "";
    string $c = "";
    number $i = 0;
    while ($i < len($s)) {
        $c = $s[$i];
        if ($c == "'") {
            $out = $out + "''";
        } else {
            $out = $out + $c;
        }
        $i = $i + 1;
    }
    return $out;
}

// ─── Helper: build post dict from row ──────────────────────────
def postFromRow($row) {
    dict $p = {
        "id": $row.id,
        "title": $row.title,
        "body": $row.body,
        "author": $row.author,
        "createdAt": $row.created_at,
        "likes": 0,
        "comments": 0,
        "shares": 0
    };
    return $p;
}

// ─── Helper: get author from body, default Anonymous ───────────
def authorOr($body, $fallback) {
    if ($body.author) {
        return $body.author;
    }
    return $fallback;
}

// ═══════════════════════════════════════════════════════════════
//  ROUTE HANDLERS (must be named functions — Bantu doesn't support
//  inline def as callback)
// ═══════════════════════════════════════════════════════════════

// ─── Health check ──────────────────────────────────────────────
def handleHealth($req, $res) {
    $res.json({
        "status": "ok",
        "language": "Bantu",
        "framework": "Sua",
        "database": "SQLite",
        "version": "1.1.0"
    });
}

// ─── List all posts ────────────────────────────────────────────
def handleListPosts($req, $res) {
    list $rows = sua.sqlite.query("SELECT p.id, p.title, p.body, p.author, p.created_at, (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count, (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comment_count, (SELECT COUNT(*) FROM shares WHERE post_id = p.id) AS share_count FROM posts p ORDER BY p.created_at DESC;");

    list $posts = [];
    dict $p = {};
    number $idx = 0;
    each ($row in $rows) {
        $p = postFromRow($row);
        $p.likes    = num($row.like_count);
        $p.comments = num($row.comment_count);
        $p.shares   = num($row.share_count);
        $posts[$idx] = $p;
        $idx = $idx + 1;
    }

    $res.json({"posts": $posts, "count": len($posts)});
}

// ─── Get a single post by ID ───────────────────────────────────
def handleGetPost($req, $res) {
    number $id = num($req.params.id);

    list $postRows = sua.sqlite.query("SELECT * FROM posts WHERE id = " + str($id) + ";");
    if (len($postRows) == 0) {
        $res.status(404).json({"error": "Post not found"});
        return null;
    }

    dict $post = postFromRow($postRows[0]);

    list $likeRows    = sua.sqlite.query("SELECT COUNT(*) AS n FROM likes    WHERE post_id = " + str($id) + ";");
    list $commentRows = sua.sqlite.query("SELECT COUNT(*) AS n FROM comments WHERE post_id = " + str($id) + ";");
    list $shareRows   = sua.sqlite.query("SELECT COUNT(*) AS n FROM shares   WHERE post_id = " + str($id) + ";");

    $post.likes    = num($likeRows[0].n);
    $post.comments = num($commentRows[0].n);
    $post.shares   = num($shareRows[0].n);

    list $commentList = sua.sqlite.query("SELECT * FROM comments WHERE post_id = " + str($id) + " ORDER BY created_at ASC;");
    list $comments = [];
    dict $cm = {};
    number $cidx = 0;
    each ($c in $commentList) {
        $cm = {
            "id": $c.id,
            "author": $c.author,
            "body": $c.body,
            "createdAt": $c.created_at
        };
        $comments[$cidx] = $cm;
        $cidx = $cidx + 1;
    }
    $post.commentsList = $comments;

    $res.json({"post": $post});
}

// ─── Create a new post ─────────────────────────────────────────
def handleCreatePost($req, $res) {
    if (!$req.body.title || !$req.body.body) {
        $res.status(400).json({"error": "title and body are required"});
        return null;
    }

    string $author = authorOr($req.body, "Anonymous");

    dict $ins = sua.sqlite.exec(
        "INSERT INTO posts (title, body, author) VALUES ('" +
        esc($req.body.title) + "', '" + esc($req.body.body) + "', '" + esc($author) + "');"
    );

    number $newId = num($ins.lastInsertId);
    list $newRow = sua.sqlite.query("SELECT * FROM posts WHERE id = " + str($newId) + ";");
    $res.status(201).json({"post": postFromRow($newRow[0]), "message": "Post created"});
}

// ─── Delete a post ─────────────────────────────────────────────
def handleDeletePost($req, $res) {
    number $id = num($req.params.id);
    sua.sqlite.exec("DELETE FROM comments WHERE post_id = " + str($id) + ";");
    sua.sqlite.exec("DELETE FROM likes    WHERE post_id = " + str($id) + ";");
    sua.sqlite.exec("DELETE FROM shares   WHERE post_id = " + str($id) + ";");
    sua.sqlite.exec("DELETE FROM posts    WHERE id = " + str($id) + ";");
    $res.json({"message": "Post deleted", "id": $id});
}

// ─── Add a comment to a post ───────────────────────────────────
def handleAddComment($req, $res) {
    number $id = num($req.params.id);

    if (!$req.body.author || !$req.body.body) {
        $res.status(400).json({"error": "author and body are required"});
        return null;
    }

    list $check = sua.sqlite.query("SELECT id FROM posts WHERE id = " + str($id) + ";");
    if (len($check) == 0) {
        $res.status(404).json({"error": "Post not found"});
        return null;
    }

    dict $ins = sua.sqlite.exec(
        "INSERT INTO comments (post_id, author, body) VALUES (" + str($id) + ", '" +
        esc($req.body.author) + "', '" + esc($req.body.body) + "');"
    );

    number $newId = num($ins.lastInsertId);
    list $newRow = sua.sqlite.query("SELECT * FROM comments WHERE id = " + str($newId) + ";");

    $res.status(201).json({
        "comment": {
            "id": $newRow[0].id,
            "postId": $id,
            "author": $newRow[0].author,
            "body": $newRow[0].body,
            "createdAt": $newRow[0].created_at
        },
        "message": "Comment added"
    });
}

// ─── Like / unlike a post (toggle) ─────────────────────────────
def handleLike($req, $res) {
    number $id = num($req.params.id);
    string $author = authorOr($req.body, "guest_" + str(random(89999) + 10000));

    list $existing = sua.sqlite.query(
        "SELECT id FROM likes WHERE post_id = " + str($id) + " AND author = '" + esc($author) + "';"
    );

    if (len($existing) > 0) {
        sua.sqlite.exec(
            "DELETE FROM likes WHERE post_id = " + str($id) + " AND author = '" + esc($author) + "';"
        );
        list $count = sua.sqlite.query("SELECT COUNT(*) AS n FROM likes WHERE post_id = " + str($id) + ";");
        $res.json({"liked": false, "likes": num($count[0].n), "message": "Unliked"});
    } else {
        sua.sqlite.exec(
            "INSERT INTO likes (post_id, author) VALUES (" + str($id) + ", '" + esc($author) + "');"
        );
        list $count = sua.sqlite.query("SELECT COUNT(*) AS n FROM likes WHERE post_id = " + str($id) + ";");
        $res.json({"liked": true, "likes": num($count[0].n), "message": "Liked"});
    }
}

// ─── Record a share ────────────────────────────────────────────
def handleShare($req, $res) {
    number $id = num($req.params.id);
    string $platform = authorOr($req.body, "copy");
    // If body didn't have author, authorOr returns "copy" — but we want platform
    // Better: just check directly
    if ($req.body.platform) {
        $platform = $req.body.platform;
    }

    sua.sqlite.exec(
        "INSERT INTO shares (post_id, platform) VALUES (" + str($id) + ", '" + esc($platform) + "');"
    );

    list $count = sua.sqlite.query("SELECT COUNT(*) AS n FROM shares WHERE post_id = " + str($id) + ";");
    $res.json({"shared": true, "shares": num($count[0].n), "message": "Share recorded"});
}

// ─── Stats ─────────────────────────────────────────────────────
def handleStats($req, $res) {
    list $p = sua.sqlite.query("SELECT COUNT(*) AS n FROM posts;");
    list $c = sua.sqlite.query("SELECT COUNT(*) AS n FROM comments;");
    list $l = sua.sqlite.query("SELECT COUNT(*) AS n FROM likes;");
    list $s = sua.sqlite.query("SELECT COUNT(*) AS n FROM shares;");
    $res.json({
        "posts":    num($p[0].n),
        "comments": num($c[0].n),
        "likes":    num($l[0].n),
        "shares":   num($s[0].n)
    });
}

// ─── CORS preflight ────────────────────────────────────────────
def handleOptions($req, $res) {
    $res.set("Access-Control-Allow-Origin", "*");
    $res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    $res.set("Access-Control-Allow-Headers", "Content-Type");
    $res.status(200).send("");
}

// ─── CORS middleware ───────────────────────────────────────────
def corsMiddleware($req, $res, $next) {
    $res.set("Access-Control-Allow-Origin", "*");
    $res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    $res.set("Access-Control-Allow-Headers", "Content-Type");
    $next();
}

// ═══════════════════════════════════════════════════════════════
//  REGISTER ROUTES
// ═══════════════════════════════════════════════════════════════
sua.server.get("/api/health",              handleHealth);
sua.server.get("/api/posts",               handleListPosts);
sua.server.get("/api/posts/:id",           handleGetPost);
sua.server.post("/api/posts",              handleCreatePost);
sua.server.delete("/api/posts/:id",        handleDeletePost);
sua.server.post("/api/posts/:id/comments", handleAddComment);
sua.server.post("/api/posts/:id/like",     handleLike);
sua.server.post("/api/posts/:id/share",    handleShare);
sua.server.get("/api/stats",               handleStats);
sua.server.options("/*",                   handleOptions);
sua.server.use(corsMiddleware);

// ─── Serve static frontend ────────────────────────────────────
sua.server.static("./public");

// ═══════════════════════════════════════════════════════════════
//  START SERVER
// ═══════════════════════════════════════════════════════════════
print "";
print "═══════════════════════════════════════════";
print "  Blog API ready on http://localhost:" + $port;
print "  Database: " + $dbPath + " (SQLite)";
print "  Endpoints:";
print "    GET    /api/health";
print "    GET    /api/posts";
print "    GET    /api/posts/:id";
print "    POST   /api/posts";
print "    DELETE /api/posts/:id";
print "    POST   /api/posts/:id/comments";
print "    POST   /api/posts/:id/like";
print "    POST   /api/posts/:id/share";
print "    GET    /api/stats";
print "═══════════════════════════════════════════";
print "";

sua.server.listen(num($port));
