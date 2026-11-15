---
name: plan-task
description: Run one task of docs/PLAN.md from start to commit. Use when asked to do "Task N", "the next task" or to continue the plan.
argument-hint: "[task number]"
---

# Running a PLAN task

`docs/PLAN.md` is long: never read it whole. Search it, and read only the lines named below.

## 1. Before any work: the effort question

Find the task's row in its Part's status table (search for `| <N> |`). It names the task's **effort** and **plugins**.

Ask the owner one line and wait for the answer:

> Task N: the plan says `<effort>`. Please confirm your session effort is `<effort>` before I start.

Never say what the session's effort is: it cannot be seen from inside. If the plan lists plugins that are not on, say which. Start only after the owner confirms.

## 2. Read

- `CLAUDE.md`, then the Part's "How to run a task" section and its rules (Part 9: 15.1 to 15.7), then the task's own section. Not the other tasks.
- The guides and decisions the task names, and the code it names before changing it.
- The next free decision number: the last entry of `docs/decisions.md`.

## 3. Check the ground

`git status` shows a clean tree on `main`. If not, stop and say so.

## 4. Do only this task

- Research first: the current docs (context7) for every library API the task adopts.
- Refactors keep behaviour: write the missing test before moving code.
- Too big for one session? Split it in the status table **before starting**, and say so. Never drop a part silently.
- If it cannot be done as written, change the task's section in the same commit and record why in a decision.
- Use subagents only when the owner's prompt allows them. Work lean: read sections, not files; edit, do not rewrite.
- If the task's real size differs from its label, say so in one line.

## 5. Gates

`pnpm gates` (the `gates` skill): narrowed to what changed, no worker flags, no skipped gate, at most one e2e rerun. Full suites only in a Part's last task.

## 6. Docs move with the code

- A decision in `docs/decisions.md` for every non-obvious choice (next free number, added to the index; supersede explicitly).
- The guide of the area, and `CLAUDE.md` when commands, layout or an everywhere pitfall changed.
- In `docs/PLAN.md`: mark the task done in the status table and replace its section with a short "Done" summary (what changed, numbers before and after, deviations, left for the owner). Records keep their words: do not rewrite other done sections, old decisions or `docs/history`.
- The standard's ratchet: a fixed deviation leaves `tests/unit/standard/known-deviations.json` in the same commit (`pnpm standard --prune`). Nothing is added to it without a decision.

## 7. Commit

One commit on `main` for the task, no branch, not pushed: `feat: Part <P> Task <N>, <name>`, with a body that lists the main changes.

## 8. Stop and report

What was done, the numbers, what the owner must do (a migration on Neon, a plugin to turn off), and what is left. Then wait for the next prompt.
