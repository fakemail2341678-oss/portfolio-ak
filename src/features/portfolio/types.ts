import type { ImageAsset } from "@/features/attachments/schema";
import type { Resolved } from "@/lib/i18n/localized";
import type { SafeHtml } from "@/lib/safe-html";
import type { AvailabilityStatus, CaseStudyBlockRecord, CoverMotif, Discipline, MetricRecord } from "./schema";

/**
 * What the public pages receive (src/server/portfolio/public.ts): published
 * content resolved to the page's language. Components never see `{ en, ne }`;
 * an object whose texts all fell back to English carries `lang: "en"`
 * (resolveLocalized, decision 0178).
 */

type Lang = { lang?: "en" };

export type Metric = Resolved<MetricRecord>;
export type CaseStudyBlock = Resolved<CaseStudyBlockRecord>;

export type Profile = Lang & {
	name: string;
	initials: string;
	role: string;
	location: string;
	timezone: string;
	email: string;
	availability: { status: AvailabilityStatus; note: string };
	headline: string[];
	intro: string;
	manifesto: string;
	bio: string[];
	principles: Array<Lang & { title: string; body: string }>;
	impact: Metric[];
	socials: Array<{ network: string; handle: string; href: string }>;
	toolbox: string[];
	since: number;
	/** The year of the last profile edit (the footer's "updated"). */
	updated: number;
	portrait: ImageAsset | null;
	/** The résumé PDF's address, if one is set. */
	resume: string | null;
	/** Search and social defaults for the home page (empty: the name and intro are used). */
	seo: { title: string; description: string; image: ImageAsset | null };
	/** When the server read this (ISO): the moment the sky and the clock are first drawn for (decision 0182). */
	generatedAt: string;
};

/** Generated cover art (CoverArt) and, when uploaded, a real cover image. */
export type Cover = { motif: CoverMotif; glyph: string; seed: string; image: ImageAsset | null };

/** A project in lists and cards: everything but the case study. */
export type ProjectSummary = Lang & {
	slug: string;
	title: string;
	client: string;
	year: number;
	disciplines: Discipline[];
	role: string;
	duration: string;
	summary: string;
	stack: string[];
	featured: boolean;
	cover: Cover;
	metrics: Metric[];
};

export type Project = ProjectSummary & {
	links: Array<{ label: string; href: string }>;
	body: CaseStudyBlock[];
	gallery: ImageAsset[];
	// apps:start
	/** The showcase app this project opens (/apps/<slug>). */
	appSlug: string | null;
	// apps:end
};

/** The case study page: the project plus where "Next project" leads. */
export type ProjectDetail = {
	project: Project;
	/** 1-based position among the published projects, for the big index numeral. */
	index: number;
	total: number;
	next: Pick<ProjectSummary, "slug" | "title" | "client" | "cover">;
	/** Shown as a draft preview (only to someone who may read drafts). */
	draft: boolean;
};

export type Experience = Lang & {
	id: string;
	company: string;
	role: string;
	/** YYYY-MM. */
	start: string;
	/** YYYY-MM; null: the current position. */
	end: string | null;
	location: string;
	summary: string;
};

export type Skill = Lang & { id: string; title: string; summary: string; skills: string[] };
export type ProcessStep = Lang & { id: string; title: string; body: string; outputs: string[] };
export type Testimonial = Lang & { id: string; quote: string; name: string; role: string; company: string };

export type PostSummary = Lang & {
	slug: string;
	title: string;
	excerpt: string;
	/** YYYY-MM-DD. */
	publishedAt: string;
	tags: string[];
	/** Estimated from the body's word count. */
	readingMinutes: number;
	cover: ImageAsset | null;
};

export type Post = PostSummary & {
	/** Sanitized on the server; render with RichTextContent. */
	body: SafeHtml;
};

export type PostDetail = {
	post: Post;
	/** The next older post (wraps to the newest), for the article footer. */
	next: Pick<PostSummary, "slug" | "title" | "publishedAt">;
	draft: boolean;
};

/** The home page's read, in one round trip (getHome). */
export type HomeContent = {
	featured: ProjectSummary[];
	projectCount: number;
	experience: Experience[];
	skills: Skill[];
	process: ProcessStep[];
	testimonials: Testimonial[];
	posts: PostSummary[];
};

/** The about page's read. */
export type AboutContent = { experience: Experience[]; skills: Skill[]; testimonials: Testimonial[] };
