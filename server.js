import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomBytes, createHmac, createHash, timingSafeEqual } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

// Hinter dem nginx-Reverse-Proxy: echte Client-IP für Rate-Limiting erkennen.
app.set('trust proxy', 1);

// ---- Sicherheits-Middleware --------------------------------------------------
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
}));

app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '8kb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// Healthcheck (für Docker / Reverse-Proxy)
app.get('/healthz', (req, res) => res.json({ ok: true }));

// ---- Authentifizierung -------------------------------------------------------
// AUTH_PASSWORD  -> normale Anmeldung (Rolle "user")
// ADMIN_PASSWORD -> Admin-Anmeldung   (Rolle "admin", darf alles verwalten)
// Ohne AUTH_PASSWORD ist die App offen; jeder gilt dann als "admin" (nur Test).
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const AUTH_ENABLED = AUTH_PASSWORD.length > 0;
const SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
const COOKIE = 'dc_session';
const MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 Tage

if (!AUTH_ENABLED) {
  console.warn('WARNUNG: AUTH_PASSWORD nicht gesetzt - die App ist OHNE Anmeldung erreichbar.');
} else if (!process.env.SESSION_SECRET) {
  console.warn('Hinweis: SESSION_SECRET nicht gesetzt - Sessions werden bei jedem Neustart ungültig.');
}

const sha = (s) => createHash('sha256').update(String(s)).digest();
function constEq(a, b) {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
// Prüft das Login-Passwort und liefert die Rolle ('admin' | 'user' | null).
function roleForPassword(input) {
  if (ADMIN_PASSWORD && timingSafeEqual(sha(input), sha(ADMIN_PASSWORD))) return 'admin';
  if (AUTH_PASSWORD && timingSafeEqual(sha(input), sha(AUTH_PASSWORD))) return 'user';
  return null;
}
function getCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1));
  }
  return null;
}
function makeToken(role) {
  const exp = Date.now() + MAX_AGE;
  const payload = `${exp}.${role}`;
  const sig = createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
// Liefert die Rolle aus einem gültigen Token oder null.
function roleFromToken(tok) {
  if (!tok) return null;
  const parts = tok.split('.');
  if (parts.length !== 3) return null;
  const [exp, role, sig] = parts;
  if (!['user', 'admin'].includes(role)) return null;
  if (!Number.isFinite(Number(exp)) || Number(exp) < Date.now()) return null;
  const expect = createHmac('sha256', SECRET).update(`${exp}.${role}`).digest('base64url');
  return constEq(sig, expect) ? role : null;
}
// Effektive Rolle des Requests: ohne Auth gilt jeder als admin.
function roleOf(req) {
  if (!AUTH_ENABLED) return 'admin';
  return roleFromToken(getCookie(req, COOKIE));
}
const isAuthed = (req) => roleOf(req) !== null;

function setSession(req, res, role) {
  res.cookie(COOKIE, makeToken(role), {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,        // hinter HTTPS-Proxy automatisch true
    maxAge: MAX_AGE,
    path: '/',
  });
}

function requireAdmin(req, res, next) {
  if (roleOf(req) === 'admin') return next();
  return res.status(403).json({ error: 'Nur für Administratoren.' });
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,                     // max. 10 Login-Versuche / 15 min / IP
  standardHeaders: true,
  legacyHeaders: false,
});

// Gate: alles gesperrt außer Login, Healthcheck und Stylesheet (für die Login-Seite)
const OPEN_GET = new Set(['/healthz', '/login', '/style.css']);
app.use((req, res, next) => {
  if (!AUTH_ENABLED) return next();
  if (req.method === 'GET' && OPEN_GET.has(req.path)) return next();
  if (req.method === 'POST' && req.path === '/login') return next();
  if (isAuthed(req)) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Nicht angemeldet.' });
  return res.redirect('/login');
});

