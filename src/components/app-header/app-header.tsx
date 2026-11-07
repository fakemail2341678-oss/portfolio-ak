import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { UserMenu } from "@/components/admin-shell/user-menu";
import { BrandName } from "@/components/brand/brand";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { ThemeToggle } from "@/components/layout/theme";
import { Button } from "@/components/ui/button";
import { sessionQueryOptions } from "@/features/auth/queries";
import { canEnterAdmin } from "@/features/rbac/permissions";
import { m } from "@/paraglide/messages";

/**
 * The compact header of signed-in pages outside the admin area (the account page;
 * the apps later): the brand, the admin area when the user may enter it, language,
 * theme and the user menu (account, sign out).
 */
export function AppHeader() {
	const { data: session } = useQuery(sessionQueryOptions());
	const admin = session && canEnterAdmin(session.permissions);
	return (
		<>
			<NavigationProgress />
			<header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
				<div className="mx-auto flex h-12 max-w-5xl items-center gap-2 px-4">
					<Link to="/" className="me-auto rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
						<BrandName />
					</Link>
					{admin ? (
						<nav aria-label={m.nav_label()}>
							<Button asChild variant="ghost" size="sm">
								<Link to="/admin">{m.nav_admin()}</Link>
							</Button>
						</nav>
					) : null}
					<LanguageSwitcher />
					<ThemeToggle />
					<UserMenu />
				</div>
			</header>
		</>
	);
}
