import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ClockIcon, LanguagesIcon, LayoutDashboardIcon, LogOutIcon } from "lucide-react";
import { useEffect, useState } from "react";
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
import { permittedCommands } from "@/features/admin/commands";
import { ADMIN_SECTIONS, type AdminPath, permittedSections } from "@/features/admin/sections";
import { useAuthNavigation } from "@/features/auth/use-auth-actions";
import { usePermissions } from "@/features/rbac/can";
import { useTheme } from "@/lib/stores/hooks";
import { THEMES } from "@/lib/stores/preferences";
import { m } from "@/paraglide/messages";
import { getLocale, type Locale, locales, localizeHref } from "@/paraglide/runtime";

const RECENT_KEY = "admin-recent-pages";
const RECENT_MAX = 5;

/**
 * Recently opened admin pages, newest first: a per-browser convenience in
 * localStorage, so every access is wrapped (private windows and blocked storage throw).
 */
const readRecent = (): string[] => {
	try {
		const value: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
		return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
	} catch {
		return [];
	}
};

const rememberRecent = (path: string) => {
	try {
		const next = [path, ...readRecent().filter((item) => item !== path)].slice(0, RECENT_MAX);
		window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
	} catch {
		// Storage unavailable: the palette simply shows no recent pages.
	}
};

const LANGUAGE_NAMES: Record<Locale, () => string> = { en: m.language_en, ne: m.language_ne };

/**
 * The admin command palette (cmdk; decision 0165, which replaced the 0140 recipe):
 * recent pages, every section and feature action the user may open (the same
 * permission filter as the sidebar; routes and server functions check again),
 * theme, language and sign out.
 */
export function CommandMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
	const navigate = useNavigate();
	const permissions = usePermissions();
	const { setTheme } = useTheme();
	const { signOut } = useAuthNavigation();
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const href = useRouterState({ select: (state) => state.location.href });
	const sections = permittedSections(permissions);
	const commands = permittedCommands(permissions);
	const pages = [
		{ to: "/admin" as const, label: m.admin_nav_dashboard, icon: LayoutDashboardIcon, keywords: undefined },
		...sections,
	];
	const [recent, setRecent] = useState<string[]>([]);

	// Remember admin pages as they are opened (only the palette's own targets).
	useEffect(() => {
		if (pathname === "/admin" || ADMIN_SECTIONS.some((section) => section.to === pathname)) rememberRecent(pathname);
	}, [pathname]);

	useEffect(() => {
		if (open) setRecent(readRecent());
	}, [open]);

	const run = (action: () => void) => {
		onOpenChange(false);
		action();
	};
	const go = (to: AdminPath | "/admin") => run(() => void navigate({ to, viewTransition: true }));
	const recentPages = recent
		.filter((path) => path !== pathname)
		.flatMap((path) => pages.filter((page) => page.to === path));

	return (
		<CommandDialog
			open={open}
			onOpenChange={onOpenChange}
			title={m.command_title()}
			description={m.command_description()}
			className="top-[18%] translate-y-0 sm:max-w-xl"
		>
			<CommandInput placeholder={m.command_placeholder()} data-testid="command-input" />
			<CommandList>
				<CommandEmpty>{m.command_empty()}</CommandEmpty>
				{recentPages.length > 0 ? (
					<CommandGroup heading={m.command_group_recent()}>
						{recentPages.map((page) => (
							<CommandItem
								key={page.to}
								value={`recent ${page.to}`}
								keywords={[page.label()]}
								onSelect={() => go(page.to)}
							>
								<ClockIcon aria-hidden />
								<span>{page.label()}</span>
							</CommandItem>
						))}
					</CommandGroup>
				) : null}
				<CommandGroup heading={m.command_group_pages()}>
					{pages.map((page) => (
						<CommandItem
							key={page.to}
							value={page.to}
							keywords={[page.label(), ...(page.keywords?.().split(" ") ?? [])]}
							onSelect={() => go(page.to)}
						>
							<page.icon aria-hidden />
							<span>{page.label()}</span>
						</CommandItem>
					))}
				</CommandGroup>
				{commands.length > 0 ? (
					<CommandGroup heading={m.command_group_actions()}>
						{commands.map((command) => (
							<CommandItem
								key={command.id}
								value={command.id}
								keywords={[command.label(), ...(command.keywords?.().split(" ") ?? [])]}
								onSelect={() => go(command.to)}
							>
								<command.icon aria-hidden />
								<span>{command.label()}</span>
							</CommandItem>
						))}
					</CommandGroup>
				) : null}
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
					<CommandItem value="sign-out" keywords={[m.nav_logout()]} onSelect={() => run(() => void signOut())}>
						<LogOutIcon aria-hidden />
						<span>{m.nav_logout()}</span>
					</CommandItem>
				</CommandGroup>
			</CommandList>
		</CommandDialog>
	);
}
