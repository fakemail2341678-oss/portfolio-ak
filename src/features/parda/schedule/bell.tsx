import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BellIcon, CalendarDaysIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { sessionQueryOptions } from "@/features/auth/queries";
import { formatNumber, formatRelativeTimeFrom } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { tmdbImage } from "../kit/image";
import { TmdbImage } from "../kit/tmdb-image";
import { pardaLinks } from "../links";
import { episodeRangeLabel } from "./labels";
import { pardaInboxQueryOptions } from "./queries";
import type { InboxData, InboxItem } from "./types";

/**
 * The bell in the top mask (PLAN Task 68, decision 0241), for a session: new episodes of
 * the series the profile follows. The layout loaded it, so the count renders with the
 * page. Opening it marks what it shows read; the dots stay until it closes, so the viewer
 * still sees what was new.
 */

const focusRing = "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function Item({
	item,
	imageBase,
	fresh,
	now,
	onPick,
}: {
	item: InboxItem;
	imageBase: string;
	fresh: boolean;
	now: string;
	onPick: () => void;
}) {
	return (
		<li>
			<Link
				{...pardaLinks.watch("tv", item.tmdbId, item.slug, { season: item.season, episode: item.episode })}
				onClick={onPick}
				className={cn("group flex items-center gap-3 px-4 py-2.5 hover:bg-pd-ground-2", focusRing)}
				data-testid="inbox-item"
			>
				<span className="block w-10 shrink-0">
					<TmdbImage
						image={tmdbImage(imageBase, item.poster, "poster")}
						alt=""
						label={item.title}
						aspect="poster"
						sizes="2.5rem"
					/>
				</span>
				<span className="flex min-w-0 flex-1 flex-col gap-0.5">
					<span className="truncate font-medium text-sm">{item.title}</span>
					<span className="truncate text-pd-muted text-xs">
						{m.pd_inbox_new({ episodes: episodeRangeLabel(item) })}
					</span>
					<span className="text-pd-muted text-xs">{formatRelativeTimeFrom(item.createdAt, now)}</span>
				</span>
				{fresh ? (
					<span className="size-2 shrink-0 rounded-full bg-pd-action" data-testid="inbox-unread">
						<span className="sr-only">{m.pd_inbox_unread()}</span>
					</span>
				) : null}
			</Link>
		</li>
	);
}

export function PardaBell() {
	const locale = getLocale();
	const queryClient = useQueryClient();
	const { data: session } = useQuery(sessionQueryOptions());
	const { data } = useQuery({ ...pardaInboxQueryOptions(locale), enabled: Boolean(session) });
	const [open, setOpen] = useState(false);
	// What was unread when the bell opened: dots for those until it closes.
	const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
	const [now, setNow] = useState(() => new Date().toISOString());
	if (!session) return null;
	const unread = data?.unread ?? 0;

	const onOpenChange = (next: boolean) => {
		setOpen(next);
		if (!next || !data) return;
		setNow(new Date().toISOString());
		const ids = data.items.filter((item) => !item.read).map((item) => item.id);
		setFresh(new Set(ids));
		if (unread === 0) return;
		queryClient.setQueryData<InboxData>(pardaInboxQueryOptions(locale).queryKey, (old) =>
			old ? { ...old, unread: 0, items: old.items.map((item) => ({ ...item, read: true })) } : old,
		);
		void import("@/functions/parda/alerts")
			.then(({ markPardaInboxRead }) => markPardaInboxRead({ data: { ids: null } }))
			.catch(() => queryClient.invalidateQueries({ queryKey: pardaInboxQueryOptions(locale).queryKey }));
	};

	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<PopoverTrigger asChild>
				<Button variant="ghost" size="icon" className="relative" data-testid="parda-bell">
					<BellIcon aria-hidden />
					<span className="sr-only">
						{unread ? m.pd_inbox_label_unread({ count: formatNumber(unread) }) : m.pd_inbox_label()}
					</span>
					{unread ? (
						<span
							aria-hidden
							className="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-pd-action px-1 font-medium text-[0.625rem] text-pd-on-action tabular-nums"
							data-testid="parda-bell-count"
						>
							{unread > 9 ? "9+" : formatNumber(unread)}
						</span>
					) : null}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-80 bg-pd-mask p-0 text-pd-ink" data-testid="parda-inbox">
				<p className="px-4 pt-3 pb-2 font-medium text-sm">{m.pd_inbox_title()}</p>
				{data?.items.length ? (
					<ul className="max-h-96 overflow-y-auto">
						{data.items.map((item) => (
							<Item
								key={item.id}
								item={item}
								imageBase={data.imageBase}
								fresh={fresh.has(item.id)}
								now={now}
								onPick={() => setOpen(false)}
							/>
						))}
					</ul>
				) : (
					<p className="px-4 pb-3 text-pd-muted text-sm" data-testid="parda-inbox-empty">
						{m.pd_inbox_empty()}
					</p>
				)}
				<div className="border-border border-t px-2 py-2">
					<Button asChild variant="ghost" size="sm" className="w-full justify-start">
						<Link {...pardaLinks.schedule()} onClick={() => setOpen(false)} data-testid="parda-inbox-schedule">
							<CalendarDaysIcon aria-hidden />
							{m.pd_schedule_title()}
						</Link>
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
