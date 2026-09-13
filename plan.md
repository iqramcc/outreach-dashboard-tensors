Tensors — Junior Olympiad Outreach Dashboard

Context

Tensors is a student-run NGO running an exam called the Junior Olympiad. Outreach is currently
tracked in Excel sheets, which makes it impossible to answer basic questions: how many Kerala
districts have we covered, which schools need a follow-up call today, who spoke to whom, and how
many students each school actually registered.

This project builds a minimal shared web dashboard that replaces those sheets while keeping the
spreadsheet feel the team is used to — including uploading their existing Excel files, adding rows
by hand, and marking rows with colours.

Target outcome: the outreach team opens one link, sees district-wise progress across Kerala and
Tamil Nadu, works a call list, and logs every call — with no one touching a shared Excel file again.

Decisions already made with the user

┌────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────┐
│    Decision    │                                              Choice                                               │
├────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Deployment     │ Build deploy-agnostic — runs locally now, ships to Vercel or the existing VPS later               │
├────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Users          │ Per-volunteer accounts, two roles: ADMIN and MEMBER                                               │
├────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Scope          │ Phase 1 = schools + outreach. Phase 2 = students. Phase 3 = results                               │
├────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Students       │ Entered manually by the team (no public form)                                                     │
├────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Outreach       │ Full call history per school, not just a current status                                           │
├────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Excel tabs     │ Both modes offered at import: tab-per-sheet, or merge-all-tabs into one sheet with a District     │
│                │ column                                                                                            │
├────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Duplicate      │ Included, on user-chosen columns — confirmed cheap (indexed lookup, one batched query per import) │
│ check          │                                                                                                   │
└────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────┘

---

Stack

Matches jan-seva-portal so the deploy playbook and conventions carry over:

- Next.js (latest, App Router) + TypeScript
- Tailwind CSS v4 — white/green and black/green themes via CSS variables
- Prisma + PostgreSQL — one DATABASE_URL, so local Docker today and Neon/Supabase/VPS later
- Auth: jsonwebtoken + bcryptjs, httpOnly cookie (same pattern as jan-seva-portal — not NextAuth)
- exceljs for Excel import/export, zod for validation, recharts for charts,
  lucide-react for icons
- No table library — a custom server-paginated table keeps it minimal and makes inline edit simple

▎ ⚠️ Carry jan-seva-portal/AGENTS.md forward into this project's CLAUDE.md: this Next.js version
▎ has breaking changes. Read node_modules/next/dist/docs/ before writing route/layout code.

Local database: docker compose up -d db (Postgres service in docker-compose.yml), or paste any
Postgres connection string into .env. Nothing else in the app assumes a host.

---

Core design idea

Two ideas make this flexible instead of hardcoded:

1. Sheets are containers; canonical fields are global.
Every school row lives in exactly one Sheet (the equivalent of an Excel tab — "Malappuram",
"Connected Schools", "Chennai"). But the fields that drive the dashboard — region, district, list
type, status — live as real indexed columns on the row, not inside the sheet. So the team keeps
their tab-based mental model and we can still ask "all of Kerala, every sheet, grouped by
district."

2. Core columns + custom columns.
A fixed set of canonical fields powers filtering and analytics. Anything else an Excel file contains
becomes a custom column stored in a extra JSON blob. Admins can rename any column's label,
reorder, hide, or add new ones — without a code change or migration.

---

Data model (prisma/schema.prisma)

