/**
 * The demo content's shapes (`pnpm db:seed-portfolio` writes it, decision 0176).
 * Written for people: case-study blocks without ids, article bodies as typed
 * prose blocks. scripts/lib/portfolio-seed.ts turns them into the database's
 * shape (block ids, rich-text HTML per language). No imports: Node runs this.
 */

export type Localized = { en: string; ne: string };

export type MetricRecord = {
	value: number;
	format: "number" | "compact" | "percent" | "multiplier" | "plus" | "ms" | "seconds";
	label: Localized;
};

export type ProfileRecord = {
	name: Localized;
	initials: string;
	role: Localized;
	location: Localized;
	timezone: string;
	email: string;
	availability: { status: "open" | "limited" | "closed"; note: Localized };
	headline: Localized[];
	intro: Localized;
	manifesto: Localized;
	bio: Localized[];
	principles: Array<{ title: Localized; body: Localized }>;
	impact: MetricRecord[];
	socials: Array<{ network: string; handle: string; href: string }>;
	toolbox: string[];
	since: number;
	updated: number;
};

type CodeBlock = {
	kind: "code";
	language: "ts" | "tsx" | "sql" | "bash" | "css";
	caption?: Localized;
	code: string;
};
type QuoteBlock = { kind: "quote"; text: Localized; cite?: string };

export type CaseStudyBlock =
	| { kind: "chapter"; title: Localized; body: Localized[] }
	| QuoteBlock
	| CodeBlock
	| {
			kind: "architecture";
			caption: Localized;
			nodes: Array<{ id: string; label: Localized; detail: string; tier: "client" | "edge" | "service" | "data" }>;
			edges: Array<[string, string]>;
	  }
	| { kind: "gallery"; captions: Localized[] };

export type ProjectRecord = {
	slug: string;
	title: string;
	client: Localized;
	year: number;
	disciplines: Array<"product" | "frontend" | "backend" | "platform" | "ai">;
	role: Localized;
	duration: Localized;
	summary: Localized;
	stack: string[];
	featured: boolean;
	cover: { motif: "grid" | "orbit" | "waves" | "blocks" | "type" | "terrain" | "signal"; glyph: string };
	links: Array<{ label: Localized; href: string }>;
	metrics: MetricRecord[];
	body: CaseStudyBlock[];
};

export type ProseBlock =
	| { kind: "paragraph"; text: Localized }
	| { kind: "heading"; text: Localized }
	| QuoteBlock
	| CodeBlock
	| { kind: "list"; items: Localized[] };

export type PostRecord = {
	slug: string;
	title: Localized;
	excerpt: Localized;
	/** YYYY-MM-DD. */
	publishedAt: string;
	tags: string[];
	body: ProseBlock[];
};

export type ExperienceRecord = {
	id: string;
	company: string;
	role: Localized;
	/** YYYY-MM. */
	start: string;
	/** null: the current position. */
	end: string | null;
	location: Localized;
	summary: Localized;
};

export type CapabilityRecord = { id: string; title: Localized; summary: Localized; skills: string[] };
export type ProcessStepRecord = { id: string; title: Localized; body: Localized; outputs: Localized[] };
export type TestimonialRecord = { id: string; quote: Localized; name: string; role: Localized; company: string };
