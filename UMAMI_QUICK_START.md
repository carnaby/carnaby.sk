# Umami Analytics - PostgreSQL Deployment

## Čo bolo zmenené

Umami teraz používa **PostgreSQL** namiesto SQLite (ktorý nie je podporovaný).

## Rýchle nasadenie

### 1. Vygeneruj secrets

Na NAS-e alebo lokálne:

```bash
# APP_SECRET (base64 je OK)
openssl rand -base64 32

# DB_PASSWORD (použij hex, nie base64!)
# Hex formát nemá špeciálne znaky ako +, /, = ktoré spôsobujú problémy v URL
openssl rand -hex 32
```

### 2. Aktualizuj .env súbor

V `/volume1/docker/carnaby-sk/.env` pridaj:

```bash
# Database (shared)
DB_PASSWORD=<tvoj-vygenerovaný-db-password>

# Umami Analytics
UMAMI_APP_SECRET=<tvoj-vygenerovaný-app-secret>
```

### 3. Vytvor priečinky

```bash
sudo mkdir -p /volume1/docker/carnaby-sk/db
sudo chown 1026:100 /volume1/docker/carnaby-sk/db
```

### 4. Nasaď služby

```bash
cd /volume1/docker/carnaby-sk
sudo docker-compose pull
sudo docker-compose up -d
```

### 5. Sleduj logy

```bash
# PostgreSQL
sudo docker logs -f carnaby-db

# Umami (v novom okne)
sudo docker logs -f carnaby-umami
```

Počkaj, kým neuvidíš:
- **db**: `database system is ready to accept connections`
- **umami**: `Listening on http://0.0.0.0:3000`

### 6. Prihlásiť sa

Otvor: `http://<IP-tvojho-NAS>:3001`

- **Username**: `admin`
- **Password**: `umami`

**IHNEĎ zmeň heslo!**

## Zálohovanie

### Manuálny backup

```bash
# Vytvor backup
docker exec carnaby-db pg_dump -U umami umami | gzip > db-backup-$(date +%Y%m%d).sql.gz

# Restore
gunzip < db-backup-20260121.sql.gz | docker exec -i carnaby-db psql -U umami umami
```

### Automatický backup script

Vytvor `/volume1/docker/carnaby-sk/backup-db.sh`:

```bash
#!/bin/bash
# /volume1/docker/carnaby-sk/backup-db.sh
# Backs up PostgreSQL database (Umami + future web app)

BACKUP_DIR="/volume1/private/clouds/GoogleDrive/carnaby_sk/backups"
DATE=$(date +%Y%m%d-%H%M%S)

# Backup databázy
sudo docker exec carnaby-db pg_dump -U umami umami | gzip > "$BACKUP_DIR/db-$DATE.sql.gz"

# Cleanup starých záloh (30+ dní)
find "$BACKUP_DIR" -name "db-*.sql.gz" -mtime +30 -delete

echo "Database backup completed: db-$DATE.sql.gz"
```

Spusti:
```bash
chmod +x /volume1/docker/carnaby-sk/backup-db.sh

# Otestuj script
/volume1/docker/carnaby-sk/backup-db.sh
```

**Pridaj do Synology Task Scheduler:**

1. Otvor **Control Panel** → **Task Scheduler**
2. Klikni **Create** → **Scheduled Task** → **User-defined script**
3. **General tab:**
   - Task: `Backup PostgreSQL Database`
   - User: `root` (potrebné pre Docker prístup)
4. **Schedule tab:**
   - Date: Daily
   - Time: `02:00` (2:00 AM)
5. **Task Settings tab:**
   - User-defined script:
     ```bash
     /volume1/docker/carnaby-sk/backup-db.sh
     ```
6. Klikni **OK**
```

## Troubleshooting

### Password Authentication Failed

**Chyba:** `password authentication failed for user "umami"`

**Príčina:** Zmenil si heslo v `.env`, ale PostgreSQL databáza už bola vytvorená so starým heslom.

**Riešenie - Reštart databázy (stratíš dáta!):**

```bash
# 1. Zastav kontajnery
sudo docker-compose down

# 2. Zmaž databázový volume
sudo rm -rf /volume1/docker/carnaby-sk/db

# 3. Vytvor znova s správnymi permissions
sudo mkdir -p /volume1/docker/carnaby-sk/db
sudo chown 1026:100 /volume1/docker/carnaby-sk/db

# 4. Spusti znova (vytvorí novú databázu s novým heslom)
sudo docker-compose up -d
```

**Alternatívne - Zmeň heslo v existujúcej databáze (zachováš dáta):**

```bash
# 1. Pripoj sa do PostgreSQL
sudo docker exec -it carnaby-db psql -U postgres

# 2. Zmeň heslo (nahraď NOVE_HESLO svojim heslom z .env)
ALTER USER umami WITH PASSWORD 'NOVE_HESLO';
\q

# 3. Reštartuj Umami
sudo docker-compose restart umami
```

### Invalid URL Error

**Chyba:** `TypeError: Invalid URL`

**Príčina:** Heslo obsahuje špeciálne znaky (`+`, `/`, `=`) z base64 formátu.

**Riešenie:** Vygeneruj nové heslo v hex formáte:

```bash
openssl rand -hex 32
```

Aktualizuj `.env` a reštartuj databázu (pozri vyššie).

### Databáza sa nespustí

```bash
# Skontroluj logy
sudo docker logs carnaby-db

# Skontroluj permissions
ls -la /volume1/docker/carnaby-sk/db

# Mal by byť owned by 1026:100
```

### Umami sa nespustí

```bash
# Skontroluj logy
sudo docker logs carnaby-umami

# Skontroluj, či databáza beží
sudo docker ps | grep carnaby-db

# Reštartuj
sudo docker-compose restart umami
```

### Nemôžeš sa pripojiť na port 3001

Skontroluj firewall na Synology:
- Control Panel → Security → Firewall
- Pridaj pravidlo pre port 3001

## Ďalšie kroky

1. ✅ Zmeň admin heslo
2. ✅ Pridaj svoju stránku (Settings → Websites → Add website)
3. ✅ Skopíruj tracking kód
4. ✅ Nastav automatické zálohy
5. 🔜 (Voliteľné) Nastav reverse proxy s HTTPS

Pre viac detailov pozri `UMAMI_SETUP.md`.