function loginPage(error) {
  return `<!DOCTYPE html><html lang="de"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<meta name="theme-color" content="#0e1312"/>
<title>Anmelden · Dreicount</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="/style.css"/>
</head><body>
<header class="topbar"><a class="brand" href="/login"><span class="brand-mark">÷</span><span class="brand-name">Dreicount</span></a><span class="brand-tag">Ausgaben fair teilen</span></header>
<main class="app">
  <h1 class="hero">Anmelden</h1>
  <p class="lead">Bitte gib dein Zugangspasswort ein, um fortzufahren.</p>
  <form class="card" method="post" action="/login" autocomplete="on">
    <div class="field">
      <label for="password">Passwort</label>
      <input id="password" name="password" type="password" autocomplete="current-password" autofocus required/>
    </div>
    <button class="btn-primary" type="submit">Anmelden</button>
    ${error ? '<div class="error">Falsches Passwort.</div>' : ''}
  </form>
</main>
</body></html>`;
}

app.get('/login', (req, res) => {
  if (!AUTH_ENABLED || isAuthed(req)) return res.redirect('/');
  res.type('html').send(loginPage(req.query.e === '1'));
});

app.post('/login', loginLimiter, (req, res) => {
  const role = roleForPassword(req.body?.password || '');
  if (!role) return res.redirect('/login?e=1');
  setSession(req, res, role);
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.redirect('/login');
});

// Aktuelle Rolle für das Frontend
app.get('/api/me', (req, res) => {
  res.json({ role: roleOf(req) || 'user', authEnabled: AUTH_ENABLED });
});

// ---- Hilfsfunktionen ---------------------------------------------------------
const genId = (bytes = 16) => randomBytes(bytes).toString('base64url');

function toCents(value) {
  if (typeof value === 'string') value = value.trim().replace(',', '.');
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function clean(str, max = 200) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, max);
}

// Gleichmäßige Aufteilung inkl. Restcent-Verteilung (summiert exakt auf total).
function splitEqually(totalCents, memberIds) {
  const n = memberIds.length;
  const base = Math.floor(totalCents / n);
  let remainder = totalCents - base * n;
  return memberIds.map((id) => {
    let share = base;
    if (remainder > 0) { share += 1; remainder -= 1; }
    return { member_id: id, share_cents: share };
  });
}

// Schuldenausgleich mit minimaler Anzahl an Überweisungen (Greedy).
function settle(balances) {
  const debtors = [], creditors = [];
  for (const [id, bal] of Object.entries(balances)) {
    if (bal < 0) debtors.push({ id, amt: -bal });
    else if (bal > 0) creditors.push({ id, amt: bal });
  }
  debtors.sort((a, b) => b.amt - a.amt);
  creditors.sort((a, b) => b.amt - a.amt);
  const tx = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    if (pay > 0) tx.push({ from: debtors[i].id, to: creditors[j].id, amount_cents: pay });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt === 0) i++;
    if (creditors[j].amt === 0) j++;
  }
  return tx;
}

