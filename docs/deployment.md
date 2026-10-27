# Deployment — production runbook

**Status:** Verified against repo 2026-10-27 (main @ b176f47)

| Piece | Where | How it gets there |
|---|---|---|
| Frontend (`app/web`, Next.js) | Vercel — https://www.safariyat.live | Vercel's GitHub integration builds on every merge to `main` |
| Backend (`app/Backend`, NestJS) + Postgres + Redis + Caddy | One Azure VM — https://api.safariyat.live | `.github/workflows/deploy-backend.yml` SSHes in and runs `docker compose -f docker-compose.prod.yml up -d --build` |

This is the one deployed environment; there is no staging. Everything below is
the live setup, not a plan.

## 1. The VM

- Azure, **Ubuntu Server 24.04 LTS**, size `Standard_B2ats_v2` (2 vCPU, but
  `free -m` shows only **~842 MB RAM** — smaller than the B2 name suggests),
  resource group `safariyat-rg`, region Spain Central.
- A **2 GB swapfile** was added after the first `docker compose … --build`
  stalled with no swap. It is outside the repo; if the VM is ever rebuilt,
  recreate it before the first build:

  ```bash
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
  sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  ```

- Inbound ports: **22, 80, 443** — in both the Azure Network Security Group
  (portal → VM → Networking) *and* the OS firewall:

  ```bash
  sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
  ```

- Docker + Compose plugin via `curl -fsSL https://get.docker.com | sudo sh`,
  then `sudo usermod -aG docker $USER` (log out/in once).
- The repo is a plain clone at `~/travel-platform` on the `main` branch; the
  deploy workflow does `git pull origin main` there, so never commit or leave
  local changes on the VM.

> Note: the size name comes from the Azure portal at provisioning time, not
> from anything in the repo; the ~842 MB figure is what the OS reports.

## 2. DNS and TLS

- `api.safariyat.live` → A record at the VM's public IP.
- Caddy (`caddy:2-alpine`) reads the one-line `Caddyfile` at the repo root:
  `{$DOMAIN}` → `reverse_proxy backend:3001`. `DOMAIN` comes from the root
  `.env` (see §3). Caddy obtains and renews the Let's Encrypt certificate
  itself; certs persist in the `caddy_data` volume, so a container rebuild
  does not re-issue.
- `www.safariyat.live` is configured on the Vercel side (project domains),
  not on the VM.

## 3. Environment files — there are two

`docker-compose.prod.yml` (project name `travelhub-prod`) reads **two**
different files. Mixing them up is the most common deploy mistake.

| File on the VM | Read by | Contains |
|---|---|---|
| `~/travel-platform/.env` | Docker Compose, for `${...}` substitution in the compose file | **Only** `POSTGRES_PASSWORD` and `DOMAIN`. Template: `.env.prod.example`. |
| `~/travel-platform/app/Backend/.env` | The `backend` container, via `env_file:` | All app config. Template: `app/Backend/.env.example`. |

Both are git-ignored and were written by hand on the VM; nothing in CI or in
the repo recreates them.

### `app/Backend/.env` — what must be set in production

From `app/Backend/.env.example`. The three marked *overridden* are set by the
compose file's `environment:` block, so whatever the file says for them is
ignored.

| Variable | Production value / notes |
|---|---|
| `NODE_ENV` | `production` (the Dockerfile also sets it) |
| `PORT` | *overridden* → `3001` |
| `DATABASE_URL` | *overridden* → `postgresql://travelhub:${POSTGRES_PASSWORD}@postgres:5432/travelhub` |
| `REDIS_URL` | *overridden* → `redis://redis:6379` |
| `JWT_SECRET` | Real secret, `openssl rand -hex 32` |
| `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS` | Defaults `900` / `30` |
| `WEB_APP_URL` | `https://www.safariyat.live` — drives CORS, the magic-link URL and the Google OAuth post-login redirect |
| `RESEND_API_KEY`, `MAIL_FROM` | Resend key for the verified sending domain; `MAIL_FROM=Safariyat <no-reply@auth.safariyat.live>`. Empty key = magic links are only logged. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Redirect URI is `https://api.safariyat.live/api/v1/auth/google/callback` and must be listed verbatim in the Google Cloud Console OAuth client |
| `DUFFEL_API_KEY`, `DUFFEL_WEBHOOK_SECRET` | Webhook registered in Duffel's dashboard at `https://api.safariyat.live/api/v1/webhooks/duffel` |
| `PAYMOB_API_BASE`, `PAYMOB_API_KEY`, `PAYMOB_INTEGRATION_ID`, `PAYMOB_IFRAME_ID`, `PAYMOB_HMAC_SECRET` | Paymob integration's callback URL is `https://api.safariyat.live/api/v1/webhooks/paymob` |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT` | DSN from the Sentry project; environment optional (falls back to `NODE_ENV`). Unset DSN = Sentry is a no-op. |

