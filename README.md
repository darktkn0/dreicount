# Dreicount – selbst gehostete Tricount-Alternative

Eine schlanke Web-App zum Aufteilen von Gruppenausgaben: Abrechnung anlegen,
Ausgaben eintragen, sofort sehen, wer wem wie viel schuldet – und den Ausgleich
mit möglichst wenigen Überweisungen. Kein Konto, kein Tracking, eine einzige
SQLite-Datei als Datenbank.

- **Backend:** Node.js + Express + SQLite (`better-sqlite3`)
- **Frontend:** eine statische Seite (Vanilla JS), mobil-optimiert
- **Sicherheit:** Passwort-Login (Session-Cookie, brute-force-begrenzt),
  Helmet (Security-Header + CSP), Rate-Limiting, Beträge in Cent
  (keine Rundungsfehler), unrat­bare 128-Bit-Links
- **Anmeldung:** Über `AUTH_PASSWORD` aktiv. Wer kein Passwort kennt, sieht nur
  die Login-Seite. Innerhalb der App gilt zusätzlich: der **Link einer
  Abrechnung** ist der Schlüssel zu genau dieser Abrechnung – nur mit den
  Beteiligten teilen.


## Konfiguration (Umgebungsvariablen)

| Variable | Zweck |
|---|---|
| `AUTH_PASSWORD` | Zugangspasswort (Rolle „user"). Gesetzt = Login aktiv; leer = App offen (mit Warnung). |
| `ADMIN_PASSWORD` | Optionales Admin-Passwort (Rolle „admin"): Zugang zur Admin-Seite zum Verwalten/Löschen. |
| `SESSION_SECRET` | Signiert die Login-Cookies (`openssl rand -hex 32`). Ohne = bei Neustart neu. Session gilt 30 Tage. |
| `PORT` / `HOST` | Standard `3000` / `127.0.0.1` (im Container `0.0.0.0`). |
| `DB_PATH` | Pfad der SQLite-Datei. |

---

## Schnellstart lokal (zum Ausprobieren)

```bash
npm install
npm start
# -> http://127.0.0.1:3000
```

---

## Deployment auf einem IONOS-VPS (Ubuntu 22.04/24.04)

Annahme: frischer Ubuntu-VPS, du hast eine Domain (oder Subdomain) bei IONOS,
z. B. `dreicount.deine-domain.de`. Befehle als `root` oder mit `sudo`.

### 0. IONOS-Firewall & DNS vorab

Zwei Dinge passieren bei IONOS **außerhalb** des Servers:

1. **Firewall im IONOS Cloud Panel:** VPS auswählen → *Netzwerk → Firewall-Richtlinie*.
   Eingehend erlauben: **TCP 22 (SSH), 80 (HTTP), 443 (HTTPS)**. Alles andere
   bleibt zu. (Diese Cloud-Panel-Firewall sitzt *vor* dem Server – ohne sie
   kommt trotz UFW nichts durch.)
2. **DNS:** Domains-Bereich → deine Domain → *DNS*. Lege einen **A-Record** an,
   der `dreicount` (oder `@`) auf die IPv4 deines VPS zeigt. Falls IPv6 vorhanden:
   zusätzlich einen **AAAA-Record**. Bis zu ~1 Stunde Wartezeit einplanen.

Prüfen: `ping dreicount.deine-domain.de` sollte die VPS-IP zeigen.

### 1. System aktualisieren & Grundpakete

```bash
apt update && apt upgrade -y
apt install -y nginx git ufw sqlite3 unattended-upgrades fail2ban
```

Automatische Sicherheitsupdates aktivieren:

```bash
dpkg-reconfigure -plow unattended-upgrades   # "Yes" wählen
```

### 2. Server-Firewall (UFW)

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 'Nginx Full'      # öffnet 80 + 443
ufw enable
ufw status
```

### 3. SSH absichern (dringend empfohlen)

Wenn du einen SSH-Schlüssel hinterlegt hast, deaktiviere Passwort-Logins.
In `/etc/ssh/sshd_config` setzen:

```
PermitRootLogin prohibit-password
PasswordAuthentication no
```

Dann: `systemctl restart ssh`
(Vorher sicherstellen, dass dein Schlüssel funktioniert – sonst sperrst du dich aus.)

### 4. Node.js 20 LTS installieren

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v   # sollte v20.x zeigen
```

> Node 20 LTS, weil `better-sqlite3` dafür fertige Binärpakete liefert –
> es ist **kein** Compiler nötig.

### 5. Eigenen Benutzer & App-Verzeichnis anlegen

```bash
adduser --system --group --home /opt/dreicount dreicount
```

Lade den Projektordner `dreicount/` nach `/opt/dreicount` hoch
(z. B. per `scp -r dreicount/* root@DEINE-IP:/opt/dreicount/` oder per git).
Danach:

```bash
cd /opt/dreicount
npm install --omit=dev
mkdir -p data backups
chown -R dreicount:dreicount /opt/dreicount
```

Kurzer Funktionstest (Strg+C zum Beenden):

```bash
sudo -u dreicount HOST=127.0.0.1 PORT=3000 node server.js
```

### 6. Als Dienst einrichten (systemd)

```bash
cp /opt/dreicount/deploy/dreicount.service /etc/systemd/system/dreicount.service
systemctl daemon-reload
systemctl enable --now dreicount
systemctl status dreicount    # sollte "active (running)" zeigen
```

Die App lauscht jetzt nur auf `127.0.0.1:3000` – von außen nicht direkt
erreichbar. Das macht gleich nginx.

### 7. nginx als Reverse-Proxy

```bash
cp /opt/dreicount/deploy/nginx-dreicount.conf /etc/nginx/sites-available/dreicount
# Domain in der Datei anpassen:
nano /etc/nginx/sites-available/dreicount    # server_name -> deine Domain
ln -s /etc/nginx/sites-available/dreicount /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

Aufruf von `http://dreicount.deine-domain.de` sollte die App zeigen.

### 8. HTTPS mit Let's Encrypt

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d dreicount.deine-domain.de
```

certbot richtet das Zertifikat ein, ergänzt den 443-Block und leitet HTTP→HTTPS um.
Die Verlängerung läuft automatisch; testen mit `certbot renew --dry-run`.

**Fertig** – erreichbar unter `https://dreicount.deine-domain.de`.

---

## Backups

`sqlite3` ist installiert. Backup-Skript scharf schalten:

```bash
chmod +x /opt/dreicount/deploy/backup.sh
crontab -e
```

Zeile einfügen (täglich 3:30 Uhr):

```
30 3 * * * /opt/dreicount/deploy/backup.sh >> /opt/dreicount/backups/backup.log 2>&1
```

Snapshots landen in `/opt/dreicount/backups/`; die letzten 14 werden behalten.
Wiederherstellen: Dienst stoppen, `.db.gz` entpacken, nach
`/opt/dreicount/data/dreicount.db` kopieren, Dienst starten.

> Lade die Backups regelmäßig auch außerhalb des VPS herunter
> (`scp`), damit ein Serverausfall keine Daten kostet.

---

## Optional: zusätzliche Zugangssperre (Basic-Auth)

Wenn die ganze Seite hinter einem Passwort liegen soll:

```bash
apt install -y apache2-utils
htpasswd -c /etc/nginx/.htpasswd-dreicount deinname
```

Im nginx-`location /`-Block ergänzen:

```
auth_basic "Dreicount";
auth_basic_user_file /etc/nginx/.htpasswd-dreicount;
```

Dann `nginx -t && systemctl reload nginx`.

---

## Wartung – nützliche Befehle

```bash
systemctl status dreicount        # läuft der Dienst?
journalctl -u dreicount -f        # Live-Logs
systemctl restart dreicount       # neu starten

# App aktualisieren
cd /opt/dreicount
# (neue Dateien einspielen)
npm install --omit=dev
chown -R dreicount:dreicount /opt/dreicount
systemctl restart dreicount
```

---

## API (Kurzreferenz)

| Methode & Pfad | Zweck |
|---|---|
| `POST /api/tricounts` | Abrechnung anlegen `{title, currency, members[]}` |
| `GET /api/tricounts/:id` | Abrechnung inkl. Salden & Ausgleich laden |
| `POST /api/tricounts/:id/expenses` | Ausgabe `{description, amount, paid_by, spent_on, split_among[]}` oder `{… , shares[]}` |
| `DELETE /api/tricounts/:id/expenses/:expenseId` | Ausgabe löschen |

Beträge intern in Cent; gleichmäßige Aufteilung verteilt Restcents fair, sodass
die Summe exakt aufgeht. Der Ausgleich minimiert die Anzahl der Überweisungen.

---

## Sicherheits-Checkliste

- [x] App läuft als eigener, unprivilegierter Benutzer (systemd-Hardening)
- [x] Nur `127.0.0.1` gebunden, nginx als TLS-Endpunkt davor
- [x] UFW **und** IONOS-Cloud-Firewall: nur 22/80/443
- [x] HTTPS erzwungen (Let's Encrypt)
- [x] Security-Header + CSP (Helmet), Rate-Limiting aktiv
- [x] Automatische Sicherheitsupdates, fail2ban
- [x] Regelmäßige, ausgelagerte Backups
- [ ] SSH key-only (Schritt 3 ausführen!)
- [ ] Links nur mit Beteiligten teilen (ggf. Basic-Auth)
