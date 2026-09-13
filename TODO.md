# Backlog

Feedback from Ikram after the first hands-on pass. Working through these in order.
Tick items off as they land.

## 1. Import wizard — per-tab row · ☑ done
- 1.1 District appears twice (as sheet name and as district) and the fields have
  no labels, so "Kerala" / "Mass call list" are unexplained. Label everything;
  drop the duplication.
- 1.2 District should be **type-or-pick** (free text *and* a dropdown).
- Mass call / connected list needs a visible label, not a bare dropdown.

## 2. Duplicates — let the user decide · ☑ done
"Check for duplicates" is a dry run reporting a count, expandable to a
row-by-row review. Four actions, overridable per row: skip / merge with the
saved row winning / merge with the file winning / keep both.

## 3. Assigning work · ☑ done
Tick rows and assign them, or assign the whole filtered list in one action
("all 277 in Thiruvananthapuram"). Assigning a whole list requires a sheet, so
nobody can hand the entire database to one person by accident.

## 5. School type is not editable · ☑ done
(No item 4 in the original list.)

## 6. Finance type / Board — dropdowns · ☑ done
Options: Government, Govt aided, High-class private, Private, + "other" free
text. Point is consistent spelling across the team.

## 7. Contacts — multiple numbers · ☑ done
A school page now has a Numbers panel: add as many numbers as you like, each
with an optional person's name. The main number keeps its own column so
imports and duplicate matching are unchanged, and the grid's Contact cell
shows "9447365106 +2" when there are others.

## 8. Search is broken / no search icon · ☑ done
How do you search within one list?

## 9. Follow-up date picker unreadable in dark mode · ☑ done

## 10. Add row → Connection: drop the "eg: ikram 11th n 12th" placeholder · ☑ done

## 11. Let members add columns (not just admins) · ☑ done
Columns moved out of /admin to /columns, open to everyone. Members can add a
column (text, long text, number, phone, email, date, fixed dropdown, or
dropdown + free text with their own options), rename, reorder and hide, and
can create and rename sheets.

Held back to admins, because each one loses data or resets shared meaning:
deleting a column, deleting a sheet, and editing the colour key. Deleting a
sheet also now requires confirming the exact number of rows it will destroy.
Built-in columns cannot be deleted or retyped; the dashboard is calculated
from them.

## 12. Add row — more columns than exist · ☑ done
Add row now shows every custom column, plus "Need another field?" which
creates one on the spot with the same type choice as item 11. It warns that
the field is new to every school, and offers to fill the existing rows — this
sheet or the whole database. Backfill only touches rows that are blank, so a
value someone already typed is never overwritten.

## 13. Reorder rows in a sheet · ☑ done

**The risk you asked about is real, but only for the naive version.** If the
serial number were stored literally as 1, 2, 3, inserting at position 5 of a
3,000-row sheet would have to rewrite 2,995 rows. With several volunteers
working at once that means long locks and a sheet that stutters.

**The fix: the serial number is not stored at all.** It is just the row's
position in the sorted order, worked out at display time. So "push everything
below down by one" costs nothing — the numbers simply render differently.

What gets stored is a `position` sort key. To drop a row between two others,
give it a value between theirs. That is **one write, whatever the sheet size** —
moving a row in a 3,000-row sheet costs exactly the same as in a 10-row one.

- Typing "move to 7" → look up the rows currently at 6 and 7, take a position
  between them. One write.
- Dragging a block of rows → one write per row actually moved, not per row in
  the sheet.
- Halving the gap repeatedly eventually runs out of precision, so positions get
  renumbered (1000, 2000, 3000…) occasionally in the background. Invisible.

**One honest caveat:** the grid pages at 100 rows, so dragging a row from page 1
to page 12 is not something drag-and-drop can express. The serial-number box
covers exactly that case, which is why both are worth having.

**Cost:** a `position` column plus an index, a backfill of existing rows, and
switching the grid's sort from `createdAt` to `position`.

## 14. Add row — insert at a position · ☑ done

Add row itself works (verified: it saves, warns on a duplicate name in the same
district, and lets you add anyway). Choosing where the new row lands needs the
`position` key from item 13, and then costs one write like any other move.

---

## Questions for Ikram

1. Item 13/14: go ahead with the position-key design above?
2. The colour key is still admin-only. Members can now add columns and sheets —
   should they be able to rename a colour too? (Deleting one would stay admin,
   since it clears that status off every row using it.)
