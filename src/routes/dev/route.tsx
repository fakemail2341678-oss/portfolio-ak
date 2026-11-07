import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { ConfirmProvider } from "@/components/dialogs/confirm";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader, type SiteHeaderLink } from "@/components/layout/site-header";
import { staticCrumb } from "@/lib/breadcrumbs";
import { DEV_ROUTES } from "@/lib/dev-routes";
import { fontPreloads } from "@/lib/fonts";
import { NOINDEX } from "@/lib/seo";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

/**
 * The demo and developer references under /dev: the demo home, /dev/stack,
 * the public Test CRUD pages, /dev/forms and /dev/examples. They exist only when
 * DEV_ROUTES is on (`vite dev`, or a build made with VITE_DEV_ROUTES=true): in
 * a plain build every page here answers with the localized 404 before its loader
 * runs, and their server functions refuse too (devOnlyMiddleware). Never indexed.
 */
export const Route = createFileRoute("/dev")({
	beforeLoad: () => {
		if (!DEV_ROUTES) throw notFound();
	},
	staticData: { breadcrumb: staticCrumb(m.nav_dev) },
	head: () => ({ meta: [NOINDEX], links: fontPreloads(getLocale()) }),
	component: DevLayout,
});

/** Section links, labels called at render time. */
const DEV_LINKS: ReadonlyArray<SiteHeaderLink> = [
	{ to: "/dev", label: m.nav_dev, exact: true },
	{ to: "/dev/stack", label: m.nav_stack },
	{ to: "/dev/test-crud", label: m.nav_test_crud },
	{ to: "/dev/examples", label: m.nav_examples },
];

function DevLayout() {
	return (
		<ConfirmProvider>
			<SiteHeader links={DEV_LINKS} />
			<div className="flex-1">
				<Outlet />
			</div>
			<SiteFooter />
		</ConfirmProvider>
	);
}
