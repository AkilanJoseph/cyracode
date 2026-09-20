# CyraCode — GitHub Actions CI/CD to Azure

This document describes the CI/CD pipeline that builds, tests, and deploys
CyraCode to Azure automatically.

## 1. Architecture at a glance

| Component | Tech | Azure resource |
|---|---|---|
| Frontend | React + Vite SPA, served by `server.js` (Node) | Azure **App Service** — `cyracode-frontend` |
| Backend / API | FastAPI + SQLAlchemy + Uvicorn (Python) | Azure **App Service** — `cyracode-api` |
| Database | PostgreSQL (mirrors `database/schema.postgres.sql`) | Azure Database for **PostgreSQL** |

The two App Service names come from `frontend/.env.production`
(`https://cyracode-api.azurewebsites.net` and `https://cyracode-frontend.azurewebsites.net`)
and are configurable via GitHub **variables** (see below).

> The repo also contains `database/schema.sql` (a **Microsoft SQL Server** schema).
> **It is never run by this pipeline.** It drops every table and would destroy
> production data. The live database is PostgreSQL.

### How the schema is managed (important)

There is **no Alembic migration tool**. The database is created/updated by the
application itself, safely and idempotently, at every backend startup:

- `Base.metadata.create_all()` — creates missing tables, never alters existing ones (`backend/app/main.py`)
- Additive in-place migrations — `_ensure_schema_upgrades()`, `_ensure_cyracode_columns()`,
  `_ensure_user_role_column()`, `_ensure_api_client_columns()` add missing columns only
- Idempotent seeds — `_seed_plans()` and `_bootstrap_admin()`

This is why the pipeline treats the database as self-migrating and only performs:

1. A **connectivity** check before deploy (`SELECT 1`) — non-destructive.
2. After deploy, a **table-presence** check (all 13 ORM tables) — non-destructive.
3. A **read-only DB round-trip through the API** (`GET /registration/count`), which
   proves the deployed app can reach the database.
4. An **optional** bootstrap of a brand-new/empty database via
   `database/schema.postgres.sql` (guarded — it refuses to run if any CyraCode
   table already exists).

## 2. Workflow file(s)

- `.github/workflows/deploy-azure.yml` — main pipeline
- `.github/actions/db-verify/action.yml` — reusable, non-destructive DB check/provision
  (with optional temporary firewall rule for the runner IP)
- `backend/scripts/ci_verify_db.py` — the check/provision script (no credentials logged)

### Trigger rules

| Event | What runs |
|---|---|
| Push to `main` | Full pipeline: test → DB check → deploy → verify |
| Pull request into `main` | Build + tests only (no deploy) |
| Manual `workflow_dispatch` (Actions → Run workflow) | Full pipeline (with optional fresh-DB bootstrap) |

### Pipeline stages (on push to `main`)

```
1. build-be   backend: pip install + pytest + zip package   (parallel)
1. build-fe   frontend: npm ci + vitest + vite build + zip   (parallel)
2. database   DB connectivity + optional fresh-DB bootstrap  (non-destructive)
3. deploy-be  App Service settings + zip deploy (Oryx pip install)
4. deploy-fe  App Service settings (SCM build off) + zip deploy
5. verify     /health + /registration/count (DB round-trip) + frontend 200 + table check
```

Deploy jobs run in the GitHub **`production` environment**, so you can attach
required reviewers / deployment gates in repo Settings → Environments if desired.

Deployments are **serialized** per branch (`concurrency.cancel-in-progress: false`)
so a new push never cancels an in-flight release.

## 3. One-time Azure authentication setup (OIDC — no secrets stored)

