import { Link, type LinkOptions } from "@tanstack/react-router";
import { HouseIcon, InfoIcon, type LucideIcon, MenuIcon, SearchIcon, SettingsIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { ConsentSettingsButton } from "@/components/layout/observability";
import { ThemeToggle } from "@/components/layout/theme";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useHotkeyLabel, useHotkeys } from "@/hooks/use-hotkeys";
import { m } from "@/paraglide/messages";
import { chaalLinks } from "../links";
import { useImportLocalPreferences } from "../settings/use-preferences";
import { ChaalWordmark } from "./chaal-mark";
import { ChaalPalette } from "./chaal-palette";
import { ChaalUserMenu } from "./chaal-user-menu";
import { ChaalNoticeBanner } from "./notice-banner";
import { ChaalShortcutsDialog } from "./shortcuts-dialog";

/**
 * Chaal's sections: the top bar's links on wide screens, the tab bar on phones (PLAN Task
 * 73: Play, Puzzles, Analysis, Watch, More). A link arrives with its route (PLAN 13.3):
 * Home now, Play with Task 76, Analysis with 75, Puzzles with 80, Watch with 82.
 */
const SECTIONS: ReadonlyArray<{
	link: LinkOptions;
	label: () => string;
	icon: LucideIcon;
	exact?: boolean;
	testId: string;
}> = [{ link: chaalLinks.home(), label: m.ch_nav_home, icon: HouseIcon, exact: true, testId: "chaal-nav-home" }];

const focusRing = "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** The pages behind "More" on phones, and in the footer everywhere. */
const MORE: ReadonlyArray<{ link: LinkOptions; label: () => string; icon: LucideIcon; testId: string }> = [
	{ link: chaalLinks.settings(), label: m.ch_settings_title, icon: SettingsIcon, testId: "chaal-more-settings" },
	{ link: chaalLinks.about(), label: m.ch_about_title, icon: InfoIcon, testId: "chaal-more-about" },
];

/**
 * The top bar (the contract's first viewport): 58 px, the wordmark, the sections with a 2 px
 * ink underline on the current one, and at the end the palette, language (from `lg`; the
 * footer has it below), theme and the account. Ruled off from the page with a heavy rule.
 */
function ChaalHeader({ onOpenPalette }: { onOpenPalette: () => void }) {
	const shortcut = useHotkeyLabel("mod+k");
	return (
		<header className="sticky top-0 z-40 border-ch-ink border-b-2 bg-ch-ground" data-testid="chaal-header">
			<div className="mx-auto flex h-[3.625rem] max-w-7xl items-center gap-4 px-4 sm:px-6 lg:gap-8 lg:px-8">
				<Link {...chaalLinks.home()} className={`-mx-1 px-1 py-1 ${focusRing}`} data-testid="chaal-home-link">
					<ChaalWordmark />
					<span className="sr-only">{m.ch_nav_home()}</span>
				</Link>
				<nav aria-label={m.ch_nav_label()} className="max-md:hidden">
					<ul className="flex items-center gap-1">
						{SECTIONS.map((section) => (
							<li key={section.testId}>
								<Link
									{...section.link}
									activeOptions={{ exact: section.exact ?? false }}
									className={`block whitespace-nowrap px-2 py-[1.125rem] text-ch-muted transition-colors hover:text-ch-ink aria-[current=page]:text-ch-ink aria-[current=page]:shadow-[inset_0_-2px_0_var(--ch-ink)] ${focusRing}`}
									data-testid={section.testId}
								>
									{section.label()}
								</Link>
							</li>
						))}
					</ul>
				</nav>
				<div className="ms-auto flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						onClick={onOpenPalette}
						className="gap-2 text-ch-muted"
						data-testid="chaal-search"
					>
						<SearchIcon aria-hidden />
						<span className="sr-only lg:not-sr-only">{m.ch_search()}</span>
						<Kbd className="max-lg:hidden" aria-hidden>
							{shortcut}
						</Kbd>
					</Button>
					<LanguageSwitcher className="max-lg:hidden" />
					<ThemeToggle />
					<ChaalUserMenu />
				</div>
			</div>
		</header>
	);
}

