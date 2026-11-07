import { z } from "zod";
import type { ImageAsset } from "@/features/attachments/schema";
import { versionSchema } from "@/lib/concurrency";
import { isoDateTime } from "@/lib/crud/schema";
import type { Localized } from "@/lib/i18n/localized";
import type { Paged } from "@/lib/list/paging";
import { SLUG_PATTERN } from "@/lib/slug";
import {
	email,
	list,
	localizedRichText,
	localizedText,
	numberRange,
	optionalText,
	required,
	slug,
	tags,
} from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { locales } from "@/paraglide/runtime";
import {
	ARCHITECTURE_TIERS,
	AVAILABILITY_STATUSES,
	CODE_LANGUAGES,
	COVER_MOTIFS,
	DISCIPLINES,
	METRIC_FORMATS,
	PORTFOLIO_STATUSES,
	PROFILE_ID,
} from "./constants";

export * from "./constants";

/**
 * The portfolio's content model (decision 0176): what the admin edits, the
 * database stores and the server functions validate. ONE schema per record
 * serves the admin form and the server; jsonb columns (blocks, metrics, links…)
 * are written only after passing it.
 *
 * Content is data, not UI copy: every human-language field is `{ en, ne }`
 * (Nepali may be empty: pages fall back to English, decision 0107). Brand and
 * tech names, code and slugs are plain strings. Public pages receive records
 * resolved to one language (./types.ts).
 */

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

/** https:// links and mailto: addresses only. */
const href = () =>
	z
		.string()
		.trim()
		.min(1, { error: () => m.validation_required() })
		.regex(/^(https:\/\/|mailto:)\S+$/, { error: () => m.validation_url() });

const yearMonth = () => z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: () => m.validation_year_month() });

export const metricSchema = z.strictObject({
	value: numberRange({ min: 0, max: 1_000_000_000_000 }),
	format: z.enum(METRIC_FORMATS),
	label: localizedText({ max: 80 }),
});
export type MetricRecord = z.output<typeof metricSchema>;

export const linkSchema = z.strictObject({ label: localizedText({ max: 80 }), href: href() });

/** One image of the media library in a form: which, and its preview (not sent to the server). */
export const mediaItemSchema = z.object({ id: z.uuid(), preview: z.custom<ImageAsset>() });

// ---------------------------------------------------------------------------
// Case study blocks: typed (no HTML), each rendered by a component. `id` and
// `type` are what BlocksField needs (a React key, the union's tag).
// ---------------------------------------------------------------------------

const blockId = z.string().min(1).max(64);

const nodeId = z
	.string()
	.trim()
	.min(1, { error: () => m.validation_required() })
	.max(32, { error: () => m.validation_text_max({ max: "32" }) })
	.regex(SLUG_PATTERN, { error: () => m.validation_slug() });

const architectureBlock = z
	.strictObject({
		id: blockId,
		type: z.literal("architecture"),
		caption: localizedText({ max: 200 }),
		nodes: list(
			z.strictObject({
				id: nodeId,
				label: localizedText({ max: 60 }),
				detail: required({ max: 60 }),
				tier: z.enum(ARCHITECTURE_TIERS),
			}),
			{ min: 2, max: 12 },
		),
		edges: list(z.strictObject({ from: nodeId, to: nodeId }), { min: 1, max: 24 }),
	})
	.superRefine((block, ctx) => {
		const ids = block.nodes.map((node) => node.id);
		ids.forEach((id, index) => {
			if (ids.indexOf(id) !== index) {
				ctx.addIssue({ code: "custom", path: ["nodes", index, "id"], message: m.portfolio_error_node_duplicate() });
			}
		});
		block.edges.forEach((edge, index) => {
			for (const end of ["from", "to"] as const) {
				if (!ids.includes(edge[end])) {
					ctx.addIssue({ code: "custom", path: ["edges", index, end], message: m.portfolio_error_node_unknown() });
				}
			}
		});
	});

export const caseStudyBlockSchema = z.discriminatedUnion("type", [
	z.strictObject({
		id: blockId,
		type: z.literal("chapter"),
		title: localizedText({ max: 120 }),
		body: list(localizedText({ max: 2000 }), { min: 1, max: 12 }),
	}),
	z.strictObject({
		id: blockId,
		type: z.literal("quote"),
		text: localizedText({ max: 600 }),
		cite: optionalText({ max: 120 }),
	}),
	z.strictObject({
		id: blockId,
		type: z.literal("code"),
		language: z.enum(CODE_LANGUAGES),
		caption: localizedText({ max: 200, optional: true }),
		code: required({ max: 4000 }),
	}),
	architectureBlock,
	/** Generated screens (ScreenArt), one per caption. */
	z.strictObject({
		id: blockId,
		type: z.literal("gallery"),
		captions: list(localizedText({ max: 120 }), { min: 1, max: 4 }),
	}),
]);
export type CaseStudyBlockRecord = z.output<typeof caseStudyBlockSchema>;

