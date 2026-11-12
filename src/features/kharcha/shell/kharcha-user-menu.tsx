import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { LanguagesIcon, LayoutDashboardIcon, LogOutIcon, SettingsIcon, UserIcon, UserPlusIcon } from "lucide-react";
import { isTheme, THEME_ICONS, THEME_LABELS } from "@/components/layout/theme";
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
import { getLocale, localizeHref } from "@/paraglide/runtime";
import { PersonAvatar } from "../kit/person-avatar";
import { KHARCHA_PATHS, kharchaLinks } from "../links";
import type { KharchaPerson } from "../types";

/**
 * The caller's menu (PLAN 14.5 "UX"): their account (a guest is offered sign-up, which keeps
 * their sample data), their settings (Task 89: categories, tags, methods, rules), the other language, the theme, the admin area when they may enter it,
 * and sign out, back to Kharcha's landing. The trigger is their plate: at the rail's foot on
 * a laptop, in the red top bar on a phone.
 */
export function KharchaUserMenu({ person, place }: { person: KharchaPerson | undefined; place: "rail" | "bar" }) {
	const { data: session } = useQuery(sessionQueryOptions());
	const { signOut } = useAuthNavigation({ signedOutTo: KHARCHA_PATHS.landing });
	const { theme, setTheme } = useTheme();
	const location = useLocation();
	if (!session) return null;
	const guest = session.isAnonymous === true;
	const name = guest ? m.guest_label() : person?.name || session.user.name || session.user.email;
	const email = guest ? "" : session.user.email;
	const other = getLocale() === "en" ? "ne" : "en";
	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger
				className={cn(
					"kh-ease grid size-11 place-items-center rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-kh-thread",
					place === "rail" ? "hover:bg-kh-cloth-deep" : "hover:bg-kh-cloth-deep/70",
				)}
				data-testid="user-menu"
			>
				<PersonAvatar name={name} color={person?.color ?? "gray"} />
				<span className="sr-only">{m.user_menu_label({ name })}</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align={place === "rail" ? "start" : "end"}
				side={place === "rail" ? "right" : "bottom"}
				className="min-w-60"
			>
				<DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
					<span className="truncate font-medium">{name}</span>
					{email ? <span className="truncate text-caption text-muted-foreground">{email}</span> : null}
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					{guest ? (
						<DropdownMenuItem asChild>
							<Link {...kharchaLinks.signUp(location.href)} data-testid="nav-upgrade">
								<UserPlusIcon aria-hidden />
								{m.guest_create_account()}
							</Link>
						</DropdownMenuItem>
					) : (
						<DropdownMenuItem asChild>
							<Link {...kharchaLinks.account()} data-testid="nav-account">
								<UserIcon aria-hidden />
								{m.nav_account()}
							</Link>
						</DropdownMenuItem>
					)}
					<DropdownMenuItem asChild>
						<Link {...kharchaLinks.settings("categories")} data-testid="nav-settings">
							<SettingsIcon aria-hidden />
							{m.kharcha_nav_settings()}
						</Link>
					</DropdownMenuItem>
					{/* A full load: the server renders the other language (like the language switcher). */}
					<DropdownMenuItem asChild>
						<a href={localizeHref(location.href, { locale: other })} hrefLang={other}>
							<LanguagesIcon aria-hidden />
							{m.command_language({ language: other === "en" ? m.language_en() : m.language_ne() })}
						</a>
					</DropdownMenuItem>
					{canEnterAdmin(session.permissions) ? (
						<DropdownMenuItem asChild>
							<Link to="/admin">
								<LayoutDashboardIcon aria-hidden />
								{m.nav_admin()}
							</Link>
						</DropdownMenuItem>
					) : null}
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
				<DropdownMenuItem onSelect={() => void signOut()} data-testid="sign-out">
					<LogOutIcon aria-hidden />
					{m.nav_logout()}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
