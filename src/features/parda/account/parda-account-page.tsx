import { getRouteApi, Link } from "@tanstack/react-router";
import { LogOutIcon, UsersIcon } from "lucide-react";
import { useId } from "react";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { AccountSections } from "@/features/auth/components/account-page";
import { AccountSectionFrameProvider, type AccountSectionProps } from "@/features/auth/components/account-section";
import { useAuthNavigation } from "@/features/auth/use-auth-actions";
import { m } from "@/paraglide/messages";
import { PARDA_PATHS, pardaLinks } from "../links";

const route = getRouteApi("/_parda/app/parda/account");

/**
 * One section in Parda's look: no card (the Masking record's don'ts), a rule above it,
 * and from lg the title and its note in a column beside the form, so a long page scans.
 */
function PardaAccountSection({ id, title, description, children }: AccountSectionProps) {
	const headingId = useId();
	return (
		<section
			id={id}
			aria-labelledby={headingId}
			className="grid scroll-mt-20 gap-4 border-border border-t py-8 first-of-type:border-t-0 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-12"
		>
			<div className="flex flex-col gap-2">
				<h2 id={headingId} className="pd-display text-balance text-xl leading-tight">
					{title}
				</h2>
				{description ? <p className="max-w-prose text-pd-muted text-sm">{description}</p> : null}
			</div>
			<div className="flex min-w-0 max-w-xl flex-col gap-4">{children}</div>
		</section>
	);
}

/**
 * /app/parda/account (decision 0249): the shared account page's sections (profile, email,
 * password, two-factor, sign-in methods, sessions, data) in Parda's frame. The heading sits
 * in the mask like a title's; signing out stays in Parda.
 */
export function PardaAccountPage() {
	const { session } = route.useRouteContext();
	const { emailChanged } = route.useSearch();
	const { signOut } = useAuthNavigation({ signedOutTo: PARDA_PATHS.home });
	// The route sends visitors and guests elsewhere first.
	if (!session) return null;
	const { user } = session;
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="account-page">
			<div className="bg-pd-mask px-4 pt-10 pb-8 sm:px-6 lg:px-8">
				<div className="mx-auto flex max-w-5xl flex-col gap-6 md:flex-row md:items-end md:justify-between">
					<div className="flex min-w-0 flex-col gap-2">
						<h1 className="pd-display text-pd-title">{m.account_title()}</h1>
						<p className="flex min-w-0 flex-wrap gap-x-3 text-pd-muted">
							<span className="truncate font-medium text-pd-ink">{user.name}</span>
							<span className="truncate" data-testid="account-email">
								{user.email}
							</span>
						</p>
					</div>
					<div className="flex shrink-0 flex-wrap items-center gap-2">
						<Button asChild variant="ghost">
							<Link {...pardaLinks.profiles()}>
								<UsersIcon aria-hidden />
								{m.pd_nav_profiles()}
							</Link>
						</Button>
						<Button type="button" variant="outline" onClick={() => void signOut()}>
							<LogOutIcon aria-hidden />
							{m.nav_logout()}
						</Button>
					</div>
				</div>
			</div>
			<div className="px-4 pt-2 pb-16 sm:px-6 lg:px-8">
				<div className="mx-auto flex max-w-5xl flex-col">
					<AccountSectionFrameProvider value={PardaAccountSection}>
						<AccountSections
							user={user}
							emailChanged={emailChanged === 1}
							twoFactorRequested={false}
							accountPath={PARDA_PATHS.account}
						/>
					</AccountSectionFrameProvider>
				</div>
			</div>
		</main>
	);
}
