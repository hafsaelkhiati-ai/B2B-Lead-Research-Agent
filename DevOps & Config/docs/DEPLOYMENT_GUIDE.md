# 🚀 B2B Lead Agent — VPS Deployment Guide

Complete step-by-step guide to take this agent live on a Linux VPS (Ubuntu 22.04 recommended).

---

## 📁 Project Structure

```
b2b-lead-agent/
├── backend/
│   ├── server.js                  ← Express entry point
│   ├── package.json
│   ├── .env.example               ← Copy to .env and fill in keys
│   ├── routes/
│   │   ├── leads.js
│   │   ├── pipeline.js
│   │   └── stats.js
│   └── services/
│       ├── apolloService.js       ← Apollo.io API
│       ├── clayService.js         ← Clay enrichment API
│       ├── hubspotService.js      ← HubSpot CRM API
│       ├── openaiService.js       ← GPT-4o scoring + openers
│       ├── slackService.js        ← Slack alerts
│       ├── pipelineOrchestrator.js← Agent brain
│       └── logger.js
├── frontend/
│   ├── src/
│   │   ├── App.jsx                ← Main dashboard UI
│   │   └── index.js
│   ├── public/index.html
│   ├── package.json
│   └── .env                       ← Set REACT_APP_API_URL here
├── nginx/
│   └── leadagent.conf             ← Nginx reverse proxy config
├── ecosystem.config.js            ← PM2 process config
└── .gitignore
```

---

## 🔑 STEP 1 — Get Your API Keys

Before anything else, collect all keys:

### OpenAI
1. Go to https://platform.openai.com/api-keys
2. Click **Create new secret key**
3. Copy the key → paste into `.env` as `OPENAI_API_KEY`

### HubSpot
1. In HubSpot: **Settings → Integrations → Private Apps → Create a private app**
2. Name it "Lead Agent"
3. Under **Scopes**, enable:
   - `crm.objects.contacts.write`
   - `crm.objects.contacts.read`
   - `crm.objects.companies.write`
   - `crm.objects.companies.read`
4. Click **Create App** → copy the access token
5. Paste into `.env` as `HUBSPOT_ACCESS_TOKEN`

> ⚠️ **IMPORTANT — Create custom HubSpot properties before first run:**
> In HubSpot → Properties → Create the following Contact properties:
> - `icp_score` (Number)
> - `icp_reason` (Single-line text)
> - `personalised_opener` (Multi-line text)
> - `linkedin_url` (Single-line text)
> 
> And these Company properties:
> - `icp_score` (Number)
> - `icp_reason` (Single-line text)
> - `linkedin_company_page` (Single-line text)

### Apollo.io
1. Go to https://developer.apollo.io/
2. Navigate to **API Keys** in your account settings
3. Generate a new key → paste into `.env` as `APOLLO_API_KEY`

### Clay
1. Log into https://clay.com
2. Go to **Settings → API**
3. Copy your API key → paste into `.env` as `CLAY_API_KEY`
4. (Optional) Set up a webhook URL and paste as `CLAY_WEBHOOK_URL`

### Slack (optional)
1. Go to https://api.slack.com/apps → **Create New App**
2. Choose **From scratch** → name it "Lead Agent Alerts"
3. Go to **Incoming Webhooks** → toggle **On** → click **Add New Webhook to Workspace**
4. Pick a channel → copy the webhook URL
5. Paste into `.env` as `SLACK_WEBHOOK_URL`

---

## 🖥️ STEP 2 — VPS Setup

SSH into your VPS (Ubuntu 22.04):

```bash
ssh root@YOUR_VPS_IP
```

### Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # Should print v20.x.x
```

### Install PM2 (process manager)

```bash
sudo npm install -g pm2
```

### Install Nginx

```bash
sudo apt update
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## 📦 STEP 3 — Upload Your Code

### Option A — Git (recommended)

```bash
# On your VPS:
cd /var/www
sudo mkdir leadagent
sudo chown $USER:$USER leadagent
cd leadagent
git init
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git pull origin main
```

### Option B — SCP from your local machine

```bash
# Run this on your LOCAL machine:
scp -r ./b2b-lead-agent root@YOUR_VPS_IP:/var/www/leadagent
```

---

## ⚙️ STEP 4 — Configure Environment

```bash
cd /var/www/leadagent/backend
cp .env.example .env
nano .env
```

Fill in every value. The file looks like this — replace all `REPLACE_WITH_...` values:

```env
PORT=4000
NODE_ENV=production
OPENAI_API_KEY=sk-...
HUBSPOT_ACCESS_TOKEN=pat-...
APOLLO_API_KEY=...
CLAY_API_KEY=...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
ICP_INDUSTRIES=SaaS,Manufacturing,Chemical
ICP_LOCATIONS=Germany,Austria,Switzerland
ICP_MIN_EMPLOYEES=50
ICP_MAX_EMPLOYEES=5000
```

