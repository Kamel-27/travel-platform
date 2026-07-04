# Deployment (M8) — Oracle Cloud Always Free

**Status:** v1 — first manual deploy, per roadmap.md §5 ("don't automate a deploy you haven't done manually").

Frontend (`app/web`) is deployed on Vercel already. This covers the backend
(`app/Backend` + Postgres + Redis), self-hosted on one Oracle Cloud
Always Free VM via `docker-compose.prod.yml` — genuinely free forever within
the Always Free limits, no trial-credit expiry.

## 1. Provision the VM (OCI Console — manual, only you have the account)

1. Create an OCI account (card required for identity verification only — Always
   Free resources are never billed unless you explicitly upgrade and exceed them).
2. Compute → Create Instance:
   - Shape: **VM.Standard.A1.Flex** (Ampere/ARM, Always Free — up to 4 OCPUs / 24GB RAM).
   - Image: **Ubuntu 24.04** (or latest LTS).
   - Add your SSH public key (or let OCI generate a key pair for you — download the `.key` file).
   - Networking: use the default VCN or create one; **assign a public IPv4 address**.
3. In the VCN's **Security List** (or a Network Security Group), add ingress rules for
   `0.0.0.0/0`: TCP 80, TCP 443, TCP 22 (SSH). This is separate from the VM's own
   OS firewall — both need to allow the ports, that's the #1 thing people miss here.

## 2. DNS

Caddy needs a real domain to request a Let's Encrypt certificate (bare IPs don't work).
- **No domain?** Use `https://sslip.io` — a hostname like `203-0-113-10.sslip.io`
  resolves to `203.0.113.10` automatically, zero DNS setup, and Let's Encrypt issues
  real certs for it.
- **Have a domain?** Point an A record (e.g. `api.yourdomain.com`) at the VM's public IP.

## 3. Server setup (SSH in)

```bash
ssh -i /path/to/key ubuntu@<vm-public-ip>

# OS firewall (ufw) — allow the same ports as the OCI security list
sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable

# Docker + Compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # log out/in once for this to take effect
sudo apt-get install -y docker-compose-plugin

git clone https://github.com/Kamel-27/travel-platform.git
cd travel-platform
```

## 4. Configure environment

```bash
cp .env.prod.example .env                 # repo-root vars: POSTGRES_PASSWORD, DOMAIN
cp app/Backend/.env.example app/Backend/.env
```

Edit `app/Backend/.env` with **production** values (see that file for the full list):
- `NODE_ENV=production`
- `JWT_SECRET` — generate a real secret: `openssl rand -hex 32`
- `WEB_APP_URL` — your exact Vercel URL (protocol + host, no trailing slash).
  Drives CORS *and* the magic-link email URL *and* is the Google OAuth
  post-login redirect target.
- `GOOGLE_REDIRECT_URI` — `https://<your-domain>/api/v1/auth/google/callback`.
  Add this **exact** URL to the Google Cloud Console OAuth client's
  "Authorized redirect URIs" (external step, Google's dashboard).
- `DUFFEL_WEBHOOK_SECRET` — Duffel gives you this when you register a webhook
  pointed at `https://<your-domain>/api/v1/webhooks/duffel` in their dashboard.
- `PAYMOB_*` — reuse existing sandbox credentials; set the Paymob integration's
  webhook callback URL to `https://<your-domain>/api/v1/webhooks/paymob`.
- `DATABASE_URL`/`REDIS_URL`/`PORT` are overridden by docker-compose.prod.yml —
  leave them as-is in the file, they're ignored in this setup.

Edit `.env` (repo root) and set `POSTGRES_PASSWORD` (strong, random) and `DOMAIN`.

## 5. Deploy

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f backend   # watch it boot + run migrations
```

Verify: `curl https://<your-domain>/health` → `{"status":"ok",...}` with `database`/`redis` both up.

## 6. Wire up the frontend

In Vercel's project settings → Environment Variables, set
`NEXT_PUBLIC_API_URL=https://<your-domain>` and redeploy.

## 7. Redeploying after a change

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build backend
```

## Notes

- Postgres/Redis are **not** exposed on host ports in `docker-compose.prod.yml` —
  only reachable from the `backend` container over the internal Docker network.
  Only 80/443 (Caddy) and 22 (SSH) need to be open externally.
- No managed backups: Postgres data lives in the `pgdata` named volume on this
  one VM. Fine for a portfolio demo; if this becomes real, add an off-box backup.
- Full staging/production separation is a deliberate scope cut (roadmap.md §5) —
  this is the one deployed environment.
