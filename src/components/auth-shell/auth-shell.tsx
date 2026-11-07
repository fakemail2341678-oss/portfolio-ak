import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BrandName } from "@/components/brand/brand";
import { ContourArt } from "@/components/brand/contour-art";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { ConsentSettingsButton } from "@/components/layout/observability";
import { ThemeToggle } from "@/components/layout/theme";
import { m } from "@/paraglide/messages";

/**
 * The frame of the sign-in pages and the public one-off pages (verify email, reset
 * password, health): the page in a column on the left, under a slim header (brand,
 * language, theme); on wide screens a brand panel with contour art on the right
 * (decorative). One column on phones. The page renders its own <main>.
 */
export function AuthShell({ children }: { children: ReactNode }) {
	return (
		<div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
			<div className="flex min-h-dvh flex-col">
				<NavigationProgress />
				<header className="flex h-14 items-center justify-between gap-4 px-4 sm:px-8">
					<Link to="/" className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
						<BrandName />
					</Link>
					<div className="flex items-center gap-1">
						<LanguageSwitcher />
						<ThemeToggle />
					</div>
				</header>
				<div className="flex flex-1 flex-col">{children}</div>
				<footer className="flex flex-wrap items-center justify-between gap-2 px-4 py-4 text-caption text-muted-foreground sm:px-8">
					<span>{m.footer_built_with()}</span>
					<ConsentSettingsButton />
				</footer>
			</div>
			<div
				className="relative hidden overflow-hidden border-s bg-surface-1 text-primary lg:block"
				data-testid="auth-brand-panel"
			>
				<ContourArt className="absolute inset-0 size-full" />
				{/* A soft fade into the panel's colour at the bottom edge. */}
				<div className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-surface-1 to-transparent" />
			</div>
		</div>
	);
}
