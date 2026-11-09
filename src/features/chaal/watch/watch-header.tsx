import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { m } from "@/paraglide/messages";
import { chaalLinks } from "../links";
import type { LiveLink } from "./use-live";

/**
 * Watch's pages' heading (Task 82): the title, a line about it, and the two halves of Watch,
 * the TV and the broadcasts, as tabs under a heavy rule (links in the URL, like the players'
 * ratings).
 */
export function WatchHeader({
	current,
	title,
	intro,
	children,
}: {
	current: "tv" | "broadcasts";
	title: string;
	intro: string;
	children?: ReactNode;
}) {
	const tabs = [
		{ key: "tv", link: chaalLinks.watch(), label: m.ch_watch_tv(), testId: "chaal-watch-tab-tv" },
		{
			key: "broadcasts",
			link: chaalLinks.broadcasts(),
			label: m.ch_broadcasts_title(),
			testId: "chaal-watch-tab-broadcasts",
		},
	] as const;
	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-col gap-2">
				<h1 className="ch-display text-ch-title">{title}</h1>
				<p className="max-w-prose text-ch-muted">{intro}</p>
				{children}
			</header>
			<nav aria-label={m.ch_watch_sections()} className="ch-rule -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
				<ul className="flex gap-1">
					{tabs.map((tab) => (
						<li key={tab.key}>
							<Link
								{...tab.link}
								aria-current={tab.key === current ? "page" : undefined}
								className="block whitespace-nowrap px-3 py-2.5 text-ch-muted text-sm transition-colors hover:text-ch-ink aria-[current=page]:text-ch-ink aria-[current=page]:shadow-[inset_0_-2px_0_var(--ch-ink)]"
								data-testid={tab.testId}
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

/**
 * A live stream's state as a small dot: ink when live, hollow while it connects or waits. A
 * line of its own (`basis-full` in the flex rows it sits in), so its words changing never
 * rewraps the line beside it.
 */
export function LiveDot({ link, behind = false }: { link: LiveLink; behind?: boolean }) {
	const live = link === "open";
	return (
		<span className="flex basis-full items-center gap-1.5" data-testid="chaal-watch-live" data-link={link}>
			<span
				aria-hidden
				className={`inline-block size-2 rounded-full border border-ch-ink ${live ? "bg-ch-ink" : "bg-transparent"}`}
			/>
			{live
				? behind
					? m.ch_watch_live_behind()
					: m.ch_live_link_open()
				: link === "refused" || link === "closed"
					? m.ch_live_link_refused()
					: m.ch_live_link_connecting()}
		</span>
	);
}

/**
 * A clock's place before its time is known (a feed's first line, a stream's first position):
 * as tall as the clock, so nothing moves when it arrives.
 */
export function ClockPlace() {
	return (
		<div aria-hidden className="ch-display ch-figures invisible text-ch-clock text-[2rem] sm:text-ch-clock">
			0:00
		</div>
	);
}

/** Watch turned off by the admin: said calmly where the content would be. */
export function WatchOff() {
	return (
		<p className="ch-rule pt-3 text-ch-muted" data-testid="chaal-watch-off">
			{m.ch_watch_off_body()}
		</p>
	);
}
