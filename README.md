# Tensors — Junior Olympiad Outreach Dashboard

School outreach tracking for the Tensors Junior Olympiad. Replaces the shared Excel
sheets: one link, district-wise progress across Kerala and Tamil Nadu, a worked call
list, and a logged history of every call.

## Running it

```bash
npm install
cp .env.example .env      # then set DATABASE_URL and JWT_SECRET
npx prisma migrate deploy
npm run db:seed           # creates the first admin + the colour legend
npm run dev
```

Open http://localhost:3000 and sign in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD`
from `.env`. **Change that password immediately after the first login.**

### Database

Any PostgreSQL will do — set one `DATABASE_URL`. Local Postgres, `docker compose up -d db`
(a Postgres service is included), or a free Neon/Supabase instance when you deploy.
Nothing else in the app assumes a host, so moving it later is a connection-string change.

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
- **what to do** — skip, fill blanks on the existing row, or import anyway.

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
