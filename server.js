const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'boss-installations-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// ─── Auth Middleware ───
function requireAuth(req, res, next) {
  if (req.session && req.session.adminId) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

// ─── PUBLIC ROUTES ───

// Contact form submission
app.post('/api/contact', (req, res) => {
  const { name, email, phone, service, message } = req.body;

  if (!name || !email || !service || !message) {
    return res.status(400).json({ error: 'Name, email, service, and message are required.' });
  }

  try {
    const stmt = db.prepare(
      'INSERT INTO inquiries (name, email, phone, service, message) VALUES (?, ?, ?, ?, ?)'
    );
    const result = stmt.run(name, email, phone || null, service, message);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('Contact form error:', err);
    res.status(500).json({ error: 'Failed to submit inquiry.' });
  }
});

// ─── ADMIN AUTH ───

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }

  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  req.session.adminId = user.id;
  req.session.adminUser = user.username;
  res.json({ success: true, username: user.username });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/admin/session', requireAuth, (req, res) => {
  res.json({ loggedIn: true, username: req.session.adminUser });
});

// ─── ADMIN: INQUIRIES ───

app.get('/api/admin/inquiries', requireAuth, (req, res) => {
  const { search, unread } = req.query;
  let query = 'SELECT * FROM inquiries';
  const conditions = [];
  const params = [];

  if (unread === 'true') {
    conditions.push('is_read = 0');
  }
  if (search) {
    conditions.push('(name LIKE ? OR email LIKE ? OR service LIKE ? OR message LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY created_at DESC';

  const inquiries = db.prepare(query).all(...params);
  res.json(inquiries);
});

app.put('/api/admin/inquiries/:id/read', requireAuth, (req, res) => {
  db.prepare('UPDATE inquiries SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/inquiries/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM inquiries WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── ADMIN: CLIENTS ───

app.get('/api/admin/clients', requireAuth, (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM clients';
  const params = [];

  if (search) {
    query += ' WHERE name LIKE ? OR email LIKE ? OR phone LIKE ? OR service LIKE ?';
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }
  query += ' ORDER BY created_at DESC';

  const clients = db.prepare(query).all(...params);
  res.json(clients);
});

app.get('/api/admin/clients/:id', requireAuth, (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found.' });
  res.json(client);
});

app.post('/api/admin/clients', requireAuth, (req, res) => {
  const { name, email, phone, address, service, notes } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Client name is required.' });
  }

  try {
    const stmt = db.prepare(
      'INSERT INTO clients (name, email, phone, address, service, notes) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(name, email || null, phone || null, address || null, service || null, notes || null);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('Add client error:', err);
    res.status(500).json({ error: 'Failed to add client.' });
  }
});

app.put('/api/admin/clients/:id', requireAuth, (req, res) => {
  const { name, email, phone, address, service, notes } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Client name is required.' });
  }

  try {
    db.prepare(
      `UPDATE clients SET name = ?, email = ?, phone = ?, address = ?, service = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(name, email || null, phone || null, address || null, service || null, notes || null, req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Update client error:', err);
    res.status(500).json({ error: 'Failed to update client.' });
  }
});

app.delete('/api/admin/clients/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── ADMIN: STATS ───

app.get('/api/admin/stats', requireAuth, (req, res) => {
  const totalInquiries = db.prepare('SELECT COUNT(*) as count FROM inquiries').get().count;
  const unreadInquiries = db.prepare('SELECT COUNT(*) as count FROM inquiries WHERE is_read = 0').get().count;
  const totalClients = db.prepare('SELECT COUNT(*) as count FROM clients').get().count;

  const serviceBreakdown = db.prepare(
    'SELECT service, COUNT(*) as count FROM clients WHERE service IS NOT NULL GROUP BY service ORDER BY count DESC'
  ).all();

  const recentInquiries = db.prepare(
    'SELECT * FROM inquiries ORDER BY created_at DESC LIMIT 5'
  ).all();

  res.json({
    totalInquiries,
    unreadInquiries,
    totalClients,
    serviceBreakdown,
    recentInquiries
  });
});

// ─── ADMIN: CHANGE PASSWORD ───

app.put('/api/admin/password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password required.' });
  }

  const user = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.session.adminId);

  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  res.json({ success: true });
});

// Serve admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🔧 Boss Installations Services Limited`);
  console.log(`   Server running at http://localhost:${PORT}`);
  console.log(`   Admin panel at http://localhost:${PORT}/admin\n`);
});
