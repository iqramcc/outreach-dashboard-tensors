# Tensors — Junior Olympiad Outreach Dashboard

School outreach tracking for the Tensors Junior Olympiad. Replaces the shared Excel
sheets: one link, district-wise progress across Kerala and Tamil Nadu, a worked call
list, and a logged history of every call.

**Using it:** [GUIDE.md](GUIDE.md) for the team, [ADMIN.md](ADMIN.md) for admins.

## Running it

> Already set up on a machine? Just `npm run dev`. The steps below are for a
> fresh clone or a new server.

**1. Install the dependencies**

```bash
npm install
```

**2. Create your settings file**

The app reads its settings from a file called `.env`. That file is deliberately
kept out of git, because it holds passwords — so a fresh clone doesn't have one.
`.env.example` is the same file with fake values, and is safe to copy from:

```bash
cp .env.example .env          # Git Bash / Mac / Linux
copy .env.example .env        # Windows Command Prompt
Copy-Item .env.example .env   # Windows PowerShell
```

Now open `.env` in any text editor. Four things matter:

| Setting | What to put |
|---|---|
| `DATABASE_URL` | Where your PostgreSQL is — see below |
| `JWT_SECRET` | Any long random string. Generate one with the command below |
| `ADMIN_EMAIL` | The first admin's login |
| `ADMIN_PASSWORD` | Their password. Change it after the first login |

Generate a secret (works anywhere Node is installed):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Paste the output between the quotes on the `JWT_SECRET` line. It only signs login
cookies — nobody has to remember it — but changing it later signs everyone out.

**3. Set up the database**

```bash
npx prisma migrate deploy   # creates the tables
npm run db:seed             # creates the first admin, colour key and mail lists
```

**4. Start it**

```bash
npm run dev
```

Open http://localhost:3000 and sign in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD`
from your `.env`. **Change that password immediately after the first login.**

### DATABASE_URL

The shape is:

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE_NAME?schema=public
```

Any PostgreSQL works. On a machine with Postgres installed locally, create the
database once:

```sql
CREATE DATABASE olympiad;
CREATE USER olympiad WITH PASSWORD 'olympiad';
GRANT ALL PRIVILEGES ON DATABASE olympiad TO olympiad;
\c olympiad
GRANT ALL ON SCHEMA public TO olympiad;
ALTER SCHEMA public OWNER TO olympiad;
```

...which matches the `DATABASE_URL` already in `.env.example`. `docker compose up -d db`
starts an equivalent one if you'd rather not install Postgres, and a hosted
Neon or Supabase database gives you a URL to paste in when you deploy.

Nothing else in the app assumes a host, so moving it later is a
connection-string change and nothing more.

## Roles

- **ADMIN** — everything, plus imports, the colour legend, columns, and the team list.
- **MEMBER** — view every sheet, edit rows, log calls, export. Cannot import, change
  the schema or legend, manage users, or delete rows.

Role checks run on the server (`requireAdmin` / `apiAdmin`), not just in the UI.

Add the team from **Admin → Team → Add many**: paste `Name, email` one per line and it
generates a password for each person, shown once.

## How the data is shaped

Two ideas keep it flexible instead of hardcoded:

**Sheets are containers; the fields that matter are global.** Every school row lives in
one `Sheet` — the team's Excel-tab mental model — but region, district, list type and
status are real indexed columns, not sheet properties. So the team works tab by tab and
the dashboard can still ask "all of Kerala, every sheet, by district".

**Core columns + custom columns.** A fixed set of fields powers the filters and
analytics. Anything else an uploaded file contains becomes a custom column stored in
`School.extra`. Admins can rename, reorder, hide or add columns without a migration.
Built-in columns can be hidden but not deleted — the district and pipeline figures are
calculated from them.

**The colour legend is the status list.** One table (`OutreachStatus`) drives the row
colours, the legend pinned above each sheet, and the dashboard funnel, so the three can
never disagree. Admins edit it inline via *Edit key*.

## Importing Excel

`/import`, admins only. Nothing is written until you confirm, and every import is
recorded so it can be undone in one click.

The parser is built around the team's real workbooks, where every tab has a different
layout: headers on row 1 or row 2 (or duplicated across both), leading blank/serial
columns, school names stored as rich-text hyperlink objects, phantom columns out to
column 26, and empty tabs. It detects the header row per tab and maps columns per tab.

Tab names resolve to districts automatically — `TVM`, `KLM`, `PAT`, `ALP`, `KTM`, `EKM`,
`IDK`, `THR`, `KZH`, `KNR`, `MLP`, `KSG`, `WAY`, `PKD`, and `TCH` → Chennai.

Two modes:
- **One sheet per tab** — each tab becomes its own sheet, district filled from the tab name.
- **Merge all tabs into one sheet** — one combined list with a District column.

### Duplicate checking

Optional, and off changes nothing. When on you choose:

- **which columns must all match** — default **school name + district**, because the same
  school name in a different district is a different school;
- **scope** — the target sheet only, or the whole database;
- **what to do** — skip, merge with the saved row winning, merge with the file winning, or
  keep both. Settable for the batch or per row after reviewing them.

Merging only touches columns that come from the spreadsheet: status, assignment,
follow-up date and registered students are the team's working state and are never
overwritten by a file.

It costs one indexed query per file, not one per row: a 2,600-row workbook re-checks in
well under a second.

## Layout

```
src/lib/           auth, db, columns, regions, normalize
src/lib/excel/     parse (header detection, rich-text cells) · map · import (dedupe)
src/app/(app)/     dashboard · sheets · schools · import · admin
src/app/api/       REST handlers, each behind apiUser/apiAdmin
src/proxy.ts       cookie presence check (Next 16 renamed middleware → proxy)
```

## Notes for whoever works on this next

- This Next.js version has breaking changes from what most references assume. Read
  `node_modules/next/dist/docs/` before writing route or layout code — see `AGENTS.md`.
- `params`, `searchParams`, `cookies()` and `headers()` are all async.
- `sample excel/` holds real school contact details and is gitignored. Keep it that way.
