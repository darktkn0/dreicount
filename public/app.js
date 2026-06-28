'use strict';

const app = document.getElementById('app');

// ---- Helpers ----------------------------------------------------------------
const h = (html) => { const tpl = document.createElement('template'); tpl.innerHTML = html.trim(); return tpl.content.firstElementChild; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let CURRENCY = '€';
let activeTab = 0;

// ---- i18n -------------------------------------------------------------------
const i18n = {
  de: {
    loading_overview: 'Lade Übersicht…',
    loading_bill: 'Lade Abrechnung…',
    loading_admin: 'Lade Verwaltung…',
    err_not_auth: 'Nicht angemeldet.',
    err_generic: 'Es ist ein Fehler aufgetreten.',
    your_bills: 'Deine Abrechnungen',
    your_bills_lead: 'Wähle eine Abrechnung oder leg eine neue an.',
    all_bills: 'Alle Abrechnungen',
    no_bills: 'Noch keine Abrechnung vorhanden. Leg unten die erste an.',
    open_link: 'Öffnen →',
    new_bill: 'Neue Abrechnung',
    field_title: 'Titel',
    title_ph: 'z. B. Wochenende in Hamburg',
    field_currency: 'Währung',
    select_members: 'Teilnehmer auswählen',
    no_people_chip: 'Noch keine Personen – füge unten welche hinzu.',
    add_person_ph: 'Neue Person hinzufügen…',
    add_person_btn: '+ Person',
    create_bill_btn: 'Abrechnung erstellen',
    edit_expense_h: 'Ausgabe bearbeiten',
    add_expense_h: 'Ausgabe hinzufügen',
    what_for: 'Wofür?',
    what_for_ph: 'z. B. Einkauf, Restaurant, Tickets',
    field_amount: 'Betrag',
    amount_ph: '0,00',
    field_date: 'Datum',
    paid_by: 'Bezahlt von',
    split_among: 'Aufteilen auf',
    save_changes: 'Änderungen speichern',
    add_expense_btn: 'Ausgabe eintragen',
    cancel: 'Abbrechen',
    expense_updated: 'Ausgabe aktualisiert',
    expense_saved: 'Ausgabe gespeichert',
    back: '← Übersicht',
    copy_link: 'Link kopieren',
    link_copied: 'Link kopiert',
    copy_failed: 'Kopieren nicht möglich',
    stat_total: 'Gesamt',
    stat_my_share: 'Mein Anteil',
    i_am: 'Du bist',
    select_ph: 'wählen…',
    tab_expenses: 'Ausgaben',
    tab_settlement: 'Ausgleich',
    section_expenses: 'Ausgaben',
    no_expenses: 'Noch keine Ausgaben.',
    edit_tooltip: 'Bearbeiten',
    delete_tooltip: 'Löschen',
    expense_deleted: 'Ausgabe gelöscht',
    delete_expense_confirm: 'Diese Ausgabe löschen?',
    exp_meta: (payer, date, count) => `${payer} · ${date} · ${count} Personen`,
    section_balances: 'Salden',
    receives: 'bekommt',
    owes: 'schuldet',
    balanced: 'ausgeglichen',
    section_settlement: 'Ausgleich',
    bill_closed_info: (d) => `Diese Abrechnung ist abgeschlossen (${d}). Änderungen sind gesperrt.`,
    reopen: 'Wieder öffnen',
    reopened: 'Wieder geöffnet',
    all_settled: 'Alles ausgeglichen. Keine Zahlungen offen.',
    close_bill: 'Abrechnung abschließen',
    close_confirm: 'Abrechnung abschließen? Danach sind keine Änderungen mehr möglich, bis sie wieder geöffnet wird.',
    bill_closed_toast: 'Abrechnung geschlossen',
    open_payments_info: 'Offene Zahlungen – Betrag anpassen für Teilzahlungen und „bezahlt" tippen:',
    paid_btn: 'bezahlt',
    payment_recorded: 'Zahlung erfasst',
    section_paid: 'Bezahlt',
    undo_btn: 'rückgängig',
    undo_tooltip: 'Rückgängig',
    payment_undone: 'Zahlung zurückgenommen',
    not_found: 'Nicht gefunden',
    to_overview: 'Zur Übersicht',
    admin_only: 'Nur für Administratoren',
    section_admin: 'Verwaltung',
    admin_lead: 'Abrechnungen und Personen verwalten.',
    section_people: 'Personen',
    no_people_saved: 'Noch keine Personen gespeichert.',
    delete_btn: 'Löschen',
    delete_person_confirm: (name) => `Person „${name}" aus dem Pool entfernen? Bestehende Abrechnungen bleiben unverändert.`,
    person_deleted: 'Person gelöscht',
    no_bills_admin: 'Keine Abrechnungen vorhanden.',
    open_btn: 'Öffnen',
    rename_btn: 'Umbenennen',
    rename_prompt_label: 'Neuer Titel:',
    renamed: 'Umbenannt',
    delete_bill_confirm: (title) => `Abrechnung „${title}" mit allen Ausgaben unwiderruflich löschen?`,
    deleted: 'Gelöscht',
    badge_closed: 'geschlossen',
    tc_meta: (members, expenses) => `${members} Personen · ${expenses} Ausgaben`,
    brand_tag: 'Ausgaben fair teilen',
    logout: 'Abmelden',
    footer: 'Selbst gehostet · keine Konten, kein Tracking',
    paypal_section: 'PayPal-Adressen',
    paypal_email_ph: 'PayPal-E-Mail',
    paypal_saved: 'Gespeichert',
    tab_paypal: 'PayPal',
    copy_email: 'Kopieren',
    email_copied: 'E-Mail kopiert',
    force_close_btn: 'Als Admin schließen',
    force_close_confirm: 'Abrechnung schließen, obwohl noch Zahlungen offen sind?',
  },
  en: {
    loading_overview: 'Loading overview…',
    loading_bill: 'Loading bill…',
    loading_admin: 'Loading admin…',
    err_not_auth: 'Not authenticated.',
    err_generic: 'An error occurred.',
    your_bills: 'Your Bills',
    your_bills_lead: 'Select a bill or create a new one.',
    all_bills: 'All Bills',
    no_bills: 'No bills yet. Create your first one below.',
    open_link: 'Open →',
    new_bill: 'New Bill',
    field_title: 'Title',
    title_ph: 'e.g. Weekend trip',
    field_currency: 'Currency',
    select_members: 'Select participants',
    no_people_chip: 'No people yet – add some below.',
    add_person_ph: 'Add new person…',
    add_person_btn: '+ Person',
    create_bill_btn: 'Create bill',
    edit_expense_h: 'Edit expense',
    add_expense_h: 'Add expense',
    what_for: 'What for?',
    what_for_ph: 'e.g. Groceries, Restaurant, Tickets',
    field_amount: 'Amount',
    amount_ph: '0.00',
    field_date: 'Date',
    paid_by: 'Paid by',
    split_among: 'Split among',
    save_changes: 'Save changes',
    add_expense_btn: 'Add expense',
    cancel: 'Cancel',
    expense_updated: 'Expense updated',
    expense_saved: 'Expense saved',
    back: '← Overview',
    copy_link: 'Copy link',
    link_copied: 'Link copied',
    copy_failed: 'Could not copy',
    stat_total: 'Total',
    stat_my_share: 'My share',
    i_am: 'I am',
    select_ph: 'select…',
    tab_expenses: 'Expenses',
    tab_settlement: 'Settlement',
    section_expenses: 'Expenses',
    no_expenses: 'No expenses yet.',
    edit_tooltip: 'Edit',
    delete_tooltip: 'Delete',
    expense_deleted: 'Expense deleted',
    delete_expense_confirm: 'Delete this expense?',
    exp_meta: (payer, date, count) => `${payer} · ${date} · ${count} people`,
    section_balances: 'Balances',
    receives: 'receives',
    owes: 'owes',
    balanced: 'settled',
    section_settlement: 'Settlement',
    bill_closed_info: (d) => `This bill is closed (${d}). Changes are locked.`,
    reopen: 'Reopen',
    reopened: 'Reopened',
    all_settled: 'All settled. No payments due.',
    close_bill: 'Close bill',
    close_confirm: 'Close bill? No further changes will be possible until it is reopened.',
    bill_closed_toast: 'Bill closed',
    open_payments_info: 'Open payments – adjust amount for partial payments and tap "paid":',
    paid_btn: 'paid',
    payment_recorded: 'Payment recorded',
    section_paid: 'Paid',
    undo_btn: 'undo',
    undo_tooltip: 'Undo',
    payment_undone: 'Payment undone',
    not_found: 'Not found',
    to_overview: 'Back to overview',
    admin_only: 'Admins only',
    section_admin: 'Admin',
    admin_lead: 'Manage bills and people.',
    section_people: 'People',
    no_people_saved: 'No people saved yet.',
    delete_btn: 'Delete',
    delete_person_confirm: (name) => `Remove person "${name}" from the pool? Existing bills remain unchanged.`,
    person_deleted: 'Person deleted',
    no_bills_admin: 'No bills found.',
    open_btn: 'Open',
    rename_btn: 'Rename',
    rename_prompt_label: 'New title:',
    renamed: 'Renamed',
    delete_bill_confirm: (title) => `Permanently delete bill "${title}" with all expenses?`,
    deleted: 'Deleted',
    badge_closed: 'closed',
    tc_meta: (members, expenses) => `${members} people · ${expenses} expenses`,
    brand_tag: 'Split expenses fairly',
    logout: 'Log out',
    footer: 'Self-hosted · no accounts, no tracking',
    paypal_section: 'PayPal Addresses',
    paypal_email_ph: 'PayPal email',
    paypal_saved: 'Saved',
    tab_paypal: 'PayPal',
    copy_email: 'Copy',
    email_copied: 'Email copied',
    force_close_btn: 'Close as admin',
    force_close_confirm: 'Close bill even though payments are still open?',
  },
};

const lang = navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en';
const t = (key, ...args) => {
  const val = i18n[lang][key];
  return typeof val === 'function' ? val(...args) : (val ?? key);
};
const numLocale = lang === 'de' ? 'de-DE' : 'en-US';
const decSep = lang === 'de' ? ',' : '.';

const fmtAmt = (cents, cur = CURRENCY) =>
  (cents / 100).toLocaleString(numLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + cur;
const fmt = (cents) => fmtAmt(cents, CURRENCY);
const fmtInput = (cents) => (cents / 100).toFixed(2).replace('.', decSep);

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { location.href = '/login'; throw new Error(t('err_not_auth')); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || t('err_generic'));
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
  const m = hash.match(/^\/t\/(.+)$/);
  if (m) return viewTricount(m[1]);
  if (hash === '/admin') return viewAdmin();
  return viewDashboard();
}
window.addEventListener('hashchange', router);
window.addEventListener('load', async () => {
  document.title = 'Dreicount · ' + t('brand_tag');
  const brandTagEl = document.querySelector('.brand-tag');
  if (brandTagEl) brandTagEl.textContent = t('brand_tag');
  const logoutEl = document.querySelector('.logout');
  if (logoutEl) logoutEl.textContent = t('logout');
  const footerEl = document.querySelector('.footer span');
  if (footerEl) footerEl.textContent = t('footer');

  try { ME = await api('GET', '/api/me'); } catch {}
  updateChrome();
  router();
});

// ---- Dashboard --------------------------------------------------------------
async function viewDashboard() {
  app.innerHTML = `<p class="empty">${t('loading_overview')}</p>`;
  let list, users;
  try { [list, users] = await Promise.all([api('GET', '/api/tricounts'), api('GET', '/api/users')]); }
  catch (e) { app.innerHTML = `<p class="empty">${esc(e.message)}</p>`; return; }

  app.innerHTML = '';
  app.appendChild(h(`
    <section>
      <h1 class="hero">${t('your_bills')}</h1>
      <p class="lead">${t('your_bills_lead')}</p>
    </section>
  `));

  const listCard = h(`<section class="card"><h2>${t('all_bills')}</h2></section>`);
  if (!list.length) {
    listCard.appendChild(h(`<p class="empty">${t('no_bills')}</p>`));
  } else {
    for (const tc of list) {
      const row = h(`
        <a class="tc-row${tc.closed_at ? ' closed' : ''}" href="#/t/${esc(tc.id)}">
          <div class="tc-body">
            <div class="tc-title">${esc(tc.title)}${tc.closed_at ? ` <span class="badge-closed">${t('badge_closed')}</span>` : ''}</div>
            <div class="tc-meta">${t('tc_meta', tc.member_count, tc.expense_count)}</div>
          </div>
          <div class="tc-sum">${fmtAmt(tc.total_cents, tc.currency)}</div>
          <span class="tc-go">${t('open_link')}</span>
        </a>
      `);
      listCard.appendChild(row);
    }
  }
  app.appendChild(listCard);

  const card = h(`
    <section class="card">
      <h2>${t('new_bill')}</h2>
      <div class="row">
        <div class="field" style="flex:1">
          <label for="title">${t('field_title')}</label>
          <input id="title" placeholder="${t('title_ph')}" maxlength="120" />
        </div>
        <div class="field" style="flex:0 0 90px">
          <label for="currency">${t('field_currency')}</label>
          <input id="currency" value="€" maxlength="4" />
        </div>
      </div>
      <div class="field">
        <label>${t('select_members')}</label>
        <div class="checks" id="people"></div>
        <div class="add-person">
          <input id="newperson" placeholder="${t('add_person_ph')}" maxlength="60" />
          <button class="btn-small btn-ghost" id="addperson" type="button">${t('add_person_btn')}</button>
        </div>
      </div>
      <button class="btn-primary" id="create">${t('create_bill_btn')}</button>
      <div class="error" id="err"></div>
    </section>
  `);

  const people = card.querySelector('#people');
  const renderEmpty = () => {
    if (!people.querySelector('.chip')) {
      people.innerHTML = `<span class="empty" style="padding:0">${t('no_people_chip')}</span>`;
    }
  };
  const addChip = (user, selected) => {
    let cb = people.querySelector(`.chip input[value="${CSS.escape(user.id)}"]`);
    if (cb) { cb.checked = selected; cb.closest('.chip').classList.toggle('on', selected); return; }
    const empty = people.querySelector('.empty'); if (empty) empty.remove();
    const chip = h(`<label class="chip${selected ? ' on' : ''}"><input type="checkbox" value="${esc(user.id)}"${selected ? ' checked' : ''} /> ${esc(user.name)}</label>`);
    chip.querySelector('input').addEventListener('change', (e) => chip.classList.toggle('on', e.target.checked));
    people.appendChild(chip);
  };
  for (const u of users) addChip(u, false);
  renderEmpty();

  const newInput = card.querySelector('#newperson');
  const addPerson = async () => {
    const name = newInput.value.trim();
    if (!name) return;
    const err = card.querySelector('#err'); err.textContent = '';
    try {
      const user = await api('POST', '/api/users', { name });
      addChip(user, true);
      newInput.value = ''; newInput.focus();
    } catch (e) { err.textContent = e.message; }
  };
  card.querySelector('#addperson').addEventListener('click', addPerson);
  newInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addPerson(); } });

  card.querySelector('#create').addEventListener('click', async () => {
    const title = card.querySelector('#title').value.trim();
    const currency = card.querySelector('#currency').value.trim() || '€';
    const user_ids = [...people.querySelectorAll('.chip input:checked')].map((c) => c.value);
    const err = card.querySelector('#err'); err.textContent = '';
    try {
      const { id } = await api('POST', '/api/tricounts', { title, currency, user_ids });
      location.hash = '/t/' + id;
    } catch (e) { err.textContent = e.message; }
  });
  app.appendChild(card);
}

