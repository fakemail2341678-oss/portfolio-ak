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
import { tasklineLinks } from "../links";
import { TasklineArt } from "./taskline-art";
import { TasklineWordmark } from "./taskline-mark";

function TasklineHeader({ actions = true }: { actions?: boolean }) {
	const { data: session } = useQuery(sessionQueryOptions());
	return (
		<header className="flex h-14 items-center justify-between gap-4 px-4 sm:px-8">
			<Link
				{...tasklineLinks.landing()}
				className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
			>
				<TasklineWordmark />
			</Link>
			<div className="flex items-center gap-1">
				<LanguageSwitcher />
				<ThemeToggle />
				{actions ? (
					session ? (
						<Button asChild size="sm" className="ms-1">
							<Link {...tasklineLinks.home()}>{m.taskline_open_app()}</Link>
						</Button>
					) : (
						<>
							<Button asChild variant="ghost" size="sm" className="max-sm:hidden">
								<Link {...tasklineLinks.signIn()} data-testid="taskline-sign-in-link">
									{m.taskline_sign_in()}
								</Link>
							</Button>
							<Button asChild size="sm" className="ms-1">
								<Link {...tasklineLinks.signUp()}>{m.taskline_sign_up()}</Link>
							</Button>
						</>
					)
				) : null}
			</div>
		</header>
	);
}

function TasklineFooter() {
	return (
		<footer className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-4 text-caption text-muted-foreground sm:px-8">
			<span>{m.taskline_footer()}</span>
			<ConsentSettingsButton />
		</footer>
	);
}

/**
 * Taskline's public frame: the landing and a 404 for visitors. Its own header (the
 * wordmark, language, theme, sign in and sign up, or "Open Taskline" when signed
 * in) and footer: nothing of the site's or the apps' chrome. The page renders its <main>.
 */
export function TasklinePublicFrame({ children }: { children: ReactNode }) {
	return (
		<div className="flex flex-1 flex-col" data-testid="taskline-public-frame">
			<NavigationProgress />
			<TasklineHeader />
			<div className="flex flex-1 flex-col">{children}</div>
			<TasklineFooter />
		</div>
	);
}

/**
 * The frame of Taskline's sign-in and sign-up pages: the form in a column under the
 * header, and on wide screens a panel with the plan drawing (decorative). The page
 * renders its own <main>.
 */
export function TasklineAuthFrame({ children }: { children: ReactNode }) {
	return (
		<div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
			<div className="flex min-h-dvh flex-col">
				<NavigationProgress />
				<TasklineHeader actions={false} />
				<div className="flex flex-1 flex-col">{children}</div>
				<TasklineFooter />
			</div>
			<div className="relative hidden overflow-hidden border-s bg-surface-1 lg:block" data-testid="taskline-auth-panel">
				<TasklineArt className="absolute inset-x-12 top-1/2 w-[calc(100%-6rem)] -translate-y-1/2" />
			</div>
		</div>
	);
}
