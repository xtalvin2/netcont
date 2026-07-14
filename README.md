# NetConnect WiFi Billing Platform

A web-based WiFi billing and hotspot management platform built for Nigerian ISPs and hotspot operators. Customers can purchase internet packages or redeem prepaid vouchers via Paystack; admins manage packages, vouchers, payments, advertisements, analytics, and MikroTik router integration from a dashboard.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Project Structure](#project-structure)
5. [Local Development Setup](#local-development-setup)
6. [Supabase Backend Setup](#supabase-backend-setup)
7. [Paystack Configuration](#paystack-configuration)
8. [MikroTik Relay Setup](#mikrotik-relay-setup)
9. [Production Deployment](#production-deployment)
10. [Environment Variables Reference](#environment-variables-reference)
11. [Admin Credentials](#admin-credentials)
12. [Troubleshooting](#troubleshooting)
13. [Hosting on Android Termux (Old Phone)](#hosting-on-android-termux-old-phone)

---

## Overview

NetConnect bridges a MikroTik hotspot with cloud payment processing. It is designed for LAN-only operation where the customer portal and a small relay server run inside the same network as the MikroTik router, while Supabase and Paystack remain in the cloud.

### Main features

- Public portal: package selection, Paystack checkout, voucher redemption, ad banners, support page
- Admin dashboard: dashboard stats, package management, voucher generation/reports, payments log, user sessions, ads management, system settings
- Supabase Edge Functions for payment, voucher redemption, session expiry, MikroTik activation, and admin credentials
- MikroTik REST API relay for live voucher sync and hotspot user creation
- 5-minute session expiry cron job

---

## Architecture

```
Customer Device
       │
       ▼
MikroTik Hotspot (192.168.88.1)
       │
       ├── Portal (React SPA) ─────── http://<local_ip>:8080
       │
       └── MikroTik Relay (Node.js) ─ http://<local_ip>:3000
       │
       ▼
   Internet
       │
       ├── Supabase (Auth + PostgreSQL + Edge Functions + Storage)
       │
       └── Paystack (payment gateway)
```

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Supabase Edge Functions (Deno runtime)
- **Database**: PostgreSQL managed by Supabase
- **Relay**: Node.js + Express (runs on your LAN, inside `tasks/mikrotik-relay/`)
- **Payments**: Paystack (Nigerian card/bank transfers)

---

## Prerequisites

### Required accounts & services

- [Supabase](https://supabase.com) project (free tier works)
- [Paystack](https://paystack.com) business account + secret/public keys
- MikroTik router with Hotspot enabled (L009 / RB750 / hAP series)

### Local development machine

- Node.js ≥ 20
- pnpm ≥ 9 or npm ≥ 10
- Supabase CLI (for local Edge Function testing and deployment)
- Git (optional)

Verify tools:

```bash
node -v   # v20.x or higher
pnpm -v   # 9.x or higher
supabase --version
```

---

## Project Structure

```
.
├── index.html                      # Vite entry HTML
├── package.json                    # Frontend dependencies and scripts
├── postcss.config.js               # Tailwind/PostCSS config
├── tailwind.config.js              # Tailwind theme config
├── tsconfig*.json                  # TypeScript configs
├── vite.config.ts                  # Vite configuration
├── public/                         # Static assets (logos, favicon, error illustrations)
├── src/
│   ├── App.tsx                     # Root application component
│   ├── main.tsx                    # React mount point
│   ├── routes.tsx                  # React Router route definitions
│   ├── index.css                   # Global styles
│   ├── components/                 # Shared UI components (shadcn/ui)
│   ├── components/layouts/         # PublicLayout, AdminLayout
│   ├── components/portal/          # Portal-only components (AdBanner)
│   ├── contexts/                   # React contexts (AuthContext)
│   ├── db/                         # Supabase client setup
│   ├── hooks/                      # Custom React hooks
│   ├── lib/                        # Utility helpers and API callers
│   ├── pages/                      # Public and admin pages
│   └── types/                      # TypeScript type definitions
├── supabase/
│   ├── config.toml                 # Supabase CLI config
│   ├── functions/                  # Edge Functions (Deno)
│   │   ├── paystack-payment/       # Initialize Paystack checkout
│   │   ├── paystack-webhook/       # Handle Paystack webhooks
│   │   ├── generate-vouchers/      # Admin bulk voucher generation
│   │   ├── redeem-voucher/         # Customer voucher redemption
│   │   ├── retry-activation/       # Retry MikroTik user activation
│   │   ├── expire-sessions/        # Expire old hotspot sessions (cron)
│   │   └── update-admin-credentials/ # Admin password update
│   ├── migrations/                 # Database schema migrations
│   └── secrets/required.json       # Required secret keys list
├── tasks/
│   └── mikrotik-relay/             # LAN relay server (Node.js + Express)
│       ├── index.js
│       ├── package.json
│       ├── .env.example
│       └── README.md
└── README.md                       # This file
```

---

## Local Development Setup

### 1. Clone or extract the source code

```bash
cd /workspace/app-czpf690oj3ep   # or wherever you extracted the ZIP
```

### 2. Install frontend dependencies

```bash
pnpm install
# or
npm install
```

### 3. Configure frontend environment

Create `.env` in the project root:

```bash
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_PAYSTACK_PUBLIC_KEY=pk_test_...
VITE_PAYSTACK_SECRET_KEY=sk_test_...
```

> The frontend needs `VITE_PAYSTACK_SECRET_KEY` only when running the demo/test flow; in production, the Edge Function uses the server-side secret stored in Supabase Secrets.

### 4. Run the development server

```bash
pnpm dev -- --host 0.0.0.0
# or
npm run dev -- --host 0.0.0.0
```

The portal will be available at `http://localhost:5173`.

---

## Supabase Backend Setup

### 1. Create a Supabase project

- Go to [Supabase Dashboard](https://app.supabase.com)
- Create a new project and save the **Project URL** and **Anon Key**
- Navigate to Project Settings → API → save `service_role` key too (only for local CLI/admin use)

### 2. Link the project with Supabase CLI

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

### 3. Run database migrations

```bash
supabase db push
```

This applies all SQL files inside `supabase/migrations/`, creating the schema, default admin user, RLS policies, and cron jobs.

### 4. Set required Edge Function secrets

In the Supabase Dashboard → Edge Functions → Secrets (or via CLI):

```bash
supabase secrets set PAYSTACK_SECRET_KEY=sk_test_...
supabase secrets set PAYSTACK_PUBLIC_KEY=pk_test_...
supabase secrets set SUPABASE_URL=https://<your-project>.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Optional / MikroTik-specific secrets:

```bash
supabase secrets set MIKROTIK_RELAY_URL=http://<relay-ip>:3000
supabase secrets set MIKROTIK_RELAY_SECRET=<relay-secret>
supabase secrets set FRONTEND_URL=http://<portal-ip>:8080
```

### 5. Deploy Edge Functions

```bash
supabase functions deploy
```

### 6. Enable the 5-minute expiry cron

Migration `00013_setup_expire_sessions_cron_5min.sql` already schedules the cron. Verify it exists:

```sql
SELECT * FROM pg_cron.job WHERE jobname = 'expire_sessions_every_5_minutes';
```

If missing, run the migration directly:

```bash
supabase db push
```

---

## Paystack Configuration

1. Sign up at [Paystack](https://paystack.com)
2. Switch to test mode
3. Copy **Public Key** and **Secret Key**
4. Add them to:
   - Frontend `.env`: `VITE_PAYSTACK_PUBLIC_KEY`
   - Supabase Secrets: `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`
5. Configure your Paystack callback URL to point to your deployed portal:
   - `https://<your-domain>/payment/verify`
6. Set the webhook URL in Paystack dashboard:
   - `https://<your-project>.functions.supabase.co/paystack-webhook`
7. Use a strong webhook secret and store it in Supabase Secrets as `PAYSTACK_WEBHOOK_SECRET` if the code checks it.

---

## MikroTik Relay Setup

The relay is needed because Supabase (cloud) cannot directly reach a MikroTik router behind CGNAT/Starlink. The relay sits on your LAN and forwards commands to the router's REST API.

### 1. Prepare a relay host

Recommended:
- Raspberry Pi 4/5 on the same LAN as MikroTik
- An old laptop running Ubuntu/Debian
- An Android phone with Termux (see later section)

### 2. Install and configure

```bash
cd tasks/mikrotik-relay
npm install
cp .env.example .env
nano .env
```

Edit `.env`:

```env
PORT=3000
MIKROTIK_HOST=192.168.88.1
MIKROTIK_USER=admin
MIKROTIK_PASSWORD=your_router_password
RELAY_SECRET=a_long_random_secret
```

### 3. Start the relay

```bash
npm start
```

### 4. Expose to Supabase (choose one)

**Option A — Local device with public IP**
- Open/forward port 3000 on your router
- Use `http://<public-ip>:3000` as `MIKROTIK_RELAY_URL`

**Option B — Cloudflare Tunnel (free, works behind CGNAT)**

```bash
# Install cloudflared
# Then run:
cloudflared tunnel --url http://localhost:3000
# Use the https://*.trycloudflare.com URL as MIKROTIK_RELAY_URL
```

**Option C — Tailscale/VPN**
- Run the relay on a VPS connected to the same Tailscale network as the router

### 5. Save Supabase secrets

```bash
supabase secrets set MIKROTIK_RELAY_URL=<relay-url>
supabase secrets set MIKROTIK_RELAY_SECRET=<relay-secret>
```

### 6. MikroTik router preparation

1. Winbox / WebFig → **IP → Services** → enable `www` (port 80) or `www-ssl` (port 443)
2. Create a dedicated API user:
   - **System → Users → Add**
   - Name: `api-user`
   - Group: create a group with policies `read, write, api, hotspot`
3. Confirm hotspot server name under **IP → Hotspot → Servers** (default: `hotspot1`)

---

## Production Deployment

### Frontend

1. Build the static files:

```bash
pnpm build
```

This creates a `dist/` folder.

2. Serve `dist/` with nginx, Apache, Vercel, Netlify, or any static host.

Example nginx config:

```nginx
server {
    listen 80;
    server_name portal.example.com;
    root /var/www/netconnect/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Edge Functions

```bash
supabase functions deploy
```

### Relay

Run as a systemd service or use PM2:

```bash
sudo npm install -g pm2
cd tasks/mikrotik-relay
pm2 start index.js --name mikrotik-relay
pm2 save
pm2 startup
```

---

## Environment Variables Reference

### Frontend (.env)

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anon key |
| `VITE_PAYSTACK_PUBLIC_KEY` | Paystack public test/live key |
| `VITE_PAYSTACK_SECRET_KEY` | Paystack secret test/live key (used in dev flows) |

### Supabase Edge Function Secrets

| Secret | Description |
|---|---|
| `PAYSTACK_SECRET_KEY` | Paystack server secret key |
| `PAYSTACK_PUBLIC_KEY` | Paystack public key |
| `SUPABASE_URL` | Same as `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `MIKROTIK_RELAY_URL` | URL of your LAN relay server |
| `MIKROTIK_RELAY_SECRET` | Shared secret for relay authentication |
| `FRONTEND_URL` | Customer portal URL for redirects |
| `PAYSTACK_WEBHOOK_SECRET` | Optional webhook verification secret |

### Relay (.env)

| Variable | Description |
|---|---|
| `PORT` | Port the relay listens on |
| `MIKROTIK_HOST` | MikroTik router IP |
| `MIKROTIK_USER` | MikroTik API username |
| `MIKROTIK_PASSWORD` | MikroTik API password |
| `RELAY_SECRET` | Shared secret; must match Supabase secret |

---

## Admin Credentials

After running migrations, a default admin user is created:

- **Email**: `admin@netconnect.local`
- **Password**: `admin`

> Change the password immediately after first login via **Admin → Settings → Update Admin Credentials**.

---

## Troubleshooting

### `npm install` fails or runs out of memory

- Use `pnpm` instead of `npm`
- Increase Node memory: `NODE_OPTIONS=--max-old-space-size=4096 pnpm install`
- On low-end devices, build on a stronger machine and copy `dist/`

### Edge Function deployment fails

- Ensure you ran `supabase link` first
- Check secrets are set: `supabase secrets list`
- Check Deno type errors: `supabase functions build`

### Payments show "pending" forever

- Verify `paystack-webhook` is deployed
- Verify Paystack webhook URL is correct
- Check Supabase Functions logs

### Voucher redeem says "invalid code"

- Check the voucher exists in Supabase `vouchers` table
- If using live sync, verify relay is running: `curl <relay>/health`
- Test MikroTik connectivity: `curl <relay>/mikrotik/test -H "x-relay-secret: ..."`

### MikroTik users are not created

- Confirm REST API service is enabled in RouterOS
- Confirm API user has `read, write, api, hotspot` policies
- Confirm `MIKROTIK_HOTSPOT_SERVER` in relay matches actual server name
- Check relay logs and Supabase Edge Function logs

### Customers can't reach the portal

- Confirm the portal host is on the same LAN/subnet as MikroTik
- Check firewall rules; ensure ports 8080 (portal) and 3000 (relay) are allowed
- Confirm MikroTik hotspot login page URL points to the portal IP

---

## Hosting on Android Termux (Old Phone)

You can host both the static portal and the MikroTik relay on an Android phone using Termux. This is useful for low-budget setups where the phone sits on the same LAN as the MikroTik router.

### Requirements

- Android phone (e.g., Infinix Hot 9)
- Termux installed from **F-Droid** (not Play Store)
- Phone connected to MikroTik WiFi

### 1. Install Termux packages

```bash
pkg update && pkg upgrade -y
pkg install -y nodejs nginx openssh zip unzip
```

### 2. Transfer pre-built files

Because building on the phone is slow, build `dist/` on your PC first (`pnpm build`), then copy `dist/` and `tasks/mikrotik-relay/` to the phone.

```bash
# On PC
zip -r portal-dist.zip dist/
zip -r relay.zip tasks/mikrotik-relay/
# Copy both to phone Download folder, then in Termux:
cp /sdcard/Download/portal-dist.zip ~/
cp /sdcard/Download/relay.zip ~/
unzip portal-dist.zip
unzip relay.zip
```

### 3. Configure nginx

```bash
cat > $PREFIX/etc/nginx/nginx.conf << 'EOF'
worker_processes 1;
events { worker_connections 256; }
http {
    include mime.types;
    default_type application/octet-stream;
    sendfile on;
    server {
        listen 8080;
        root /data/data/com.termux/files/home/dist;
        index index.html;
        location / {
            try_files $uri $uri/ /index.html;
        }
    }
}
EOF
nginx
```

### 4. Start the relay

```bash
cd ~/mikrotik-relay
npm install
# Edit .env, then:
node index.js &
```

### 5. Keep Termux alive

```bash
termux-wake-lock
```

Disable Android battery optimization for Termux and consider installing **Termux:Boot** for auto-start on reboot.

### 6. Update Supabase secrets

```bash
supabase secrets set FRONTEND_URL=http://<phone-ip>:8080
supabase secrets set MIKROTIK_RELAY_URL=http://<phone-ip>:3000
```

### 7. Update MikroTik hotspot redirect

Set the hotspot login URL to:

```
http://<phone-ip>:8080
```

---

## License

This project is provided as-is for educational and commercial use by the original purchaser. Redistribution without permission is not allowed.

## Support

For issues, refer to the [Troubleshooting](#troubleshooting) section or open an issue in your project's repository.
