# Carnaby.sk - Synology NAS Deployment Guide

## 🚀 Automatizovaný CI/CD Pipeline

Projekt používa **GitHub Actions** pre automatické buildovanie a nasadzovanie Docker images. Pri každom pushu do `main` vetvy sa automaticky:

1. Zbuilduje nový Docker image
2. Pushne sa do **GitHub Container Registry** (ghcr.io)
3. **Watchtower** na Synology NAS automaticky detekuje novú verziu
4. Kontajner sa automaticky aktualizuje a reštartuje

**Výsledok:** Zero-downtime deployment bez manuálneho zásahu! 🎉

---

## 🔑 GitHub Container Registry - Prvotné nastavenie

### 1. Vytvorte GitHub Personal Access Token (PAT)

1. Prejdite na GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Kliknite **Generate new token (classic)**
3. Nastavte:
   - **Note**: `Synology NAS - carnaby.sk`
   - **Expiration**: `No expiration` (alebo podľa preferencie)
   - **Scopes**: Zaškrtnite `read:packages`
4. Kliknite **Generate token**
5. **DÔLEŽITÉ**: Skopírujte token (ukáže sa len raz!)

### 2. Prihláste sa na NAS do GitHub Container Registry

SSH na Synology NAS a spustite:

```bash
echo "YOUR_GITHUB_TOKEN" | sudo docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

**Príklad:**
```bash
echo "ghp_xxxxxxxxxxxxxxxxxxxx" | sudo docker login ghcr.io -u dodus --password-stdin
```

**Výstup:**
```
Login Succeeded
```

Credentials sa uložia do `~/.docker/config.json` a Watchtower ich automaticky použije.

### 3. GitHub Secrets (voliteľné)

**Dobrá správa:** Pre základný CI/CD pipeline **nepotrebujete** nastavovať žiadne GitHub Secrets! 🎉

GitHub Actions automaticky poskytuje `GITHUB_TOKEN` s potrebnými oprávneniami na:
- Čítanie kódu z repozitára
- Publikovanie Docker images do GitHub Container Registry

**Kedy nastaviť vlastné secrets:**
- Ak chcete notifikácie z Watchtower (Slack, Discord, atď.)
- Ak potrebujete prístup k externým službám počas buildu

**Ako nastaviť secrets (ak potrebné):**
1. GitHub repozitár → **Settings** → **Secrets and variables** → **Actions**
2. Kliknite **New repository secret**
3. Pridajte potrebné secrets (napr. `SLACK_WEBHOOK_URL`)



## 🐳 Docker Deployment na Synology NAS

### Predpoklady
- Synology NAS s nainštalovaným **Container Manager** (Docker)
- SSH prístup k NAS
- Git nainštalovaný na NAS (voliteľné, pre klonovanie repozitára)
- **Prihlásenie do ghcr.io** (viď sekcia vyššie)

---

## 📋 Krok za krokom (Prvotné nasadenie)

### 1. Pripojte sa na Synology cez SSH

```bash
ssh your-username@synology-ip
```

### 2. Vytvorte pracovný adresár

```bash
mkdir -p /volume1/docker/carnaby-sk
cd /volume1/docker/carnaby-sk
```

### 3. Nahrajte súbory aplikácie

**Možnosť A: Git clone (odporúčané)**
```bash
git clone https://github.com/your-username/carnaby-sk.git .
```

**Možnosť B: Manuálny upload**
- Použite FileStation alebo SCP na nahratie súborov do `/volume1/docker/carnaby-sk`

### 4. Vytvorte adresár pre databázu

```bash
mkdir -p data
```

### 5. Nastavte GitHub repository (pre docker-compose)

Vytvorte `.env` súbor s názvom vášho GitHub repozitára:

```bash
echo "GITHUB_REPOSITORY=your-username/carnaby.sk" > .env
```

**Príklad:**
```bash
echo "GITHUB_REPOSITORY=dodus/carnaby.sk" > .env
```

### 6. Spustite kontajnery (automaticky stiahne image z ghcr.io)

```bash
sudo docker-compose up -d
```

### 7. Overte, že kontajnery bežia

```bash
sudo docker ps
```

Výstup by mal obsahovať **2 kontajnery**:
```
CONTAINER ID   IMAGE                                    COMMAND           STATUS         PORTS                    NAMES
xxxxx          ghcr.io/dodus/carnaby.sk:latest         "node server.js"  Up 10 seconds  0.0.0.0:3000->3000/tcp   carnaby-sk
yyyyy          containrrr/watchtower:latest            "/watchtower"     Up 10 seconds                           carnaby-watchtower
```

### 8. Otvorte aplikáciu v prehliadači

```
http://synology-ip:3000
```

---

## 🔧 Užitočné príkazy

### Zobraziť logy
```bash
sudo docker-compose logs -f
```

### Reštartovať kontajner
```bash
sudo docker-compose restart
```

### Zastaviť kontajner
```bash
sudo docker-compose down
```

### Aktualizácia po zmenách v kóde

**Automaticky (odporúčané):**
- Pushnite zmeny do `main` vetvy na GitHub
- GitHub Actions automaticky zbuilduje nový image
- Watchtower ho detekuje do 5 minút a aktualizuje kontajner
- **Žiadna manuálna práca potrebná!** ✨

**Manuálne (okamžitá aktualizácia):**
```bash
# Vynútiť Watchtower kontrolu teraz
sudo docker exec carnaby-watchtower /watchtower --run-once