// ---- Abrechnungs-Ansicht ----------------------------------------------------
async function viewTricount(id) {
  app.innerHTML = `<p class="empty">${t('loading_bill')}</p>`;
  let data;
  try { data = await api('GET', '/api/tricounts/' + encodeURIComponent(id)); }
  catch (e) { app.innerHTML = `<section class="card"><h2>${t('not_found')}</h2><p class="empty">${esc(e.message)}</p><a class="btn-ghost" href="#/">${t('to_overview')}</a></section>`; return; }
  renderTricount(data);
}

function expenseFormCard(data, expense) {
  const editing = !!expense;
  const inShares = (mid) => editing ? expense.shares.some((s) => s.member_id === mid) : true;
  const card = h(`
    <section class="card">
      <h2>${editing ? t('edit_expense_h') : t('add_expense_h')}</h2>
      <div class="field"><label for="desc">${t('what_for')}</label>
        <input id="desc" placeholder="${t('what_for_ph')}" maxlength="120" /></div>
      <div class="row">
        <div class="field"><label for="amount">${t('field_amount')}</label>
          <input id="amount" class="amount-input" inputmode="decimal" placeholder="${t('amount_ph')}" /></div>
        <div class="field"><label for="date">${t('field_date')}</label><input id="date" type="date" /></div>
      </div>
      <div class="field"><label for="payer">${t('paid_by')}</label>
        <select id="payer">${data.members.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></div>
      <div class="field"><label>${t('split_among')}</label>
        <div class="checks" id="among">
          ${data.members.map((m) => `<label class="chip${inShares(m.id) ? ' on' : ''}"><input type="checkbox" value="${m.id}"${inShares(m.id) ? ' checked' : ''} /> ${esc(m.name)}</label>`).join('')}
        </div></div>
      <div class="form-actions">
        <button class="btn-primary" id="save">${editing ? t('save_changes') : t('add_expense_btn')}</button>
        ${editing ? `<button class="btn-ghost" id="cancel">${t('cancel')}</button>` : ''}
      </div>
      <div class="error" id="aerr"></div>
    </section>
  `);
  card.querySelector('#desc').value = editing ? expense.description : '';
  card.querySelector('#amount').value = editing ? fmtInput(expense.amount_cents) : '';
  card.querySelector('#date').value = editing ? expense.spent_on : new Date().toISOString().slice(0, 10);
  if (editing) card.querySelector('#payer').value = expense.paid_by;
  card.querySelectorAll('.chip input').forEach((cb) =>
    cb.addEventListener('change', () => cb.closest('.chip').classList.toggle('on', cb.checked)));
  card.querySelector('#save').addEventListener('click', async () => {
    const desc = card.querySelector('#desc').value.trim();
    const amount = card.querySelector('#amount').value.replace(',', '.');
    const paid_by = card.querySelector('#payer').value;
    const spent_on = card.querySelector('#date').value;
    const split_among = [...card.querySelectorAll('.chip input:checked')].map((c) => c.value);
    const err = card.querySelector('#aerr'); err.textContent = '';
    const body = { description: desc, amount, paid_by, spent_on, split_among };
    try {
      const updated = editing
        ? await api('PUT', `/api/tricounts/${data.id}/expenses/${expense.id}`, body)
        : await api('POST', `/api/tricounts/${data.id}/expenses`, body);
      renderTricount(updated);
      toast(editing ? t('expense_updated') : t('expense_saved'));
    } catch (e) { err.textContent = e.message; }
  });
  if (editing) card.querySelector('#cancel').addEventListener('click', () => renderTricount(data));
  return card;
}

