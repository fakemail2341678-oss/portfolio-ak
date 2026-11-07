import { jsonb } from "drizzle-orm/pg-core";

/** Text in both languages, as LocalizedField edits it (src/lib/i18n/localized.ts; no imports here, for drizzle-kit). */
export type LocalizedJson = { en: string; ne: string };

/**
 * A `{ en, ne }` jsonb column (decision 0176): one column per localized field,
 * not one column per language, so a third language needs no migration. Nepali
 * may be empty; readers fall back to English.
 *
 *   title: localizedText().notNull(),
 */
export const localizedText = () => jsonb().$type<LocalizedJson>();

/** An empty localized value: a column default. */
export const EMPTY_LOCALIZED: LocalizedJson = { en: "", ne: "" };
