import { queryOptions } from "@tanstack/react-query";
import {
	getAbout,
	getAppCaseStudies, // @apps
	getArticle,
	getCaseStudy,
	getHome,
	getJournal,
	getPublicProfile,
	getWork,
} from "@/functions/portfolio-public";
import { getLocale } from "@/paraglide/runtime";

/**
 * The public pages' reads (decision 0176): one server function per page, so a
 * page is one round trip. Loaders `ensureQuery` these (pages arrive complete)
 * and components read them with useSuspenseQuery; the database is only ever
 * read on the server, a client-side navigation calls the function. Keys
 * include the locale: content is resolved per language. A preview is its own
 * entry (it may hold a draft).
 */

const scope = () => ["portfolio", getLocale()] as const;
const input = () => ({ data: { locale: getLocale() } });

export const portfolioKeys = {
	all: ["portfolio"] as const,
	profile: () => [...scope(), "profile"] as const,
	home: () => [...scope(), "home"] as const,
	work: () => [...scope(), "work"] as const,
	project: (slug: string, preview: boolean) => [...scope(), "project", slug, { preview }] as const,
	about: () => [...scope(), "about"] as const,
	journal: () => [...scope(), "journal"] as const,
	post: (slug: string, preview: boolean) => [...scope(), "post", slug, { preview }] as const,
};

/** The owner, for every page's header and footer. */
export const profileQueryOptions = () =>
	queryOptions({ queryKey: portfolioKeys.profile(), queryFn: () => getPublicProfile(input()) });

export const homeQueryOptions = () => queryOptions({ queryKey: portfolioKeys.home(), queryFn: () => getHome(input()) });

/** Every published project (the work index filters by discipline on the page). */
export const workQueryOptions = () => queryOptions({ queryKey: portfolioKeys.work(), queryFn: () => getWork(input()) });

export const projectQueryOptions = (slug: string, preview = false) =>
	queryOptions({
		queryKey: portfolioKeys.project(slug, preview),
		queryFn: () => getCaseStudy({ data: { locale: getLocale(), slug, preview } }),
	});

export const aboutQueryOptions = () =>
	queryOptions({ queryKey: portfolioKeys.about(), queryFn: () => getAbout(input()) });

export const journalQueryOptions = () =>
	queryOptions({ queryKey: portfolioKeys.journal(), queryFn: () => getJournal(input()) });

export const postQueryOptions = (slug: string, preview = false) =>
	queryOptions({
		queryKey: portfolioKeys.post(slug, preview),
		queryFn: () => getArticle({ data: { locale: getLocale(), slug, preview } }),
	});

// apps:start
/**
 * The published case studies of the showcase apps (a project's "App" field), for the apps'
 * header (decision 0187). Not per language: only slugs.
 */
export const appCaseStudiesQueryOptions = () =>
	queryOptions({ queryKey: [...portfolioKeys.all, "app-case-studies"] as const, queryFn: () => getAppCaseStudies() });
// apps:end
