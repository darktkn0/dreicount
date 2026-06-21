'use strict';

const app = document.getElementById('app');

// ---- Helpers ----------------------------------------------------------------
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let CURRENCY = '€';
const fmtAmt = (cents, cur = CURRENCY) =>
  (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + cur;
const fmt = (cents) => fmtAmt(cents, CURRENCY);

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { location.href = '/login'; throw new Error('Nicht angemeldet.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Es ist ein Fehler aufgetreten.');
  return data;
}

let toastTimer;
function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) { el = h('<div class="toast"></div>'); document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

// ---- Rolle / Chrome ---------------------------------------------------------
let ME = { role: 'user', authEnabled: false };
function updateChrome() {
  const link = document.querySelector('.admin-link');
  if (link) link.style.display = ME.role === 'admin' ? '' : 'none';
}

// ---- Router -----------------------------------------------------------------
function router() {
  const hash = location.hash.slice(1) || '/';
  const t = hash.match(/^\/t\/(.+)$/);
  if (t) return viewTricount(t[1]);
  if (hash === '/admin') return viewAdmin();
  return viewDashboard();
}
window.addEventListener('hashchange', router);
window.addEventListener('load', async () => {
  try { ME = await api('GET', '/api/me'); } catch {}
  updateChrome();
  router();
});

// ---- Dashboard: alle Abrechnungen -------------------------------------------
async function viewDashboard() {
  app.innerHTML = '<p class="empty">Lade Übersicht…</p>';
  let list;
  try { list = await api('GET', '/api/tricounts'); }
  catch (e) { app.innerHTML = `<p class="empty">${esc(e.message)}</p>`; return; }

  app.innerHTML = '';
  app.appendChild(h(`
    <section>
      <h1 class="hero">Deine Abrechnungen</h1>
      <p class="lead">Wähle eine Abrechnung zum Beitreten oder leg eine neue an.</p>
    </section>
  `));

  const listCard = h('<section class="card"><h2>Alle Abrechnungen</h2></section>');
  if (!list.length) {
    listCard.appendChild(h('<p class="empty">Noch keine Abrechnung vorhanden. Leg unten die erste an.</p>'));
  } else {
    for (const tc of list) {
      const row = h(`
        <a class="tc-row" href="#/t/${esc(tc.id)}">
          <div class="tc-body">
            <div class="tc-title">${esc(tc.title)}</div>
            <div class="tc-meta">${tc.member_count} Personen · ${tc.expense_count} Ausgaben</div>
          </div>
          <div class="tc-sum">${fmtAmt(tc.total_cents, tc.currency)}</div>
          <span class="tc-go">Öffnen →</span>
        </a>
      `);
      listCard.appendChild(row);
    }
  }
  app.appendChild(listCard);

  // Neue Abrechnung
  const card = h(`
    <section class="card">
      <h2>Neue Abrechnung</h2>
      <div class="field">
        <label for="title">Titel</label>
        <input id="title" placeholder="z. B. Wochenende in Hamburg" maxlength="120" />
      </div>
      <div class="row">
        <div class="field" style="flex:2">
          <label for="members">Teilnehmer (eine Person pro Zeile)</label>
          <textarea id="members" placeholder="Anna&#10;Ben&#10;Carla"></textarea>
        </div>
        <div class="field" style="flex:0 0 90px">
          <label for="currency">Währung</label>
          <input id="currency" value="€" maxlength="4" />
        </div>
      </div>
      <button class="btn-primary" id="create">Abrechnung erstellen</button>
      <div class="error" id="err"></div>
    </section>
  `);
  card.querySelector('#create').addEventListener('click', async () => {
    const title = card.querySelector('#title').value.trim();
    const currency = card.querySelector('#currency').value.trim() || '€';
    const members = card.querySelector('#members').value.split('\n').map((s) => s.trim()).filter(Boolean);
    const err = card.querySelector('#err'); err.textContent = '';
    try {
      const { id } = await api('POST', '/api/tricounts', { title, currency, members });
      location.hash = '/t/' + id;
    } catch (e) { err.textContent = e.message; }
  });
  app.appendChild(card);
}

// ---- Abrechnungs-Ansicht ----------------------------------------------------
async function viewTricount(id) {
  app.innerHTML = '<p class="empty">Lade Abrechnung…</p>';
  let data;
  try { data = await api('GET', '/api/tricounts/' + encodeURIComponent(id)); }
  catch (e) { app.innerHTML = `<section class="card"><h2>Nicht gefunden</h2><p class="empty">${esc(e.message)}</p><a class="btn-ghost" href="#/">Zur Übersicht</a></section>`; return; }
  renderTricount(data);
}

function renderTricount(data) {
  CURRENCY = data.currency || '€';
  const name = (mid) => { const m = data.members.find((x) => x.id === mid); return m ? m.name : '?'; };
  app.innerHTML = '';

  app.appendChild(h('<a class="back" href="#/">← Übersicht</a>'));
  app.appendChild(h(`<h1 class="hero">${esc(data.title)}</h1>`));

  const shareUrl = location.origin + '/#/t/' + data.id;
  const share = h(`
    <div class="share">
      <code>${esc(shareUrl)}</code>
      <button class="btn-small btn-primary" id="copy" style="width:auto">Link kopieren</button>
    </div>
  `);
  share.querySelector('#copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(shareUrl); toast('Link kopiert'); }
    catch { toast('Kopieren nicht möglich'); }
  });
  app.appendChild(share);

  // Ausgabe hinzufügen
  const addCard = h(`
    <section class="card">
      <h2>Ausgabe hinzufügen</h2>
      <div class="field"><label for="desc">Wofür?</label>
        <input id="desc" placeholder="z. B. Einkauf, Restaurant, Tickets" maxlength="120" /></div>
      <div class="row">
        <div class="field"><label for="amount">Betrag</label>
          <input id="amount" class="amount-input" inputmode="decimal" placeholder="0,00" /></div>
        <div class="field"><label for="date">Datum</label><input id="date" type="date" /></div>
      </div>
      <div class="field"><label for="payer">Bezahlt von</label>
        <select id="payer">${data.members.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Aufteilen auf</label>
        <div class="checks" id="among">
          ${data.members.map((m) => `<label class="chip on"><input type="checkbox" value="${m.id}" checked /> ${esc(m.name)}</label>`).join('')}
        </div></div>
      <button class="btn-primary" id="add">Ausgabe eintragen</button>
      <div class="error" id="aerr"></div>
    </section>
  `);
  addCard.querySelector('#date').value = new Date().toISOString().slice(0, 10);
  addCard.querySelectorAll('.chip input').forEach((cb) =>
    cb.addEventListener('change', () => cb.closest('.chip').classList.toggle('on', cb.checked)));
  addCard.querySelector('#add').addEventListener('click', async () => {
    const desc = addCard.querySelector('#desc').value.trim();
    const amount = addCard.querySelector('#amount').value.replace(',', '.');
    const paid_by = addCard.querySelector('#payer').value;
    const spent_on = addCard.querySelector('#date').value;
    const split_among = [...addCard.querySelectorAll('.chip input:checked')].map((c) => c.value);
    const err = addCard.querySelector('#aerr'); err.textContent = '';
    try { renderTricount(await api('POST', `/api/tricounts/${data.id}/expenses`, { description: desc, amount, paid_by, spent_on, split_among })); toast('Ausgabe gespeichert'); }
    catch (e) { err.textContent = e.message; }
  });
  app.appendChild(addCard);

  // Ausgabenliste
  const expCard = h('<section class="card"><h2>Ausgaben</h2></section>');
  if (!data.expenses.length) expCard.appendChild(h('<p class="empty">Noch keine Ausgaben.</p>'));
  else for (const e of data.expenses) {
    const row = h(`
      <div class="exp">
        <div class="exp-body">
          <div class="exp-desc">${esc(e.description)}</div>
          <div class="exp-meta">${esc(name(e.paid_by))} · ${esc(e.spent_on)} · ${e.shares.length} Personen</div>
        </div>
        <div class="exp-amt">${fmt(e.amount_cents)}</div>
        <button class="exp-del" title="Löschen">×</button>
      </div>
    `);
    row.querySelector('.exp-del').addEventListener('click', async () => {
      if (!confirm('Diese Ausgabe löschen?')) return;
      renderTricount(await api('DELETE', `/api/tricounts/${data.id}/expenses/${e.id}`)); toast('Ausgabe gelöscht');
    });
    expCard.appendChild(row);
  }
  app.appendChild(expCard);

  // Salden
  const maxAbs = Math.max(1, ...data.members.map((m) => Math.abs(data.balances[m.id] || 0)));
  const balCard = h('<section class="card"><h2>Salden</h2></section>');
  for (const m of data.members) {
    const b = data.balances[m.id] || 0;
    const cls = b > 0 ? 'pos' : b < 0 ? 'neg' : '';
    const label = b > 0 ? 'bekommt' : b < 0 ? 'schuldet' : 'ausgeglichen';
    balCard.appendChild(h(`
      <div class="bal">
        <div class="bal-head"><span class="bal-name">${esc(m.name)}</span>
          <span class="bal-amt ${cls}">${b === 0 ? '—' : (b > 0 ? '+' : '−') + fmt(Math.abs(b))}</span></div>
        <div class="bar"><span class="${cls}" style="width:${(Math.abs(b) / maxAbs) * 50}%"></span></div>
        <div class="exp-meta">${label}</div>
      </div>
    `));
  }
  app.appendChild(balCard);

  // Ausgleich (offen) mit "als bezahlt markieren"
  const setCard = h('<section class="card"><h2>Ausgleich</h2></section>');
  if (!data.settlements.length) setCard.appendChild(h('<p class="empty">Alles ausgeglichen. Keine Zahlungen offen.</p>'));
  else {
    setCard.appendChild(h('<p class="empty">Offene Zahlungen – tippe „bezahlt", sobald jemand überwiesen hat:</p>'));
    for (const s of data.settlements) {
      const row = h(`
        <div class="settle">
          <span class="who">${esc(name(s.from))}</span><span class="arrow">→</span>
          <span class="who">${esc(name(s.to))}</span>
          <span class="sum">${fmt(s.amount_cents)}</span>
          <button class="btn-small btn-pay">bezahlt</button>
        </div>
      `);
      row.querySelector('.btn-pay').addEventListener('click', async () => {
        renderTricount(await api('POST', `/api/tricounts/${data.id}/payments`,
          { from: s.from, to: s.to, amount: s.amount_cents / 100 }));
        toast('Als bezahlt markiert');
      });
      setCard.appendChild(row);
    }
  }
  app.appendChild(setCard);

  // Erfasste Zahlungen
  if (data.payments && data.payments.length) {
    const payCard = h('<section class="card"><h2>Bezahlt</h2></section>');
    for (const p of data.payments) {
      const row = h(`
        <div class="settle done">
          <span class="who">${esc(name(p.from_member))}</span><span class="arrow">→</span>
          <span class="who">${esc(name(p.to_member))}</span>
          <span class="sum">${fmt(p.amount_cents)}</span>
          <button class="btn-small btn-undo" title="Rückgängig">rückgängig</button>
        </div>
      `);
      row.querySelector('.btn-undo').addEventListener('click', async () => {
        renderTricount(await api('DELETE', `/api/tricounts/${data.id}/payments/${p.id}`));
        toast('Zahlung zurückgenommen');
      });
      payCard.appendChild(row);
    }
    app.appendChild(payCard);
  }
}

