# Dreicount mit Docker & nginx-Reverse-Proxy

Diese Anleitung baut die App als Docker-Image und hängt sie an deinen
bestehenden nginx-Reverse-Proxy. Das native SQLite-Modul wird im Image
kompiliert – auf dem Host brauchst du **nur Docker**, sonst nichts.

Voraussetzung: Docker + Docker Compose v2 sind installiert
(`docker --version`, `docker compose version`).

---

## 1. Image bauen & Container starten

Projektordner auf den Server kopieren (z. B. nach `/opt/dreicount`), dann:

```bash
cd /opt/dreicount
docker compose up -d --build
docker compose logs -f        # "Dreicount läuft auf http://0.0.0.0:3000"
```

Die Datenbank liegt im benannten Volume `dreicount-data` und überlebt
Updates und Neustarts. Der `container_name` ist `dreicount`, der Port im
Container ist `3000`.

Welche der beiden Proxy-Varianten für dich gilt, hängt davon ab, **wie dein
nginx läuft** – als Container oder direkt auf dem Host.

---

## Variante A: nginx läuft selbst als Container

Typisch bei einem zentralen Proxy-Stack oder Nginx Proxy Manager.
Beide Container teilen sich ein Docker-Netz, und der Proxy spricht den
App-Container per Service-Namen an – **kein Port muss aufs Host**.

**1) Gemeinsames Netz anlegen** (einmalig, falls noch nicht vorhanden):

```bash
docker network create proxy
```

In der `docker-compose.yml` ist der `networks: [proxy]`-Block bereits aktiv
und das Netz als `external: true` eingebunden. Stelle sicher, dass dein
nginx-Container ebenfalls in diesem Netz hängt.

**2a) Klassischer nginx-Container** – Server-Block (Domain anpassen):

```nginx
server {
    listen 80;
    server_name dreicount.deine-domain.de;
    client_max_body_size 128k;

    location / {
        proxy_pass http://dreicount:3000;     # Service-Name aus compose
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

HTTPS richtest du wie für deine anderen Container ein (certbot im
nginx-Container bzw. dein bestehender Zertifikats-Workflow).

**2b) Nginx Proxy Manager (GUI)** – falls du NPM nutzt:

1. NPM und `dreicount` müssen im selben Docker-Netz sein (`proxy`).
2. In NPM: *Hosts → Proxy Hosts → Add Proxy Host*.
   - **Domain Names:** `dreicount.deine-domain.de`
   - **Scheme:** `http`
   - **Forward Hostname / IP:** `dreicount`  (der Container-Name)
   - **Forward Port:** `3000`
   - **Block Common Exploits:** an, **Websockets Support:** kann an bleiben
3. Tab **SSL:** *Request a new SSL Certificate*, *Force SSL* + *HTTP/2* an,
   E-Mail eintragen, speichern. NPM holt das Let's-Encrypt-Zertifikat selbst.

Fertig – erreichbar unter `https://dreicount.deine-domain.de`.

---

## Variante B: nginx läuft direkt auf dem Host

Dann veröffentlichst du den Container-Port **nur lokal** und der Host-nginx
proxyt dorthin.

**1)** In `docker-compose.yml` den `networks:`-Block beim Service `dreicount`
entfernen/auskommentieren, den `ports:`-Block aktivieren:

```yaml
    ports:
      - "127.0.0.1:3000:3000"
```

(Den externen `networks: proxy`-Abschnitt unten kannst du dann ebenfalls
weglassen.) Danach `docker compose up -d`.

**2)** Server-Block auf dem Host (`/etc/nginx/sites-available/dreicount`):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name dreicount.deine-domain.de;
    client_max_body_size 128k;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/dreicount /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d dreicount.deine-domain.de    # HTTPS
```

> `127.0.0.1:3000` (statt nur `3000`) sorgt dafür, dass der Port **nicht**
> von außen erreichbar ist – nur der Host-nginx kommt dran.

---

## Updates einspielen

```bash
cd /opt/dreicount
# neue Dateien einspielen (git pull / scp)
docker compose up -d --build
docker image prune -f      # alte Images aufräumen
```

Das Volume `dreicount-data` bleibt erhalten, die Daten also auch.

---

## Backups

Konsistenter Snapshot ins Volume (Unterordner `backups/`):

```bash
docker exec dreicount npm run backup
```

Automatisch per Host-cron (täglich 3:30 Uhr) – `crontab -e`:

```
30 3 * * * docker exec dreicount npm run backup >> /var/log/dreicount-backup.log 2>&1
```

Backups vom Server herunterladen (außerhalb des VPS aufbewahren!):

```bash
docker cp dreicount:/app/data/backups ./dreicount-backups
```

Wiederherstellen: Container stoppen, gewünschte `dreicount-*.db` ins Volume nach
`/app/data/dreicount.db` kopieren, Container starten.

---

## Nützliche Befehle

```bash
docker compose ps              # Status + Healthcheck
docker compose logs -f         # Live-Logs
docker compose restart         # neu starten
docker compose down            # stoppen (Volume bleibt)
docker exec -it dreicount sh     # Shell im Container
```

---

## Sicherheitshinweise

- Der Container läuft als unprivilegierter `node`-User, nicht als root.
- Kein Port muss aufs Host (Variante A) bzw. nur lokal gebunden (Variante B).
- Security-Header, CSP und Rate-Limiting sind in der App aktiv; TLS macht
  dein Reverse-Proxy.
- Zugriffsmodell wie bei Tricount: **der Link ist der Schlüssel.** Für eine
  zusätzliche Sperre kannst du in nginx/NPM Basic-Auth oder eine Access-List
  vorschalten.
