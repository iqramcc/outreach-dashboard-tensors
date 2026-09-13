# Tensors — Junior Olympiad Outreach Dashboard

School outreach tracking for the Tensors Junior Olympiad. Replaces the shared Excel
sheets: one link, district-wise progress across Kerala and Tamil Nadu, a worked call
list, and a logged history of every call.

**Using it:** [GUIDE.md](GUIDE.md) for the team, [ADMIN.md](ADMIN.md) for admins.
**Working on it:** [ARCHITECTURE.md](ARCHITECTURE.md) explains why the code is shaped the way it is.

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

## Where things are

```
src/lib/           auth, db, columns, regions, normalize
src/lib/excel/     parse · map · import · plan
src/app/(app)/     dashboard · sheets · schools · import · admin
src/app/api/       REST handlers, each behind apiUser/apiAdmin
src/proxy.ts       cookie check (this Next version renamed middleware to proxy)
prisma/            schema and migrations
```

## Before you change anything

Read [ARCHITECTURE.md](ARCHITECTURE.md). It covers how the data is shaped, how
the Excel importer copes with the team's real files, what is shared versus what
is per-user, and the handful of gotchas that have already caused bugs here.

Two that matter immediately:

- This Next.js version differs from most references. Read
  `node_modules/next/dist/docs/` before writing route or layout code — see
  `AGENTS.md`. `params`, `searchParams`, `cookies()` and `headers()` are async.
- `sample excel/` holds real school contact details and is gitignored. Keep it
  that way.
