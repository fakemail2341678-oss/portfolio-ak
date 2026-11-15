# AGENTS.md

For any coding agent that works in this repository. The rules are the same for every tool, and they live in one place each (decision 0297):

1. **Read [CLAUDE.md](CLAUDE.md) first.** It is the entry point: what the app is, the "before you write code" checklist, the MUST and NEVER lines, the guides, the commands and the pitfalls most tasks can hit.
2. **Read the rules of the area you touch,** in `.claude/rules/`. Each file names the paths it covers in its front matter:

   | File | Covers |
   | --- | --- |
   | [routes.md](.claude/rules/routes.md) | `src/routes/**` |
   | [functions.md](.claude/rules/functions.md) | `src/functions/**`, `src/middleware/**` |
   | [server.md](.claude/rules/server.md) | `src/server/**` |
   | [features.md](.claude/rules/features.md) | `src/features/**`, `src/components/**`, `src/hooks/**` |
   | [tests.md](.claude/rules/tests.md) | `tests/**`, `e2e/**`, stories |
   | [messages.md](.claude/rules/messages.md) | `messages/*.json`, `src/lib/i18n/**` |
   | [migrations.md](.claude/rules/migrations.md) | `drizzle/**`, `src/server/db/schema/**` |

3. **Follow the recipe for a repeated job,** in `.claude/skills/<name>/SKILL.md`: [new-feature](.claude/skills/new-feature/SKILL.md), [server-function](.claude/skills/server-function/SKILL.md), [migration](.claude/skills/migration/SKILL.md), [gates](.claude/skills/gates/SKILL.md), [plan-task](.claude/skills/plan-task/SKILL.md).
4. **Read the guide** for the area in `docs/guides/` (CLAUDE.md lists them). The standard that every file follows is in [docs/guides/conventions.md](docs/guides/conventions.md), "The standard".

## After every edit

Claude Code runs a hook (`.claude/settings.json`) that does this for each edited file. Any other tool runs it by hand:

```bash
pnpm exec biome check --write <file>     # format and lint
pnpm standard <file>                     # the standard's rules for that file
```

## Before calling work done

```bash
pnpm standard        # no new deviation from the standard (two seconds)
pnpm gates           # every gate, narrowed to what changed
```

Never skip a gate, weaken a test, or add to `tests/unit/standard/known-deviations.json` without a decision in `docs/decisions.md`.
