---
expect_unchanged: true
---

Mark **Review notes** complete.

## Pass if

- Asks which Review notes task the user means, distinguishing Reading group from Personal review
- Does not choose a task or mark both complete
- Leaves the entire document unchanged

## Fail if

- Changes any checkbox or other document content
- Claims the task is complete without clarification
- Gives an empty response or only says no edit is needed
