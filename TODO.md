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

## 13. Reorder rows in a sheet · ☐ — design ready, awaiting the go-ahead

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

## 14. Add row — insert at a position · ☐ — depends on 13

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