// ---- Admin-Seite ------------------------------------------------------------
async function viewAdmin() {
  if (ME.role !== 'admin') { toast('Nur für Administratoren'); location.hash = '/'; return; }
  app.innerHTML = '<p class="empty">Lade Verwaltung…</p>';
  let list;
  try { list = await api('GET', '/api/tricounts'); }
  catch (e) { app.innerHTML = `<p class="empty">${esc(e.message)}</p>`; return; }

  app.innerHTML = '';
  app.appendChild(h('<a class="back" href="#/">← Übersicht</a>'));
  app.appendChild(h('<h1 class="hero">Verwaltung</h1>'));
  app.appendChild(h('<p class="lead">Alle Abrechnungen umbenennen, öffnen oder löschen.</p>'));

  const card = h('<section class="card"><h2>Alle Abrechnungen</h2></section>');
  if (!list.length) card.appendChild(h('<p class="empty">Keine Abrechnungen vorhanden.</p>'));
  else for (const tc of list) {
    const row = h(`
      <div class="admin-row">
        <div class="tc-body">
          <div class="tc-title">${esc(tc.title)}</div>
          <div class="tc-meta">${tc.member_count} Personen · ${tc.expense_count} Ausgaben · ${fmtAmt(tc.total_cents, tc.currency)}</div>
        </div>
        <div class="admin-actions">
          <a class="btn-small btn-ghost" href="#/t/${esc(tc.id)}">Öffnen</a>
          <button class="btn-small btn-ghost btn-rename">Umbenennen</button>
          <button class="btn-small btn-del">Löschen</button>
        </div>
      </div>
    `);
    row.querySelector('.btn-rename').addEventListener('click', async () => {
      const title = prompt('Neuer Titel:', tc.title);
      if (!title || !title.trim()) return;
      await api('PATCH', `/api/admin/tricounts/${tc.id}`, { title: title.trim() });
      toast('Umbenannt'); viewAdmin();
    });
    row.querySelector('.btn-del').addEventListener('click', async () => {
      if (!confirm(`Abrechnung „${tc.title}" mit allen Ausgaben unwiderruflich löschen?`)) return;
      await api('DELETE', `/api/admin/tricounts/${tc.id}`);
      toast('Gelöscht'); viewAdmin();
    });
    card.appendChild(row);
  }
  app.appendChild(card);
}
