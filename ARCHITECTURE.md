# How this is built

For whoever works on this next. The setup steps are in [README.md](README.md);
this is the reasoning behind the shape of the code, so the decisions that look
odd aren't undone by accident.

---

## The stack, briefly

Next.js (App Router) · TypeScript · Prisma · PostgreSQL · Tailwind.

> **Read `node_modules/next/dist/docs/` before touching routes or layouts.**
> This Next.js version differs from most tutorials and from what LLMs assume.
> `params`, `searchParams`, `cookies()` and `headers()` are all **async**, and
> `middleware.ts` is now **`proxy.ts`**. See `AGENTS.md`.

---

## Data model

### Sheets are containers; the fields that matter are columns

A `School` belongs to exactly one `Sheet` — the team's Excel-tab mental model.
But region, district, list type and status are **real indexed columns on the
row**, not properties of the sheet.

That's what lets the team work tab-by-tab while the dashboard still asks "all of
Kerala, every sheet, grouped by district". Don't move these onto `Sheet`.

### Core columns + `extra`

A fixed set of fields (`src/lib/columns.ts` → `CORE_COLUMNS`) powers filters and
analytics. Everything else — anything an uploaded file contains, anything the
team invents — lives in the `School.extra` JSON blob, described by a
`ColumnDef` row.

Built-in columns can be hidden and renamed but never deleted or retyped: the
district and pipeline figures are computed from them.

### The colour key *is* the pipeline

`OutreachStatus` is one table doing both jobs on purpose. It drives the row
colours, the legend above each sheet, and the dashboard funnel — so the three
can't disagree.

Reports key off its **flags** (`isContacted`, `isPositive`), never off status
names. Renaming "Interested" must not break the progress report.

### Row order is a float, and the serial number isn't stored

`School.position` is a float. Dropping a row between two others takes a value
between theirs — **one write regardless of sheet size**. A literal 1,2,3
numbering would rewrite every row below an insert (thousands, on a real sheet).

The number the team sees is just the row's place in that order, rendered. So
"everything below moves down by one" costs nothing.

Splitting the same gap repeatedly exhausts float precision, so
`/api/schools/reorder` renumbers the sheet (1000, 2000, 3000…) in one statement
and retries. Verified to hold over 60 consecutive inserts at the same position.

---

## Duplicate detection

`nameKey` and `contactKey` are normalised, indexed copies of the name and phone
(`src/lib/normalize.ts`). Checking a 3,000-row import is **one indexed query for
the whole file**, not one per row — keep it that way.

What counts as a duplicate is the user's choice: a set of columns that must all
match, defaulting to **name + district**, because the same school name in a
different district is a different school.

`compositeKey()` joins on a NUL character, written as `'\u0000'`. Unlike a
space it can't make `["a b", "c"]` and `["a", "b c"]` collide. Don't paste a
literal NUL into the source — git then treats the file as binary.

---

## The Excel importer

Built around the team's real workbooks, not idealised ones. `src/lib/excel/`:

| | |
|---|---|
| `parse.ts` | Reading the file at all |
| `map.ts` | Guessing which column is what |
| `import.ts` | Duplicates, merging, the actual insert |
| `plan.ts` | Shared by the preview and the real import, so they can't disagree |

Things `parse.ts` exists to survive, all from real files:

- every tab has a different layout, so **mapping is per tab**
- headers on row 1, row 2, or duplicated across both
- school names stored as rich text *inside* a hyperlink object — naive reads
  give `[object Object]` or a `sametham.kite.kerala.gov.in` URL
- a tab reporting 4 columns but carrying stray formatting out to column 26
- blank and serial-number leading columns; entirely empty tabs

Tab names resolve to districts via `matchDistrict()`. Aliases are checked
**before** substring matching, and substrings need 4+ characters — otherwise
`ALP` matches the "alp" inside "cheng**alp**attu".

---

## Views vs sheets

`/sheets/[id]` is a stored sheet. `/sheets/view?...` is a **filter rendered as a
sheet** — "everything assigned to Amal", "every primary target".

Views copy nothing, so reassigning a school moves it between them instantly.
They have no sheet of their own, so adding rows and reordering are switched off
(`virtual` prop on `SheetView`).

---

## What's shared and what's per user

Easy to conflate, and getting it wrong is visible to everyone:

| Per user | Shared |
|---|---|
| `ColumnPref` — visible columns, order | `ColumnDef` — the columns themselves |
| `UserStatusColor` — personal status colours | `OutreachStatus` — the colour key |
| `PersonalTag` — private marks | Everything on `School` |

Every personal route is scoped to the **caller**, not gated by role — an admin
gets a 404 on someone else's mark rather than being able to edit it.

---

## Campaign lists

Members add schools; admins export, send, and mark as sent. `status` on
`CampaignEntry` is what keeps the next export from mailing the same school
twice.

**Values are resolved at export time, not copied when the school was added.**
Correct a school's email and every list it sits on exports the new one. A list
must never become a stale snapshot.

`CampaignEntry.note` is a per-send comment. That's why `comment` / `comments`
are reserved column names — a school column of that name would sit beside it
meaning something different.

---

## Auth

JWT in an httpOnly cookie; `src/lib/auth.ts`.

`proxy.ts` only checks that a cookie **exists**, so signed-out visitors bounce
to `/login`. It is not a security boundary — it runs outside the render path.
Real checks are `requireUser` / `requireAdmin` in pages and `apiUser` /
`apiAdmin` in routes.

`getSession()` re-reads the user every time, so deactivating someone locks them
out immediately rather than whenever their token expires.

**Never rely on hiding a control in the UI.** Every restriction is enforced
server-side too — that's what the role tests check.

---

## Destructive actions

Deleting a column or a sheet, and undoing an import, all require the caller to
send back the **exact number of rows affected**, which they can only know by
asking first. A mis-click or a stale page can't destroy data.

Keep this pattern for anything new that loses data.

---

## Gotchas worth knowing

- **jsonb `?` operator** collides with the driver's parameter placeholders. Use
  `COALESCE(extra ->> $1, '') <> ''` instead of `extra ? $1`.
- **Postgres can't infer parameter types** inside `jsonb_build_object` or
  `concat_ws` — cast explicitly (`${key}::text`) or the statement fails.
- **Column names interpolated as SQL identifiers** (parameters can't be
  identifiers) must come from a whitelist. See `READABLE_CORE` in
  `api/columns/[id]/derive`.
- **`useState(props)` doesn't resync.** Filtering navigates and the server
  returns new rows as props; without an explicit sync the grid keeps showing
  its first page. This bug shipped once — don't reintroduce it.
- **iOS zooms in** on any focused input under 16px and doesn't zoom back. Touch
  styles are keyed on `pointer: coarse`, not screen width.
- **`vh` on mobile** includes area hidden behind browser chrome. Use `dvh`.
- **HTML5 drag doesn't fire on touch at all.** Row and column reordering both
  keep a non-drag path (typing the row number; the arrows in the Columns panel).

---

## Checking your work

```bash
npx tsc --noEmit    # types
npx eslint src      # lint
npm run build       # the real gate
```

There are no automated tests. Changes have been verified by driving the running
app over HTTP and checking the database directly — worth doing for anything
touching imports, duplicates or permissions.
