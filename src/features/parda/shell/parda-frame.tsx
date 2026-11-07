import { Link, type LinkOptions } from "@tanstack/react-router";
import {
	BookmarkIcon,
	ClapperboardIcon,
	CompassIcon,
	HouseIcon,
	InfoIcon,
	type LucideIcon,
	SparklesIcon,
	TvIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { ConsentSettingsButton } from "@/components/layout/observability";
import { ThemeToggle } from "@/components/layout/theme";
import { m } from "@/paraglide/messages";
import { pardaLinks } from "../links";
import { PardaBell } from "../schedule/bell";
import { PardaSearchButton } from "../search/search-button";
import { PardaGuestBanner } from "./guest-banner";
import { PardaNoticeBanner } from "./notice-banner";
import { PardaWordmark } from "./parda-mark";
import { PardaUserMenu } from "./parda-user-menu";

/**
 * Parda's sections: the top mask's links on wide screens, the tab bar on phones.
 * A link arrives with its route (PLAN 12.3): Home and About (Task 61), the hubs (Task 62),
 * Discover (Task 66), My List (Task 67). About isn't in the tab bar: the footer links it on
 * every page. My List is in the top mask from `lg` (the account menu has it below).
 */
const SECTIONS: ReadonlyArray<{
	link: LinkOptions;
	label: () => string;
	icon: LucideIcon;
	exact?: boolean;
	testId: string;
	/** In the phone's tab bar too. */
	tab?: false;
	/** In the top mask only from `lg` (`xl` for About, decision 0240): below it the footer or the account menu has it. */
	wide?: "lg" | "xl";
}> = [
	{ link: pardaLinks.home(), label: m.pd_nav_home, icon: HouseIcon, exact: true, testId: "parda-nav-home" },
	{ link: pardaLinks.hub("movies"), label: m.pd_hub_movies, icon: ClapperboardIcon, testId: "parda-nav-movies" },
	{ link: pardaLinks.hub("series"), label: m.pd_hub_series, icon: TvIcon, testId: "parda-nav-series" },
	{ link: pardaLinks.hub("anime"), label: m.pd_hub_anime, icon: SparklesIcon, testId: "parda-nav-anime" },
	{ link: pardaLinks.discover(), label: m.pd_nav_discover, icon: CompassIcon, testId: "parda-nav-discover" },
	{ link: pardaLinks.library(), label: m.pd_my_list, icon: BookmarkIcon, testId: "parda-nav-library", wide: "lg" },
	{
		link: pardaLinks.about(),
		label: m.pd_nav_about,
		icon: InfoIcon,
		testId: "parda-nav-about",
		tab: false,
		wide: "xl",
	},
];

const focusRing = "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * The top mask (decision 0232): always solid, 60 px, the wordmark at the start, the
 * sections beside it, search, language (from `lg`; the footer has it below), theme and
 * account at the end. Nothing in it sits on
 * a picture, so it never needs a scrim.
 */
function PardaHeader() {
	return (
		<header className="sticky top-0 z-40 bg-pd-mask text-pd-ink" data-testid="parda-header">
			<div className="flex h-15 items-center gap-4 px-4 sm:px-6 lg:gap-6 lg:px-8">
				<Link {...pardaLinks.home()} className={`-mx-1 px-1 py-1 ${focusRing}`} data-testid="parda-home-link">
					<PardaWordmark />
					<span className="sr-only">{m.pd_nav_home()}</span>
				</Link>
				<nav aria-label={m.pd_nav_label()} className="max-md:hidden">
					<ul className="flex items-center gap-1">
						{SECTIONS.map((section) => (
							<li
								key={section.testId}
								className={section.wide === "xl" ? "max-xl:hidden" : section.wide ? "max-lg:hidden" : undefined}
							>
								<Link
									{...section.link}
									activeOptions={{ exact: section.exact ?? false }}
									className={`block whitespace-nowrap px-2 py-2 text-pd-muted lg:px-3 text-sm transition-colors hover:text-pd-ink aria-[current=page]:text-pd-ink aria-[current=page]:shadow-[inset_0_-2px_0_var(--pd-action)] ${focusRing}`}
									data-testid={section.testId}
								>
									{section.label()}
								</Link>
							</li>
						))}
					</ul>
				</nav>
				<div className="ms-auto flex items-center gap-1">
					<PardaSearchButton />
					<LanguageSwitcher className="max-lg:hidden" />
					<ThemeToggle />
					<PardaBell />
					<PardaUserMenu />
				</div>
			</div>
		</header>
	);
}

/**
 * The phone's tab bar, fixed to the bottom mask. Rendered by the server like the
 * rest, and hidden by CSS from `md` up, so nothing moves when the page hydrates.
 */
function PardaTabBar() {
	return (
		<nav
			aria-label={m.pd_tabs_label()}
			className="fixed inset-x-0 bottom-0 z-40 bg-pd-mask pb-[env(safe-area-inset-bottom)] md:hidden"
			data-testid="parda-tab-bar"
		>
			<ul className="grid h-14 auto-cols-fr grid-flow-col">
				{SECTIONS.filter((section) => section.tab !== false).map((section) => {
					const Icon = section.icon;
					return (
						<li key={section.testId} className="flex">
							<Link
								{...section.link}
								activeOptions={{ exact: section.exact ?? false }}
								className={`flex flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem] text-pd-muted aria-[current=page]:text-pd-ink ${focusRing}`}
							>
								<Icon aria-hidden className="size-5" />
								{section.label()}
							</Link>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}

/**
 * The footer, in the mask: the notice page, the schedule, the other language on
 * phones, and the analytics choice. Parda is the owner's own, so it names no
 * catalogue provider (decision 0249).
 */
function PardaFooter() {
	return (
		<footer className="bg-pd-mask text-pd-muted text-sm" data-testid="parda-footer">
			<div className="flex flex-col gap-4 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
				<PardaWordmark className="text-pd-ink" />
				<div className="flex flex-wrap items-center gap-x-5 gap-y-2">
					<Link {...pardaLinks.about()} className={`underline-offset-4 hover:underline ${focusRing}`}>
						{m.pd_footer_about()}
					</Link>
					<Link {...pardaLinks.schedule()} className={`underline-offset-4 hover:underline ${focusRing}`}>
						{m.pd_schedule_title()}
					</Link>
					<LanguageSwitcher className="lg:hidden" />
					<ConsentSettingsButton />
				</div>
			</div>
		</footer>
	);
}

/**
 * Parda's frame on every page (PLAN Task 61): the top mask, the page, the footer,
 * and on phones the tab bar, whose height the page keeps clear. The page renders its
 * own <main>.
 */
export function PardaFrame({ children }: { children: ReactNode }) {
	return (
		<div
			className="flex min-h-dvh flex-col bg-pd-ground text-pd-ink max-md:pb-[calc(3.5rem+env(safe-area-inset-bottom))]"
			data-testid="parda-frame"
		>
			<NavigationProgress />
			<PardaHeader />
			<PardaNoticeBanner />
			<PardaGuestBanner />
			<div className="flex flex-1 flex-col">{children}</div>
			<PardaFooter />
			<PardaTabBar />
		</div>
	);
}