prisma
User          id, name, email @unique, passwordHash, role(ADMIN|MEMBER), isActive, createdAt
Sheet         id, name, description, order, isArchived, createdById, createdAt
School        id, sheetId, name, nameKey @index, entityType(SCHOOL|TUITION_CENTRE|OTHER),
              schoolType,            // free text: CBSE / State / ICSE / International
              regionCategory(KERALA|TAMIL_NADU|MIDDLE_EAST|OTHER_STATE) @index,
              district @index,       // Kerala district / TN district / ME country / state name
              listType(MASS_CALL|CONNECTED|OFFLINE_OUTREACH) @index,
              connection,            // "Ikram's school", "friend of X"
              pocName, pocRole, contact, email,
              statusId -> OutreachStatus,   // drives row colour + funnel
              assignedToId -> User,
              nextFollowUpAt @index,
              registeredStudents Int?,      // manual in Phase 1, derived in Phase 2
              remarks,
              extra Json,            // custom columns
              cellColors Json,       // { columnKey: hex } ad-hoc highlights
              importBatchId -> ImportBatch?,
              createdById, createdAt, updatedAt
OutreachStatus  id, name, hex, order, isPositive, isDefault   // the colour legend itself
ColumnDef     id, key, label, type(TEXT|LONGTEXT|NUMBER|PHONE|EMAIL|SELECT|DATE|CHECKBOX),
              options Json?, isCore, sheetId?, order, isVisible, isRequired
OutreachLog   id, schoolId, userId, channel(CALL|WHATSAPP|EMAIL|VISIT|OTHER),
              outcome, note, nextFollowUpAt, createdAt @index
ImportBatch   id, filename, mode, createdById, rowsCreated, rowsUpdated, rowsSkipped, createdAt

Why OutreachStatus is one table, not two: the user wants colour codes and a legend labelling
what each colour means at the top of the sheet. That legend is the status list. Making them one
thing means the funnel chart, the row colour, and the legend can never drift out of sync. Admins
edit names and hex values inline in the legend. Ad-hoc per-cell highlighting stays separate in
cellColors so it can't corrupt the funnel.

nameKey is name lowercased, punctuation stripped, whitespace collapsed — indexed, and the
basis of duplicate detection.

---

Files to build

prisma/schema.prisma            model above
prisma/seed.ts                  admin user, default statuses, core ColumnDefs, district lists
src/lib/auth.ts                 hashPassword, verifyPassword, signToken, getSession, requireAdmin
src/lib/db.ts                   Prisma singleton
src/lib/regions.ts              KERALA_DISTRICTS(14), TN_DISTRICTS(Chennai first), GULF_COUNTRIES
src/lib/normalize.ts            toNameKey(), phone normalisation
src/lib/columns.ts              merge core ColumnDefs + custom into one render/validate schema
src/lib/excel/parse.ts          exceljs -> { tabs: [{name, headers, rows}] }
src/lib/excel/map.ts            fuzzy header -> core field guesser
src/lib/excel/import.ts         dedupe + transactional insert + ImportBatch
src/lib/excel/export.ts         current filtered view -> .xlsx

src/app/(auth)/login/page.tsx
src/app/(app)/layout.tsx        nav + theme toggle + role gating
src/app/(app)/page.tsx          dashboard
src/app/(app)/sheets/[id]/page.tsx   the spreadsheet view
src/app/(app)/schools/[id]/page.tsx  detail drawer/page + call log
src/app/(app)/import/page.tsx        4-step import wizard
src/app/(app)/admin/{users,columns,statuses}/page.tsx
src/app/api/...                 REST handlers behind requireSession/requireAdmin
src/components/{DataTable,Legend,Filters,ThemeToggle,StatusPill,LogCallDialog}.tsx

---

Feature detail

The sheet view (the piece that must feel like Excel)

- Server-paginated table, 100 rows/page, all filters driven by URL search params so views are shareable
- Filters: region, district, list type, status, assigned volunteer, follow-up due, free-text search
- Inline cell edit — click, type, blur saves (optimistic, with a toast on failure)
- Colour legend pinned at the top, editable by admins: swatch + label, click a swatch to filter
- Row colour comes from status; right-click a cell for an ad-hoc highlight
- "Add row" inline at the bottom; "Add row to another sheet" from the same dialog
- Column show/hide/reorder, persisted per user
- Export current filtered view to Excel

Import wizard (/import)