Save with `Ctrl+O`, exit with `Ctrl+X`.

---

## 📥 STEP 5 — Install Dependencies

```bash
# Backend
cd /var/www/leadagent/backend
npm install

# Create logs directory (required by logger)
mkdir -p /var/www/leadagent/logs

# Frontend
cd /var/www/leadagent/frontend
npm install
```

---

## 🏗️ STEP 6 — Build Frontend

```bash
cd /var/www/leadagent/frontend

# ⚠️  Set your domain or VPS IP first:
echo "REACT_APP_API_URL=http://YOUR_VPS_IP_OR_DOMAIN/api" > .env

npm run build
```

This creates `frontend/build/` — that's what Nginx will serve.

---

## 🌐 STEP 7 — Configure Nginx

```bash
# Copy the nginx config
sudo cp /var/www/leadagent/nginx/leadagent.conf /etc/nginx/sites-available/leadagent

# Edit the server_name line to match your domain or IP
sudo nano /etc/nginx/sites-available/leadagent
# Change:  server_name yourdomain.com;
# To:      server_name YOUR_VPS_IP;  (or your actual domain)

# Also update the frontend root path:
# Change: root /var/www/leadagent/frontend;
# To:     root /var/www/leadagent/frontend/build;

# Enable the site
sudo ln -s /etc/nginx/sites-available/leadagent /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Reload
sudo systemctl reload nginx
```

---

## ▶️ STEP 8 — Start the Backend with PM2

```bash
cd /var/www/leadagent

# ⚠️  Edit ecosystem.config.js first — update the cwd path if needed
nano ecosystem.config.js
# Change: cwd: "/var/www/leadagent"   ← should already match

# Start the backend
pm2 start ecosystem.config.js

# Check it's running
pm2 status
pm2 logs leadagent-backend --lines 20

# Make PM2 restart on server reboot
pm2 save
pm2 startup
# → Run the command it prints out
```

---

## ✅ STEP 9 — Verify Everything Works

```bash
# 1. Check backend health
curl http://localhost:4000/health
# Expected: {"status":"ok","timestamp":"..."}

# 2. Check API via Nginx
curl http://YOUR_VPS_IP/api/stats
# Expected: {"totalLeadsInCRM":0,"avgIcpScore":0,"lastRun":null}

# 3. Open dashboard in browser
# Go to: http://YOUR_VPS_IP
```

---

## 🔒 STEP 10 — Add HTTPS (Free with Let's Encrypt)

Only do this if you have a real domain pointing to your VPS:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
# Follow the prompts
# Certbot will auto-update your nginx config for SSL

# Test auto-renewal
sudo certbot renew --dry-run
```

---

## 🔁 Updating the App

When you push code changes:

```bash
cd /var/www/leadagent
git pull origin main

# If backend changed:
cd backend && npm install
pm2 restart leadagent-backend

# If frontend changed:
cd ../frontend
npm run build
sudo systemctl reload nginx
```

---

## 🗓️ Scheduled Pipeline (Cron)

The backend already includes a built-in cron job in `server.js`:

```js
// Runs every weekday at 08:00 server time
cron.schedule("0 8 * * 1-5", async () => { ... });
```

To change the schedule, edit this line in `backend/server.js` using standard cron syntax:
- `"0 8 * * 1-5"` = Monday–Friday at 08:00
- `"0 9,14 * * *"` = Every day at 09:00 and 14:00
- `"0 */4 * * *"` = Every 4 hours

After editing, restart: `pm2 restart leadagent-backend`

---

## 🐛 Troubleshooting

| Problem | Fix |
|---|---|
| Backend not starting | `pm2 logs leadagent-backend` — check for missing .env keys |
| Frontend shows blank page | Check `REACT_APP_API_URL` in frontend/.env, rebuild |
| HubSpot push fails | Verify custom properties exist in HubSpot (see Step 1) |
| Apollo returns 0 results | Check API key, confirm your plan includes people search |
| Clay enrichment fails | Check CLAY_API_KEY, or set it to empty — enrichment is non-blocking |
| Nginx 502 Bad Gateway | Backend is down — run `pm2 restart leadagent-backend` |
| Port 4000 in use | Change `PORT=4001` in .env and update ecosystem.config.js |

---

## 💰 Monthly Cost Estimate

| Service | Plan | Cost |
|---|---|---|
| Clay | Starter | ~$149/mo |
| Apollo.io | Basic | ~$49/mo |
| HubSpot | Free CRM | $0 |
| OpenAI | Pay-per-use | ~$5/mo |
| VPS (Hetzner/DigitalOcean) | 2GB RAM | ~$6/mo |
| **Total** | | **~$209/mo** |

---

## 📋 Resume Bullet (copy exactly)

> Developed a Clay + HubSpot API lead research agent that automatically scores B2B prospects by ICP fit and creates enriched CRM entries — removing manual data entry from the prospecting workflow.
