// Konsistenter Backup-Snapshot der Datenbank.
// Aufruf im Container:  docker exec dreicount npm run backup
import fs from 'fs';
import path from 'path';
import db from '../db.js';

const dir = process.env.BACKUP_DIR || '/app/data/backups';
const keep = Number(process.env.BACKUP_KEEP || 14);
fs.mkdirSync(dir, { recursive: true });

const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '');
const dest = path.join(dir, `dreicount-${stamp}.db`);

await db.backup(dest);

// Alte Backups aufräumen
const files = fs.readdirSync(dir)
  .filter((f) => f.startsWith('dreicount-') && f.endsWith('.db'))
  .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t);
for (const { f } of files.slice(keep)) fs.unlinkSync(path.join(dir, f));

console.log('Backup erstellt:', dest);
process.exit(0);
