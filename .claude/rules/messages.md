---
paths:
  - "messages/*.json"
  - "src/lib/i18n/**/*.ts"
---

# Messages

Guide: `docs/guides/i18n.md`.

- Every user-visible string MUST be in `messages/en.json` and `messages/ne.json`, with the same variables and plural forms. `pnpm i18n:check` checks.
- A key is `<feature>_<part>_<name>` in snake_case. It starts with the feature's name spelled out (`test_crud_`, a product's `<product>_`), or with a word of the shared kit (`SHARED_MESSAGE_WORDS` in `scripts/standard/vocabulary.ts`).
- The Nepali text MUST differ from the English. `pnpm i18n:translate` fills what is missing; review its diff.
- Delete a key when its UI goes away (a test checks that every key is used).
- Call `m.key()` at render time, NEVER in a module-level constant: on the server it would freeze the first request's locale.
- After editing messages, `pnpm typecheck` compiles them.