/** "More" on phones: the pages that aren't tabs, search and the shortcuts' palette. */
function MoreSheet({ onOpenPalette }: { onOpenPalette: () => void }) {
	const [open, setOpen] = useState(false);
	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger
				className={`flex flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem] text-ch-muted ${focusRing}`}
				data-testid="chaal-more"
			>
				<MenuIcon aria-hidden className="size-5" />
				{m.ch_nav_more()}
			</SheetTrigger>
			<SheetContent side="bottom" className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
				<SheetHeader>
					<SheetTitle className="ch-display text-ch-head">{m.ch_nav_more()}</SheetTitle>
					<SheetDescription className="sr-only">{m.ch_more_description()}</SheetDescription>
				</SheetHeader>
				<ul className="flex flex-col px-4">
					{MORE.map((item) => {
						const Icon = item.icon;
						return (
							<li key={item.testId} className="ch-hairline">
								<Link
									{...item.link}
									onClick={() => setOpen(false)}
									className={`flex items-center gap-3 py-3.5 ${focusRing}`}
									data-testid={item.testId}
								>
									<Icon aria-hidden className="size-5 text-ch-muted" />
									{item.label()}
								</Link>
							</li>
						);
					})}
					<li className="ch-hairline">
						<button
							type="button"
							onClick={() => {
								setOpen(false);
								onOpenPalette();
							}}
							className={`flex w-full items-center gap-3 py-3.5 text-start ${focusRing}`}
						>
							<SearchIcon aria-hidden className="size-5 text-ch-muted" />
							{m.ch_search()}
						</button>
					</li>
				</ul>
				<div className="px-4 pt-2">
					<LanguageSwitcher />
				</div>
			</SheetContent>
		</Sheet>
	);
}

/**
 * The phone's tab bar: rendered by the server like the rest and hidden by CSS from `md` up,
 * so nothing moves when the page hydrates. The page keeps its height clear.
 */
function ChaalTabBar({ onOpenPalette }: { onOpenPalette: () => void }) {
	return (
		<nav
			aria-label={m.ch_tabs_label()}
			className="fixed inset-x-0 bottom-0 z-40 border-ch-ink border-t-2 bg-ch-ground pb-[env(safe-area-inset-bottom)] md:hidden"
			data-testid="chaal-tab-bar"
		>
			<ul className="grid h-14 auto-cols-fr grid-flow-col">
				{SECTIONS.map((section) => {
					const Icon = section.icon;
					return (
						<li key={section.testId} className="flex">
							<Link
								{...section.link}
								activeOptions={{ exact: section.exact ?? false }}
								className={`flex flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem] text-ch-muted aria-[current=page]:font-semibold aria-[current=page]:text-ch-ink ${focusRing}`}
							>
								<Icon aria-hidden className="size-5" />
								{section.label()}
							</Link>
						</li>
					);
				})}
				<li className="flex">
					<MoreSheet onOpenPalette={onOpenPalette} />
				</li>
			</ul>
		</nav>
	);
}

const footerLink = `underline-offset-4 hover:text-ch-ink hover:underline ${focusRing}`;

/**
 * The footer (PLAN 13.6, "Not a copy"): "Powered by Lichess, not affiliated" on every page,
 * the about page, the credits and the engine's source, the other language on phones, and
 * the analytics choice.
 */
function ChaalFooter() {
	return (
		<footer className="border-ch-hair border-t text-ch-muted text-sm" data-testid="chaal-footer">
			<div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
				<p>
					{m.ch_footer_powered_before()}
					<a href="https://lichess.org" rel="noopener" className={`text-ch-ink underline ${focusRing}`}>
						Lichess
					</a>
					{m.ch_footer_powered_after()}
				</p>
				<div className="flex flex-wrap items-center gap-x-5 gap-y-2">
					<Link {...chaalLinks.about()} className={footerLink}>
						{m.ch_about_title()}
					</Link>
					<Link {...chaalLinks.about("credits")} className={footerLink}>
						{m.ch_footer_credits()}
					</Link>
					<Link {...chaalLinks.about("stockfish")} className={footerLink}>
						{m.ch_footer_engine_source()}
					</Link>
					<LanguageSwitcher className="lg:hidden" />
					<ConsentSettingsButton />
				</div>
			</div>
		</footer>
	);
}

/**
 * Chaal's frame on every page (PLAN Task 73): the top bar, the admin's notice, the page, the
 * footer, and on phones the tab bar, whose height the page keeps clear. The palette (⌘K) and
 * the shortcuts (`?`) open from anywhere. The page renders its own <main>.
 */
export function ChaalFrame({ children }: { children: ReactNode }) {
	const [paletteOpen, setPaletteOpen] = useState(false);
	const [shortcutsOpen, setShortcutsOpen] = useState(false);
	useImportLocalPreferences();
	useHotkeys({
		"mod+k": () => setPaletteOpen((open) => !open),
		"shift+?": () => setShortcutsOpen(true),
	});
	const openPalette = () => setPaletteOpen(true);
	return (
		<div
			className="flex min-h-dvh flex-col bg-ch-ground text-ch-ink max-md:pb-[calc(3.5rem+env(safe-area-inset-bottom))]"
			data-testid="chaal-frame"
		>
			<NavigationProgress />
			<ChaalHeader onOpenPalette={openPalette} />
			<ChaalNoticeBanner />
			<div className="flex flex-1 flex-col">{children}</div>
			<ChaalFooter />
			<ChaalTabBar onOpenPalette={openPalette} />
			<ChaalPalette open={paletteOpen} onOpenChange={setPaletteOpen} onOpenShortcuts={() => setShortcutsOpen(true)} />
			<ChaalShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
		</div>
	);
}
