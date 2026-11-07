import { useQuery } from "@tanstack/react-query";
import { Link, type LinkProps } from "@tanstack/react-router";
import { sessionQueryOptions } from "@/features/auth/queries";
import { useAuthNavigation } from "@/features/auth/use-auth-actions";
import { canEnterAdmin } from "@/features/rbac/permissions";
import { clientEnv } from "@/lib/env/client";
import { m } from "@/paraglide/messages";
import { LanguageSwitcher } from "./language-switcher";
import { NavigationProgress } from "./navigation-progress";
import { ThemeToggle } from "./theme";

const navLink =
	"rounded-md px-2 py-1 text-muted-foreground text-sm outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[status=active]:font-medium data-[status=active]:text-foreground";

/** A section link in the header. `label` is a message, called at render time. */
export type SiteHeaderLink = { to: LinkProps["to"]; label: () => string; exact?: boolean };

/**
 * The app header. There is no global header: each layout that wants one renders
 * it with its own section links (`/dev` passes the demo's; the auth, account,
 * admin and public layouts pass none). Always: the brand (to `/`), Admin when
 * permitted, account or sign-in, language and theme (decision 0161).
 */
export function SiteHeader({ links = [] }: { links?: ReadonlyArray<SiteHeaderLink> }) {
	// Filled by the root route's beforeLoad, so it's available during SSR and hydration.
	const { data: session } = useQuery(sessionQueryOptions());
	const { signOut } = useAuthNavigation();
	const admin = session && canEnterAdmin(session.permissions);

	return (
		<header className="border-b">
			<NavigationProgress />
			{/* Wraps onto two rows on narrow screens instead of overflowing. */}
			<div className="mx-auto flex min-h-14 max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
				{/* Brand name from config (VITE_APP_TITLE), identical in every locale. */}
				<Link to="/" className="font-semibold tracking-tight">
					{clientEnv.VITE_APP_TITLE}
				</Link>
				{links.length > 0 || admin ? (
					<nav aria-label={m.nav_label()} className="flex flex-wrap items-center gap-1">
						{links.map((link) => (
							<Link key={link.to} to={link.to} className={navLink} activeOptions={{ exact: link.exact ?? false }}>
								{link.label()}
							</Link>
						))}
						{admin ? (
							<Link to="/admin" className={navLink}>
								{m.nav_admin()}
							</Link>
						) : null}
					</nav>
				) : null}
				<div className="ml-auto flex flex-wrap items-center gap-2">
					<LanguageSwitcher />
					<ThemeToggle />
					{session ? (
						<>
							<Link to="/account" className={navLink} data-testid="nav-account">
								{m.nav_account()}
							</Link>
							<button type="button" onClick={signOut} className={navLink}>
								{m.nav_logout()}
							</button>
						</>
					) : (
						<Link to="/login" className={navLink} data-testid="nav-login">
							{m.nav_login()}
						</Link>
					)}
				</div>
			</div>
		</header>
	);
}