// ---------------------------------------------------------------------------
// Profile (one row)
// ---------------------------------------------------------------------------

const profileFields = {
	name: localizedText({ max: 80 }),
	/** Two letters for the header monogram. */
	initials: required({ max: 2 }),
	role: localizedText({ max: 80 }),
	location: localizedText({ max: 80 }),
	timezone: required({ max: 40 }),
	email: email(),
	availabilityStatus: z.enum(AVAILABILITY_STATUSES),
	availabilityNote: localizedText({ max: 200, optional: true }),
	/** The hero headline, one entry per line. */
	headline: list(localizedText({ max: 40 }), { min: 1, max: 4 }),
	intro: localizedText({ max: 400 }),
	manifesto: localizedText({ max: 1200 }),
	bio: list(localizedText({ max: 1200 }), { min: 1, max: 6 }),
	principles: list(z.strictObject({ title: localizedText({ max: 80 }), body: localizedText({ max: 300 }) }), {
		max: 8,
	}),
	impact: list(metricSchema, { max: 4 }),
	socials: list(z.strictObject({ network: required({ max: 40 }), handle: required({ max: 60 }), href: href() }), {
		max: 8,
	}),
	/** Tool names for the capabilities marquee (brands: not translated). */
	toolbox: tags({ max: 30, maxLength: 40 }),
	/** The first year in the footer's copyright line. */
	since: numberRange({ min: 1950, max: 2100, integer: true }),
	seoTitle: localizedText({ max: 70, optional: true }),
	seoDescription: localizedText({ max: 160, optional: true }),
};

export const profileInputSchema = z.strictObject({
	...profileFields,
	portraitId: z.uuid().nullable(),
	/** A PDF in the media library. */
	resumeId: z.uuid().nullable(),
	/** The social preview image (1200×630 crop); the portrait when absent. */
	ogImageId: z.uuid().nullable(),
});
export type ProfileInput = z.output<typeof profileInputSchema>;
export const profileUpdateSchema = profileInputSchema.extend({ id: z.literal(PROFILE_ID), updatedAt: versionSchema() });

/** The profile form: media fields hold library items with previews. */
export const profileFormSchema = z.object({
	...profileFields,
	portrait: z.array(mediaItemSchema).max(1),
	resume: z.array(mediaItemSchema).max(1),
	ogImage: z.array(mediaItemSchema).max(1),
});
export type ProfileFormValues = z.input<typeof profileFormSchema>;

const firstId = (items: ReadonlyArray<{ id: string }>) => items[0]?.id ?? null;

export const toProfileInput = (values: ProfileFormValues): ProfileInput => {
	const { portrait, resume, ogImage, ...rest } = profileFormSchema.parse(values);
	return { ...rest, portraitId: firstId(portrait), resumeId: firstId(resume), ogImageId: firstId(ogImage) };
};

const image = z.custom<ImageAsset>();

export const profileDetail = z.object({
	id: z.literal(PROFILE_ID),
	...profileFields,
	portrait: image.nullable(),
	resume: image.nullable(),
	ogImage: image.nullable(),
	updatedAt: isoDateTime(),
});
export type ProfileDetail = z.output<typeof profileDetail>;

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const PROJECT_MAX_GALLERY = 12;

const projectFields = {
	/** Product names are brands: the same in every language. */
	title: required({ max: 80 }),
	slug: slug(),
	client: localizedText({ max: 80 }),
	year: numberRange({ min: 2000, max: 2100, integer: true }),
	disciplines: z.array(z.enum(DISCIPLINES)).min(1, { error: () => m.validation_select_min({ min: "1" }) }),
	role: localizedText({ max: 80 }),
	duration: localizedText({ max: 80 }),
	summary: localizedText({ max: 400 }),
	stack: tags({ max: 20, maxLength: 40 }),
	links: list(linkSchema, { max: 6 }),
	metrics: list(metricSchema, { max: 4 }),
	blocks: list(caseStudyBlockSchema, { max: 40 }),
	/** Seeds the generated cover art; empty means the slug. */
	artSeed: optionalText({ max: 40 }),
	motif: z.enum(COVER_MOTIFS),
	/** One to three characters set huge on the cover. */
	glyph: required({ max: 3 }),
	// apps:start
	/** The showcase app this project opens (/apps/<slug>), if any. */
	appSlug: z.union([z.literal(""), slug({ max: 40 })]),
	// apps:end
	featured: z.boolean(),
	status: z.enum(PORTFOLIO_STATUSES),
};

