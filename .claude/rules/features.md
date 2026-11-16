---
paths:
  - "src/features/**/*.{ts,tsx}"
  - "src/components/**/*.{ts,tsx}"
  - "src/hooks/**/*.{ts,tsx}"
---

# Features and the kit

Guides: `docs/guides/conventions.md` ("The standard"), `docs/guides/crud.md`, `docs/guides/design-system.md`, `docs/guides/forms.md`, `docs/guides/state.md`. The reference: `src/features/test-crud/`.

- A feature folder MUST hold only `schema.ts`, `search.ts`, `keys.ts`, `queries.ts`, `collection.ts`, `columns.tsx`, `filters.tsx`, `labels.ts`, `constants.ts`, `types.ts`, `links.ts`, `commands.ts`, `load.ts`, `head.ts`, `store.ts`, and the folders `components/` (every component, its stories beside it), `hooks/` (`use-<thing>.ts`) and `lib/` (everything else, no React).
- A component file is `<thing>-<role>.tsx`; the role says what it renders (`page`, `list`, `detail`, `form`, `dialog`, … the list is `COMPONENT_ROLES` in `scripts/standard/vocabulary.ts`).
- Exports: `<feature>Keys`, `<thing>QueryOptions`, `<feature>Mutations`, `<feature>Rows`, `<thing>Schema` with the type `<Thing>`.
- Page data MUST be read with `useSuspenseQuery(options)` after the loader's `ensureQuery`. `useQuery` needs `enabled` (asked for after an interaction) or a `// useQuery: <reason>` comment above it. NEVER fetch first-paint data in an effect.
- A write MUST go through `useCrudMutation` (a form through `useCrudForm`), optimistic where it changes a list's rows. NEVER a raw `useMutation`.
- A list MUST use the list contract (`listSchema`, `useListPage`, `CrudListPage`), with its state in the URL.
- Reuse the kit (`src/components/page`, `data-table`, `data-display`, `filters`, `dialogs`, `forms`) before writing a component. A pattern used twice becomes shared.
- Every user-visible string MUST be a Paraglide message in both languages, called at render time (`m.key()`), NEVER in a module-level constant.
- A shortcut MUST be registered with `useShortcuts` (`src/hooks/use-shortcuts.ts`, TanStack Hotkeys), with a name and a group. A key handler that is a widget's own keyboard model needs a `// keys: <reason>` comment.
- Debouncing, throttling and queuing go through TanStack Pacer (`useDebouncedValue`, `useThrottledCallback`, `usePacedRefresh`, `createJobQueue`; state.md, "Pacing"). Another `setTimeout` or `setInterval` needs a `// timer: <reason>` comment.
- Dates, numbers and money MUST be formatted by `src/lib/i18n`; NEVER `toLocaleString` or `new Intl.NumberFormat`.
- NEVER add `useMemo` or `useCallback` for speed (the React Compiler memoizes).
- `src/components`, `src/hooks` and `src/lib` know no feature: NEVER import `@/features`, `@/functions`, `@/routes` or `@/server` there. Every export there MUST say what it is for in a comment above it.
- The UI only hides what the server would refuse: `useCan` and `<Can>` are the only permission checks in UI code.