function renderTricount(data, editingId = null) {
  CURRENCY = data.currency || '€';
  const closed = !!data.closed_at;
  const name = (mid) => { const m = data.members.find((x) => x.id === mid); return m ? m.name : '?'; };
  app.innerHTML = '';

  app.appendChild(h(`<a class="back" href="#/">${t('back')}</a>`));
  app.appendChild(h(`<h1 class="hero">${esc(data.title)}${closed ? ` <span class="badge-closed">${t('badge_closed')}</span>` : ''}</h1>`));

  const shareUrl = location.origin + '/#/t/' + data.id;
  const share = h(`
    <div class="share">
      <code>${esc(shareUrl)}</code>
      <button class="btn-small btn-primary" id="copy" style="width:auto">${t('copy_link')}</button>
    </div>
  `);
  share.querySelector('#copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(shareUrl); toast(t('link_copied')); }
    catch { toast(t('copy_failed')); }
  });
  app.appendChild(share);

  // Statistik-Leiste
  const totalCents = data.expenses.reduce((s, e) => s + e.amount_cents, 0);
  const savedMe = localStorage.getItem('me_' + data.id) || '';
  const myShare = (mid) => data.expenses.reduce((sum, e) => {
    const s = e.shares.find((sh) => sh.member_id === mid);
    return s ? sum + s.share_cents : sum;
  }, 0);

  const statsEl = h(`
    <div class="card stats-bar">
      <div class="stats-row">
        <div class="stats-chunk">
          <div class="stats-lbl">${t('stat_total')}</div>
          <div class="stats-val">${fmt(totalCents)}</div>
        </div>
        <div class="stats-chunk" id="my-chunk"${savedMe ? '' : ' hidden'}>
          <div class="stats-lbl">${t('stat_my_share')}</div>
          <div class="stats-val" id="my-val">${savedMe ? fmt(myShare(savedMe)) : ''}</div>
        </div>
        <div class="stats-who">
          <div class="stats-lbl">${t('i_am')}</div>
          <select class="who-select" id="who-am-i">
            <option value="">${t('select_ph')}</option>
            ${data.members.map((m) => `<option value="${esc(m.id)}"${m.id === savedMe ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
  `);
  statsEl.querySelector('#who-am-i').addEventListener('change', (e) => {
    const mid = e.target.value;
    if (mid) {
      localStorage.setItem('me_' + data.id, mid);
      statsEl.querySelector('#my-val').textContent = fmt(myShare(mid));
      statsEl.querySelector('#my-chunk').hidden = false;
    } else {
      localStorage.removeItem('me_' + data.id);
      statsEl.querySelector('#my-chunk').hidden = true;
    }
  });
  app.appendChild(statsEl);

  // Tab-Leiste
  const tabBar = h(`
    <div class="tab-bar">
      <button class="tab-btn${activeTab === 0 ? ' active' : ''}" data-tab="0">${t('tab_expenses')}</button>
      <button class="tab-btn${activeTab === 1 ? ' active' : ''}" data-tab="1">${t('tab_settlement')}</button>
      <button class="tab-btn${activeTab === 2 ? ' active' : ''}" data-tab="2">${t('tab_paypal')}</button>
    </div>
  `);
  const tab1 = h('<div class="tab-pane"></div>');
  const tab2 = h('<div class="tab-pane"></div>');
  const tab3 = h('<div class="tab-pane"></div>');
  tab1.hidden = activeTab !== 0;
  tab2.hidden = activeTab !== 1;
  tab3.hidden = activeTab !== 2;
  tabBar.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = parseInt(btn.dataset.tab);
      tabBar.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      tab1.hidden = activeTab !== 0;
      tab2.hidden = activeTab !== 1;
      tab3.hidden = activeTab !== 2;
    });
  });
  app.appendChild(tabBar);
  app.appendChild(tab1);
  app.appendChild(tab2);
  app.appendChild(tab3);

  // PayPal-Tab
  const paypalCard = h(`<section class="card"><h2>${t('paypal_section')}</h2></section>`);
  for (const m of data.members) {
    const row = h(`
      <div class="paypal-row">
        <span class="paypal-name">${esc(m.name)}</span>
        <input type="email" inputmode="email" placeholder="${t('paypal_email_ph')}" value="${esc(m.paypal_email || '')}" />
        <button class="btn-small btn-ghost paypal-copy"${m.paypal_email ? '' : ' disabled'}>${t('copy_email')}</button>
      </div>
    `);
    const input = row.querySelector('input');
    const copyBtn = row.querySelector('.paypal-copy');
    input.addEventListener('input', () => { copyBtn.disabled = !input.value.trim(); });
    copyBtn.addEventListener('click', async () => {
      const email = input.value.trim();
      if (!email) return;
      try { await navigator.clipboard.writeText(email); toast(t('email_copied')); }
      catch { toast(t('copy_failed')); }
    });
    let savedVal = m.paypal_email || '';
    input.addEventListener('blur', async () => {
      const val = input.value.trim();
      if (val === savedVal) return;
      try {
        await api('PATCH', `/api/tricounts/${data.id}/members/${m.id}`, { paypal_email: val });
        m.paypal_email = val || null;
        savedVal = val;
        copyBtn.disabled = !val;
        toast(t('paypal_saved'));
        renderTricount(data);
      } catch (e) {
        toast(e.message);
        input.value = savedVal;
      }
    });
    paypalCard.appendChild(row);
  }
  tab3.appendChild(paypalCard);

  if (!closed) {
    const editing = editingId ? data.expenses.find((e) => e.id === editingId) : null;
    tab1.appendChild(expenseFormCard(data, editing || null));
  }

  // Ausgabenliste
  const expCard = h(`<section class="card"><h2>${t('section_expenses')}</h2></section>`);
  if (!data.expenses.length) expCard.appendChild(h(`<p class="empty">${t('no_expenses')}</p>`));
  else for (const e of data.expenses) {
    const isEditing = e.id === editingId;
    const row = h(`
      <div class="exp${isEditing ? ' editing' : ''}">
        <div class="exp-body">
          <div class="exp-desc">${esc(e.description)}</div>
          <div class="exp-meta">${t('exp_meta', esc(name(e.paid_by)), esc(e.spent_on), e.shares.length)}</div>
        </div>
        <div class="exp-amt">${fmt(e.amount_cents)}</div>
        ${closed ? '' : `<button class="exp-edit" title="${t('edit_tooltip')}">✎</button><button class="exp-del" title="${t('delete_tooltip')}">×</button>`}
      </div>
    `);
    if (!closed) {
      row.querySelector('.exp-edit').addEventListener('click', () => {
        renderTricount(data, isEditing ? null : e.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      row.querySelector('.exp-del').addEventListener('click', async () => {
        if (!confirm(t('delete_expense_confirm'))) return;
        renderTricount(await api('DELETE', `/api/tricounts/${data.id}/expenses/${e.id}`));
        toast(t('expense_deleted'));
      });
    }
    expCard.appendChild(row);
  }
  tab1.appendChild(expCard);

  // Salden
  const maxAbs = Math.max(1, ...data.members.map((m) => Math.abs(data.balances[m.id] || 0)));
  const balCard = h(`<section class="card"><h2>${t('section_balances')}</h2></section>`);
  for (const m of data.members) {
    const b = data.balances[m.id] || 0;
    const cls = b > 0 ? 'pos' : b < 0 ? 'neg' : '';
    const label = b > 0 ? t('receives') : b < 0 ? t('owes') : t('balanced');
    balCard.appendChild(h(`
      <div class="bal">
        <div class="bal-head"><span class="bal-name">${esc(m.name)}</span>
          <span class="bal-amt ${cls}">${b === 0 ? '—' : (b > 0 ? '+' : '−') + fmt(Math.abs(b))}</span></div>
        <div class="bar"><span class="${cls}" style="width:${(Math.abs(b) / maxAbs) * 50}%"></span></div>
        <div class="exp-meta">${label}</div>
      </div>
    `));
  }
  tab2.appendChild(balCard);

  // Ausgleich
  const setCard = h(`<section class="card"><h2>${t('section_settlement')}</h2></section>`);
  if (closed) {
    setCard.appendChild(h(`<p class="empty">${t('bill_closed_info', esc(data.closed_at))}</p>`));
    const reopen = h(`<button class="btn-ghost" id="reopen" style="padding:10px 14px">${t('reopen')}</button>`);
    reopen.addEventListener('click', async () => {
      try { renderTricount(await api('POST', `/api/tricounts/${data.id}/reopen`)); toast(t('reopened')); }
      catch (e) { toast(e.message); }
    });
    setCard.appendChild(reopen);
  } else if (!data.settlements.length) {
    setCard.appendChild(h(`<p class="empty">${t('all_settled')}</p>`));
    if (data.expenses.length) {
      const closeBtn = h(`<button class="btn-primary" id="closebtn">${t('close_bill')}</button>`);
      closeBtn.addEventListener('click', async () => {
        if (!confirm(t('close_confirm'))) return;
        try { renderTricount(await api('POST', `/api/tricounts/${data.id}/close`)); toast(t('bill_closed_toast')); }
        catch (e) { toast(e.message); }
      });
      setCard.appendChild(closeBtn);
    }
  } else {
    setCard.appendChild(h(`<p class="settle-info">${t('open_payments_info')}</p>`));
    for (const s of data.settlements) {
      const toMem = data.members.find((m) => m.id === s.to);
      const paypalEmail = toMem?.paypal_email;
      const row = h(`
        <div class="settle">
          <span class="who">${esc(name(s.from))}</span><span class="arrow">→</span>
          <span class="who">${esc(name(s.to))}</span>
          ${paypalEmail ? `<button class="btn-small btn-ghost paypal-copy">${t('copy_email')}</button>` : ''}
          <span class="sum">${fmt(s.amount_cents)}</span>
          <input class="pay-amt amount-input" inputmode="decimal" aria-label="${t('field_amount')}" value="${fmtInput(s.amount_cents)}" />
          <button class="btn-small btn-pay">${t('paid_btn')}</button>
        </div>
      `);
      if (paypalEmail) {
        row.querySelector('.paypal-copy').addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(paypalEmail); toast(t('email_copied')); }
          catch { toast(t('copy_failed')); }
        });
      }
      row.querySelector('.btn-pay').addEventListener('click', async () => {
        const amount = row.querySelector('.pay-amt').value.replace(',', '.');
        try {
          renderTricount(await api('POST', `/api/tricounts/${data.id}/payments`,
            { from: s.from, to: s.to, amount }));
          toast(t('payment_recorded'));
        } catch (e) { toast(e.message); }
      });
      setCard.appendChild(row);
    }
    if (ME.role === 'admin') {
      const forceBtn = h(`<button class="btn-ghost" style="margin-top:8px;color:var(--muted);font-size:.82rem">${t('force_close_btn')}</button>`);
      forceBtn.addEventListener('click', async () => {
        if (!confirm(t('force_close_confirm'))) return;
        try { renderTricount(await api('POST', `/api/tricounts/${data.id}/close`)); toast(t('bill_closed_toast')); }
        catch (e) { toast(e.message); }
      });
      setCard.appendChild(forceBtn);
    }
  }
  tab2.appendChild(setCard);

  // Erfasste Zahlungen
  if (data.payments && data.payments.length) {
    const payCard = h(`<section class="card"><h2>${t('section_paid')}</h2></section>`);
    for (const p of data.payments) {
      const row = h(`
        <div class="settle done">
          <span class="who">${esc(name(p.from_member))}</span><span class="arrow">→</span>
          <span class="who">${esc(name(p.to_member))}</span>
          <span class="sum">${fmt(p.amount_cents)}</span>
          ${closed ? '' : `<button class="btn-small btn-undo" title="${t('undo_tooltip')}">${t('undo_btn')}</button>`}
        </div>
      `);
      if (!closed) row.querySelector('.btn-undo').addEventListener('click', async () => {
        renderTricount(await api('DELETE', `/api/tricounts/${data.id}/payments/${p.id}`));
        toast(t('payment_undone'));
      });
      payCard.appendChild(row);
    }
    tab2.appendChild(payCard);
  }
}

// ---- Admin-Seite ------------------------------------------------------------
async function viewAdmin() {
  if (ME.role !== 'admin') { toast(t('admin_only')); location.hash = '/'; return; }
  app.innerHTML = `<p class="empty">${t('loading_admin')}</p>`;
  let list, users;
  try { [list, users] = await Promise.all([api('GET', '/api/tricounts'), api('GET', '/api/users')]); }
  catch (e) { app.innerHTML = `<p class="empty">${esc(e.message)}</p>`; return; }

  app.innerHTML = '';
  app.appendChild(h(`<a class="back" href="#/">${t('back')}</a>`));
  app.appendChild(h(`<h1 class="hero">${t('section_admin')}</h1>`));
  app.appendChild(h(`<p class="lead">${t('admin_lead')}</p>`));

  const pCard = h(`<section class="card"><h2>${t('section_people')}</h2></section>`);
  if (!users.length) pCard.appendChild(h(`<p class="empty">${t('no_people_saved')}</p>`));
  else for (const u of users) {
    const row = h(`
      <div class="admin-row">
        <div class="tc-body"><div class="tc-title">${esc(u.name)}</div></div>
        <div class="admin-actions">
          <button class="btn-small btn-del btn-del-user">${t('delete_btn')}</button>
        </div>
      </div>
    `);
    row.querySelector('.btn-del-user').addEventListener('click', async () => {
      if (!confirm(t('delete_person_confirm', u.name))) return;
      await api('DELETE', `/api/users/${u.id}`);
      toast(t('person_deleted')); viewAdmin();
    });
    pCard.appendChild(row);
  }
  app.appendChild(pCard);

  const card = h(`<section class="card"><h2>${t('all_bills')}</h2></section>`);
  if (!list.length) card.appendChild(h(`<p class="empty">${t('no_bills_admin')}</p>`));
  else for (const tc of list) {
    const row = h(`
      <div class="admin-row">
        <div class="tc-body">
          <div class="tc-title">${esc(tc.title)}</div>
          <div class="tc-meta">${t('tc_meta', tc.member_count, tc.expense_count)} · ${fmtAmt(tc.total_cents, tc.currency)}</div>
        </div>
        <div class="admin-actions">
          <a class="btn-small btn-ghost" href="#/t/${esc(tc.id)}">${t('open_btn')}</a>
          <button class="btn-small btn-ghost btn-rename">${t('rename_btn')}</button>
          <button class="btn-small btn-del">${t('delete_btn')}</button>
        </div>
      </div>
    `);
    row.querySelector('.btn-rename').addEventListener('click', async () => {
      const title = prompt(t('rename_prompt_label'), tc.title);
      if (!title || !title.trim()) return;
      await api('PATCH', `/api/admin/tricounts/${tc.id}`, { title: title.trim() });
      toast(t('renamed')); viewAdmin();
    });
    row.querySelector('.btn-del').addEventListener('click', async () => {
      if (!confirm(t('delete_bill_confirm', tc.title))) return;
      await api('DELETE', `/api/admin/tricounts/${tc.id}`);
      toast(t('deleted')); viewAdmin();
    });
    card.appendChild(row);
  }
  app.appendChild(card);
}