function loadTricount(id) {
  const tc = db.prepare('SELECT id, title, currency, created_at, closed_at FROM tricounts WHERE id = ?').get(id);
  if (!tc) return null;
  const members = db.prepare('SELECT id, name, paypal_email FROM members WHERE tricount_id = ? ORDER BY created_at').all(id);
  const expenses = db.prepare(
    'SELECT id, description, amount_cents, paid_by, spent_on, created_at FROM expenses WHERE tricount_id = ? ORDER BY spent_on DESC, created_at DESC'
  ).all(id);
  const shareRows = db.prepare(
    `SELECT s.expense_id, s.member_id, s.share_cents FROM expense_shares s
     JOIN expenses e ON e.id = s.expense_id WHERE e.tricount_id = ?`
  ).all(id);
  const payments = db.prepare(
    'SELECT id, from_member, to_member, amount_cents, paid_on, created_at FROM payments WHERE tricount_id = ? ORDER BY created_at DESC'
  ).all(id);

  const sharesByExpense = {};
  for (const r of shareRows) {
    (sharesByExpense[r.expense_id] ||= []).push({ member_id: r.member_id, share_cents: r.share_cents });
  }
  for (const e of expenses) e.shares = sharesByExpense[e.id] || [];

  // Salden aus Ausgaben
  const balances = {};
  for (const m of members) balances[m.id] = 0;
  for (const e of expenses) {
    balances[e.paid_by] += e.amount_cents;
    for (const s of e.shares) balances[s.member_id] -= s.share_cents;
  }
  // Rückzahlungen verrechnen: wer zurückzahlt, baut seine Schuld ab.
  for (const p of payments) {
    if (p.from_member in balances) balances[p.from_member] += p.amount_cents;
    if (p.to_member in balances) balances[p.to_member] -= p.amount_cents;
  }

  return { ...tc, members, expenses, payments, balances, settlements: settle(balances) };
}

// Liefert die Abrechnung (id + closed_at) oder null – für Existenz-/Schreibschutz-Prüfung.
const findTricount = (id) => db.prepare('SELECT id, closed_at FROM tricounts WHERE id = ?').get(id);
// Antwortet mit einem Fehler, falls die Abrechnung fehlt oder geschlossen ist; sonst null.
function blockIfMissingOrClosed(tc, res) {
  if (!tc) { res.status(404).json({ error: 'Abrechnung nicht gefunden.' }); return true; }
  if (tc.closed_at) { res.status(409).json({ error: 'Abrechnung ist geschlossen. Bitte zuerst wieder öffnen.' }); return true; }
  return false;
}

// ---- API ---------------------------------------------------------------------

// ---- Personen (wiederverwendbarer Teilnehmer-Pool) --------------------------

// Alle gespeicherten Personen
app.get('/api/users', (req, res) => {
  res.json(db.prepare('SELECT id, name FROM users ORDER BY name COLLATE NOCASE').all());
});

// Person anlegen (oder vorhandene zurückgeben, falls Name bereits existiert)
app.post('/api/users', (req, res) => {
  const name = clean(req.body?.name, 60);
  if (!name) return res.status(400).json({ error: 'Name fehlt.' });
  const existing = db.prepare('SELECT id, name FROM users WHERE name = ? COLLATE NOCASE').get(name);
  if (existing) return res.json(existing);
  const id = genId(8);
  db.prepare('INSERT INTO users (id, name) VALUES (?, ?)').run(id, name);
  res.status(201).json({ id, name });
});

// Person aus dem Pool entfernen (bestehende Abrechnungen bleiben unberührt)
app.delete('/api/users/:id', requireAdmin, (req, res) => {
  const r = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'Person nicht gefunden.' });
  res.json({ ok: true });
});

// Neue Abrechnung anlegen
app.post('/api/tricounts', (req, res) => {
  const title = clean(req.body?.title, 120);
  const currency = clean(req.body?.currency, 4) || '€';

  // Teilnehmernamen aus zwei Quellen: ausgewählte Personen + frei eingegebene Namen.
  const typedNames = Array.isArray(req.body?.members)
    ? req.body.members.map((n) => clean(n, 60)).filter(Boolean)
    : [];
  const userIds = Array.isArray(req.body?.user_ids)
    ? req.body.user_ids.map((u) => clean(u, 40)).filter(Boolean)
    : [];
  const selectedNames = userIds.length
    ? db.prepare(`SELECT name FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`).all(...userIds).map((u) => u.name)
    : [];

  // Zusammenführen, Duplikate (ohne Beachtung der Groß-/Kleinschreibung) entfernen.
  const names = [];
  const seen = new Set();
  for (const n of [...selectedNames, ...typedNames]) {
    const key = n.toLowerCase();
    if (!seen.has(key)) { seen.add(key); names.push(n); }
  }

  if (!title) return res.status(400).json({ error: 'Titel fehlt.' });
  if (names.length < 2) return res.status(400).json({ error: 'Mindestens zwei Teilnehmer angeben.' });
  if (names.length > 50) return res.status(400).json({ error: 'Maximal 50 Teilnehmer.' });

  const id = genId(16);
  const insertTc = db.prepare('INSERT INTO tricounts (id, title, currency) VALUES (?, ?, ?)');
  const insertMember = db.prepare('INSERT INTO members (id, tricount_id, name) VALUES (?, ?, ?)');
  // Neu eingegebene Namen für die spätere Wiederverwendung in den Pool übernehmen.
  const upsertUser = db.prepare('INSERT OR IGNORE INTO users (id, name) VALUES (?, ?)');

  db.transaction(() => {
    insertTc.run(id, title, currency);
    for (const name of names) {
      insertMember.run(genId(8), id, name);
      upsertUser.run(genId(8), name);
    }
  })();

  res.status(201).json({ id });
});