The workflow uses **Azure OpenID Connect (federated identity)** via
[`azure/login@v2`](https://github.com/azure/login). No password, client secret, or
service-principal credential is committed or stored as a GitHub secret.

Run the following with the Azure CLI (logged in as an owner/admin):

```bash
# 0) Login and pick your subscription
az login
az account set --subscription "<subscription-id>"

# 1) Create a Service Principal scoped to the resource group that holds the apps + DB
az ad sp create-for-rbac \
  --name "cyracode-github-actions" \
  --role Contributor \
  --scopes "/subscriptions/<subscription-id>/resourceGroups/<resource-group>"

# 2) Get the application (client) ID and object ID
APP_ID=$(az ad sp list --display-name "cyracode-github-actions" --query "[0].appId" -o tsv)
SP_OBJ_ID=$(az ad sp list --display-name "cyracode-github-actions" --query "[0].id" -o tsv)

# 3) Register federated identity credentials for GitHub
cat > fed-branch.json <<'EOF'
{
  "name": "github-branch-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:AkilanJoseph/cyracode:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"],
  "description": "Deployments from main branch pushes"
}
EOF
cat > fed-env.json <<'EOF'
{
  "name": "github-environment-production",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:AkilanJoseph/cyracode:environment:production",
  "audiences": ["api://AzureADTokenExchange"],
  "description": "Deployments from the production environment"
}
EOF
APP_OBJ_ID=$(az ad app show --id "$APP_ID" --query id -o tsv)
az rest --method POST \
  --uri "https://graph.microsoft.com/v1.0/applications/$APP_OBJ_ID/federatedIdentityCredentials" \
  --body @fed-branch.json
az rest --method POST \
  --uri "https://graph.microsoft.com/v1.0/applications/$APP_OBJ_ID/federatedIdentityCredentials" \
  --body @fed-env.json
```

> The `Contributor` role on the resource group is enough for deploying App Service
> zips, changing app settings / startup commands, and (if you use it) managing the
> PostgreSQL firewall rule.

## 4. Required GitHub Secrets and Variables

Configure these in **Settings → Secrets and variables → Actions**
(repository-level, or on the `production` environment to scope them).
Environment-level values take precedence.

### Secrets

| Secret | Purpose |
|---|---|
| `AZURE_CLIENT_ID` | Service principal application (client) ID from step 3 |
| `AZURE_TENANT_ID` | Your Azure AD tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Subscription that holds the App Services and DB |
| `AZURE_DATABASE_URL` | PostgreSQL URL, e.g. `postgresql+psycopg2://user:pass@cyracode-pg.postgres.database.azure.com:5432/cyracode?sslmode=require` |
| `AZURE_SECRET_KEY` | `SECRET_KEY` used by the API for JWT signing (must differ from dev) |
| `AZURE_ADMIN_EMAIL` | Bootstrap admin email (applies on first backend start) |
| `AZURE_ADMIN_PASSWORD` | Bootstrap admin password |
| `GOOGLE_CLIENT_ID` | Optional — overrides backend audience validation |
| `GOOGLE_CLIENT_SECRET` | Optional |
| `GOOGLE_MAPS_API_KEY` | Optional |
| `SMS_GATEWAY_URL`, `SMS_API_KEY` | Optional SMS gateway |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Optional e-mail |

Empty secrets are simply not applied — existing App Service settings are left intact.

### Variables

| Variable | Default | Purpose |
|---|---|---|
| `AZURE_RESOURCE_GROUP` | *(required)* | Resource group for the apps and DB |
| `AZURE_API_APP_NAME` | `cyracode-api` | Backend App Service name |
| `AZURE_FRONTEND_APP_NAME` | `cyracode-frontend` | Frontend App Service name |
| `API_BASE_URL` | `https://cyracode-api.azurewebsites.net` | Baked into the SPA build and used for post-deploy health checks |
| `FRONTEND_URL` | `https://cyracode-frontend.azurewebsites.net` | Backend `FRONTEND_URL` + post-deploy health check |
| `GOOGLE_CLIENT_ID` | value already in `frontend/.env.production` | Baked into the SPA build (public client id, not secret) |
| `CORS_ORIGINS` | *(empty)* | Extra comma-separated CORS origins |
| `REGISTRATION_COUNT_INITIAL` | `10000` | Social-proof counter baseline |
| `PROVISION_FRESH_DATABASE` | `false` | `true` = apply `database/schema.postgres.sql` **to an empty DB only** |
| `DB_MANAGE_FIREWALL` | `false` | `true` = auto-allow the runner IP temporarily (needs `AZURE_POSTGRES_SERVER`) |
| `AZURE_POSTGRES_SERVER` | *(empty)* | Azure PostgreSQL server name, e.g. `cyracode-pg` (when `DB_MANAGE_FIREWALL=true`) |

> DB firewall note: if the PostgreSQL server does not allow the GitHub-hosted
> runner to connect, either enable `DB_MANAGE_FIREWALL=true` (the pipeline adds a
> rule for the runner IP and removes it afterwards) or permanently allow Azure
> service access in the portal.

## 5. Manual trigger

1. GitHub → repository → **Actions** tab → **CyraCode CI/CD - Deploy to Azure**.
2. **Run workflow** (choose branch).
3. Optional: enable **`provision_fresh_database`** only when you are bootstrapping a
   brand-new/empty database. The pipeline refuses to run if tables already exist.
4. Monitor the run. Green jobs: test → database → deploy → verify.

## 6. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `azure/login` fails (`AADSTS700204`…) | Federated credential not registered for the branch/environment; re-run step 3, or push from `main`. |
| `AADSTS700016` | Wrong `AZURE_CLIENT_ID` / `AZURE_TENANT_ID`. |
| `Deployment was not successful` | Check App Service → Deployment Center → logs. Backend: confirm `requirements.txt` installed (Oryx). Frontend: confirm `SCM_DO_BUILD_DURING_DEPLOYMENT=0`. |
| API returns 500 / crash loop | Run Startup Command: check App Service → Configuration. API must be `uvicorn app.main:app --host 0.0.0.0 --port 8000` with `WEBSITES_PORT=8000`. |
| `could not translate host name` | `AZURE_DATABASE_URL` malformed; see required format above. |
| Connection timeout to DB from the runner | Enable `DB_MANAGE_FIREWALL=true` (+ `AZURE_POSTGRES_SERVER`) or allow Azure services through the DB firewall. |
| Missing tables in verify | API never started successfully or app settings missing `DATABASE_URL`. Fix and redeploy. |
| `REFUSING to provision` | You enabled `provision_fresh_database` against a DB that already has tables — that is expected and safe; flip it back to `false`. |
| PR shows failing deploy jobs | Expected — deploy jobs only run on push to `main` or via manual dispatch; PR runs tests only. |

## 7. Rollback

The pipeline deploys immutable zip artifacts, so the quickest rollback is to
re-deploy a previous commit:

1. GitHub → Actions → find the last **green** run you want to restore.
2. Click **Re-run all jobs**.

For a source-controlled rollback: `git revert <bad-sha>` then push to `main` and
let the pipeline redeploy.

For zero-downtime/faster rollbacks, optionally:
- Configure **deployment slots** (staging) on both App Services and swap after verify,
- or enable **Continuous deployment** logging and use **Deployment Center → previous
  deployment → Redeploy**.

**Database rollback / data safety**
- The pipeline never runs `DROP`/`TRUNCATE` and never runs `database/schema.sql`.
- The PostgreSQL database is **not** recreated on deploy; schema changes are
  additive-on-startup only.
- Enable Azure PostgreSQL **point-in-time restore** and/or daily backups (see also
  `backend/scripts/backup.py` ideas) so you can recover independently of code.

## 8. Local pre-flight (same as CI)

Backend:
```bash
cd backend
pip install -r requirements.txt
python -m pytest -q
```

Frontend:
```bash
cd frontend
npm ci
npm run test
npm run build
```