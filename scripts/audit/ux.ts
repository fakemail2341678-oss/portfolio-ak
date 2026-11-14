/**
 * Audit: every reviewed page's use of the width, its anatomy, and what its first load asks the
 * server for, from the files an audit run of the browser review leaves (e2e/support/audit.ts):
 *
 *   AUDIT_DIR=.data/audit/ux AUDIT_WIDTHS=1280,1920 pnpm exec playwright test --project review --workers=2 --grep "light (1280|1920) › en"
 *   node scripts/audit/ux.ts
 *
 * The screenshots stay in .data/audit/ux/screens/<width>/ (not committed: about 350 pictures).
 *
 * - **Empty side space:** at 1920 the first screen's content spans less than SHARE_FLOOR of the
 *   width beside the sidebar.
 * - **Anatomy unlike the others:** no <h1> or several, no <main> or several, and, among pages
 *   with a sidebar, no breadcrumbs.
 * - **The first load asks for more:** the browser called a server function while the page loaded.
 *
 * Prints the lists and writes docs/history/part9-audit/ux.json.
 * Part 9 Task 98.
 */
import { existsSync, readdirSync } from "node:fs";
import { layerOf, print, read, save, tally } from "./lib.ts";

const DIR = process.argv[2] ?? ".data/audit/ux";
const SHARE_FLOOR = 0.75;

type PageAudit = {
	route: string;
	variant: string;
	locale: string;
	width: number;
	url: string;
	calls: string[];
	contentLeft: number;
	main: { left: number; width: number } | null;
	used: { left: number; right: number };
	share: number;
	emptyLeft: number;
	emptyRight: number;
	anatomy: {
		mains: number;
		h1: number;
		h1Text: string;
		h1Top: number | null;
		breadcrumbs: boolean;
		sidebar: boolean;
		header: boolean;
		footer: boolean;
		tabs: number;
		tables: number;
		forms: number;
		scrollHeight: number;
	};
	title: string;
};

if (!existsSync(DIR)) {
	console.error(`No audit run in ${DIR}: see this file's header for the command.`);
	process.exit(1);
}
const pages = readdirSync(DIR)
	.filter((name) => name.endsWith(".json"))
	.map((name) => JSON.parse(read(`${DIR}/${name}`)) as PageAudit);
/** The layer of a reviewed page, from its route. */
const layer = (page: PageAudit) =>
	layerOf(`src/routes${page.route.split(" ")[0] ?? ""}/`.replace("/app/", "/_").replace("/admin/", "/"));
const section = (page: PageAudit) => {
	const route = page.route.split(" ")[0] ?? "";
	if (route.startsWith("/admin")) return "admin";
	if (route.startsWith("/app/")) return `app: ${route.split("/")[2] ?? ""}`;
	if (route.startsWith("/apps")) return "apps";
	if (route.startsWith("/dev")) return "dev";
	if (route.startsWith("/account") || route.startsWith("/auth") || /sign-|password|verify/.test(route))
		return "account and auth";
	return "site";
};

const at = (width: number) => pages.filter((page) => page.width === width);
const wide = at(1920);
const desktop = at(1280);
const narrow = wide.filter((page) => page.share < SHARE_FLOOR).sort((a, b) => a.share - b.share);
const asks = desktop.filter((page) => page.calls.length > 0).sort((a, b) => b.calls.length - a.calls.length);
const oddHeading = desktop.filter((page) => page.anatomy.h1 !== 1);
const oddMain = desktop.filter((page) => page.anatomy.mains !== 1);
const noCrumbs = desktop.filter((page) => page.anatomy.sidebar && !page.anatomy.breadcrumbs);
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;

print("Pages audited", { "at 1280": desktop.length, "at 1920": wide.length });
print(
	"Median share of the width used at 1920, by section",
	Object.fromEntries(
		[...new Set(wide.map(section))].sort().map((name) => {
			const own = wide.filter((page) => section(page) === name);
			return [
				name,
				`${Math.round(median(own.map((page) => page.share)) * 100)}% (${own.length} pages, ${own.filter((page) => page.share < SHARE_FLOOR).length} under ${SHARE_FLOOR * 100}%)`,
			];
		}),
	),
);
print(`Pages under ${SHARE_FLOOR * 100}% at 1920, by section`, tally(narrow, section));
print("The first load called a server function, by section", tally(asks, section));
print("Anatomy at 1280", {
	"no <h1>": desktop.filter((page) => page.anatomy.h1 === 0).length,
	"several <h1>": desktop.filter((page) => page.anatomy.h1 > 1).length,
	"not exactly one <main>": oddMain.length,
	"a sidebar and no breadcrumbs": noCrumbs.length,
	"a sidebar and breadcrumbs": desktop.filter((page) => page.anatomy.sidebar && page.anatomy.breadcrumbs).length,
});
print("A sidebar and no breadcrumbs, by section", tally(noCrumbs, section));

const brief = (page: PageAudit) => ({
	route: page.route,
	section: section(page),
	layer: layer(page),
	share: page.share,
	emptyLeft: page.emptyLeft,
	emptyRight: page.emptyRight,
});
save("ux", {
	generated: "an audit run of the browser review (see scripts/audit/ux.ts), then node scripts/audit/ux.ts",
	shareFloor: SHARE_FLOOR,
	pages: { at1280: desktop.length, at1920: wide.length },
	emptySideSpaceAt1920: narrow.map(brief),
	firstLoadAsksForMore: asks.map((page) => ({ route: page.route, section: section(page), calls: page.calls })),
	anatomy: {
		noOrSeveralH1: oddHeading.map((page) => ({ route: page.route, h1: page.anatomy.h1 })),
		notOneMain: oddMain.map((page) => ({ route: page.route, mains: page.anatomy.mains })),
		sidebarWithoutBreadcrumbs: noCrumbs.map((page) => page.route),
	},
	all: pages
		.sort((a, b) => a.route.localeCompare(b.route) || a.width - b.width)
		.map((page) => ({
			...brief(page),
			width: page.width,
			url: page.url,
			calls: page.calls.length,
			anatomy: page.anatomy,
		})),
});
