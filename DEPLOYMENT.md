# Carnaby.sk - Synology NAS Deployment Guide

## 🐳 Docker Deployment na Synology NAS

### Predpoklady
- Synology NAS s nainštalovaným **Container Manager** (Docker)
- SSH prístup k NAS
- Git nainštalovaný na NAS (voliteľné, pre klonovanie repozitára)

---

## 📋 Krok za krokom

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

### 5. Build Docker image

```bash
sudo docker-compose build
```

Alebo manuálne:
```bash
sudo docker build -t carnaby-sk:latest .
```

### 6. Spustite kontajner

```bash
sudo docker-compose up -d
```

### 7. Overte, že kontajner beží

```bash
sudo docker ps
```

Výstup by mal obsahovať:
```
CONTAINER ID   IMAGE          COMMAND           STATUS         PORTS                    NAMES
xxxxx          carnaby-sk     "node server.js"  Up 10 seconds  0.0.0.0:3000->3000/tcp   carnaby-sk
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

### Rebuild po zmenách v kóde
```bash
sudo docker-compose down
sudo docker-compose build --no-cache
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

## 🔄 Automatické aktualizácie

### Vytvorte update skript

```bash
nano /volume1/docker/carnaby-sk/update.sh
```

Obsah:
```bash
#!/bin/bash
cd /volume1/docker/carnaby-sk
git pull
sudo docker-compose down
sudo docker-compose build
sudo docker-compose up -d
```

Urobte ho spustiteľným:
```bash
chmod +x update.sh
```

Spustite aktualizáciu:
```bash
./update.sh
```

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