// Alle Abrechnungen auflisten (Übersicht nach dem Login)
app.get('/api/tricounts', (req, res) => {
  const rows = db.prepare(`
    SELECT t.id, t.title, t.currency, t.created_at, t.closed_at,
           (SELECT COUNT(*) FROM members  m WHERE m.tricount_id  = t.id) AS member_count,
           (SELECT COUNT(*) FROM expenses e WHERE e.tricount_id  = t.id) AS expense_count,
           (SELECT COALESCE(SUM(amount_cents),0) FROM expenses e WHERE e.tricount_id = t.id) AS total_cents
    FROM tricounts t
    ORDER BY t.created_at DESC
  `).all();
  res.json(rows);
});

// Abrechnung laden
app.get('/api/tricounts/:id', (req, res) => {
  const data = loadTricount(req.params.id);
  if (!data) return res.status(404).json({ error: 'Abrechnung nicht gefunden.' });
  res.json(data);
});

// Parst & validiert die Eingabe einer Ausgabe (für Anlegen und Bearbeiten).
// Liefert { value: {...} } oder { error: '...' }.
function parseExpenseInput(body, memberIds) {
  const memberSet = new Set(memberIds);

  const description = clean(body?.description, 120);
  const amountCents = toCents(body?.amount);
  const paidBy = clean(body?.paid_by, 40);
  const spentOn = clean(body?.spent_on, 10) || new Date().toISOString().slice(0, 10);

  if (!description) return { error: 'Beschreibung fehlt.' };
  if (!amountCents) return { error: 'Ungültiger Betrag.' };
  if (!memberSet.has(paidBy)) return { error: 'Zahler unbekannt.' };

  // Aufteilung bestimmen
  let shares;
  if (Array.isArray(body?.shares) && body.shares.length) {
    // Benutzerdefiniert: { member_id, amount } - muss exakt auf Betrag summieren
    shares = [];
    let sum = 0;
    for (const s of body.shares) {
      const mid = clean(s?.member_id, 40);
      const c = toCents(s?.amount);
      if (!memberSet.has(mid) || !c) return { error: 'Ungültige Aufteilung.' };
      shares.push({ member_id: mid, share_cents: c });
      sum += c;
    }
    if (sum !== amountCents) return { error: 'Aufteilung ergibt nicht den Gesamtbetrag.' };
  } else {
    // Gleichmäßig: optional nur auf eine Teilmenge
    let amongRaw = Array.isArray(body?.split_among) && body.split_among.length
      ? body.split_among.map((m) => clean(m, 40))
      : memberIds;
    const among = amongRaw.filter((m) => memberSet.has(m));
    if (!among.length) return { error: 'Niemand zum Aufteilen ausgewählt.' };
    shares = splitEqually(amountCents, among);
  }

  return { value: { description, amountCents, paidBy, spentOn, shares } };
}

