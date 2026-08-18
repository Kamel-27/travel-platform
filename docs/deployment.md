# Deployment (M8) — Azure (student credit)

**Status:** v1 — first manual deploy, per roadmap.md §5 ("don't automate a deploy you haven't done manually").

Frontend (`app/web`) is deployed on Vercel already. This covers the backend
(`app/Backend` + Postgres + Redis), self-hosted on one Azure Virtual Machine
via `docker-compose.prod.yml` — same self-hosted shape originally scoped for
Oracle Cloud, then DigitalOcean; both rejected card verification, so this
runs on Azure's student credit instead. Same Dockerfile/compose/Caddy setup
either way — a VM is a VM; only the provisioning steps below are Azure-specific.

## 1. Provision the VM (Azure Portal — manual, only you have the account)

1. Redeem the Azure for Students credit (school email verification), then
   Create a resource → **Virtual Machine**:
   - Image: **Ubuntu Server 24.04 LTS**.
   - Size: **B1s** (1 vCPU / 1GB RAM) to start — bump to **B2s** (2 vCPU / 4GB)
     if Postgres + Redis + the NestJS app feels sluggish together.
   - Authentication: **SSH public key**, note the admin username you set
     (commonly `azureuser` — the portal suggests this by default).
   - A public IP is assigned automatically (accept the default settings).
2. Networking tab (or the VM's **Networking** blade after creation) → add
   inbound port rules for **80** and **443** (22/SSH is usually already open
   by default from the quick-create wizard — verify it's there too). This is
   Azure's Network Security Group (NSG) — separate from the VM's own OS
   firewall (`ufw`, set up below); both need to allow the ports.

## 2. DNS

Caddy needs a real domain to request a Let's Encrypt certificate (bare IPs don't work).
- **No domain?** Use `https://sslip.io` — a hostname like `203-0-113-10.sslip.io`
  resolves to `203.0.113.10` automatically, zero DNS setup, and Let's Encrypt issues
  real certs for it.
- **Have a domain?** Point an A record (e.g. `api.yourdomain.com`) at the VM's public IP.

## 3. Server setup (SSH in)

```bash
ssh -i /path/to/key azureuser@<vm-public-ip>   # use whatever admin username you set

# OS firewall (ufw) — allow the same ports as the NSG rules above
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

## 8. Database backups

`scripts/backup-db.sh` dumps Postgres out of the container to
`~/backups/postgres/travelhub-<timestamp>.dump`, verifies the archive is
readable, and prunes dumps older than `RETENTION_DAYS` (default 14).

### Scheduling it

The script does nothing until cron runs it. On the VM:

```bash
crontab -l | grep backup-db || (crontab -l 2>/dev/null; echo '15 3 * * * cd ~/travel-platform && ./scripts/backup-db.sh >> ~/backup.log 2>&1') | crontab -
```

Confirm it's registered and that the log shows recent successful runs:

```bash
crontab -l && tail -20 ~/backup.log && ls -lh ~/backups/postgres/
```

### Off-site copy — required for this to count as a backup

By default dumps land on the **same VM and disk as the database**. That covers
a bad migration or an accidental `DELETE`; it does **not** cover losing the VM.
Until an off-site destination is configured, a dead VM is still total data
loss. The `OFF-SITE COPY` block at the bottom of `scripts/backup-db.sh` has
three ready-to-uncomment options (Azure Blob, rclone to any S3-compatible
bucket, or pulling to your own machine with `rsync`).

### Restoring

Restore into a scratch database first and inspect it — never straight over the
live one.

```bash
docker compose -f docker-compose.prod.yml exec -T postgres createdb -U travelhub travelhub_restore
docker compose -f docker-compose.prod.yml exec -T postgres pg_restore -U travelhub -d travelhub_restore --no-owner < ~/backups/postgres/travelhub-<timestamp>.dump
docker compose -f docker-compose.prod.yml exec -T postgres psql -U travelhub -d travelhub_restore -c '\dt'
```

To promote it over the live database, stop the backend first so nothing writes
mid-swap:

```bash
docker compose -f docker-compose.prod.yml stop backend
docker compose -f docker-compose.prod.yml exec -T postgres psql -U travelhub -d postgres -c 'ALTER DATABASE travelhub RENAME TO travelhub_old;'
docker compose -f docker-compose.prod.yml exec -T postgres psql -U travelhub -d postgres -c 'ALTER DATABASE travelhub_restore RENAME TO travelhub;'
docker compose -f docker-compose.prod.yml start backend
```

Keep `travelhub_old` until the app is verified healthy, then drop it.

> **A backup you have never restored is not a backup.** Walk through the
> scratch-database restore above at least once, and note the date you last did
> it — that rehearsal is what tells you the dumps are actually usable.

## 9. Monitoring and error reporting

### Sentry

Both apps report unhandled errors to Sentry. Every Sentry call is a no-op when
the DSN is unset, so local dev and CI need no configuration.

| Where | Variable | Notes |
|---|---|---|
| Backend (`.env.prod` on the VM) | `SENTRY_DSN` | From the Sentry project settings |
| Backend | `SENTRY_ENVIRONMENT` | Optional; defaults to `NODE_ENV` |
| Frontend (Vercel env vars) | `NEXT_PUBLIC_SENTRY_DSN` | DSNs are write-only and public by design |
| Frontend | `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Optional; defaults to `NODE_ENV` |

Optional, for readable stack traces in the frontend — set all three in Vercel
and the build uploads source maps; leave them unset and it skips the upload:
`SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`.

What gets reported: the backend sends only genuine faults — `HttpException`s
(401/404/validation) are normal outcomes and are deliberately not reported, or
they'd bury the real incidents. Request bodies, cookies, and `Authorization`
headers are stripped before send (passenger PII and payment payloads). Session
Replay is off on the frontend for the same reason.

### Uptime checks

`GET /health` is a real readiness probe — it pings Postgres and Redis and
returns 503 if either is down, so it fails when the API is up but its
datastores are not. It is exempt from the `api/v1` prefix:

```bash
curl -sS https://api.safariyat.live/health
```

Point an external uptime monitor at that URL (UptimeRobot, Better Stack, and
Cronitor all have free tiers that cover a 5-minute interval with email alerts).
This has to be **external** — a check running on the VM cannot tell you the VM
is unreachable.

## Notes

- Postgres/Redis are **not** exposed on host ports in `docker-compose.prod.yml` —
  only reachable from the `backend` container over the internal Docker network.
  Only 80/443 (Caddy) and 22 (SSH) need to be open externally.
- Backups are self-managed via `scripts/backup-db.sh` (§8), not a managed
  service. Data lives in the `pgdata` named volume on this one VM.
- Full staging/production separation is a deliberate scope cut (roadmap.md §5) —
  this is the one deployed environment.