1. Upload .xlsx/.xls/.csv → shows every tab with its row count
2. Mode →
   - Tab per sheet: each tab becomes a Sheet; tab name pre-fills District for its rows
   - Merge all: one target sheet (new or existing); tab name fills the District column
     Region category and list type are set per tab, defaulted and editable.
3. Map columns → each spreadsheet header maps to a core field / existing custom column / new
   custom column / ignore. Auto-guessed ("Mail"→email, "Contact No"→contact, "Remarks"→remarks).
4. Duplicate check → choose match columns (default school name; optionally contact or email).
   Reports both in-file duplicates and clashes with existing rows; per-row choice of
   skip / update existing / import anyway, with a "apply to all" shortcut.
5. Preview + confirm → transactional insert, recorded as an ImportBatch so a bad import can be
   undone in one click.

Latency note: dedupe is one WHERE nameKey IN (...) query against an indexed column for the whole
file — not per row. A 3,000-row file resolves in well under a second.

Call logging

Every status change opens a quick log dialog (channel, outcome, note, next follow-up date) —
prefilled and dismissible, so it never blocks fast work. The school page shows the full timeline.
nextFollowUpAt powers the dashboard's "due today / overdue" queue.

Dashboard (/)

- KPI tiles: total schools, contacted, interested, confirmed, students registered
- Funnel bar across statuses
- Kerala district table: schools / contacted % / confirmed / students, sortable, click to filter
- Same breakdown for Tamil Nadu (Chennai pinned first), Middle East, Other State
- Mass-call vs connected-school split
- Volunteer leaderboard, and a follow-ups-due queue

Theme

White+green and black+green, toggled in the nav, persisted in localStorage with a no-flash inline
script. One token set — --bg / --surface / --border / --text / --muted / --accent — defined on
:root and overridden under [data-theme="dark"]. Green is the only accent; status colours come
from the database.

Roles

- ADMIN — everything, plus manage users, edit columns, edit the colour legend, import, delete
  sheets, undo imports
- MEMBER — view all sheets, add and edit rows, log calls, export. Cannot change schema, legend,
  users, or delete.

Seed creates one admin from .env (ADMIN_EMAIL / ADMIN_PASSWORD); the admin invites the rest
from /admin/users.

---

Build order

1. Scaffold Next.js + Tailwind + Prisma + docker-compose Postgres; theme tokens; CLAUDE.md
2. Schema + seed (statuses, core columns, districts, admin user)
3. Auth: login, session cookie, middleware, role guards, /admin/users
4. Sheet view: table, filters, pagination, inline edit, add row
5. Colour legend + status editing + ad-hoc highlights
6. Import wizard (all 5 steps) + Excel export + import undo
7. Call logging + school detail timeline + follow-up queue
8. Dashboard charts and district breakdowns
9. Admin column manager (rename / reorder / hide / add custom)

Phase 2 (after the team is live): Student model, per-school manual entry + student Excel upload,
registeredStudents becomes derived. Phase 3: marks, ranks, district leaderboards.

---

Verification

Run npm run dev and check end to end:

1. npm run db:setup seeds cleanly; logging in as the seeded admin works; a MEMBER account cannot
   open /admin/* (blocked server-side, not just hidden in the UI)
2. Import a real Tensors Excel file both ways — tab-per-sheet and merge-all — and confirm
   district is filled correctly from tab names in each
3. Re-import the same file: every row must be flagged as a duplicate, and skip must leave the
   count unchanged. Then undo an import and confirm the rows disappear
4. Import a deliberately messy file (extra columns, blank rows, merged headers) — extra columns must
   land as custom columns rather than erroring
5. Seed ~3,000 rows and confirm sheet paging, filtering and district aggregation stay responsive
6. Edit a colour label in the legend and confirm rows, funnel and legend all update together
7. Log a call with a follow-up date and confirm the school appears in the dashboard's due queue
8. Toggle white/green ↔ black/green on every page, reload, and confirm no flash and no unreadable
   contrast
9. Open a sheet on a phone-width screen — filters and table must stay usable