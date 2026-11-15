import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
	BookOpenIcon,
	ChartSplineIcon,
	FlameIcon,
	HouseIcon,
	InfoIcon,
	KeyboardIcon,
	LanguagesIcon,
	LinkIcon,
	LogInIcon,
	LogOutIcon,
	MedalIcon,
	PuzzleIcon,
	RadioTowerIcon,
	SettingsIcon,
	SwordsIcon,
	TrophyIcon,
	TvIcon,
	UsersIcon,
} from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { THEME_ICONS, THEME_LABELS } from "@/components/layout/theme";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command";
import { useAuthNavigation } from "@/features/auth/hooks/use-auth-actions";
import { sessionQueryOptions } from "@/features/auth/queries";
import { THEMES } from "@/lib/stores/preferences";
import { useTheme } from "@/lib/stores/use-stores";
import { m } from "@/paraglide/messages";
import { getLocale, type Locale, locales, localizeHref } from "@/paraglide/runtime";
import { canConnect, connectionState, useConnectLichess } from "../../connect/hooks/use-connect";
import { CHAAL_PATHS, chaalLinks } from "../../links";
import { chaalConnectionQueryOptions, chaalStatusQueryOptions } from "../../queries";

const PalettePlayers = lazy(() => import("./players-palette"));

const LANGUAGE_NAMES: Record<Locale, () => string> = { en: m.language_en, ne: m.language_ne };

/**
 * Chaal's palette (Ctrl/⌘ K, PLAN 13.6): its pages, connecting Lichess, the shortcuts,
 * theme, language, and signing in or out; players found by name (Task 81, loaded with the
 * first search), and each page's actions with their tasks.
 */