// Ausgabe hinzufügen
app.post('/api/tricounts/:id/expenses', (req, res) => {
  const tc = findTricount(req.params.id);
  if (blockIfMissingOrClosed(tc, res)) return;

  const memberIds = db.prepare('SELECT id FROM members WHERE tricount_id = ?').all(tc.id).map((m) => m.id);
  const parsed = parseExpenseInput(req.body, memberIds);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const { description, amountCents, paidBy, spentOn, shares } = parsed.value;

  const expenseId = genId(12);
  const insertExpense = db.prepare(
    'INSERT INTO expenses (id, tricount_id, description, amount_cents, paid_by, spent_on) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertShare = db.prepare('INSERT INTO expense_shares (expense_id, member_id, share_cents) VALUES (?, ?, ?)');

  db.transaction(() => {
    insertExpense.run(expenseId, tc.id, description, amountCents, paidBy, spentOn);
    for (const s of shares) insertShare.run(expenseId, s.member_id, s.share_cents);
  })();

  res.status(201).json(loadTricount(tc.id));
});

// Ausgabe bearbeiten
app.put('/api/tricounts/:id/expenses/:expenseId', (req, res) => {
  const tc = findTricount(req.params.id);
  if (blockIfMissingOrClosed(tc, res)) return;

  const existing = db.prepare('SELECT id FROM expenses WHERE id = ? AND tricount_id = ?')
    .get(req.params.expenseId, tc.id);
  if (!existing) return res.status(404).json({ error: 'Ausgabe nicht gefunden.' });

  const memberIds = db.prepare('SELECT id FROM members WHERE tricount_id = ?').all(tc.id).map((m) => m.id);
  const parsed = parseExpenseInput(req.body, memberIds);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const { description, amountCents, paidBy, spentOn, shares } = parsed.value;

  const updateExpense = db.prepare(
    'UPDATE expenses SET description = ?, amount_cents = ?, paid_by = ?, spent_on = ? WHERE id = ?'
  );
  const deleteShares = db.prepare('DELETE FROM expense_shares WHERE expense_id = ?');
  const insertShare = db.prepare('INSERT INTO expense_shares (expense_id, member_id, share_cents) VALUES (?, ?, ?)');

  db.transaction(() => {
    updateExpense.run(description, amountCents, paidBy, spentOn, existing.id);
    deleteShares.run(existing.id);
    for (const s of shares) insertShare.run(existing.id, s.member_id, s.share_cents);
  })();

  res.json(loadTricount(tc.id));
});

// Ausgabe löschen
app.delete('/api/tricounts/:id/expenses/:expenseId', (req, res) => {
  const tc = findTricount(req.params.id);
  if (blockIfMissingOrClosed(tc, res)) return;
  const row = db.prepare('SELECT id FROM expenses WHERE id = ? AND tricount_id = ?')
    .get(req.params.expenseId, req.params.id);
  if (!row) return res.status(404).json({ error: 'Ausgabe nicht gefunden.' });
  db.prepare('DELETE FROM expenses WHERE id = ?').run(row.id);
  res.json(loadTricount(req.params.id));
});

// Zahlung erfassen ("als bezahlt markieren": from zahlt amount an to)
app.post('/api/tricounts/:id/payments', (req, res) => {
  const tc = findTricount(req.params.id);
  if (blockIfMissingOrClosed(tc, res)) return;

  const memberSet = new Set(db.prepare('SELECT id FROM members WHERE tricount_id = ?').all(tc.id).map((m) => m.id));
  const from = clean(req.body?.from, 40);
  const to = clean(req.body?.to, 40);
  const amountCents = toCents(req.body?.amount);
  const paidOn = clean(req.body?.paid_on, 10) || new Date().toISOString().slice(0, 10);

  if (!memberSet.has(from) || !memberSet.has(to)) return res.status(400).json({ error: 'Teilnehmer unbekannt.' });
  if (from === to) return res.status(400).json({ error: 'Zahler und Empfänger sind identisch.' });
  if (!amountCents) return res.status(400).json({ error: 'Ungültiger Betrag.' });

  db.prepare('INSERT INTO payments (id, tricount_id, from_member, to_member, amount_cents, paid_on) VALUES (?, ?, ?, ?, ?, ?)')
    .run(genId(12), tc.id, from, to, amountCents, paidOn);
  res.status(201).json(loadTricount(tc.id));
});

// Zahlung rückgängig machen
app.delete('/api/tricounts/:id/payments/:paymentId', (req, res) => {
  const tc = findTricount(req.params.id);
  if (blockIfMissingOrClosed(tc, res)) return;
  const row = db.prepare('SELECT id FROM payments WHERE id = ? AND tricount_id = ?')
    .get(req.params.paymentId, req.params.id);
  if (!row) return res.status(404).json({ error: 'Zahlung nicht gefunden.' });
  db.prepare('DELETE FROM payments WHERE id = ?').run(row.id);
  res.json(loadTricount(req.params.id));
});

// Abrechnung abschließen (nur wenn alles ausgeglichen ist)
app.post('/api/tricounts/:id/close', (req, res) => {
  const data = loadTricount(req.params.id);
  if (!data) return res.status(404).json({ error: 'Abrechnung nicht gefunden.' });
  if (data.closed_at) return res.status(409).json({ error: 'Abrechnung ist bereits geschlossen.' });
  if (data.settlements.length && roleOf(req) !== 'admin')
    return res.status(409).json({ error: 'Es sind noch Zahlungen offen.' });
  db.prepare("UPDATE tricounts SET closed_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json(loadTricount(req.params.id));
});

// Abrechnung wieder öffnen
app.post('/api/tricounts/:id/reopen', (req, res) => {
  const tc = findTricount(req.params.id);
  if (!tc) return res.status(404).json({ error: 'Abrechnung nicht gefunden.' });
  db.prepare('UPDATE tricounts SET closed_at = NULL WHERE id = ?').run(req.params.id);
  res.json(loadTricount(req.params.id));
});

// PayPal-E-Mail eines Mitglieds speichern
app.patch('/api/tricounts/:id/members/:memberId', (req, res) => {
  const tc = findTricount(req.params.id);
  if (!tc) return res.status(404).json({ error: 'Abrechnung nicht gefunden.' });
  const member = db.prepare('SELECT id FROM members WHERE id = ? AND tricount_id = ?')
    .get(req.params.memberId, tc.id);
  if (!member) return res.status(404).json({ error: 'Mitglied nicht gefunden.' });
  const email = clean(req.body?.paypal_email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Ungültige E-Mail-Adresse.' });
  db.prepare('UPDATE members SET paypal_email = ? WHERE id = ?').run(email || null, member.id);
  res.json({ ok: true });
});

// ---- Admin -------------------------------------------------------------------

// Abrechnung umbenennen
app.patch('/api/admin/tricounts/:id', requireAdmin, (req, res) => {
  const title = clean(req.body?.title, 120);
  if (!title) return res.status(400).json({ error: 'Titel fehlt.' });
  const r = db.prepare('UPDATE tricounts SET title = ? WHERE id = ?').run(title, req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'Abrechnung nicht gefunden.' });
  res.json({ ok: true });
});

// Abrechnung komplett löschen (inkl. Mitglieder/Ausgaben/Zahlungen)
app.delete('/api/admin/tricounts/:id', requireAdmin, (req, res) => {
  const r = db.prepare('DELETE FROM tricounts WHERE id = ?').run(req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'Abrechnung nicht gefunden.' });
  res.json({ ok: true });
});

// ---- Statische Dateien & SPA -------------------------------------------------
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Dreicount läuft auf http://${HOST}:${PORT}  (Anmeldung: ${AUTH_ENABLED ? 'aktiv' : 'AUS'})`);
});
