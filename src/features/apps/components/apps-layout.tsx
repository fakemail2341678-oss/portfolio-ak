import { useQuery } from "@tanstack/react-query";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import {
	BookOpenIcon, // @portfolio
	ChevronDownIcon,
	LayoutGridIcon,
} from "lucide-react";
import { UserMenu } from "@/components/admin-shell/user-menu";
import { BrandName } from "@/components/brand/brand";
import { ConfirmProvider } from "@/components/dialogs/confirm";
import { DbScope } from "@/components/layout/db-scope";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { ThemeToggle } from "@/components/layout/theme";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sessionQueryOptions } from "@/features/auth/queries";
import { appCaseStudiesQueryOptions } from "@/features/portfolio/queries"; // @portfolio
import { GUEST_LIFETIME_DAYS } from "@/lib/guests";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { APPS, type AppEntry, appBySlug, appPath, isAppSlug } from "../registry";

/** The app a path is in (/apps/<slug>/…), if any. */
const appOfPath = (pathname: string): AppEntry | null => {
	const slug = pathname.split("/")[2];
	return isAppSlug(slug) ? appBySlug(slug) : null;
};

/**
 * The showcase apps' frame (decision 0187): the app header (the brand, an app
 * switcher, a link to the app's case study, language, theme, the user), the guest
 * banner, and what every app page needs: confirms and TanStack DB (`DbScope`, 0189).
 */
export function AppsLayout() {
	return (
		<ConfirmProvider>
			<DbScope>
				<NavigationProgress />
				<AppsHeader />
				<GuestBanner />
				<Outlet />
			</DbScope>
		</ConfirmProvider>
	);
}

function AppsHeader() {
	const { data: session } = useQuery(sessionQueryOptions());
	const location = useLocation();
	const current = appOfPath(location.pathname);
	// portfolio:start
	const { data: caseStudies } = useQuery(appCaseStudiesQueryOptions());
	const caseStudy = current ? caseStudies?.find((study) => study.app === current.slug) : undefined;
	// portfolio:end
	return (
		<header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
			<div className="mx-auto flex h-12 max-w-6xl items-center gap-1 px-4">
				<Link to="/" className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
					{/* The name is read, not shown, on phones: the header has the app switcher too. */}
					<BrandName className="max-sm:[&>span]:sr-only" />
				</Link>
				<span className="px-1 text-muted-foreground max-sm:hidden" aria-hidden>
					/
				</span>
				<AppSwitcher current={current} />
				<div className="ms-auto flex items-center gap-1">
					{/* portfolio:start */}
					{caseStudy ? (
						<Button asChild variant="ghost" size="sm" className="max-sm:hidden">
							<Link to="/work/$slug" params={{ slug: caseStudy.slug }}>
								<BookOpenIcon aria-hidden />
								{m.apps_case_study()}
							</Link>
						</Button>
					) : null}
					{/* portfolio:end */}
					<LanguageSwitcher />
					<ThemeToggle />
					{session ? (
						<UserMenu />
					) : (
						// Not on phones: there the landings carry their own sign-in button.
						<Button asChild variant="ghost" size="sm" className="max-sm:hidden">
							<Link to="/login" search={{ redirect: location.href }}>
								{m.nav_login()}
							</Link>
						</Button>
					)}
				</div>
			</div>
		</header>
	);
}

/** Every app, and the gallery. */
function AppSwitcher({ current }: { current: AppEntry | null }) {
	const Icon = current?.icon ?? LayoutGridIcon;
	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="sm" className="gap-1.5 font-medium" data-testid="app-switcher">
					<Icon aria-hidden />
					{current ? current.name() : m.apps_title()}
					<ChevronDownIcon className="text-muted-foreground" aria-hidden />
					<span className="sr-only">{m.apps_switch()}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="min-w-64">
				{APPS.map((app) => (
					<DropdownMenuItem key={app.slug} asChild>
						<Link to={appPath(app.slug)} className="flex items-start gap-2">
							<app.icon className="mt-0.5" aria-hidden />
							<span className="flex flex-col">
								<span className="font-medium">{app.name()}</span>
								<span className="text-caption text-muted-foreground">{app.tagline()}</span>
							</span>
						</Link>
					</DropdownMenuItem>
				))}
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link to="/apps">
						<LayoutGridIcon aria-hidden />
						{m.apps_all()}
					</Link>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** Shown to a guest (decision 0185) on every app page: how long their data lives, and how to keep it. */
function GuestBanner() {
	const { data: session } = useQuery(sessionQueryOptions());
	const location = useLocation();
	if (!session?.isAnonymous) return null;
	return (
		<aside aria-label={m.guest_banner_label()} className="border-b bg-info-subtle" data-testid="guest-banner">
			<p className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-caption">
				<span>{m.guest_banner({ days: formatNumber(GUEST_LIFETIME_DAYS) })}</span>
				<Link to="/register" search={{ redirect: location.href }} className="font-medium underline underline-offset-4">
					{m.guest_banner_action()}
				</Link>
			</p>
		</aside>
	);
}
