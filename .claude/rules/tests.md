---
paths:
  - "tests/**/*.{ts,tsx}"
  - "e2e/**/*.ts"
  - "src/**/*.stories.tsx"
---

# Tests

Guide: `docs/guides/testing.md`. Running them: the `gates` skill.

- A test file lives in `tests/unit` (pure logic), `tests/server` (PGlite) or `tests/components` (jsdom), and is named `<subject>[-<topic>].test.ts`, where the subject is the feature, module or file it tests.
- Before moving or rewriting code that has no test, write the test.
- Server tests use `tests/utils/test-db.ts` (`reset()`, `snapshot()`, `restore()`); a test that signs in calls `harness.resetRateLimits()` first.
- A new server function MUST get its row in `tests/server/guarded-functions.test.ts`, and a product's function its row in the product's access test.
- A new page MUST be listed in `e2e/support/pages.ts`; a public one also in `tests/unit/route-seo.test.ts`.
- Stories sit beside their component as `*.stories.tsx` and pass axe in en/light and ne/dark.
- The standard's own tests are in `tests/unit/standard/`. `known-deviations.json` only gets shorter: fix a deviation and run `pnpm standard --prune`. NEVER add to it without a decision in `docs/decisions.md`.
- NEVER skip a gate, weaken an assertion or delete a test to get green. NEVER run a full suite when `pnpm gates` narrows it, except in a Part's last task.
