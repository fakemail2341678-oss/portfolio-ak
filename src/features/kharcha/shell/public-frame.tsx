import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { ConsentSettingsButton } from "@/components/layout/observability";
import { ThemeToggle } from "@/components/layout/theme";
import { Button } from "@/components/ui/button";
import { sessionQueryOptions } from "@/features/auth/queries";
import { m } from "@/paraglide/messages";
import { KharchaWordmark } from "../kit/wordmark";
import { kharchaLinks } from "../links";
import { KharchaArt } from "./kharcha-art";

function KharchaHeader({ actions = true }: { actions?: boolean }) {
	const { data: session } = useQuery(sessionQueryOptions());
	return (
		<header className="flex h-14 items-center justify-between gap-2 bg-kh-cloth px-3 text-kh-on-cloth shadow-[inset_0_-2px_0_var(--kh-thread)] sm:px-8">
			<Link
				{...kharchaLinks.landing()}
				className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-kh-thread"
			>
				<KharchaWordmark onCloth compact className="text-[1.0625rem]" />
			</Link>
			<div className="flex items-center gap-1 [&_button]:text-kh-on-cloth [&_button:hover]:bg-kh-cloth-deep [&_button:hover]:text-kh-on-cloth">
				<LanguageSwitcher className="[&_a:hover]:bg-kh-cloth-deep [&_a[aria-current]]:text-kh-on-cloth [&_a]:text-kh-cloth-muted [&_a]:focus-visible:ring-kh-thread" />
				<ThemeToggle />
				{actions ? (
					session ? (
						<Button asChild size="sm" variant="secondary" className="ms-1">
							<Link {...kharchaLinks.home()}>{m.kharcha_open_app()}</Link>
						</Button>
					) : (
						<>
							<Button
								asChild
								variant="ghost"
								size="sm"
								className="text-kh-on-cloth hover:bg-kh-cloth-deep hover:text-kh-on-cloth max-sm:hidden"
							>
								<Link {...kharchaLinks.signIn()} data-testid="kharcha-sign-in-link">
									{m.kharcha_sign_in()}
								</Link>
							</Button>
							<Button asChild size="sm" variant="secondary" className="ms-1">
								<Link {...kharchaLinks.signUp()}>{m.kharcha_sign_up()}</Link>
							</Button>
						</>
					)
				) : null}
			</div>
		</header>
	);
}

function KharchaFooter() {
	return (
		<footer className="flex flex-wrap items-center justify-between gap-2 border-kh-hair border-t bg-kh-page px-4 py-4 text-caption text-kh-muted sm:px-8">
			<span>{m.kharcha_footer()}</span>
			<ConsentSettingsButton />
		</footer>
	);
}

/**
 * Kharcha's public frame: the landing and a 404 for visitors. Its own red header (the
 * wordmark, language, theme, sign in and sign up, or "Open Kharcha" when signed in) and
 * footer: nothing of the site's or the apps' chrome. The page renders its <main>.
 */
export function KharchaPublicFrame({ children }: { children: ReactNode }) {
	return (
		<div className="flex flex-1 flex-col bg-kh-ground text-kh-ink" data-testid="kharcha-public-frame">
			<NavigationProgress />
			<KharchaHeader />
			<div className="flex flex-1 flex-col">{children}</div>
			<KharchaFooter />
		</div>
	);
}

/**
 * The frame of Kharcha's sign-in and sign-up: the form in a column under the header, and
 * on wide screens a page of the book beside it (decorative). The page renders its own <main>.
 */
export function KharchaAuthFrame({ children }: { children: ReactNode }) {
	return (
		<div className="grid flex-1 bg-kh-ground text-kh-ink lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
			<div className="flex min-h-dvh flex-col bg-kh-page">
				<NavigationProgress />
				<KharchaHeader actions={false} />
				<div className="flex flex-1 flex-col">{children}</div>
				<KharchaFooter />
			</div>
			<div className="relative hidden border-kh-hair border-s lg:block" data-testid="kharcha-auth-panel">
				<KharchaArt className="absolute inset-x-12 top-1/2 -translate-y-1/2" />
			</div>
		</div>
	);
}