export const projectInputSchema = z.strictObject({
	...projectFields,
	coverId: z.uuid().nullable(),
	gallery: z.array(z.uuid()).max(PROJECT_MAX_GALLERY),
});
export type ProjectInput = z.output<typeof projectInputSchema>;
export const projectUpdateSchema = projectInputSchema.extend({ id: z.uuid(), updatedAt: versionSchema() });

export const projectFormSchema = z.object({
	...projectFields,
	cover: z.array(mediaItemSchema).max(1),
	gallery: z.array(mediaItemSchema).max(PROJECT_MAX_GALLERY),
});
export type ProjectFormValues = z.input<typeof projectFormSchema>;

export const toProjectInput = (values: ProjectFormValues): ProjectInput => {
	const { cover, gallery, ...rest } = projectFormSchema.parse(values);
	return { ...rest, coverId: firstId(cover), gallery: gallery.map((item) => item.id) };
};

export const projectListItem = z.object({
	id: z.string(),
	slug: z.string(),
	title: z.string(),
	year: z.number(),
	status: z.enum(PORTFOLIO_STATUSES),
	featured: z.boolean(),
	sortOrder: z.number(),
	motif: z.enum(COVER_MOTIFS),
	glyph: z.string(),
	artSeed: z.string(),
	cover: image.nullable(),
	publishedAt: isoDateTime().nullable(),
	updatedAt: isoDateTime(),
});
export type ProjectListItem = z.output<typeof projectListItem>;
export type ProjectPage = Paged<ProjectListItem>;

export const projectDetail = projectListItem.extend({
	...projectFields,
	gallery: z.array(image),
	createdAt: isoDateTime(),
});
export type ProjectDetail = z.output<typeof projectDetail>;

/** The reorder dialog: every project, in order. */
export const projectOrderItem = projectListItem.pick({ id: true, title: true, status: true, sortOrder: true });
export type ProjectOrderItem = z.output<typeof projectOrderItem>;

// ---------------------------------------------------------------------------
// Journal posts
// ---------------------------------------------------------------------------

const postFields = {
	title: localizedText({ max: 140 }),
	slug: slug(),
	excerpt: localizedText({ max: 300 }),
	/** Rich-text HTML per language; the server sanitizes it before storing. */
	body: localizedRichText({ max: 50_000 }),
	tags: tags({ max: 8, maxLength: 32 }),
	status: z.enum(PORTFOLIO_STATUSES),
};

export const postInputSchema = z.strictObject({ ...postFields, coverId: z.uuid().nullable() });
export type PostInput = z.output<typeof postInputSchema>;
export const postUpdateSchema = postInputSchema.extend({ id: z.uuid(), updatedAt: versionSchema() });

export const postFormSchema = z.object({ ...postFields, cover: z.array(mediaItemSchema).max(1) });
export type PostFormValues = z.input<typeof postFormSchema>;

export const toPostInput = (values: PostFormValues): PostInput => {
	const { cover, ...rest } = postFormSchema.parse(values);
	return { ...rest, coverId: firstId(cover) };
};

const localizedDto = z.custom<Localized>();

export const postListItem = z.object({
	id: z.string(),
	slug: z.string(),
	title: localizedDto,
	status: z.enum(PORTFOLIO_STATUSES),
	tags: z.array(z.string()),
	cover: image.nullable(),
	publishedAt: isoDateTime().nullable(),
	updatedAt: isoDateTime(),
});
export type PostListItem = z.output<typeof postListItem>;
export type PostPage = Paged<PostListItem>;

export const postDetail = postListItem.extend({
	excerpt: localizedDto,
	body: localizedDto,
	createdAt: isoDateTime(),
});
export type PostDetail = z.output<typeof postDetail>;

/** The slug check while typing: is `slug` free for the record `id` (absent for a new one)? */
export const slugCheckSchema = z.strictObject({
	slug: z.string().max(80).regex(SLUG_PATTERN),
	id: z.uuid().optional(),
});
export const statusUpdateSchema = z.strictObject({ id: z.uuid(), status: z.enum(PORTFOLIO_STATUSES) });
export const reorderSchema = z.strictObject({ ids: z.array(z.uuid()).min(1).max(500) });

