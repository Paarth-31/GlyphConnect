# Deployment Guide

**Note:** This project is now complete (v1.0.0). The deployment steps below apply to the finalized version of the application.

This document covers SSH access to the EC2 instance, first-time server setup, and how to push code updates to production.

---

## Table of Contents

- [SSH into the EC2 Instance](#ssh-into-the-ec2-instance)
- [First-Time Server Setup](#first-time-server-setup)
- [Deploying Code Updates](#deploying-code-updates)
- [Managing the Server Process (PM2)](#managing-the-server-process-pm2)
- [Checking Logs](#checking-logs)
- [Environment Variables on EC2](#environment-variables-on-ec2)
- [Database (AWS RDS)](#database-aws-rds)
- [Troubleshooting](#troubleshooting)

---

## SSH into the EC2 Instance

### What you need

- Your `.pem` key file (downloaded when you created the EC2 instance)
- Your EC2 instance's **Public IP** or **Elastic IP** (find it in the AWS Console → EC2 → Instances)
- The default username for your AMI:

| AMI | Username |
|---|---|
| Amazon Linux 2 / 2023 | `ec2-user` |
| Ubuntu 20.04 / 22.04 / 24.04 | `ubuntu` |
| Debian | `admin` |

### Connect

```bash
# Basic connection
ssh -i /path/to/your-key.pem ec2-user@YOUR_EC2_PUBLIC_IP

# Example with a real key and IP
ssh -i ~/.ssh/rda-server.pem ubuntu@13.233.45.67
```

**If you get "Permission denied (publickey)"**, your key file permissions are too open:

```bash
chmod 400 ~/.ssh/rda-server.pem
```

**If you get "Connection timed out"**, check your EC2 Security Group:
- AWS Console → EC2 → Security Groups → your instance's group
- Inbound rules must allow **SSH (port 22)** from your IP (or `0.0.0.0/0` for any IP)
- Also allow **port 8080** (or whichever port your signaling server uses) from `0.0.0.0/0`

### Shortcut: SSH config file

Add this to `~/.ssh/config` on your local machine so you can just type `ssh rda`:

```
Host rda
  HostName 13.233.45.67
  User ubuntu
  IdentityFile ~/.ssh/rda-server.pem
  ServerAliveInterval 60
```

Then connect with:

```bash
ssh rda
```

---

## First-Time Server Setup

Run these once when you first set up the EC2 instance.

### 1. Update the system

```bash
sudo apt update && sudo apt upgrade -y   # Ubuntu/Debian
# or
sudo yum update -y                        # Amazon Linux
```

### 2. Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # should print v20.x.x
```

### 3. Install PM2 (process manager)

```bash
sudo npm install -g pm2
pm2 startup   # follow the printed command to enable auto-start on reboot
```

### 4. Install Git

```bash
sudo apt install -y git
```

### 5. Clone the repository

```bash
cd ~
git clone https://github.com/YOUR_USERNAME/RDA.git
cd RDA
```

### 6. Install dependencies

```bash
cd signaling-server
npm install
```

### 7. Create the `.env` file

```bash
cp .env.example .env
nano .env       # or vim .env
```

Fill in all values. The server **will not start** if `JWT_SECRET` is missing.

Generate a secure secret:

```bash
openssl rand -hex 32
```

### 8. Start the server with PM2

```bash
pm2 start --name rda-signaling --interpreter node \
  -- node -e "require('ts-node').register(); require('./src/server.ts')"

# or if you add a build step:
# npm run build
# pm2 start dist/server.js --name rda-signaling

pm2 save   # persist the process list across reboots
```

### 9. Verify it is running

```bash
pm2 status
curl http://localhost:8080/health
```

---

## Deploying Code Updates

Every time you push changes to GitHub and want the server to pick them up:

### Step 1 — SSH into the instance

```bash
ssh rda   # or: ssh -i ~/.ssh/rda-server.pem ubuntu@YOUR_IP
```

### Step 2 — Pull the latest code

```bash
cd ~/RDA
git pull origin main
```

### Step 3 — Install any new dependencies

```bash
cd signaling-server
npm install
```

### Step 4 — Restart the server

```bash
pm2 restart rda-signaling
```

### Step 5 — Confirm it came back up

```bash
pm2 status
curl http://localhost:8080/health
# expected: {"status":"ok","db_pool":{...},"ts":"..."}
```

### One-liner (paste this after SSH-ing in)

```bash
cd ~/RDA && git pull origin main && cd signaling-server && npm install && pm2 restart rda-signaling && pm2 status
```

---

## Managing the Server Process (PM2)

| Command | What it does |
|---|---|
| `pm2 status` | Show all running processes |
| `pm2 restart rda-signaling` | Restart without downtime |
| `pm2 stop rda-signaling` | Stop the process |
| `pm2 delete rda-signaling` | Remove from PM2 list |
| `pm2 reload rda-signaling` | Zero-downtime reload |
| `pm2 monit` | Live CPU/memory dashboard |
| `pm2 save` | Persist process list for reboot |
| `pm2 startup` | Re-generate the systemd startup script |

---

## Checking Logs

```bash
# Live streaming logs (Ctrl+C to exit)
pm2 logs rda-signaling

# Last 200 lines
pm2 logs rda-signaling --lines 200

# Error log only
pm2 logs rda-signaling --err

# Log files are at:
~/.pm2/logs/rda-signaling-out.log   # stdout
~/.pm2/logs/rda-signaling-error.log # stderr
```

---

## Environment Variables on EC2

The `.env` file lives at `~/RDA/signaling-server/.env` on the server. It is **not** in git (`.gitignore` excludes it).

To edit it:

```bash
ssh rda
nano ~/RDA/signaling-server/.env
pm2 restart rda-signaling   # restart to pick up the new values
```

### Production `.env` values to change from dev defaults

| Variable | Dev value | Production value |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| `DB_HOST` | `localhost` | your RDS endpoint |
| `DB_SSL` | `false` | `true` |
| `DB_PASSWORD` | `localdevpassword` | your RDS password |
| `JWT_SECRET` | *(any)* | 64-char random hex |
| `JWT_EXPIRES` | `1h` | `1h` or `15m` |
| `FRONTEND_URL` | `http://localhost:5173` | your production frontend URL |

---

## Database (AWS RDS)

### Apply the schema for the first time

From inside the EC2 instance (RDS is not publicly accessible by default — access via EC2):

```bash
PGPASSWORD=your_rds_password psql \
  -h your-rds-endpoint.rds.amazonaws.com \
  -U rda_app \
  -d rda \
  -f ~/RDA/signaling-server/src/db/schema.sql
```

### Connect to the database for inspection

```bash
PGPASSWORD=your_rds_password psql \
  -h your-rds-endpoint.rds.amazonaws.com \
  -U rda_app \
  -d rda
```

Useful queries:

```sql
-- Check active users
SELECT id, email, display_name, created_at FROM users ORDER BY created_at DESC LIMIT 20;

-- Check active sessions
SELECT * FROM user_sessions_auth WHERE expires_at > NOW();

-- Check server health log
SELECT * FROM system_health ORDER BY recorded_at DESC LIMIT 10;
```

---

## Troubleshooting

### Server not reachable from outside

Check the EC2 security group has inbound rules for:
- Port 22 (SSH) — your IP
- Port 8080 (or your `PORT`) — `0.0.0.0/0`

```bash
# From your local machine, test if the port is reachable
curl http://YOUR_EC2_IP:8080/health
```

### PM2 process keeps crashing

```bash
pm2 logs rda-signaling --err --lines 50
```

Common causes:
- Missing or wrong `.env` values (especially `JWT_SECRET` — the server now throws if it is unset)
- Database connection refused (wrong `DB_HOST`, RDS security group not allowing EC2)
- Port already in use: `sudo lsof -i :8080`

### Git pull asks for credentials

Set up an SSH deploy key or use HTTPS with a GitHub personal access token:

```bash
git remote set-url origin https://YOUR_TOKEN@github.com/YOUR_USERNAME/RDA.git
```

Or use SSH keys:

```bash
ssh-keygen -t ed25519 -C "ec2-deploy"
cat ~/.ssh/id_ed25519.pub   # add this to GitHub → Settings → Deploy Keys
git remote set-url origin git@github.com:YOUR_USERNAME/RDA.git
```

### `npm install` fails with EACCES

```bash
sudo chown -R $(whoami) ~/.npm
```

### Electron DBus error (local Linux dev only)

If you see `Failed to call method: org.freedesktop.DBus.StartServiceByName` when running Electron locally on Linux:

```bash
dbus-launch npm run dev
# or
DBUS_SESSION_BUS_ADDRESS=/dev/null npm run dev
```

This is a local dev-only issue and does not affect the EC2 signaling server.