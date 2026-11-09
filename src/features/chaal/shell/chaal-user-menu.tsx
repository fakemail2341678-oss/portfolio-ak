import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import {
	LayoutDashboardIcon,
	LinkIcon,
	LogInIcon,
	LogOutIcon,
	SettingsIcon,
	UnlinkIcon,
	UserIcon,
	UserPlusIcon,
} from "lucide-react";
import { isTheme, THEME_ICONS, THEME_LABELS } from "@/components/layout/theme";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sessionQueryOptions } from "@/features/auth/queries";
import { useAuthNavigation } from "@/features/auth/use-auth-actions";
import { canEnterAdmin } from "@/features/rbac/permissions";
import { useTheme } from "@/lib/stores/hooks";
import { THEMES } from "@/lib/stores/preferences";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getLocale, type Locale, locales, localizeHref } from "@/paraglide/runtime";
import { type ConnectionState, canConnect, connectionState, useConnectLichess } from "../connect/use-connect";
import { useDisconnectLichess } from "../connect/use-disconnect";
import { CHAAL_PATHS, chaalLinks } from "../links";
import { chaalConnectionQueryOptions, chaalStatusQueryOptions } from "../queries";

const AUTH_PAGES = new Set(["/app/chaal/sign-in", "/app/chaal/sign-up"]);
const LANGUAGE_NAMES: Record<Locale, () => string> = { en: m.language_en, ne: m.language_ne };

const STATE_TEXT: Readonly<Record<ConnectionState, () => string>> = {
	ok: m.ch_connection_ok,
	attention: m.ch_connection_attention,
	none: m.ch_connection_none,
};

/**
 * The connection's dot (PLAN 13.6, "Instant": the state is a small dot): ink when Lichess is
 * connected, an open ring when it isn't, a ring in the danger colour when it needs a reconnect.
 */
export function ConnectionDot({ state, className }: { state: ConnectionState; className?: string }) {
	return (
		<span
			aria-hidden
			data-state={state}
			className={cn(
				"inline-block size-2 shrink-0 rounded-full border-[1.5px]",
				state === "ok" && "border-ch-ink bg-ch-ink",
				state === "none" && "border-ch-muted",
				state === "attention" && "border-destructive",
				className,
			)}
		/>
	);
}

/**
 * The top bar's account control (PLAN Task 73): a dot for the Lichess connection and who is
 * here, and a menu with connecting or disconnecting Lichess, the settings, theme, language,
 * the admin area when they may enter it, and signing in or out. Signing out stays in Chaal.
 */
export function ChaalUserMenu() {
	const { data: session } = useQuery(sessionQueryOptions());
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const { data: connection } = useQuery({ ...chaalConnectionQueryOptions(), enabled: Boolean(session) });
	const { signOut } = useAuthNavigation({ signedOutTo: CHAAL_PATHS.home });
	const { connect, pending: connecting } = useConnectLichess();
	const disconnect = useDisconnectLichess();
	const { theme, setTheme } = useTheme();
	const location = useLocation();
	const state = connectionState(connection);
	const guest = session?.isAnonymous === true;
	const member = Boolean(session) && !guest;
	const name = member ? session?.user.name || session?.user.email : null;
	const label = connection?.username ?? name ?? m.ch_menu_label();

	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="h-9 max-w-32 gap-2 border-ch-ink px-3 font-medium sm:max-w-44"
					data-testid="user-menu"
				>
					<ConnectionDot state={state} />
					<span className="truncate" dir={connection ? "ltr" : undefined}>
						{label}
					</span>
					<span className="sr-only">{`, ${STATE_TEXT[state]()}`}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-64">
				<DropdownMenuLabel className="flex flex-col gap-1 font-normal">
					<span className="truncate font-medium">{member ? name : guest ? m.guest_label() : m.ch_menu_visitor()}</span>
					<span
						className="flex items-center gap-2 text-caption text-muted-foreground"
						data-testid="chaal-connection-state"
					>
						<ConnectionDot state={state} />
						{connection ? m.ch_menu_lichess_as({ username: connection.username }) : STATE_TEXT[state]()}
					</span>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					{canConnect(status) && state !== "ok" ? (
						<DropdownMenuItem onSelect={() => void connect()} disabled={connecting} data-testid="chaal-connect">
							<LinkIcon aria-hidden />
							{state === "attention" ? m.ch_reconnect() : m.ch_connect()}
						</DropdownMenuItem>
					) : null}
					{connection ? (
						<DropdownMenuItem onSelect={() => void disconnect.ask()} disabled={disconnect.pending}>
							<UnlinkIcon aria-hidden />
							{m.ch_disconnect()}
						</DropdownMenuItem>
					) : null}
					<DropdownMenuItem asChild>
						<Link {...chaalLinks.settings()} data-testid="nav-settings">
							<SettingsIcon aria-hidden />
							{m.ch_settings_title()}
						</Link>
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuLabel className="text-caption text-muted-foreground">{m.theme_label()}</DropdownMenuLabel>
				<DropdownMenuRadioGroup value={theme} onValueChange={(value) => isTheme(value) && setTheme(value)}>
					{THEMES.map((option) => {
						const Icon = THEME_ICONS[option];
						return (
							<DropdownMenuRadioItem key={option} value={option}>
								<Icon aria-hidden />
								{THEME_LABELS[option]()}
							</DropdownMenuRadioItem>
						);
					})}
				</DropdownMenuRadioGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					{locales
						.filter((locale) => locale !== getLocale())
						.map((locale) => (
							<DropdownMenuItem key={locale} asChild>
								{/* A full load: the server renders the other language (like the language switcher). */}
								<a href={localizeHref(location.href, { locale })} hrefLang={locale} lang={locale}>
									{LANGUAGE_NAMES[locale]()}
								</a>
							</DropdownMenuItem>
						))}
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					{member ? (
						<DropdownMenuItem asChild>
							<Link to="/account" data-testid="nav-account">
								<UserIcon aria-hidden />
								{m.nav_account()}
							</Link>
						</DropdownMenuItem>
					) : AUTH_PAGES.has(location.pathname) ? null : (
						<>
							<DropdownMenuItem asChild>
								<Link {...chaalLinks.signIn(location.href)} data-testid="chaal-sign-in-link">
									<LogInIcon aria-hidden />
									{m.ch_sign_in()}
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link {...chaalLinks.signUp(location.href)} data-testid="nav-upgrade">
									<UserPlusIcon aria-hidden />
									{m.guest_create_account()}
								</Link>
							</DropdownMenuItem>
						</>
					)}
					{session && canEnterAdmin(session.permissions) ? (
						<DropdownMenuItem asChild>
							<Link to="/admin">
								<LayoutDashboardIcon aria-hidden />
								{m.nav_admin()}
							</Link>
						</DropdownMenuItem>
					) : null}
				</DropdownMenuGroup>
				{session ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={() => void signOut()} data-testid="sign-out">
							<LogOutIcon aria-hidden />
							{m.nav_logout()}
						</DropdownMenuItem>
					</>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