### Frontend env (Vercel project settings)

From `app/web/.env.example` plus the Sentry additions:

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.safariyat.live` (no trailing slash) |
| `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | DSNs are public by design; environment optional |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | Optional — set all three and the build uploads source maps; unset and it skips |

Changing a Vercel env var requires a redeploy to take effect.

### Gotchas

- **`docker compose restart` does not re-read either file.** It restarts the
  existing containers with their existing environment. After editing an env
  file, apply it with
  `docker compose -f docker-compose.prod.yml up -d` (append `backend` to limit
  it to that service).
- **Changing `POSTGRES_PASSWORD` in `.env` does nothing once the `pgdata`
  volume exists.** The password is baked into the cluster on first init.
  Change it inside Postgres first, then update `.env`, then `up -d` so the
  backend's `DATABASE_URL` matches:

  ```bash
  docker compose -f docker-compose.prod.yml exec postgres psql -U travelhub -d postgres \
    -c "ALTER USER travelhub WITH PASSWORD '<new>';"
  ```

## 4. What a deploy does

`.github/workflows/deploy-backend.yml` runs on every **push to `main`** that
touches `app/Backend/**`, `docker-compose.prod.yml`, `Caddyfile` or the
workflow file itself. A merge that only touches `app/web`, `docs/` or
`scripts/` does **not** deploy the backend (and does not `git pull` on the VM —
see §8 for the backup-script consequence).

1. On the GitHub runner: `npm ci`, `lint:check`, `typecheck`, `build`,
   `test:cov` in `app/Backend`. Any failure stops the deploy.
2. Over SSH (`appleboy/ssh-action`, repo secrets `VM_HOST`, `VM_USER`,
   `VM_SSH_KEY`):
   `cd ~/travel-platform && git pull origin main && docker compose -f docker-compose.prod.yml up -d --build`
3. On the VM, the `backend` image is rebuilt from `app/Backend/Dockerfile`
   (`node:22-alpine`; `npm ci` keeps dev deps because `migration:run` needs
   ts-node; `npm run build`). Its `CMD` is
   `npm run migration:run && npm run start:prod`, so **TypeORM migrations run
   on every container start**, before the API listens.
4. Compose waits for the Postgres/Redis healthchecks, then starts `backend`;
   Caddy keeps running and proxies to the new container once it answers.

Expect `/health` to return **502 for roughly 20 seconds** after the container
swaps — Caddy is up but the new container is still booting and migrating
(the compose healthcheck's `start_period: 20s` matches this). It is not an
incident unless it persists.

The frontend deploys independently: Vercel builds on every merge to `main`,
with no workflow in this repo.

## 5. Manual deploy (when Actions is not an option)

```bash
ssh -i <key> <user>@<vm-ip>
cd ~/travel-platform
git pull origin main
setsid nohup docker compose -f docker-compose.prod.yml up -d --build > ~/deploy.log 2>&1 &
tail -f ~/deploy.log
```

Detach long builds with `setsid`/`nohup` as above — a full image build on this
VM can outlive an SSH session, and a dropped session would kill a foreground
build mid-way.

## 6. Verify a deploy

- [ ] The **Deploy Backend** run on GitHub Actions is green (the verify step
      *and* the SSH step).
- [ ] `curl -sS https://api.safariyat.live/health` returns **200** with
      `"status":"ok"` and both `database` and `redis` reported `up`
      (give it ~20 s after the container swap; 503 means a datastore is down,
      502 means the container is still booting).
- [ ] `docker compose -f docker-compose.prod.yml ps` on the VM shows all four
      services running and `backend` `healthy`.
- [ ] `docker compose -f docker-compose.prod.yml logs --tail=50 backend` shows
      the migration run and Nest's "successfully started" line, no stack
      traces.
- [ ] If the change touched `app/web`: the Vercel deployment is **Ready** and a
      hard refresh of https://www.safariyat.live shows the new bundle (a
      visible change, or a new `_next/static/<buildId>` hash in page source).