// ---------------------------------------------------------------------------
// Ordered sections: experience, skills, process steps, testimonials. Each is a
// short list in display order (`sortOrder`), edited in a sheet.
// ---------------------------------------------------------------------------

const sectionDto = { id: z.string(), sortOrder: z.number(), updatedAt: isoDateTime() };
const versioned = { id: z.uuid(), updatedAt: versionSchema() };

export const experienceInputSchema = z
	.strictObject({
		company: required({ max: 80 }),
		role: localizedText({ max: 80 }),
		start: yearMonth(),
		/** Empty: the current position. */
		end: z.union([z.literal(""), yearMonth()]),
		location: localizedText({ max: 80 }),
		summary: localizedText({ max: 600 }),
	})
	.refine((entry) => entry.end === "" || entry.end >= entry.start, {
		path: ["end"],
		error: () => m.validation_date_order(),
	});
export type ExperienceInput = z.output<typeof experienceInputSchema>;
export const experienceUpdateSchema = experienceInputSchema.safeExtend(versioned);
export const experienceItem = z.object({
	...sectionDto,
	company: z.string(),
	role: localizedDto,
	start: z.string(),
	end: z.string(),
	location: localizedDto,
	summary: localizedDto,
});
export type ExperienceItem = z.output<typeof experienceItem>;

export const skillInputSchema = z.strictObject({
	title: localizedText({ max: 80 }),
	summary: localizedText({ max: 400 }),
	skills: tags({ min: 1, max: 20, maxLength: 40 }),
});
export type SkillInput = z.output<typeof skillInputSchema>;
export const skillUpdateSchema = skillInputSchema.extend(versioned);
export const skillItem = z.object({
	...sectionDto,
	title: localizedDto,
	summary: localizedDto,
	skills: z.array(z.string()),
});
export type SkillItem = z.output<typeof skillItem>;

export const processStepInputSchema = z.strictObject({
	title: localizedText({ max: 80 }),
	body: localizedText({ max: 600 }),
	outputs: list(localizedText({ max: 80 }), { max: 8 }),
});
export type ProcessStepInput = z.output<typeof processStepInputSchema>;
export const processStepUpdateSchema = processStepInputSchema.extend(versioned);
export const processStepItem = z.object({
	...sectionDto,
	title: localizedDto,
	body: localizedDto,
	outputs: z.array(localizedDto),
});
export type ProcessStepItem = z.output<typeof processStepItem>;

export const testimonialInputSchema = z.strictObject({
	quote: localizedText({ max: 600 }),
	name: required({ max: 80 }),
	role: localizedText({ max: 80 }),
	company: required({ max: 80 }),
	/** Unpublished testimonials stay in the admin (waiting for the person's approval). */
	published: z.boolean(),
});
export type TestimonialInput = z.output<typeof testimonialInputSchema>;
export const testimonialUpdateSchema = testimonialInputSchema.extend(versioned);
export const testimonialItem = z.object({
	...sectionDto,
	quote: localizedDto,
	name: z.string(),
	role: localizedDto,
	company: z.string(),
	published: z.boolean(),
});
export type TestimonialItem = z.output<typeof testimonialItem>;

// ---------------------------------------------------------------------------
// Contact messages (the public form → the admin inbox)
// ---------------------------------------------------------------------------

export const CONTACT_MESSAGE_MAX = 4000;

/** The public contact form. `website` is the honeypot (people leave it empty); `captcha` the Turnstile token. */
export const contactInputSchema = z.strictObject({
	name: required({ max: 80 }),
	email: email(),
	message: required({ max: CONTACT_MESSAGE_MAX }),
	website: z.string().max(200).optional(),
	captcha: z.string().max(4096).optional(),
	locale: z.enum(locales),
});
export type ContactInput = z.output<typeof contactInputSchema>;

export const contactMessageItem = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	message: z.string(),
	locale: z.string(),
	readAt: isoDateTime().nullable(),
	archivedAt: isoDateTime().nullable(),
	createdAt: isoDateTime(),
});
export type ContactMessageItem = z.output<typeof contactMessageItem>;
export type ContactMessagePage = Paged<ContactMessageItem>;

export const messageStateSchema = z.strictObject({
	ids: z.array(z.uuid()).min(1).max(200),
	/** read/unread toggles `readAt`; archived/inbox toggles `archivedAt`. */
	set: z.enum(["read", "unread", "archived", "inbox"]),
});
export type MessageStateInput = z.output<typeof messageStateSchema>;
