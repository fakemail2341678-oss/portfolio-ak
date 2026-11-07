import type { ReactNode } from "react";
import type { DateInput } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { RelativeTime } from "./relative-time";
import { UserAvatar } from "./user-avatar";

export type TimelineItem = {
	id: string;
	/** A small visual on the line: an avatar or an icon (decorative). */
	marker?: ReactNode;
	/** What happened, as a sentence. */
	title: ReactNode;
	/** A second line: the changes, a comment. */
	detail?: ReactNode;
	at: DateInput;
};

/**
 * Events in order (newest first is the caller's choice), each with its marker on a
 * vertical line and its relative time. `now` is when the data was read, so the
 * server and the browser print the same times (see RelativeTime).
 */
export function Timeline({
	items,
	now,
	className,
}: {
	items: ReadonlyArray<TimelineItem>;
	now: DateInput;
	className?: string;
}) {
	return (
		<ol className={cn("flex min-w-0 flex-col", className)}>
			{items.map((item, index) => (
				<li key={item.id} className="relative flex min-w-0 gap-3 pb-4 last:pb-0">
					{index < items.length - 1 ? (
						<span className="absolute start-3.5 top-8 bottom-0 w-px -translate-x-1/2 bg-border" aria-hidden />
					) : null}
					<div className="relative flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-1 text-muted-foreground [&_svg]:size-4">
						{item.marker}
					</div>
					<div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-1">
						<div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3">
							<p className="min-w-0 text-body">{item.title}</p>
							<RelativeTime value={item.at} now={now} className="shrink-0 text-caption text-muted-foreground" />
						</div>
						{item.detail ? <div className="min-w-0 text-caption text-muted-foreground">{item.detail}</div> : null}
					</div>
				</li>
			))}
		</ol>
	);
}

export type ActivityEvent = {
	id: string;
	actor: { name: string; email: string };
	/** The action as a localized phrase ("updated the role"). */
	action: string;
	target: ReactNode;
	at: DateInput;
	detail?: ReactNode;
};

/** Who did what, when: audit events on a Timeline, each marked with the person's avatar. */
export function ActivityFeed({
	events,
	now,
	className,
}: {
	events: ReadonlyArray<ActivityEvent>;
	now: DateInput;
	className?: string;
}) {
	return (
		<Timeline
			now={now}
			className={className}
			items={events.map((event) => ({
				id: event.id,
				at: event.at,
				detail: event.detail,
				marker: <UserAvatar name={event.actor.name} email={event.actor.email} size="default" />,
				title: (
					<>
						<span className="font-medium">{event.actor.name || event.actor.email}</span>{" "}
						<span className="text-muted-foreground">{event.action}</span> {event.target}
					</>
				),
			}))}
		/>
	);
}
