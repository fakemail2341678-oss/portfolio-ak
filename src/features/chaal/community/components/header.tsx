import { Link, type LinkOptions } from "@tanstack/react-router";
import { LogInIcon, RefreshCwIcon } from "lucide-react";
import type { ReactNode } from "react";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages";
import { useConnectLichess } from "../../connect/hooks/use-connect";
import { chaalLinks } from "../../links";

/**
 * Community's pages' parts (PLAN Task 83, decision 0273): the heading with the three areas
 * as tabs (tournaments, teams, studies), what a page says when its area is off, a list's
 * pager and waiting place, and what acting on Lichess needs (connecting, or reconnecting
 * for the area's scopes).
 */

export type CommunityArea = "tournaments" | "teams" | "studies";

export function CommunityHeader({
	current,
	title,
	intro,
	children,
}: {
	current: CommunityArea;
	title: string;
	intro: string;
	children?: ReactNode;
}) {
	const tabs: ReadonlyArray<{ key: CommunityArea; link: LinkOptions; label: string }> = [
		{ key: "tournaments", link: chaalLinks.tournaments(), label: m.chaal_tournaments_title() },
		{ key: "teams", link: chaalLinks.teams(), label: m.chaal_teams_title() },
		{ key: "studies", link: chaalLinks.studies(), label: m.chaal_studies_title() },
	];
	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-col gap-2">
				<h1 className="ch-display text-ch-title">{title}</h1>
				<p className="max-w-prose text-ch-muted">{intro}</p>
				{children}
			</header>
			<nav aria-label={m.chaal_community_sections()} className="ch-rule -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
				<ul className="flex gap-1">
					{tabs.map((tab) => (
						<li key={tab.key}>
							<Link
								{...tab.link}
								aria-current={tab.key === current ? "page" : undefined}
								className="block whitespace-nowrap px-3 py-2.5 text-ch-muted text-sm transition-colors hover:text-ch-ink aria-[current=page]:text-ch-ink aria-[current=page]:shadow-[inset_0_-2px_0_var(--ch-ink)]"
								data-testid={`chaal-community-tab-${tab.key}`}
							>
								{tab.label}
							</Link>
						</li>
					))}
				</ul>
			</nav>
		</div>
	);
}

/** An area the admin turned off: said calmly where the content would be. */
export function CommunityOff({ area }: { area: CommunityArea }) {
	const body =
		area === "tournaments"
			? m.chaal_tournaments_off_body()
			: area === "teams"
				? m.chaal_teams_off_body()
				: m.chaal_studies_off_body();
	return (
		<p className="ch-rule pt-3 text-ch-muted" data-testid="chaal-community-off">
			{body}
		</p>
	);
}

/** A list's place while it loads, or what went wrong with a retry. */
export function ListWaiting({ error, retry, testId }: { error: unknown; retry: () => void; testId: string }) {
	if (error)
		return (
			<div className="flex flex-col items-start gap-3" data-testid={testId}>
				<p className="text-ch-muted">{errorMessage(error)}</p>
				<Button type="button" variant="outline" onClick={retry}>
					{m.error_retry()}
				</Button>
			</div>
		);
	return <Skeleton className="h-[32rem] w-full rounded-none" />;
}

/** Pages of a list as links (the URL is the state): back and on. */
export function ListPager({
	previous,
	next,
	testId,
}: {
	previous: LinkOptions | null;
	next: LinkOptions | null;
	testId: string;
}) {
	if (!previous && !next) return null;
	return (
		<nav aria-label={m.chaal_community_pages()} className="flex gap-2 pt-2">
			{previous ? (
				<Button asChild variant="outline" size="sm">
					<Link {...previous} data-testid={`${testId}-previous`}>
						{m.chaal_community_previous()}
					</Link>
				</Button>
			) : null}
			{next ? (
				<Button asChild variant="outline" size="sm">
					<Link {...next} data-testid={`${testId}-next`}>
						{m.chaal_community_next()}
					</Link>
				</Button>
			) : null}
		</nav>
	);
}

export type LichessUse = "ok" | "connect" | "reconnect" | "unavailable";

/** What acting needs, said with its button: connect, or reconnect to allow the area. */
export function LichessPrompt({ use, text, testId }: { use: LichessUse; text: string; testId: string }) {
	const { connect, pending } = useConnectLichess();
	if (use === "ok") return null;
	return (
		<div className="flex flex-col items-start gap-2 border-ch-hair border-t pt-3" data-testid={testId} data-use={use}>
			<p className="text-ch-muted text-sm">{use === "unavailable" ? m.chaal_community_connect_off() : text}</p>
			{use === "unavailable" ? null : (
				<Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void connect()}>
					{use === "reconnect" ? <RefreshCwIcon aria-hidden /> : <LogInIcon aria-hidden />}
					{use === "reconnect" ? m.chaal_reconnect() : m.chaal_connect()}
				</Button>
			)}
		</div>
	);
}
