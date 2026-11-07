import { z } from "zod";
import { TEST_CRUD_MAX_IMAGES } from "@/features/attachments/constants";
import { ALT_MAX, attachmentRefSchema, type ImageAsset } from "@/features/attachments/schema";
import { versionSchema } from "@/lib/concurrency";
import { isoDateTime } from "@/lib/crud/schema";
import type { Paged } from "@/lib/list/paging";
import { phone } from "@/lib/phone";
import type { SafeHtml } from "@/lib/safe-html";
import { SLUG_PATTERN } from "@/lib/slug";
import { currency, localizedText, optionalText, required, richText, slug, tags } from "@/lib/validation";
import { TEST_CRUD_STATUSES } from "./constants";

export * from "./constants";

// ---------------------------------------------------------------------------
// Create / update: ONE schema shared by the form (client) and the server functions
// ---------------------------------------------------------------------------

/**
 * Every editable field. `images` are attachments (uploaded beforehand, straight
 * to Cloudinary) in display order with their alt text; the first is the cover.
 */
export const testCrudInputSchema = z.strictObject({
	title: required({ max: 120 }),
	slug: slug(),
	summary: optionalText({ max: 280 }),
	/** Rich-text HTML; the server sanitizes it before storing. */
	body: richText({ required: false, max: 20_000 }),
	status: z.enum(TEST_CRUD_STATUSES),
	price: currency({ max: 10_000_000 }),
	phone: phone({ optional: true }),
	tags: tags({ max: 10, maxLength: 32 }),
	images: z.array(attachmentRefSchema).max(TEST_CRUD_MAX_IMAGES),
});
export type TestCrudInput = z.output<typeof testCrudInputSchema>;

/** Update: the same fields plus which item and the version the edit started from (its `updatedAt`). */
export const testCrudUpdateSchema = testCrudInputSchema.extend({ id: z.uuid(), updatedAt: versionSchema() });

/** One image in the form: the attachment, its alt text, and its preview (not sent to the server). */
const formImageSchema = z.object({
	id: z.uuid(),
	alt: localizedText({ max: ALT_MAX, optional: true }),
	preview: z.custom<ImageAsset>(),
});

/** The admin form: the shared input, with image previews for the editor. */
export const testCrudFormSchema = testCrudInputSchema.extend({
	images: z.array(formImageSchema).max(TEST_CRUD_MAX_IMAGES),
});
export type TestCrudFormValues = z.input<typeof testCrudFormSchema>;

/** Form values -> the server input (previews dropped). */
export const toTestCrudInput = (values: TestCrudFormValues): TestCrudInput => {
	const parsed = testCrudFormSchema.parse(values);
	return { ...parsed, images: parsed.images.map(({ id, alt }) => ({ id, alt })) };
};

/** The slug check while typing: is `slug` free for the item `id` (absent for a new one)? */
export const testCrudSlugCheckSchema = z.strictObject({
	slug: z.string().max(80).regex(SLUG_PATTERN),
	id: z.uuid().optional(),
});
export const testCrudStatusUpdateSchema = z.strictObject({ id: z.uuid(), status: z.enum(TEST_CRUD_STATUSES) });

// ---------------------------------------------------------------------------
// DTOs: what crosses the wire. The repository parses its rows with these (dates
// become ISO strings, other columns are left out).
// ---------------------------------------------------------------------------

const image = z.custom<ImageAsset>();

export const testCrudListItem = z.object({
	id: z.string(),
	slug: z.string(),
	title: z.string(),
	status: z.enum(TEST_CRUD_STATUSES),
	price: z.number(),
	tags: z.array(z.string()),
	/** The cover (first image), or null. */
	image: image.nullable(),
	publishedAt: isoDateTime().nullable(),
	updatedAt: isoDateTime(),
});
export type TestCrudListItem = z.output<typeof testCrudListItem>;
export type TestCrudPage = Paged<TestCrudListItem>;

export const testCrudDetail = testCrudListItem.extend({
	/** Every image, in order (the first is `image`). */
	images: z.array(image),
	summary: z.string(),
	body: z.string(),
	phone: z.string().nullable(),
	createdAt: isoDateTime(),
});
export type TestCrudDetail = z.output<typeof testCrudDetail>;

// Public side (/dev/test-crud): published items only, no auth (search params in ./search.ts).

export const publicTestCrudCard = z.object({
	slug: z.string(),
	title: z.string(),
	summary: z.string(),
	price: z.number(),
	tags: z.array(z.string()),
	image: image.nullable(),
	publishedAt: isoDateTime(),
});
export type PublicTestCrudCard = z.output<typeof publicTestCrudCard>;
export type PublicTestCrudPage = Paged<PublicTestCrudCard>;

export const publicTestCrudDetail = publicTestCrudCard.extend({
	images: z.array(image),
	/** Sanitized on the server (sanitizeRichText); render with <RichTextContent>. */
	body: z.custom<SafeHtml>(),
	phone: z.string().nullable(),
});
export type PublicTestCrudDetail = z.output<typeof publicTestCrudDetail>;