export function ChaalPalette({
	open,
	onOpenChange,
	onOpenShortcuts,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onOpenShortcuts: () => void;
}) {
	const navigate = useNavigate();
	const { setTheme } = useTheme();
	const href = useRouterState({ select: (state) => state.location.href });
	const { data: session } = useQuery(sessionQueryOptions());
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const { data: connection } = useQuery({ ...chaalConnectionQueryOptions(), enabled: Boolean(session) });
	const { connect } = useConnectLichess();
	const { signOut } = useAuthNavigation({ signedOutTo: CHAAL_PATHS.home });
	const state = connectionState(connection);
	const [term, setTerm] = useState("");
	const close = (next: boolean) => {
		if (!next) setTerm("");
		onOpenChange(next);
	};
	const run = (action: () => void) => {
		close(false);
		action();
	};
	const go = (navigation: () => Promise<void>) => run(() => void navigation());
	const member = session && !session.isAnonymous;

	return (
		<CommandDialog
			open={open}
			onOpenChange={close}
			title={m.command_title()}
			description={m.command_description()}
			className="top-[18%] translate-y-0 sm:max-w-xl"
		>
			<CommandInput
				placeholder={m.chaal_palette_placeholder()}
				value={term}
				onValueChange={setTerm}
				data-testid="command-input"
			/>
			<CommandList>
				<CommandEmpty>{m.command_empty()}</CommandEmpty>
				{status?.features.players !== false && term.trim().length >= 3 ? (
					<Suspense fallback={null}>
						<PalettePlayers term={term} onPick={(username) => go(() => navigate(chaalLinks.player(username)))} />
					</Suspense>
				) : null}
				<CommandGroup heading={m.command_group_pages()}>
					<CommandItem
						value="go home"
						keywords={[m.chaal_nav_home()]}
						onSelect={() => go(() => navigate(chaalLinks.home()))}
					>
						<HouseIcon aria-hidden />
						<span>{m.chaal_nav_home()}</span>
					</CommandItem>
					<CommandItem
						value="go play"
						keywords={[m.chaal_nav_play(), m.chaal_local_vs_computer(), m.chaal_local_over_board()]}
						onSelect={() => go(() => navigate(chaalLinks.play()))}
					>
						<SwordsIcon aria-hidden />
						<span>{m.chaal_play_title()}</span>
					</CommandItem>
					<CommandItem
						value="go puzzles"
						keywords={[m.chaal_nav_puzzles(), m.chaal_puzzle_daily(), m.chaal_puzzle_streak()]}
						onSelect={() => go(() => navigate(chaalLinks.puzzles()))}
					>
						<PuzzleIcon aria-hidden />
						<span>{m.chaal_puzzles_title()}</span>
					</CommandItem>
					<CommandItem
						value="go puzzle streak"
						keywords={[m.chaal_puzzle_streak()]}
						onSelect={() => go(() => navigate(chaalLinks.puzzles({ mode: "streak" })))}
					>
						<FlameIcon aria-hidden />
						<span>{m.chaal_puzzle_streak()}</span>
					</CommandItem>
					<CommandItem
						value="go players"
						keywords={[m.chaal_players_title(), m.chaal_players_leaderboards()]}
						onSelect={() => go(() => navigate(chaalLinks.players()))}
					>
						<TrophyIcon aria-hidden />
						<span>{m.chaal_players_title()}</span>
					</CommandItem>
					<CommandItem
						value="go watch"
						keywords={[m.chaal_nav_watch(), m.chaal_watch_tv()]}
						onSelect={() => go(() => navigate(chaalLinks.watch()))}
					>
						<TvIcon aria-hidden />
						<span>{m.chaal_watch_title()}</span>
					</CommandItem>
					<CommandItem
						value="go broadcasts"
						keywords={[m.chaal_broadcasts_title()]}
						onSelect={() => go(() => navigate(chaalLinks.broadcasts()))}
					>
						<RadioTowerIcon aria-hidden />
						<span>{m.chaal_broadcasts_title()}</span>
					</CommandItem>
					<CommandItem
						value="go tournaments"
						keywords={[m.chaal_tournaments_title(), m.chaal_palette_arena()]}
						onSelect={() => go(() => navigate(chaalLinks.tournaments()))}
					>
						<MedalIcon aria-hidden />
						<span>{m.chaal_tournaments_title()}</span>
					</CommandItem>
					<CommandItem
						value="go teams"
						keywords={[m.chaal_teams_title()]}
						onSelect={() => go(() => navigate(chaalLinks.teams()))}
					>
						<UsersIcon aria-hidden />
						<span>{m.chaal_teams_title()}</span>
					</CommandItem>
					<CommandItem
						value="go studies"
						keywords={[m.chaal_studies_title()]}
						onSelect={() => go(() => navigate(chaalLinks.studies()))}
					>
						<BookOpenIcon aria-hidden />
						<span>{m.chaal_studies_title()}</span>
					</CommandItem>
					<CommandItem
						value="go analysis"
						keywords={[m.chaal_nav_analysis(), m.chaal_analysis_title()]}
						onSelect={() => go(() => navigate(chaalLinks.analysis()))}
					>
						<ChartSplineIcon aria-hidden />
						<span>{m.chaal_analysis_title()}</span>
					</CommandItem>
					<CommandItem
						value="go settings"
						keywords={[m.chaal_settings_title()]}
						onSelect={() => go(() => navigate(chaalLinks.settings()))}
					>
						<SettingsIcon aria-hidden />
						<span>{m.chaal_settings_title()}</span>
					</CommandItem>
					<CommandItem
						value="go about"
						keywords={[m.chaal_about_title()]}
						onSelect={() => go(() => navigate(chaalLinks.about()))}
					>
						<InfoIcon aria-hidden />
						<span>{m.chaal_about_title()}</span>
					</CommandItem>
				</CommandGroup>
				<CommandGroup heading={m.command_group_actions()}>
					{canConnect(status) && state !== "ok" ? (
						<CommandItem
							value="connect lichess"
							keywords={[m.chaal_connect(), "Lichess"]}
							onSelect={() => run(() => void connect())}
						>
							<LinkIcon aria-hidden />
							<span>{state === "attention" ? m.chaal_reconnect() : m.chaal_connect()}</span>
						</CommandItem>
					) : null}
					<CommandItem value="shortcuts" keywords={[m.chaal_shortcuts_title()]} onSelect={() => run(onOpenShortcuts)}>
						<KeyboardIcon aria-hidden />
						<span>{m.chaal_shortcuts_title()}</span>
					</CommandItem>
				</CommandGroup>
				<CommandSeparator />
				<CommandGroup heading={m.command_group_preferences()}>
					{THEMES.map((theme) => {
						const Icon = THEME_ICONS[theme];
						return (
							<CommandItem
								key={theme}
								value={`theme ${theme}`}
								keywords={[m.theme_label(), THEME_LABELS[theme]()]}
								onSelect={() => run(() => setTheme(theme))}
							>
								<Icon aria-hidden />
								<span>{m.command_theme({ theme: THEME_LABELS[theme]() })}</span>
							</CommandItem>
						);
					})}
					{locales
						.filter((locale) => locale !== getLocale())
						.map((locale) => (
							<CommandItem
								key={locale}
								value={`language ${locale}`}
								keywords={[m.language_switcher_label(), LANGUAGE_NAMES[locale]()]}
								// A full load: the new language is rendered by the server (like the language switcher).
								onSelect={() => run(() => window.location.assign(localizeHref(href, { locale })))}
							>
								<LanguagesIcon aria-hidden />
								<span>{m.command_language({ language: LANGUAGE_NAMES[locale]() })}</span>
							</CommandItem>
						))}
					{session ? (
						<CommandItem value="sign-out" keywords={[m.nav_logout()]} onSelect={() => run(() => void signOut())}>
							<LogOutIcon aria-hidden />
							<span>{m.nav_logout()}</span>
						</CommandItem>
					) : null}
					{member ? null : (
						<CommandItem
							value="sign-in"
							keywords={[m.chaal_sign_in()]}
							onSelect={() => go(() => navigate(chaalLinks.signIn(href)))}
						>
							<LogInIcon aria-hidden />
							<span>{m.chaal_sign_in()}</span>
						</CommandItem>
					)}
				</CommandGroup>
			</CommandList>
		</CommandDialog>
	);
}
