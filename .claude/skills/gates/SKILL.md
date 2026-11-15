---
name: gates
description: Run this repository's gates (typecheck, lint, knip, tests, Storybook, e2e, builds, i18n, bundle budget) the right way. Use before calling any work done, and when a gate fails or hangs.
---

# Running the gates

Guide: `docs/guides/testing.md` ("pnpm gates"). A task is done when every gate is green with no warnings.

## The command

```bash
pnpm gates            # every gate in order, each narrowed to what changed, with a table of scopes and times
pnpm gates --full     # every suite whole: only in a Part's last task, or when the owner asks
pnpm gates:clean      # stops what a killed run left behind (servers, browsers)
```

`pnpm gates` runs, cheapest first: `typecheck`, `check` (Biome, warnings fail), `knip`, `i18n:check`, `test` (the tests that import a changed file, plus the ones that read the source as files, the standard's among them), `test:storybook` (the stories near a change), `build` and the bundle budget, `build-storybook`, `test:e2e` (the changed layers' flows and pages). It stops at the first failure; `--keep-going` runs the rest, `--only=test,e2e` and `--skip=e2e` choose gates.

## Rules

- **Never skip a gate, and never weaken a test to pass one.** A failure is fixed in the code, or reported with its output.
- **Narrowed by default.** Run a full suite only where the rule above says. Running one gate alone is fine while fixing it (`pnpm typecheck`, `pnpm check:fix`, `pnpm exec vitest run <file>`, `pnpm test:storybook <path>`).
- **No worker flags.** Worker counts come from the free memory (`scripts/lib/workers.ts`); `GATE_WORKERS` forces a count only when the owner asks.
- **Before timing anything, or a long e2e run:** the machine is unlocked, cool and idle. Locked or hot it ran three times slower and hung Chrome.
- **Long runs go in the foreground or in shards,** within the tool's time limit; never poll a background run in a loop. After a stopped run: `pnpm gates:clean`.
- **A stale e2e server tests the old build.** `pnpm gates` restarts one whose build hash differs; when running `pnpm test:e2e` by hand, stop the server on port 3100 first (`pnpm diagnose` says if one runs).
- **One rerun at most** for an e2e failure that looks like the machine, then treat it as real.
- **The standard:** `pnpm standard` is the fast check of the rules alone (two seconds). After fixing a listed deviation: `pnpm standard --prune`.

## When a gate fails

| Gate | First look |
| --- | --- |
| `typecheck` | messages changed? it compiles them first; then the first error only |
| `check` | `pnpm check:fix`, then what is left needs a code change (a suppression needs its reason) |
| `knip` | a file reached only by a string path belongs in `knip.json`'s `entry`; do not delete on knip's word alone |
| `test` | run the one file; a guard test names the list to update |
| `test:storybook` | an axe violation is a real accessibility bug |
| `test:e2e` | the review prints the page, the variant and the check (axe, overflow, console, CSP, CLS) |
| bundle budget | `node scripts/check-bundle.ts --routes=<text>`; a static import of a feature's `queries.ts` in a route is the usual cause |
