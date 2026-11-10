import { useQuery } from "@tanstack/react-query";
import { Link, type LinkOptions } from "@tanstack/react-router";
import { LogInIcon, RefreshCwIcon } from "lucide-react";
import type { ReactNode } from "react";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { sessionQueryOptions } from "@/features/auth/queries";
import { m } from "@/paraglide/messages";
import { canConnect, useConnectLichess } from "../connect/use-connect";
import type { ChaalFeature } from "../features";
import { chaalLinks } from "../links";
import { chaalConnectionQueryOptions, chaalStatusQueryOptions } from "../queries";

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
		{ key: "tournaments", link: chaalLinks.tournaments(), label: m.ch_tournaments_title() },
		{ key: "teams", link: chaalLinks.teams(), label: m.ch_teams_title() },
		{ key: "studies", link: chaalLinks.studies(), label: m.ch_studies_title() },
	];
	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-col gap-2">
				<h1 className="ch-display text-ch-title">{title}</h1>
				<p className="max-w-prose text-ch-muted">{intro}</p>
				{children}
			</header>
			<nav aria-label={m.ch_community_sections()} className="ch-rule -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
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
			? m.ch_tournaments_off_body()
			: area === "teams"
				? m.ch_teams_off_body()
				: m.ch_studies_off_body();
	return (
		<p className="ch-rule pt-3 text-ch-muted" data-testid="chaal-community-off">
			{body}
		</p>
	);
}

/** Whether an area is on, from the status every page has. */
export function useAreaOn(area: CommunityArea): boolean {
	const { data: status } = useQuery(chaalStatusQueryOptions());
	return status?.features[area] !== false;
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
		<nav aria-label={m.ch_community_pages()} className="flex gap-2 pt-2">
			{previous ? (
				<Button asChild variant="outline" size="sm">
					<Link {...previous} data-testid={`${testId}-previous`}>
						{m.ch_community_previous()}
					</Link>
				</Button>
			) : null}
			{next ? (
				<Button asChild variant="outline" size="sm">
					<Link {...next} data-testid={`${testId}-next`}>
						{m.ch_community_next()}
					</Link>
				</Button>
			) : null}
		</nav>
	);
}

export type LichessUse = "ok" | "connect" | "reconnect" | "unavailable";

/**
 * Whether the viewer may act on Lichess for an area now: connected with its scopes (`ok`),
 * not connected (`connect`, or `unavailable` when connecting is off), or connected without
 * the area's scopes or with a refused token (`reconnect`).
 */
export function useLichessFor(feature: ChaalFeature): LichessUse {
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const { data: session } = useQuery(sessionQueryOptions());
	// Without a session there is no connection to ask about (the call would be refused).
	const { data: connection } = useQuery({ ...chaalConnectionQueryOptions(), enabled: Boolean(session) });
	if (connection && !connection.revoked && !connection.needsScopesFor.includes(feature)) return "ok";
	if (!canConnect(status)) return "unavailable";
	return connection ? "reconnect" : "connect";
}

/** What acting needs, said with its button: connect, or reconnect to allow the area. */
export function LichessPrompt({ use, text, testId }: { use: LichessUse; text: string; testId: string }) {
	const { connect, pending } = useConnectLichess();
	if (use === "ok") return null;
	return (
		<div className="flex flex-col items-start gap-2 border-ch-hair border-t pt-3" data-testid={testId} data-use={use}>
			<p className="text-ch-muted text-sm">{use === "unavailable" ? m.ch_community_connect_off() : text}</p>
			{use === "unavailable" ? null : (
				<Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void connect()}>
					{use === "reconnect" ? <RefreshCwIcon aria-hidden /> : <LogInIcon aria-hidden />}
					{use === "reconnect" ? m.ch_reconnect() : m.ch_connect()}
				</Button>
			)}
		</div>
	);
}