## 7. Health endpoint

`GET /health` (`app/Backend/src/health/health.controller.ts`, Terminus) is
exempt from the `api/v1` prefix (`main.ts` excludes it). It runs two checks
and returns **503** if either fails:

- `database` — TypeORM `pingCheck` against Postgres;
- `redis` — `PING` on the shared ioredis client.

The compose healthcheck hits the same URL from inside the container every 15 s.
Point an **external** uptime monitor at `https://api.safariyat.live/health`
(UptimeRobot, Better Stack and Cronitor free tiers cover a 5-minute interval);
a check running on the VM cannot report the VM being unreachable.

> Note: whether an external monitor is currently configured is not visible
> from the repo.

## 8. Database backups

`scripts/backup-db.sh` (run from the repo root on the VM) does
`pg_dump -Fc` inside the `postgres` container to
`~/backups/postgres/travelhub-<UTC timestamp>.dump`, rejects dumps under
`MIN_BYTES` (10 KiB), verifies the archive with `pg_restore --list`, and prunes
dumps older than `RETENTION_DAYS` (default 14). All of these are overridable
via environment variables; see the script header.

Because the deploy workflow only pulls the repo on backend deploys (§4), a
change to this script reaches the VM on the next backend deploy or a manual
`git pull` — not on merge.

### Scheduling it

The script does nothing until cron runs it. On the VM:

```bash
crontab -l | grep backup-db || (crontab -l 2>/dev/null; echo '15 3 * * * cd ~/travel-platform && ./scripts/backup-db.sh >> ~/backup.log 2>&1') | crontab -
```

Confirm it is registered and the log shows recent successful runs:

```bash
crontab -l && tail -20 ~/backup.log && ls -lh ~/backups/postgres/
```

> Note: whether this cron entry is currently installed on the VM cannot be
> verified from the repo. Check with `crontab -l` before relying on it.

### Off-site copy — required for this to count as a backup

Dumps land on the **same VM and disk as the database**. That covers a bad
migration or an accidental `DELETE`; it does **not** cover losing the VM.
The `OFF-SITE COPY` block at the bottom of `scripts/backup-db.sh` has three
ready-to-uncomment options (Azure Blob, rclone to any S3-compatible bucket,
or pulling to your own machine with `rsync`). None is enabled in the
committed script.

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
> it.

## 9. Error reporting (Sentry)

Both apps report to Sentry; every Sentry call is a no-op when the DSN is
unset, so local dev and CI need no configuration. Variables are listed in §3.

Backend: **every error-level log line** is forwarded by the app logger
(`StructuredLoggerService`), which covers unhandled exceptions, deliberate 5xx
responses such as `SUPPLIER_UNAVAILABLE`, and background work that never
passes through an HTTP filter (BullMQ processors for fulfilment, refunds and
webhooks; cron sweeps for reconciliation, expiry and refund requeue).
4xx `HttpException`s are normal outcomes and are not reported. Errors only, no
performance tracing, to spare the VM's memory. Request bodies, cookies and
`Authorization` headers are stripped; emails and phone numbers are scrubbed
from messages.

Frontend: unhandled errors and error boundaries; Session Replay is off.

## 10. Rollback

There is no image registry or tagged release; the VM builds from whatever
`main` is. To roll back, revert the offending commit on `main` through a PR —
the deploy workflow redeploys the reverted tree. For an emergency on the VM
itself: `git checkout <good-sha>` in `~/travel-platform`, then the manual
deploy from §5, and put `main` right afterwards so the next push does not
re-deploy the bad commit.

Migrations are forward-only in this flow; `npm run migration:revert` exists in
`app/Backend` but is not part of any automated path.

## Notes

- Postgres and Redis publish **no host ports** in `docker-compose.prod.yml`;
  only `backend` reaches them over the compose network. Data lives in the
  `pgdata` and `redisdata` named volumes on this one VM.
- `docker-compose.yml` (project `travelhub`) is the **local dev** file: Postgres
  and Redis only, published on `5432`/`6379` with password `travelhub`. It is
  not used on the VM.
- Historical planning (milestones, hosting choices) lives in
  `docs/archive/roadmap.md` and is not maintained.
