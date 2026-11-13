import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
	ChartPieIcon,
	HouseIcon,
	KeyboardIcon,
	LanguagesIcon,
	LogOutIcon,
	SettingsIcon,
	UserIcon,
	UserPlusIcon,
	UsersIcon,
	WalletIcon,
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
import { KHARCHA_PATHS, kharchaLinks } from "../links";
import { CREATE_ACTIONS, type CreateAction } from "./actions";
import { CREATE_ITEMS } from "./create-menu";

const LANGUAGE_NAMES: Record<Locale, () => string> = { en: m.language_en, ne: m.language_ne };

/**
 * Kharcha's palette (Ctrl/⌘ K, PLAN 14.5 "Keyboard"): its pages, the + menu's actions, the
 * shortcuts, theme, language and signing out. Each task adds its pages and actions (Spend's
 * searches in 93).
 */
export function KharchaPalette({
	open,
	onOpenChange,
	onOpenShortcuts,
	onCreate,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onOpenShortcuts: () => void;
	onCreate: (action: CreateAction) => void;
}) {
	const navigate = useNavigate();
	const { setTheme } = useTheme();
	const href = useRouterState({ select: (state) => state.location.href });
	const { data: session } = useQuery(sessionQueryOptions());
	const { signOut } = useAuthNavigation({ signedOutTo: KHARCHA_PATHS.landing });
	const guest = session?.isAnonymous === true;
	const run = (action: () => void) => {
		onOpenChange(false);
		action();
	};
	const go = (navigation: () => Promise<void>) => run(() => void navigation());

	return (
		<CommandDialog
			open={open}
			onOpenChange={onOpenChange}
			title={m.command_title()}
			description={m.command_description()}
			className="top-[18%] translate-y-0 sm:max-w-xl"
		>
			<CommandInput placeholder={m.kharcha_palette_placeholder()} data-testid="command-input" />
			<CommandList>
				<CommandEmpty>{m.command_empty()}</CommandEmpty>
				<CommandGroup heading={m.command_group_actions()}>
					{CREATE_ACTIONS.map((action) => {
						const { icon: Icon, label } = CREATE_ITEMS[action];
						return (
							<CommandItem
								key={action}
								value={`create ${action}`}
								keywords={[label()]}
								onSelect={() => run(() => onCreate(action))}
							>
								<Icon aria-hidden />
								<span>{label()}</span>
							</CommandItem>
						);
					})}
					<CommandItem value="shortcuts" keywords={[m.kharcha_shortcuts_title()]} onSelect={() => run(onOpenShortcuts)}>
						<KeyboardIcon aria-hidden />
						<span>{m.kharcha_shortcuts_title()}</span>
					</CommandItem>
				</CommandGroup>
				<CommandGroup heading={m.command_group_pages()}>
					<CommandItem
						value="go home"
						keywords={[m.kharcha_nav_home()]}
						onSelect={() => go(() => navigate(kharchaLinks.home()))}
					>
						<HouseIcon aria-hidden />
						<span>{m.kharcha_nav_home()}</span>
					</CommandItem>
					<CommandItem
						value="go spend"
						keywords={[m.kharcha_nav_spend()]}
						onSelect={() => go(() => navigate(kharchaLinks.spend()))}
					>
						<WalletIcon aria-hidden />
						<span>{m.kharcha_nav_spend()}</span>
					</CommandItem>
					<CommandItem
						value="go insights"
						keywords={[m.kharcha_nav_insights(), m.kharcha_insights_budgets(), m.kharcha_insights_statement()]}
						onSelect={() => go(() => navigate(kharchaLinks.insights("overview")))}
					>
						<ChartPieIcon aria-hidden />
						<span>{m.kharcha_nav_insights()}</span>
					</CommandItem>
					<CommandItem
						value="go people"
						keywords={[m.kharcha_nav_people()]}
						onSelect={() => go(() => navigate(kharchaLinks.people()))}
					>
						<UsersIcon aria-hidden />
						<span>{m.kharcha_nav_people()}</span>
					</CommandItem>
					<CommandItem
						value="go settings"
						keywords={[m.kharcha_nav_settings()]}
						onSelect={() => go(() => navigate(kharchaLinks.settings("categories")))}
					>
						<SettingsIcon aria-hidden />
						<span>{m.kharcha_nav_settings()}</span>
					</CommandItem>
					{guest ? (
						<CommandItem
							value="sign up"
							keywords={[m.guest_create_account()]}
							onSelect={() => go(() => navigate(kharchaLinks.signUp(href)))}
						>
							<UserPlusIcon aria-hidden />
							<span>{m.guest_create_account()}</span>
						</CommandItem>
					) : (
						<CommandItem
							value="go account"
							keywords={[m.nav_account()]}
							onSelect={() => go(() => navigate(kharchaLinks.account()))}
						>
							<UserIcon aria-hidden />
							<span>{m.nav_account()}</span>
						</CommandItem>
					)}
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
				</CommandGroup>
			</CommandList>
		</CommandDialog>
	);
}
