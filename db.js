import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'dreicount.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS tricounts (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  currency   TEXT NOT NULL DEFAULT '€',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS members (
  id           TEXT PRIMARY KEY,
  tricount_id  TEXT NOT NULL REFERENCES tricounts(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Wiederverwendbarer Personen-Pool: einmal anlegen, in beliebig vielen
-- Abrechnungen auswählen. Mitglieder werden weiterhin als Namenskopie je
-- Abrechnung gespeichert; dieser Pool dient nur der Auswahl beim Anlegen.
CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expenses (
  id           TEXT PRIMARY KEY,
  tricount_id  TEXT NOT NULL REFERENCES tricounts(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  paid_by      TEXT NOT NULL REFERENCES members(id),
  spent_on     TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expense_shares (
  expense_id  TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  member_id   TEXT NOT NULL REFERENCES members(id),
  share_cents INTEGER NOT NULL,
  PRIMARY KEY (expense_id, member_id)
);

CREATE TABLE IF NOT EXISTS payments (
  id           TEXT PRIMARY KEY,
  tricount_id  TEXT NOT NULL REFERENCES tricounts(id) ON DELETE CASCADE,
  from_member  TEXT NOT NULL REFERENCES members(id),
  to_member    TEXT NOT NULL REFERENCES members(id),
  amount_cents INTEGER NOT NULL,
  paid_on      TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_expenses_tricount ON expenses(tricount_id);
CREATE INDEX IF NOT EXISTS idx_members_tricount  ON members(tricount_id);
CREATE INDEX IF NOT EXISTS idx_shares_member     ON expense_shares(member_id);
CREATE INDEX IF NOT EXISTS idx_payments_tricount ON payments(tricount_id);
`);

// Migration: Spalte closed_at ergänzen (NULL = offen, Zeitstempel = abgeschlossen).
const tricountCols = db.prepare('PRAGMA table_info(tricounts)').all().map((c) => c.name);
if (!tricountCols.includes('closed_at')) {
  db.exec('ALTER TABLE tricounts ADD COLUMN closed_at TEXT');
}

// Migration: PayPal-E-Mail je Mitglied.
const memberCols = db.prepare('PRAGMA table_info(members)').all().map((c) => c.name);
if (!memberCols.includes('paypal_email')) {
  db.exec('ALTER TABLE members ADD COLUMN paypal_email TEXT');
}

export default db;
