import type { Blog, BlogPosting, CollectionPage, CreativeWork, Person, ProfilePage } from "schema-dts";
import { absoluteUrl } from "@/lib/seo";
import { getLocale, localizeHref } from "@/paraglide/runtime";

/**
 * schema.org objects for the portfolio pages (emitted through seo({ jsonLd })).
 * The owner is one Person with a stable @id that every page points to.
 */

/** What every person-related object needs; loaders return exactly this. */
export type PersonInput = { name: string; role: string; description: string; socials: ReadonlyArray<string> };

/** The owner's stable @id, which every page (and the WebSite) points to. */
export const personId = () => absoluteUrl("/#person");
const pageUrl = (path: string) => absoluteUrl(localizeHref(path));
const personRef = () => ({ "@id": personId() });

/** The portfolio's owner (home page). */
export const personJsonLd = (person: PersonInput): Exclude<Person, string> => ({
	"@type": "Person",
	"@id": personId(),
	name: person.name,
	jobTitle: person.role,
	description: person.description,
	url: pageUrl("/"),
	...(person.socials.length > 0 ? { sameAs: [...person.socials] } : {}),
});

/** The about page: a profile page whose main entity is the owner. */
export const profilePageJsonLd = (person: PersonInput): Exclude<ProfilePage, string> => ({
	"@type": "ProfilePage",
	url: pageUrl("/about"),
	inLanguage: getLocale(),
	mainEntity: personJsonLd(person),
});

/** A list page (work index, journal) in the current language. */
export const collectionPageJsonLd = (input: { name: string; description: string; path: string }) =>
	({
		"@type": "CollectionPage",
		name: input.name,
		description: input.description,
		url: pageUrl(input.path),
		inLanguage: getLocale(),
		author: personRef(),
	}) satisfies Exclude<CollectionPage, string>;

/** The journal as a Blog. */
export const blogJsonLd = (input: { name: string; description: string }): Exclude<Blog, string> => ({
	"@type": "Blog",
	name: input.name,
	description: input.description,
	url: pageUrl("/journal"),
	inLanguage: getLocale(),
	author: personRef(),
});

export type CaseStudyJsonLdInput = {
	title: string;
	summary: string;
	slug: string;
	year: number;
	client: string;
	stack: ReadonlyArray<string>;
};

/** A case study: the project as a CreativeWork by the owner, made for the client. */
export const caseStudyJsonLd = (project: CaseStudyJsonLdInput): Exclude<CreativeWork, string> => {
	const url = pageUrl(`/work/${project.slug}`);
	return {
		"@type": "CreativeWork",
		"@id": `${url}#work`,
		name: project.title,
		description: project.summary,
		url,
		dateCreated: String(project.year),
		inLanguage: getLocale(),
		keywords: project.stack.join(", "),
		creator: personRef(),
		sourceOrganization: { "@type": "Organization", name: project.client },
	};
};

export type ArticleJsonLdInput = {
	title: string;
	excerpt: string;
	slug: string;
	publishedAt: string;
	tags: ReadonlyArray<string>;
};

/** A journal article. */
export const articleJsonLd = (post: ArticleJsonLdInput): Exclude<BlogPosting, string> => {
	const url = pageUrl(`/journal/${post.slug}`);
	return {
		"@type": "BlogPosting",
		"@id": `${url}#article`,
		headline: post.title,
		description: post.excerpt,
		url,
		mainEntityOfPage: url,
		datePublished: post.publishedAt,
		inLanguage: getLocale(),
		keywords: post.tags.join(", "),
		author: personRef(),
	};
};
