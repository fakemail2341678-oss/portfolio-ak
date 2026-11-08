import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
	ChartSplineIcon,
	HouseIcon,
	InfoIcon,
	KeyboardIcon,
	LanguagesIcon,
	LinkIcon,
	LogInIcon,
	LogOutIcon,
	SettingsIcon,
	SwordsIcon,
} from "lucide-react";
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
import { sessionQueryOptions } from "@/features/auth/queries";
import { useAuthNavigation } from "@/features/auth/use-auth-actions";
import { useTheme } from "@/lib/stores/hooks";
import { THEMES } from "@/lib/stores/preferences";
import { m } from "@/paraglide/messages";
import { getLocale, type Locale, locales, localizeHref } from "@/paraglide/runtime";
import { canConnect, connectionState, useConnectLichess } from "../connect/use-connect";
import { CHAAL_PATHS, chaalLinks } from "../links";
import { chaalConnectionQueryOptions, chaalStatusQueryOptions } from "../queries";

const LANGUAGE_NAMES: Record<Locale, () => string> = { en: m.language_en, ne: m.language_ne };

/**
 * Chaal's palette (Ctrl/⌘ K, PLAN 13.6): its pages, connecting Lichess, the shortcuts,
 * theme, language, and signing in or out. Players join it with their pages (Task 81),
 * and each page's actions with their tasks.
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
	const run = (action: () => void) => {
		onOpenChange(false);
		action();
	};
	const go = (navigation: () => Promise<void>) => run(() => void navigation());
	const member = session && !session.isAnonymous;

	return (
		<CommandDialog
			open={open}
			onOpenChange={onOpenChange}
			title={m.command_title()}
			description={m.command_description()}
			className="top-[18%] translate-y-0 sm:max-w-xl"
		>
			<CommandInput placeholder={m.ch_palette_placeholder()} data-testid="command-input" />
			<CommandList>
				<CommandEmpty>{m.command_empty()}</CommandEmpty>
				<CommandGroup heading={m.command_group_pages()}>
					<CommandItem
						value="go home"
						keywords={[m.ch_nav_home()]}
						onSelect={() => go(() => navigate(chaalLinks.home()))}
					>
						<HouseIcon aria-hidden />
						<span>{m.ch_nav_home()}</span>
					</CommandItem>
					<CommandItem
						value="go play"
						keywords={[m.ch_nav_play(), m.ch_local_vs_computer(), m.ch_local_over_board()]}
						onSelect={() => go(() => navigate(chaalLinks.play()))}
					>
						<SwordsIcon aria-hidden />
						<span>{m.ch_play_title()}</span>
					</CommandItem>
					<CommandItem
						value="go analysis"
						keywords={[m.ch_nav_analysis(), m.ch_analysis_title()]}
						onSelect={() => go(() => navigate(chaalLinks.analysis()))}
					>
						<ChartSplineIcon aria-hidden />
						<span>{m.ch_analysis_title()}</span>
					</CommandItem>
					<CommandItem
						value="go settings"
						keywords={[m.ch_settings_title()]}
						onSelect={() => go(() => navigate(chaalLinks.settings()))}
					>
						<SettingsIcon aria-hidden />
						<span>{m.ch_settings_title()}</span>
					</CommandItem>
					<CommandItem
						value="go about"
						keywords={[m.ch_about_title()]}
						onSelect={() => go(() => navigate(chaalLinks.about()))}
					>
						<InfoIcon aria-hidden />
						<span>{m.ch_about_title()}</span>
					</CommandItem>
				</CommandGroup>
				<CommandGroup heading={m.command_group_actions()}>
					{canConnect(status) && state !== "ok" ? (
						<CommandItem
							value="connect lichess"
							keywords={[m.ch_connect(), "Lichess"]}
							onSelect={() => run(() => void connect())}
						>
							<LinkIcon aria-hidden />
							<span>{state === "attention" ? m.ch_reconnect() : m.ch_connect()}</span>
						</CommandItem>
					) : null}
					<CommandItem value="shortcuts" keywords={[m.ch_shortcuts_title()]} onSelect={() => run(onOpenShortcuts)}>
						<KeyboardIcon aria-hidden />
						<span>{m.ch_shortcuts_title()}</span>
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
							keywords={[m.ch_sign_in()]}
							onSelect={() => go(() => navigate(chaalLinks.signIn(href)))}
						>
							<LogInIcon aria-hidden />
							<span>{m.ch_sign_in()}</span>
						</CommandItem>
					)}
				</CommandGroup>
			</CommandList>
		</CommandDialog>
	);
}
