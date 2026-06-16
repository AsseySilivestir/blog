-- ═══════════════════════════════════════════════════════════════
--  Bantu Blog — SQLite Seed Data
--  The Bantu backend (server.b) seeds this data automatically
--  on first run when the posts table is empty.
--
--  Manual use:
--    sqlite3 blog.db < seed.sql
-- ═══════════════════════════════════════════════════════════════

INSERT INTO posts (title, body, author) VALUES
('Welcome to Bantu Blog',
 'This is the very first post on our Bantu-powered blog. Built with the Bantu Programming Language, the Sua web framework, and SQLite.

Bantu is designed for African developers, by African developers. It uses familiar C-like syntax with English keywords, supports classes and inheritance, and includes a full web framework called Sua with HTTP routing, SQLite, and PostgreSQL out of the box.

Create your own posts, leave comments, hit like, and share with friends!',
 'Silivestir'),

('Why Bantu?',
 'Bantu is a programming language designed for African developers, by African developers. Here are the top reasons to use it:

1. Familiar syntax - C-like with variable prefixes
2. English keywords - print, def, class, each, return
3. Classes and inheritance - full OOP support
4. Sua framework - Express-like web server built-in
5. Database support - SQLite and PostgreSQL out of the box
6. Real-time ready - channels, WebRTC signaling, STUN/TURN

Give it a try today!',
 'Silivestir'),

('Building with Sua',
 'Sua is the Bantu web framework. It gives you:

- Express-like routing: sua.server.get, sua.server.post
- Database access: sua.sqlite.exec, sua.sqlite.query
- HTTP client: sua.http.get, sua.http.post
- Real-time: channels, broadcast, WebRTC signaling

This entire blog runs on Sua. The backend is a single Bantu file (server.b) and the frontend is pure HTML, CSS, and JavaScript - no framework needed.',
 'Alice');

INSERT INTO comments (post_id, author, body) VALUES
(1, 'Alice', 'Welcome! Excited to see Bantu growing.'),
(1, 'Bob', 'This is amazing work, Silivestir!'),
(2, 'Charlie', 'Finally a language that feels like home.'),
(3, 'Dave', 'Sua looks really clean. Going to try it tonight.');

INSERT INTO likes (post_id, author) VALUES
(1, 'alice'), (1, 'bob'), (1, 'charlie'),
(2, 'alice'), (2, 'dave'),
(3, 'bob'), (3, 'eve');

INSERT INTO shares (post_id, platform) VALUES
(1, 'twitter'), (1, 'facebook'), (1, 'copy'),
(2, 'twitter'), (2, 'copy'),
(3, 'whatsapp');
