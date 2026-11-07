import { localizeHref } from "@/paraglide/runtime";
import { absoluteUrl } from "./seo";

/**
 * Breadcrumbs are declared on routes, not pages: a route that should appear in
 * the trail sets `staticData: { breadcrumb }`, and <Breadcrumbs> walks the
 * matched routes (TanStack Router's documented pattern). Layout routes
 * (`route.tsx`) name sections, leaf routes name pages.
 *
 *   staticData: { breadcrumb: staticCrumb(m.test_crud_title) }   // fixed, localized label
 *   staticData: { breadcrumb: loaderTitleCrumb }                  // the loader's `title`
 *   staticData: { breadcrumb: ({ params }) => label(params.ws) }   // from the URL
 *
 * A layout whose child can 404 takes its label from the URL, not its loader: when a
 * child throws notFound during SSR, the browser hydrates the layout's match without
 * its loader data, and a label from it would not match the server's HTML.
 */
export type BreadcrumbSource = (match: { loaderData: unknown; params: Record<string, string> }) => string | undefined;

declare module "@tanstack/react-router" {
	interface StaticDataRouteOption {
		/** Label of this route in the breadcrumb trail; omit to leave the route out. */
		breadcrumb?: BreadcrumbSource;
	}
}

/** A fixed label (a Paraglide message, called at render time so it follows the locale). */
export const staticCrumb =
	(label: () => string): BreadcrumbSource =>
	() =>
		label();

/** The `title` of the route's loader data (detail pages whose loader returns the item). */
export const loaderTitleCrumb: BreadcrumbSource = ({ loaderData }) =>
	typeof loaderData === "object" &&
	loaderData !== null &&
	"title" in loaderData &&
	typeof loaderData.title === "string" &&
	loaderData.title !== ""
		? loaderData.title
		: undefined;

export type Crumb = { label: string; path: string };

type CrumbMatch = {
	pathname: string;
	loaderData?: unknown;
	params?: Record<string, string>;
	staticData: { breadcrumb?: BreadcrumbSource | undefined };
};

const normalize = (pathname: string) => (pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname);

/**
 * The trail for the matched routes, outermost first. A layout route and its index
 * route share a path ("/admin" and "/admin/"); the deeper label wins, so an index
 * route may rename its section.
 */
export function crumbsFromMatches(matches: ReadonlyArray<CrumbMatch>): Crumb[] {
	const crumbs: Crumb[] = [];
	for (const match of matches) {
		const label = match.staticData.breadcrumb?.({ loaderData: match.loaderData, params: match.params ?? {} });
		if (!label) continue;
		const path = normalize(match.pathname);
		const previous = crumbs.at(-1);
		if (previous?.path === path) previous.label = label;
		else crumbs.push({ label, path });
	}
	return crumbs;
}

/** schema.org BreadcrumbList for the trail (absolute, localized URLs). */
export const breadcrumbJsonLd = (crumbs: ReadonlyArray<Crumb>) => ({
	"@context": "https://schema.org",
	"@type": "BreadcrumbList",
	itemListElement: crumbs.map((crumb, index) => ({
		"@type": "ListItem",
		position: index + 1,
		name: crumb.label,
		item: absoluteUrl(localizeHref(crumb.path)),
	})),
});

/** JSON for an inline <script type="application/ld+json">: "<" is escaped so content can't close the tag. */
export const serializeJsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
