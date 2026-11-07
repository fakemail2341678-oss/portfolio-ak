import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronsUpDownIcon, LayoutDashboardIcon, LogOutIcon, PaletteIcon, UserIcon, UserPlusIcon } from "lucide-react";
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

/**
 * The signed-in user's menu: account, the admin area and appearance (when they may
 * enter it), sign out. `variant="sidebar"` shows the name and email next to the
 * avatar (the admin sidebar's footer); "compact" is the avatar alone (headers).
 * A guest (decision 0185) is "Guest", offered an account instead. Renders nothing
 * when signed out.
 */
export function UserMenu({ variant = "compact" }: { variant?: "compact" | "sidebar" }) {
	const { data: session } = useQuery(sessionQueryOptions());
	const { signOut } = useAuthNavigation();
	if (!session) return null;
	const guest = session.isAnonymous === true;
	// A guest's placeholder address means nothing to them.
	const name = guest ? m.guest_label() : session.user.name;
	const email = guest ? "" : session.user.email;
	const admin = canEnterAdmin(session.permissions);
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
							<span className="truncate text-caption text-muted-foreground">{email}</span>
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
							<Link to="/upgrade" data-testid="nav-upgrade">
								<UserPlusIcon aria-hidden />
								{m.guest_create_account()}
							</Link>
						</DropdownMenuItem>
					) : (
						<DropdownMenuItem asChild>
							<Link to="/account" data-testid="nav-account">
								<UserIcon aria-hidden />
								{m.nav_account()}
							</Link>
						</DropdownMenuItem>
					)}
					{admin ? (
						<>
							<DropdownMenuItem asChild>
								<Link to="/admin">
									<LayoutDashboardIcon aria-hidden />
									{m.nav_admin()}
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link to="/admin/settings/appearance">
									<PaletteIcon aria-hidden />
									{m.admin_nav_appearance()}
								</Link>
							</DropdownMenuItem>
						</>
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