# Alebo manuálne stiahnuť a reštartovať
sudo docker-compose pull
sudo docker-compose up -d
```

### Vymazať všetko a začať odznova
```bash
sudo docker-compose down -v
sudo docker system prune -a
```

---

## 📊 Monitoring cez Container Manager

1. Otvorte **Container Manager** v DSM
2. Prejdite na **Container** tab
3. Nájdite kontajner `carnaby-sk`
4. Kliknite naň pre zobrazenie:
   - CPU/RAM usage
   - Logs
   - Terminal access

---

## 🔒 Bezpečnosť

### Reverse Proxy (odporúčané)
Pre produkčné nasadenie nastavte reverse proxy v DSM:

1. **Control Panel** → **Login Portal** → **Advanced** → **Reverse Proxy**
2. Vytvorte nové pravidlo:
   - **Source**: `carnaby.your-domain.com` (port 443)
   - **Destination**: `localhost:3000`
3. Povoľte HTTPS certifikát cez **Let's Encrypt**

### Firewall
Ak používate priamy prístup na port 3000:
1. **Control Panel** → **Security** → **Firewall**
2. Vytvorte pravidlo povoľujúce port 3000

---

## 🔄 Automatické aktualizácie cez Watchtower

### Ako to funguje

**Watchtower** beží ako samostatný kontajner a:
- Kontroluje GitHub Container Registry každých **5 minút**
- Porovnáva SHA hash lokálneho image s registry
- Ak nájde novú verziu, automaticky:
  1. Stiahne nový image
  2. Zastaví starý kontajner
  3. Spustí nový kontajner s rovnakými nastaveniami
  4. Vymaže starý image (cleanup)

### Monitorovanie Watchtower

Zobraziť logy Watchtower:
```bash
sudo docker logs -f carnaby-watchtower
```

Príklad výstupu pri aktualizácii:
```
time="2026-01-19T16:00:00Z" level=info msg="Found new image for carnaby-sk"
time="2026-01-19T16:00:05Z" level=info msg="Stopping container carnaby-sk"
time="2026-01-19T16:00:10Z" level=info msg="Starting container carnaby-sk"
time="2026-01-19T16:00:15Z" level=info msg="Update completed successfully"
```

### Konfigurácia Watchtower

Upravte `docker-compose.yml` pre zmenu nastavení:

**Zmena intervalu kontroly:**
```yaml
environment:
  - WATCHTOWER_POLL_INTERVAL=600  # 10 minút namiesto 5
```

**Notifikácie (voliteľné):**
```yaml
environment:
  - WATCHTOWER_NOTIFICATION_URL=slack://token@channel
```

Podporované notifikačné služby: Slack, Discord, Email, Telegram, atď.
Viac info: https://containrrr.dev/watchtower/notifications/

---

## 🐛 Riešenie problémov

### Kontajner sa nespustí
```bash
sudo docker-compose logs
```

### Port 3000 je obsadený
Upravte `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Zmeňte externý port
```

### Databáza sa nevytvorila
```bash
sudo docker-compose exec carnaby-web node init-db.js
```

### npm ci zlyhalo (chýba package-lock.json)
**Problém:** Build zlyhá s chybou `npm ci can only install with an existing package-lock.json`

**Riešenie:** Dockerfile už používa `npm install` namiesto `npm ci`. Ak stále vidíte túto chybu:

1. Uistite sa, že máte najnovšiu verziu Dockerfile:
```bash
git pull origin main
```

2. Vyčistite Docker cache a rebuild:
```bash
sudo docker-compose down
sudo docker system prune -a
sudo docker-compose build --no-cache
sudo docker-compose up -d
```

**Odporúčanie pre produkciu:** Pre deterministické buildy vygenerujte package-lock.json:
```bash
npm install  # Vygeneruje package-lock.json
git add package-lock.json
git commit -m "Add package-lock.json for reproducible builds"
```

### Nedostatok pamäte
Upravte `docker-compose.yml` a pridajte:
```yaml
deploy:
  resources:
    limits:
      memory: 512M
```

---

## 📝 Poznámky

- Databáza sa automaticky inicializuje pri prvom build
- Dáta sú perzistentné vďaka volume mapping
- Kontajner sa automaticky reštartuje po reštarte NAS (`restart: unless-stopped`)
- Health check monitoruje stav aplikácie každých 30 sekúnd
- **npm install vs npm ci**: Dockerfile používa `npm install` pretože projekt momentálne neobsahuje `package-lock.json`. Pre produkčné nasadenie sa odporúča vygenerovať lockfile pre reprodukovateľné buildy.

---

## 🆘 Podpora

V prípade problémov skontrolujte:
1. Docker logy: `sudo docker-compose logs -f`
2. Synology system logy: **Log Center** v DSM
3. Dostupnosť portu: `sudo netstat -tulpn | grep 3000`
