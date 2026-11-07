import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import {
	ChevronsUpDownIcon,
	LanguagesIcon,
	LayoutDashboardIcon,
	LogOutIcon,
	SlidersHorizontalIcon,
	UserIcon,
	UserPlusIcon,
} from "lucide-react";
import { UserAvatar } from "@/components/data-display/user-avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sessionQueryOptions } from "@/features/auth/queries";
import { useAuthNavigation } from "@/features/auth/use-auth-actions";
import { canEnterAdmin } from "@/features/rbac/permissions";
import { m } from "@/paraglide/messages";
import { getLocale, localizeHref } from "@/paraglide/runtime";
import { TASKLINE_PATHS, tasklineLinks } from "../links";

/**
 * The signed-in user's menu inside Taskline: their Taskline account page (a guest is
 * offered Taskline's sign-up instead), the other language, the admin area when they
 * may enter it, and sign out, which lands on Taskline's own landing.
 */
export function TasklineUserMenu({ variant = "compact" }: { variant?: "compact" | "sidebar" }) {
	const { data: session } = useQuery(sessionQueryOptions());
	const { signOut } = useAuthNavigation({ signedOutTo: TASKLINE_PATHS.landing });
	const location = useLocation();
	if (!session) return null;
	const guest = session.isAnonymous === true;
	const name = guest ? m.guest_label() : session.user.name;
	const email = guest ? "" : session.user.email;
	const other = getLocale() === "en" ? "ne" : "en";
	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				{variant === "sidebar" ? (
					<Button
						variant="ghost"
						className="h-auto w-full justify-start gap-2 px-1.5 py-1.5 text-start group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0.5"
						data-testid="user-menu"
					>
						<UserAvatar name={name} email={email} />
						<span className="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
							<span className="truncate font-medium text-body leading-5">{name || email}</span>
							<span className="truncate text-caption text-muted-foreground">{email || m.taskline_guest_sandbox()}</span>
						</span>
						<ChevronsUpDownIcon className="text-muted-foreground group-data-[collapsible=icon]:hidden" aria-hidden />
					</Button>
				) : (
					<Button variant="ghost" size="icon" data-testid="user-menu">
						<UserAvatar name={name} email={email} />
						<span className="sr-only">{m.user_menu_label({ name: name || email })}</span>
					</Button>
				)}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" side={variant === "sidebar" ? "top" : "bottom"} className="min-w-56">
				<DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
					<span className="truncate font-medium">{name || email}</span>
					{email ? <span className="truncate text-caption text-muted-foreground">{email}</span> : null}
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					{guest ? (
						<DropdownMenuItem asChild>
							<Link {...tasklineLinks.signUp(location.href)} data-testid="nav-upgrade">
								<UserPlusIcon aria-hidden />
								{m.guest_create_account()}
							</Link>
						</DropdownMenuItem>
					) : (
						<DropdownMenuItem asChild>
							<Link {...tasklineLinks.account()} data-testid="nav-account">
								<UserIcon aria-hidden />
								{m.nav_account()}
							</Link>
						</DropdownMenuItem>
					)}
					<DropdownMenuItem asChild>
						<Link {...tasklineLinks.mySettings()} data-testid="nav-my-settings">
							<SlidersHorizontalIcon aria-hidden />
							{m.taskline_my_settings()}
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
				<DropdownMenuItem onSelect={() => void signOut()} data-testid="sign-out">
					<LogOutIcon aria-hidden />
					{m.nav_logout()}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
