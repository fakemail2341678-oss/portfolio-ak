import { z } from "zod";
import { versionSchema } from "@/lib/concurrency";
import { isoDateTime } from "@/lib/crud/schema";
import type { Paged } from "@/lib/list/paging";
{{#public}}
import { SLUG_PATTERN } from "@/lib/slug";
{{/public}}
import { {{#localized}}localizedText{{/localized}}{{^localized}}optionalText, required{{/localized}}{{#public}}, slug{{/public}} } from "@/lib/validation";

// ---------------------------------------------------------------------------
// Create / update: ONE schema shared by the form (client) and the server functions
// ---------------------------------------------------------------------------

export const __camel__InputSchema = z.strictObject({
{{#localized}}
	title: localizedText({ max: 120 }),
	notes: localizedText({ max: 2000, optional: true }),
{{/localized}}
{{^localized}}
	title: required({ max: 120 }),
	notes: optionalText({ max: 2000 }),
{{/localized}}
{{#public}}
	slug: slug(),
	published: z.boolean(),
{{/public}}
});
export type __Pascal__Input = z.output<typeof __camel__InputSchema>;
export type __Pascal__FormValues = z.input<typeof __camel__InputSchema>;

/** Update: the same fields plus which row and the version the edit started from (its `updatedAt`). */
export const __camel__UpdateSchema = __camel__InputSchema.extend({ id: z.uuid(), updatedAt: versionSchema() });
{{#public}}

/** The slug check while typing: is `slug` free for the row `id` (absent for a new one)? */
export const __camel__SlugCheckSchema = z.strictObject({
	slug: z.string().max(80).regex(SLUG_PATTERN),
	id: z.uuid().optional(),
});
{{/public}}

// ---------------------------------------------------------------------------
// DTOs: what crosses the wire. The repository parses its rows with these (dates
// become ISO strings, other columns are left out).
// ---------------------------------------------------------------------------

{{#localized}}
const text = z.object({ en: z.string(), ne: z.string() });
{{/localized}}
{{^localized}}
const text = z.string();
{{/localized}}

export const __camel__ListItem = z.object({
	id: z.string(),
	title: text,
{{#public}}
	slug: z.string(),
	published: z.boolean(),
{{/public}}
	updatedAt: isoDateTime(),
});
export type __Pascal__ListItem = z.output<typeof __camel__ListItem>;
export type __Pascal__Page = Paged<__Pascal__ListItem>;

export const __camel__Detail = __camel__ListItem.extend({ notes: text, createdAt: isoDateTime() });
export type __Pascal__Detail = z.output<typeof __camel__Detail>;
{{#public}}

/** A published row as the public pages show it (no admin-only fields). */
export const __camel__PublicItem = z.object({ slug: z.string(), title: text, notes: text, updatedAt: isoDateTime() });
export type __Pascal__PublicItem = z.output<typeof __camel__PublicItem>;
export type __Pascal__PublicPage = Paged<__Pascal__PublicItem>;
{{/public}}
