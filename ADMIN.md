# Admin guide

Everything in [GUIDE.md](GUIDE.md) plus the below. Read that one first.

---

## Importing Excel

**Import** in the nav. Nothing is saved until you press the final button.

Every tab is read separately, because tabs rarely share a layout. For each one you set the **district** (the tab name is guessed — `TVM`, `KLM`, `TCH`… are recognised), the region and the sheet type. **Columns** shows how each spreadsheet column was matched, with the first value so you can check it; change anything that looks wrong.

Two modes:

- **One sheet per tab** — each tab becomes its own sheet, named after its district
- **Merge all tabs** — one combined list with a District column

Anything the importer doesn't recognise becomes a new custom column rather than being dropped.

### Duplicates

Optional, and off changes nothing.

**Check for duplicates** is a dry run — it reports how many clash and writes nothing. Expand it to go through them one by one, with differences highlighted.

You choose what a duplicate *is*: the columns that must **all** match. The default is **name + district**, because the same school name in a different district is a different school. And where to look: this sheet only, or the whole database.

Then what to do — settable for the whole batch or per row:

| | |
|---|---|
| **Skip** | Keep what's saved, ignore the file's row |
| **Merge — existing wins** | Fill blanks only; nothing already there changes |
| **Merge — file wins** | The file overwrites where it has a value |
| **Keep both** | They really are two different schools |

Merging never touches status, assignment, follow-up dates or registered students — that's the team's own work, not the file's.

### If it goes wrong

Every import can be **undone** in one click from the Import page. It deletes exactly the rows that import created.

---

## Team

**Add many** takes a pasted list, one per line:

```
Ikram, ikram@tensors.org
amal@tensors.org
```

Passwords are generated and **shown once** — copy them before leaving the page. You can reset anyone's later.

Deactivate rather than delete someone who leaves: their call history stays attributed.

---

## The colour key

Admin-only, because it's the team's shared meaning — and it's also the pipeline the dashboard counts.

Two flags matter when you add a status:
- **Counts as contacted** — feeds "Call pending" on the progress report
- **Counts as a win** — feeds "Confirmed"

Get these right and the reports follow. Deleting a status doesn't delete any school; they just lose that label.

---

## Mail and WhatsApp lists

**Lists** in the nav. Members add schools; you send them.

For each list, **Fields** sets what it takes from every school:

| | |
|---|---|
| **Not used** | Not part of this list |
| **Compulsory** | A school without it is flagged, and members must fill it before adding |
| **Up to the member** | Exported when present, never blocks |

The working loop:

1. **View** — see what's on it, New and Sent separated
2. **Export New** — only schools that haven't had this message
3. Send it
4. **Mark new as sent**

Step 4 is the one that matters. Without it, the next export contains the same schools again.

*Not sent, ready only* leaves out schools still missing a compulsory field. The export names which field each one is missing.

---

## Progress

**Progress** shows every volunteer: assigned, call pending, follow-ups pending, confirmed, schools and students registered. Click any heading to sort, click any number to see the rows behind it.

---

## Moving schools between lists

Members can't change whether a school is Primary or Secondary — that's a targeting decision. Tick rows and use **Move or copy to…**:

- **Move** — relabels the rows where they are
- **Copy** — leaves the originals and puts a second row in another sheet, for a school that genuinely belongs to both

Copy skips anything already there, so running it twice is safe.

---

## What actually destroys data

Each of these asks you to confirm the exact number of rows affected. That's deliberate — it's the only thing standing between a mis-click and lost work.

| | |
|---|---|
| **Delete a column** | Its values are lost for every school |
| **Delete a sheet** | Every school row in it goes too |
| **Undo an import** | Deletes the rows that import created |

Built-in columns can be hidden but never deleted — the district and pipeline figures are calculated from them.

---

## Before you deploy

Change the admin password. The seeded one is in `.env` in plain text — see [README.md](README.md).
