---
selection: |
  ## Recurring

  1. [Weekly sweep](https://example.test/weekly-sweep) — Not a series. Calendar reminder.
  2. [Shelf check](https://example.test/shelf-check) — Not a series. Physical pile.
expect_unchanged: true
---

Renumber the ordered list under **Recurring** so the markers are sequential in the current entry order. Do not reorder those entries. Do not change links or notes.

## Pass if

- Recurring stays 1 then 2 in the existing entry order (Weekly sweep, Shelf check)
- Links and notes are identical
- Reading, Planned, Completed, and Queue are untouched

## Fail if

- Entries are sorted, swapped, or rewritten
- Numbering or bullets are added elsewhere
