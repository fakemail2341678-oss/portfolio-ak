-- Baseline migration (Phase 3). Intentionally empty: no feature tables yet.
-- It gives `pnpm db:migrate` a journal to apply, so the migration pipeline
-- works end to end before the first real table arrives in Phase 6.
SELECT 1;
