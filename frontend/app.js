/* ═══════════════════════════════════════════════════════════════
   Bantu Blog — Frontend Logic (pure vanilla JS)
   - Talks to Bantu/Sua/SQLite backend if reachable
   - Falls back to localStorage so the demo always works on Vercel
   ═══════════════════════════════════════════════════════════════ */

// ─── CONFIG ────────────────────────────────────────────────────
// When you deploy the Bantu backend somewhere, set this:
const API_BASE = window.BANTU_BLOG_API || 'http://localhost:8080';

// ─── STATE ─────────────────────────────────────────────────────
let backendOnline = false;
let posts = [];
let currentPost = null;
let likedPosts = new Set(JSON.parse(localStorage.getItem('bantu_blog_likes') || '[]'));

// ─── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkBackendAndLoad();
});

async function checkBackendAndLoad() {
  setStatus('checking', 'Checking backend…');
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const r = await fetch(`${API_BASE}/api/health`, { signal: ctrl.signal });
    clearTimeout(t);
    if (r.ok) {
      backendOnline = true;
      setStatus('online', 'Connected to Bantu backend (SQLite live)');
    } else {
      throw new Error('bad status');
    }
  } catch (e) {
    backendOnline = false;
    setStatus('offline', 'Backend offline — using browser storage (demo mode). Run server.b locally to enable SQLite.');
  }
  await loadPosts();
  await loadStats();
}

function setStatus(state, text) {
  const dot = document.getElementById('statusDot');
  const txt = document.getElementById('statusText');
  dot.className = 'status-dot ' + state;
  txt.textContent = text;
}

// ─── API LAYER (with fallback) ─────────────────────────────────
async function api(method, path, body) {
  if (backendOnline) {
    try {
      const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (body) opts.body = JSON.stringify(body);
      const r = await fetch(`${API_BASE}${path}`, opts);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      console.warn('Backend call failed, falling back to localStorage:', e);
      backendOnline = false;
      setStatus('offline', 'Backend disconnected — switched to browser storage.');
    }
  }
  return localApi(method, path, body);
}

