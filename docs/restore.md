# Database backup and restore

Production data lives in the Neon project **ziyarn**
(`young-wind-63202296`), on the default branch `production`
(`br-fancy-haze-ag2riwju`).

There are two recovery mechanisms:

| Mechanism | Cadence | Retention | Use it for |
|---|---|---|---|
| Neon point-in-time restore | Continuous | **6 hours** | Bad deploy, accidental delete, or bad migration caught quickly |
| Weekly dump artifact | Mondays 03:00 UTC | **14 days** | Recovery beyond the Neon history window |

The Neon project record reports `history_retention_seconds: 21600` (6 hours).
This was verified on 2026-10-22 on the free plan. Do not assume a longer window;
if an incident is older than six hours, use the latest weekly dump.

The weekly dump is produced by `.github/workflows/backup.yml`. It runs
`scripts/backup-db.sh`, validates the archive with `pg_restore --list`, and
uploads `backups/ziyarn-<timestamp>.dump` as a private GitHub Actions artifact
with 14-day retention. Repository access controls who can download it.

## One-time GitHub setup

Add a repository secret named `DATABASE_URL`:

1. GitHub repository → **Settings** → **Secrets and variables** → **Actions**.
2. **New repository secret**.
3. Name: `DATABASE_URL`.
4. Value: the production Neon connection string, including `sslmode=require`.

The workflow fails with a clear error if the secret is missing. Run it once from
**Actions** → **Database backup** → **Run workflow** to confirm it can create and
upload an artifact.

## Create a backup manually

Use the PostgreSQL 18 client. An older `pg_dump` refuses a PostgreSQL 18 server.

```sh
pg_dump --version   # must report 18.x

export DATABASE_URL='postgresql://...'
scripts/backup-db.sh
ls -lh backups/
```

The script writes a compressed custom-format dump with no owner or privilege
statements, sets mode `600`, and deletes a partial file if any step fails.
`backups/` and `*.dump` are ignored by git. Never commit, email, or attach a dump
to a public issue.

## Restore drill

Do this into a **new Neon branch**, never into `production`.

### 1. Download and inspect the artifact

Open the latest successful **Database backup** run, download the
`neon-backup-<run-id>` artifact, and unzip it. Validate the archive:

```sh
pg_restore --list ziyarn-YYYYMMDDTHHMMSSZ.dump | head
```

For an exact count comparison, create a fresh dump with `scripts/backup-db.sh`
instead of using a weekly artifact. A weekly artifact will contain older data.

### 2. Create a restore branch

In the Neon console:

1. Open project **ziyarn** → **Branches**.
2. **New Branch**.
3. Parent: `production`.
4. Name: `restore-drill-YYYY-MM-DD`.
5. Wait for the branch to become ready.
6. Copy the **direct** connection string for the `neondb` database on the **new
   branch** (the host without `-pooler`). Do not copy the production connection
   string.

Use the direct host for `pg_restore` and `psql`. The pooled hostname is intended
for application traffic; on a fresh branch compute it can route inconsistently
after the compute resumes. The 2026-10-22 drill hit intermittent `relation ...
does not exist` errors through the pooler and passed consistently through the
direct host.

### 3. Restore the dump

```sh
export RESTORE_DATABASE_URL='postgresql://...'
export DATABASE_URL='postgresql://...'   # optional, for the guard below

if [ "${RESTORE_DATABASE_URL}" = "${DATABASE_URL:-}" ]; then
  echo 'Refusing to restore into the source database.' >&2
  exit 1
fi

pg_restore \
  --clean \
  --if-exists \
  --exit-on-error \
  --no-owner \
  --no-privileges \
  --dbname "$RESTORE_DATABASE_URL" \
  ziyarn-YYYYMMDDTHHMMSSZ.dump
```

`--clean` drops objects in the target branch before recreating them. That is
why the target must be a disposable branch, not production.

### 4. Verify row counts

Run the same query against the source and the restore branch:

```sh
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f scripts/check-restore-counts.sql
psql -v ON_ERROR_STOP=1 "$RESTORE_DATABASE_URL" -f scripts/check-restore-counts.sql
```

`scripts/check-restore-counts.sql` covers `agents`, `campaigns`,
`conversations`, `domains`, `leads`, `messages`, `payments`, `subscriptions`,
`user` (Better Auth accounts), and `users` (app profiles). Counts must match
when restoring a fresh dump. With a weekly artifact, stable tables should match
and append-only tables may have legitimately newer rows in production.

For a stronger check, compare every public table:

```sh
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -t -A -c "
select table_name,
       (xpath('/row/cnt/text()',
              query_to_xml(format('select count(*) as cnt from %I.%I',
                                  table_schema, table_name),
                           false, true, '')))[1]::text::bigint
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by table_name;"
```

Run the same query against `$RESTORE_DATABASE_URL` and diff the output. Also
confirm the schema is present:

```sh
psql "$RESTORE_DATABASE_URL" -c '\dt'
psql "$RESTORE_DATABASE_URL" -c 'select count(*) from rate_limit_windows;'
```

### 5. Clean up

In the Neon console, delete the `restore-drill-...` branch after recording the
result. Do not delete `production`. Remove the local dump when finished.

## Point-in-time restore

If the incident is within the last six hours:

1. In Neon, create a branch from `production` at a timestamp before the incident
   (the console's branch-from-history flow).
2. Run the count checks and inspect the affected records.
3. Repoint the application's `DATABASE_URL` to the verified branch, or promote
   the branch through Neon's restore flow.
4. Redeploy or restart so serverless functions pick up the new connection.
5. Keep the old branch until the recovery is confirmed, then delete it.

Never point the application at an unverified branch or restore over
`production` in place.

## Incident checklist

1. Stop writes if the damage is ongoing (maintenance page or pause traffic).
2. Decide: PITR (within six hours) or weekly dump (older).
3. Restore into a new branch.
4. Compare core row counts and spot-check recent records.
5. Switch `DATABASE_URL`, redeploy, and check `/api/health`.
6. Watch Sentry and the uptime monitor.
7. Record what happened and update this runbook.

## Drill log

| Date | Backup | Target | Result | Notes |
|---|---|---|---|---|
| 2026-10-22 | Fresh dump, 223,671 bytes, validated with `pg_restore --list` | `restore-drill-2026-10-22` (`br-rapid-lake-agawz51l`) | Passed | All 38 public table counts match production; core counts: agents 5, campaigns 2, conversations 5, domains 5, leads 0, messages 46, payments 2, subscriptions 2, `user` 16, `users` 0. Use the direct (non-pooler) host for admin commands. Drill branch deleted after review. |

### Verified drill (2026-10-22)

- Fresh dump: `backups/ziyarn-20261022T124040Z.dump`, 223,671 bytes.
- Restore command: `pg_restore --clean --if-exists --exit-on-error --no-owner
  --no-privileges`; exit status 0 with no error output.
- Restore branch: `restore-drill-2026-10-22` (`br-rapid-lake-agawz51l`), created
  from `production`.
- Verification: `scripts/check-restore-counts.sql` matched exactly, and all 38
  public tables matched row-for-row.
- Caveat: the branch's pooled connection string intermittently returned
  `relation "agents" does not exist` after compute resume. The direct host
  worked consistently.
- Cleanup: the local dump was removed after verification and the
  `restore-drill-2026-10-22` branch was deleted. The first manual run of the
  weekly workflow succeeded on 2026-10-22; its artifacts remain available for
  14 days.