3. Nobody has walked the UI by hand yet. Everything below is verified over HTTP
   and against the database, but a click-through would likely surface small
   things no API test can see.

---

## Notes / decisions
- Rows currently have no explicit order column; the grid sorts by `createdAt`.
  Items 13 and 14 need a real `position` field — see the design note when that
  work starts.

## 15. Personal colour schemes · ☑ done
The shared key stays the team's agreed meaning, admin-owned. On top of it each
person gets a private overlay, reached by "My colours" above any sheet:

- **Recolour a status for yourself.** Give two statuses the same colour because
  for your purposes they are the same thing. One click resets to the team's.
- **Your own marks.** Invent a label the shared statuses don't cover ("call
  after exams") in any colour, tick rows, and apply it from the selection bar.
  It shows as a dot beside the row number.

Nobody else sees any of it, and it never reaches the pipeline figures — the
dashboard still counts the shared statuses. Verified: a member's colour leaves
the team colour untouched, and an admin gets 404 on another person's mark.

---

# Round 3

## 0. Rename the two list types · ☑ done
"Connected school" → **Primary Target sheet**. "Mass call list" → **Secondary
sheet**. Labels only; the stored values stay put.

## 1. Search and filter show no change · ☑ fixed

## 2. Filters behind one button · ☑ done
One button in the first view; clicking it expands the detail, with a final
"Filter" button to apply.

## 3. Mail / WhatsApp campaign lists · ☑ done
Per row: add to "bulk mail list", "special mail list", "WhatsApp msg list".
Admin can tell sent from new, and export each separately to Excel. Admin sets
the required and optional fields per list, and can add new list types from
their portal, reflected in the member view. Member view should auto-fill from
the existing sheet where it can.

## 4. "Check duplicates in the target sheet only" is not working · ☑ fixed

## 5. Import district picker offers only the 14 districts · ☑ done
Add NA, and make free text obvious.

## 6. Column add — copy or merge into the new column · ☑ done
A new column can start as a copy of an existing one, or as two columns merged
with a separator you choose. A row with only one of the two values gets just
that value, with no separator left dangling.

## 7. Changing a sheet's type belongs to admin only · ☑ done
Remove list-type editing from the member grid. In admin, offer either keeping
the rows in both this sheet and the Primary Target sheet, or moving them
entirely. Same options for every sheet type.

## 8. Sheet navigation · ☑ done (as views, nothing duplicated)
```
Sheets by district & region
  Primary Target sheet   → full list + per-district sheets (if uploaded)
  Secondary sheet        → per-district sheets
Sheets by assigned person
  <member>
    Combined sheet       (site-generated, not admin-made)
    Primary Target sheet → one combined list (few rows, no point splitting)
    Secondary sheet      → per-district sheets + combined (site-generated)
```

## 9. Member progress report (admin) · ☑ done
One table at /admin/progress: assigned, call pending, follow-up pending, total
pending, confirmed, schools registered, students registered. Every column sorts
both ways, every number links to the rows behind it, and the last row totals
the team.

Counts come from the colour key's own flags (isContacted, isPositive) rather
than hardcoded status names, so renaming or adding a status keeps the report
right. One grouped SQL query, not a few per member.

---

# Round 4

## 1. Campaign fields: two clear options, and a view · ☑ done
The cycling button is gone. Every column now has an outright choice per list:
**Not used**, **Compulsory**, or **Up to the member**. Compulsory means a school
without it is flagged as not ready and left out of the ready-only export;
up-to-the-member is exported when present and never blocks.

Each list also has its own page now (View), listing what is on it with New and
Sent told apart, filter tabs, and per-row mark-sent / put-back / remove.

## 2. Reorder columns in the sheet view · ☑ done
Drag a column heading, or use the arrows in the Columns panel. Show/hide and
order are saved per user, so one volunteer rearranging their grid does not move
anyone else's. "Reset to default" goes back to the shared layout.

## 3. Adding to a list asks for the missing fields first · ☑ done
Picking "Add to <list>" now opens a dialog instead of firing straight away. It
shows exactly which columns reach the admin's sheet (compulsory marked *),
fills them in from the sheet, and lists any school still missing something
compulsory with a box to type it.

The Add button stays disabled until every gap is closed, and the server refuses
an incomplete batch too - so nothing half-usable can reach an export even from
a stale page. What gets typed is saved onto the school itself, so the next list
does not ask for it again.