// ─── LOCAL STORAGE FALLBACK (mirror of the real backend) ───────
function localApi(method, path, body) {
  const db = JSON.parse(localStorage.getItem('bantu_blog_db') || '{"posts":[],"comments":[],"likes":[],"shares":[],"seq":{"posts":0,"comments":0,"likes":0,"shares":0}}');

  // Seed on first run
  if (db.posts.length === 0) {
    db.seq.posts = 3;
    db.posts = [
      { id: 1, title: 'Welcome to Bantu Blog', body: 'This is the very first post on our Bantu-powered blog. Built with the Bantu Programming Language, the Sua web framework, and SQLite.\n\nBantu is designed for African developers, by African developers. It uses familiar C-like syntax with English keywords, supports classes and inheritance, and includes a full web framework called Sua with HTTP routing, SQLite, and PostgreSQL out of the box.\n\nCreate your own posts, leave comments, hit like, and share with friends!', author: 'Silivestir', created_at: new Date(Date.now() - 86400000 * 3).toISOString() },
      { id: 2, title: 'Why Bantu?', body: 'Bantu is a programming language designed for African developers, by African developers. Here are the top reasons to use it:\n\n1. Familiar syntax — C-like with $variable prefixes\n2. English keywords — print, def, class, each, return\n3. Classes and inheritance — full OOP support\n4. Sua framework — Express-like web server built-in\n5. Database support — SQLite and PostgreSQL out of the box\n6. Real-time ready — channels, WebRTC signaling, STUN/TURN\n\nGive it a try today!', author: 'Silivestir', created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
      { id: 3, title: 'Building with Sua', body: 'Sua is the Bantu web framework. It gives you:\n\n- Express-like routing: sua.server.get, sua.server.post\n- Database access: sua.sqlite.exec, sua.sqlite.query\n- HTTP client: sua.http.get, sua.http.post\n- Real-time: channels, broadcast, WebRTC signaling\n\nThis entire blog runs on Sua. The backend is a single Bantu file (server.b) and the frontend is pure HTML, CSS, and JavaScript — no framework needed.', author: 'Alice', created_at: new Date(Date.now() - 86400000).toISOString() },
    ];
    db.comments = [
      { id: 1, post_id: 1, author: 'Alice', body: 'Welcome! Excited to see Bantu growing.', created_at: new Date(Date.now() - 3600000 * 5).toISOString() },
      { id: 2, post_id: 1, author: 'Bob', body: 'This is amazing work, Silivestir!', created_at: new Date(Date.now() - 3600000 * 2).toISOString() },
      { id: 3, post_id: 2, author: 'Charlie', body: 'Finally a language that feels like home.', created_at: new Date(Date.now() - 3600000 * 8).toISOString() },
    ];
    db.likes = [
      { id: 1, post_id: 1, author: 'alice' },
      { id: 2, post_id: 1, author: 'bob' },
      { id: 3, post_id: 2, author: 'alice' },
      { id: 4, post_id: 3, author: 'bob' },
    ];
    db.shares = [
      { id: 1, post_id: 1, platform: 'twitter' },
      { id: 2, post_id: 1, platform: 'copy' },
    ];
    localStorage.setItem('bantu_blog_db', JSON.stringify(db));
  }

  // Route handling
  let m, id;
  if ((m = path.match(/^\/api\/posts$/))) {
    if (method === 'GET') {
      const out = db.posts.map(p => ({
        ...p,
        likes:    db.likes.filter(l => l.post_id === p.id).length,
        comments: db.comments.filter(c => c.post_id === p.id).length,
        shares:   db.shares.filter(s => s.post_id === p.id).length,
      })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return { posts: out, count: out.length };
    }
    if (method === 'POST') {
      db.seq.posts++;
      const p = {
        id: db.seq.posts,
        title: body.title,
        body: body.body,
        author: body.author || 'Anonymous',
        created_at: new Date().toISOString(),
      };
      db.posts.push(p);
      localStorage.setItem('bantu_blog_db', JSON.stringify(db));
      return { post: { ...p, likes: 0, comments: 0, shares: 0 }, message: 'Post created' };
    }
  }
  if ((m = path.match(/^\/api\/posts\/(\d+)$/))) {
    id = parseInt(m[1]);
    if (method === 'GET') {
      const p = db.posts.find(x => x.id === id);
      if (!p) return { error: 'Post not found' };
      const comments = db.comments.filter(c => c.post_id === id).map(c => ({
        id: c.id, author: c.author, body: c.body, createdAt: c.created_at
      }));
      return {
        post: {
          ...p,
          likes:    db.likes.filter(l => l.post_id === id).length,
          comments: db.comments.filter(c => c.post_id === id).length,
          shares:   db.shares.filter(s => s.post_id === id).length,
          commentsList: comments,
        }
      };
    }
    if (method === 'DELETE') {
      db.posts = db.posts.filter(x => x.id !== id);
      db.comments = db.comments.filter(c => c.post_id !== id);
      db.likes = db.likes.filter(l => l.post_id !== id);
      db.shares = db.shares.filter(s => s.post_id !== id);
      localStorage.setItem('bantu_blog_db', JSON.stringify(db));
      return { message: 'Post deleted', id };
    }
  }
  if ((m = path.match(/^\/api\/posts\/(\d+)\/comments$/)) && method === 'POST') {
    id = parseInt(m[1]);
    db.seq.comments++;
    const c = { id: db.seq.comments, post_id: id, author: body.author, body: body.body, created_at: new Date().toISOString() };
    db.comments.push(c);
    localStorage.setItem('bantu_blog_db', JSON.stringify(db));
    return { comment: { id: c.id, postId: id, author: c.author, body: c.body, createdAt: c.created_at }, message: 'Comment added' };
  }
  if ((m = path.match(/^\/api\/posts\/(\d+)\/like$/)) && method === 'POST') {
    id = parseInt(m[1]);
    const author = body.author || 'guest_' + Math.floor(Math.random() * 90000 + 10000);
    const idx = db.likes.findIndex(l => l.post_id === id && l.author === author);
    if (idx >= 0) {
      db.likes.splice(idx, 1);
      localStorage.setItem('bantu_blog_db', JSON.stringify(db));
      return { liked: false, likes: db.likes.filter(l => l.post_id === id).length, message: 'Unliked' };
    } else {
      db.seq.likes++;
      db.likes.push({ id: db.seq.likes, post_id: id, author });
      localStorage.setItem('bantu_blog_db', JSON.stringify(db));
      return { liked: true, likes: db.likes.filter(l => l.post_id === id).length, message: 'Liked' };
    }
  }
  if ((m = path.match(/^\/api\/posts\/(\d+)\/share$/)) && method === 'POST') {
    id = parseInt(m[1]);
    db.seq.shares++;
    db.shares.push({ id: db.seq.shares, post_id: id, platform: body.platform || 'copy' });
    localStorage.setItem('bantu_blog_db', JSON.stringify(db));
    return { shared: true, shares: db.shares.filter(s => s.post_id === id).length, message: 'Share recorded' };
  }
  if (path === '/api/stats' && method === 'GET') {
    return {
      posts: db.posts.length,
      comments: db.comments.length,
      likes: db.likes.length,
      shares: db.shares.length,
    };
  }
  return { error: 'Not found' };
}

// ─── LOAD POSTS ────────────────────────────────────────────────
async function loadPosts() {
  const list = document.getElementById('postsList');
  try {
    const data = await api('GET', '/api/posts');
    posts = data.posts || [];
    renderPosts();
  } catch (e) {
    list.innerHTML = `<div class="empty"><h3>Couldn't load posts</h3><p>${e.message}</p></div>`;
  }
}

function renderPosts() {
  const list = document.getElementById('postsList');
  if (posts.length === 0) {
    list.innerHTML = `<div class="empty"><h3>No posts yet</h3><p>Click "New Post" to write the first one.</p></div>`;
    return;
  }
  list.innerHTML = posts.map(p => `
    <article class="post-card">
      <div class="post-meta">
        <div class="post-avatar">${escapeHtml(p.author.charAt(0).toUpperCase())}</div>
        <span class="post-author">${escapeHtml(p.author)}</span>
        <span class="post-dot">·</span>
        <span>${formatDate(p.createdAt)}</span>
      </div>
      <h3 class="post-title" onclick="openPost(${p.id})">${escapeHtml(p.title)}</h3>
      <div class="post-body">${escapeHtml(p.body)}</div>
      <div class="post-actions">
        <button class="btn-icon ${likedPosts.has(p.id) ? 'liked' : ''}" onclick="toggleLike(${p.id}, this)">
          ♥ <span class="like-count">${p.likes}</span>
        </button>
        <button class="btn-icon" onclick="openPost(${p.id})">
          💬 ${p.comments}
        </button>
        <div class="share-menu">
          <button class="btn-icon" onclick="toggleShareMenu(this)">↗ Share (${p.shares})</button>
          <div class="share-dropdown">
            <button onclick="sharePost(${p.id}, 'twitter')">🐦 Twitter</button>
            <button onclick="sharePost(${p.id}, 'facebook')">📘 Facebook</button>
            <button onclick="sharePost(${p.id}, 'whatsapp')">💬 WhatsApp</button>
            <button onclick="sharePost(${p.id}, 'copy')">🔗 Copy link</button>
          </div>
        </div>
        <div class="spacer"></div>
        <button class="btn-icon" onclick="openPost(${p.id})">Read more →</button>
      </div>
    </article>
  `).join('');
}

// ─── STATS ─────────────────────────────────────────────────────
async function loadStats() {
  try {
    const s = await api('GET', '/api/stats');
    document.getElementById('statPosts').textContent    = s.posts;
    document.getElementById('statComments').textContent = s.comments;
    document.getElementById('statLikes').textContent    = s.likes;
    document.getElementById('statShares').textContent   = s.shares;
    document.getElementById('statusStats').textContent =
      `${s.posts} posts · ${s.comments} comments · ${s.likes} likes · ${s.shares} shares`;
  } catch (e) {
    console.warn('stats failed', e);
  }
}

// ─── CREATE POST ───────────────────────────────────────────────
function openCreateModal() {
  document.getElementById('createModal').hidden = false;
  document.getElementById('postTitle').focus();
}
function closeCreateModal() {
  document.getElementById('createModal').hidden = true;
  document.getElementById('postTitle').value = '';
  document.getElementById('postAuthor').value = '';
  document.getElementById('postBody').value = '';
}
async function submitPost() {
  const title  = document.getElementById('postTitle').value.trim();
  const author = document.getElementById('postAuthor').value.trim() || 'Anonymous';
  const body   = document.getElementById('postBody').value.trim();
  if (!title || !body) { toast('Title and body are required'); return; }

  try {
    await api('POST', '/api/posts', { title, author, body });
    closeCreateModal();
    toast('Post published!');
    await loadPosts();
    await loadStats();
  } catch (e) {
    toast('Error: ' + e.message);
  }
}

// ─── POST DETAIL ───────────────────────────────────────────────
async function openPost(id) {
  document.getElementById('detailModal').hidden = false;
  document.getElementById('detailContent').innerHTML = '<div class="loading">Loading post…</div>';
  try {
    const data = await api('GET', `/api/posts/${id}`);
    if (data.error) { document.getElementById('detailContent').innerHTML = `<p>${data.error}</p>`; return; }
    currentPost = data.post;
    renderDetail(data.post);
  } catch (e) {
    document.getElementById('detailContent').innerHTML = `<p>Error: ${e.message}</p>`;
  }
}

function renderDetail(p) {
  const liked = likedPosts.has(p.id);
  document.getElementById('detailContent').innerHTML = `
    <div class="detail-header">
      <div class="post-meta" style="margin-bottom:0;">
        <div class="post-avatar">${escapeHtml(p.author.charAt(0).toUpperCase())}</div>
        <span class="post-author">${escapeHtml(p.author)}</span>
        <span class="post-dot">·</span>
        <span>${formatDate(p.createdAt)}</span>
        <div class="spacer" style="flex:1"></div>
        <button class="btn-icon" onclick="deletePost(${p.id})" title="Delete post">🗑 Delete</button>
      </div>
    </div>
    <h2 class="detail-title">${escapeHtml(p.title)}</h2>
    <div class="detail-body">${escapeHtml(p.body)}</div>
    <div class="detail-actions">
      <button class="btn-icon ${liked ? 'liked' : ''}" id="detailLikeBtn" onclick="toggleLikeDetail(${p.id}, this)">
        ♥ <span id="detailLikeCount">${p.likes}</span>
      </button>
      <div class="share-menu">
        <button class="btn-icon">↗ Share (${p.shares})</button>
        <div class="share-dropdown" id="detailShareDropdown">
          <button onclick="sharePostDetail(${p.id}, 'twitter')">🐦 Twitter</button>
          <button onclick="sharePostDetail(${p.id}, 'facebook')">📘 Facebook</button>
          <button onclick="sharePostDetail(${p.id}, 'whatsapp')">💬 WhatsApp</button>
          <button onclick="sharePostDetail(${p.id}, 'copy')">🔗 Copy link</button>
        </div>
      </div>
    </div>
    <div class="comments-section">
      <h4>${p.commentsList.length} Comment${p.commentsList.length !== 1 ? 's' : ''}</h4>
      <div class="comment-form">
        <input type="text" id="commentAuthor" placeholder="Your name" maxlength="40">
        <textarea id="commentBody" rows="3" placeholder="Write a comment…"></textarea>
        <div style="display:flex; justify-content:flex-end;">
          <button class="btn btn-primary btn-sm" onclick="submitComment(${p.id})">Post comment</button>
        </div>
      </div>
      <div class="comment-list" id="commentList">
        ${p.commentsList.map(c => `
          <div class="comment">
            <div class="comment-header">
              <div class="comment-avatar">${escapeHtml(c.author.charAt(0).toUpperCase())}</div>
              <span class="comment-author">${escapeHtml(c.author)}</span>
              <span class="post-dot">·</span>
              <span>${formatDate(c.createdAt)}</span>
            </div>
            <div class="comment-body">${escapeHtml(c.body)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function closeDetailModal() {
  document.getElementById('detailModal').hidden = true;
  currentPost = null;
}

async function deletePost(id) {
  if (!confirm('Delete this post? This cannot be undone.')) return;
  await api('DELETE', `/api/posts/${id}`);
  closeDetailModal();
  toast('Post deleted');
  await loadPosts();
  await loadStats();
}

// ─── LIKE ──────────────────────────────────────────────────────
async function toggleLike(id, btn) {
  const author = localStorage.getItem('bantu_blog_user') || 'guest_' + Math.floor(Math.random() * 90000 + 10000);
  localStorage.setItem('bantu_blog_user', author);
  try {
    const r = await api('POST', `/api/posts/${id}/like`, { author });
    if (r.liked) {
      likedPosts.add(id);
      btn.classList.add('liked');
    } else {
      likedPosts.delete(id);
      btn.classList.remove('liked');
    }
    btn.querySelector('.like-count').textContent = r.likes;
    localStorage.setItem('bantu_blog_likes', JSON.stringify([...likedPosts]));
    // Update the post in the local list
    const p = posts.find(x => x.id === id);
    if (p) p.likes = r.likes;
    await loadStats();
  } catch (e) { toast('Error: ' + e.message); }
}

async function toggleLikeDetail(id, btn) {
  const author = localStorage.getItem('bantu_blog_user') || 'guest_' + Math.floor(Math.random() * 90000 + 10000);
  localStorage.setItem('bantu_blog_user', author);
  try {
    const r = await api('POST', `/api/posts/${id}/like`, { author });
    if (r.liked) {
      likedPosts.add(id);
      btn.classList.add('liked');
    } else {
      likedPosts.delete(id);
      btn.classList.remove('liked');
    }
    document.getElementById('detailLikeCount').textContent = r.likes;
    localStorage.setItem('bantu_blog_likes', JSON.stringify([...likedPosts]));
    await loadPosts();
    await loadStats();
  } catch (e) { toast('Error: ' + e.message); }
}

// ─── COMMENT ───────────────────────────────────────────────────
async function submitComment(postId) {
  const author = (document.getElementById('commentAuthor').value || '').trim() || 'Anonymous';
  const body   = (document.getElementById('commentBody').value || '').trim();
  if (!body) { toast('Comment cannot be empty'); return; }
  try {
    const r = await api('POST', `/api/posts/${postId}/comments`, { author, body });
    // Re-open the post to refresh comments
    await openPost(postId);
    toast('Comment posted!');
    await loadStats();
  } catch (e) { toast('Error: ' + e.message); }
}

// ─── SHARE ─────────────────────────────────────────────────────
function toggleShareMenu(btn) {
  const dropdown = btn.parentElement.querySelector('.share-dropdown');
  // Close all others
  document.querySelectorAll('.share-dropdown').forEach(d => { if (d !== dropdown) d.classList.remove('open'); });
  dropdown.classList.toggle('open');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.share-menu')) {
    document.querySelectorAll('.share-dropdown').forEach(d => d.classList.remove('open'));
  }
});

async function sharePost(id, platform) {
  document.querySelectorAll('.share-dropdown').forEach(d => d.classList.remove('open'));
  const p = posts.find(x => x.id === id);
  if (!p) return;
  const url = window.location.origin + '/blog/#post-' + id;
  const text = `${p.title} — by ${p.author} on Bantu Blog`;

  if (platform === 'twitter') {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
  } else if (platform === 'facebook') {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
  } else if (platform === 'whatsapp') {
    window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
  } else if (platform === 'copy') {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied to clipboard!');
    } catch {
      toast('Could not copy — share this URL: ' + url);
    }
  }
  try { await api('POST', `/api/posts/${id}/share`, { platform }); }
  catch (e) { /* silent */ }
  await loadPosts();
  await loadStats();
}

async function sharePostDetail(id, platform) {
  document.getElementById('detailShareDropdown').classList.remove('open');
  const p = currentPost;
  if (!p) return;
  const url = window.location.origin + '/blog/#post-' + id;
  const text = `${p.title} — by ${p.author} on Bantu Blog`;

  if (platform === 'twitter') {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
  } else if (platform === 'facebook') {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
  } else if (platform === 'whatsapp') {
    window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
  } else if (platform === 'copy') {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied to clipboard!');
    } catch {
      toast('Could not copy — share this URL: ' + url);
    }
  }
  try { await api('POST', `/api/posts/${id}/share`, { platform }); }
  catch (e) { /* silent */ }
  await openPost(id);
  await loadPosts();
  await loadStats();
}

// ─── HELPERS ───────────────────────────────────────────────────
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const min = 60 * 1000, hr = 60 * min, day = 24 * hr;
  if (diff < min) return 'just now';
  if (diff < hr)   return Math.floor(diff / min) + 'm ago';
  if (diff < day)  return Math.floor(diff / hr) + 'h ago';
  if (diff < 7 * day) return Math.floor(diff / day) + 'd ago';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { t.hidden = true; }, 2500);
}

// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!document.getElementById('createModal').hidden) closeCreateModal();
    if (!document.getElementById('detailModal').hidden) closeDetailModal();
  }
});
