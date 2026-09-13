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

## 7. Contacts — multiple numbers · ☐
Allow more than one number, each with an optional contact-person name. Imported
values stay as they are; the choice appears when editing.

## 8. Search is broken / no search icon · ☑ done
How do you search within one list?

## 9. Follow-up date picker unreadable in dark mode · ☑ done

## 10. Add row → Connection: drop the "eg: ikram 11th n 12th" placeholder · ☑ done

## 11. Let members add columns (not just admins) · ☐
Field types: text, dropdown with preset options, or dropdown + free text.
Goal: the team never has to come back to us for a simple column change.
**Constraint:** members must not be able to do anything that could destroy the
database. Ask Ikram if unsure where to draw the line.

## 12. Add row — more columns than exist · ☐
Allow adding a value for a column that doesn't exist yet. Warn that it isn't in
the current list, offer to backfill a chosen value onto all existing rows, and
offer the same field-type choice as item 11.

## 13. Reorder rows in a sheet · ☐
Drag to reorder, and a serial-number box (typing a number moves the row there
and pushes everything below down by one). Multi-row select like Excel.
**Open question:** is this risky for the DB at 3,000 rows? Find a safe design.

## 14. Add row — insert at a position · ☐
Check the add-row flow works, and allow choosing the index the new row lands at,
pushing rows below down by one.

---

## Notes / decisions
- Rows currently have no explicit order column; the grid sorts by `createdAt`.
  Items 13 and 14 need a real `position` field — see the design note when that
  work starts.
