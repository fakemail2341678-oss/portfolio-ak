import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { FlagIcon, ShieldIcon, SkipForwardIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { blockerHintHidden, hideBlockerHint } from "../library/local";
import { pardaLinks } from "../links";
import { pardaSeasonQueryOptions } from "../queries";
import { EPISODES_PER_PAGE } from "../search";
import { episodeCode } from "../title/title-hero";
import { AD_BLOCKER_SECTION, type BlockerStore, blockerStore } from "./blocker";
import { UP_NEXT_COUNTDOWN_S } from "./machine";
import { PARDA_REPORT_KINDS, type PardaReportKind } from "./playback";
import type { WatchPageData } from "./watch-types";

type Data = Extract<WatchPageData, { configured: true }>;
type Episode = { season: number; episode: number };

/**
 * Up next (PLAN 12.5): near the end, the next episode with a 10 s countdown when the
 * profile autoplays (Cancel stops it), or a button when it doesn't.
 */
export function UpNext({ data, next, onCancel }: { data: Data; next: Episode; onCancel: () => void }) {
	const navigate = useNavigate();
	const [left, setLeft] = useState(UP_NEXT_COUNTDOWN_S);
	const link = pardaLinks.watch(data.title.media, data.title.id, data.title.slug, next);
	useEffect(() => {
		if (!data.autoplay) return;
		const timer = setInterval(() => setLeft((value) => value - 1), 1_000);
		return () => clearInterval(timer);
	}, [data.autoplay]);
	const gone = useRef(false);
	useEffect(() => {
		if (!data.autoplay || left > 0 || gone.current) return;
		gone.current = true;
		void navigate(link);
	}, [data.autoplay, left, navigate, link]);
	return (
		<output
			className="pd-scrim absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-end gap-2 p-4"
			data-testid="up-next"
		>
			<p className="me-auto text-pd-on-picture text-sm">
				<span className="block text-xs opacity-80">{m.pd_up_next()}</span>
				<span className="font-medium">{episodeCode(next.season, next.episode)}</span>
				{data.autoplay ? (
					<span className="ms-2 tabular-nums" data-testid="up-next-countdown">
						{m.pd_up_next_in({ seconds: formatNumber(Math.max(0, left)) })}
					</span>
				) : null}
			</p>
			<Button variant="outline" size="sm" onClick={onCancel} data-testid="up-next-cancel">
				{m.common_cancel()}
			</Button>
			<Button asChild size="sm">
				<Link {...link} data-testid="up-next-play">
					<SkipForwardIcon aria-hidden />
					{m.pd_up_next_play()}
				</Link>
			</Button>
		</output>
	);
}

/** The season's episodes beside the player (`E`), a page of 30 around the one playing. */
export function EpisodesSheet({
	data,
	open,
	onOpenChange,
}: {
	data: Data;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const current = data.episode;
	const [season, setSeason] = useState(current?.season ?? 1);
	const page = current && season === current.season ? Math.ceil(current.episode / EPISODES_PER_PAGE) : 1;
	const { data: episodes, isPending } = useQuery({
		...pardaSeasonQueryOptions(getLocale(), data.title.id, season, page),
		enabled: open,
	});
	const list = episodes?.configured ? (episodes.episodes ?? []) : [];
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="w-full gap-0 overflow-y-auto border-0 bg-pd-mask p-0 text-pd-ink sm:max-w-md"
				data-testid="watch-episodes"
			>
				<SheetHeader className="gap-2 p-4">
					<SheetTitle className="pd-display text-pd-ink text-xl">{m.pd_episodes_heading()}</SheetTitle>
					<SheetDescription className="sr-only">{data.title.title}</SheetDescription>
					{data.seasons.length > 1 ? (
						<ul className="flex flex-wrap gap-1" aria-label={m.pd_seasons_heading()}>
							{data.seasons.map((each) => (
								<li key={each.number}>
									<Button
										variant={each.number === season ? "default" : "ghost"}
										size="sm"
										aria-pressed={each.number === season}
										onClick={() => setSeason(each.number)}
									>
										{each.name}
									</Button>
								</li>
							))}
						</ul>
					) : null}
				</SheetHeader>
				<ol className="flex flex-col pb-8">
					{isPending && open ? <li className="px-4 py-2 text-pd-muted text-sm">{m.pending_loading()}</li> : null}
					{list.map((episode) => {
						const here = current?.season === season && current.episode === episode.number;
						return (
							<li key={episode.number}>
								<Link
									{...pardaLinks.watch(data.title.media, data.title.id, data.title.slug, {
										season,
										episode: episode.number,
									})}
									aria-current={here ? "page" : undefined}
									className={cn(
										"flex gap-3 px-4 py-2 text-sm outline-none hover:bg-pd-ground-2 focus-visible:ring-[3px] focus-visible:ring-ring/50",
										here && "shadow-[inset_3px_0_0_var(--pd-action)]",
									)}
									data-testid="watch-episode-link"
								>
									<span className="w-16 shrink-0 text-pd-muted tabular-nums">
										{episodeCode(season, episode.number)}
									</span>
									<span className="line-clamp-2">{episode.name}</span>
								</Link>
							</li>
						);
					})}
				</ol>
			</SheetContent>
		</Sheet>
	);
}

const REPORT_LABELS: Readonly<Record<PardaReportKind, () => string>> = {
	"not-playing": m.pd_report_not_playing,
	"wrong-title": m.pd_report_wrong_title,
	quality: m.pd_report_quality,
	"audio-subtitles": m.pd_report_audio,
	ads: m.pd_report_ads,
	other: m.pd_report_other,
};

/** *Report a problem* (PLAN 12.5): its kind (ads among them), a note, the source that was playing. Rate limited. */
export function ReportDialog({
	data,
	sourceId,
	variant = "ghost",
}: {
	data: Data;
	sourceId: string | null;
	variant?: "ghost" | "outline";
}) {
	const [open, setOpen] = useState(false);
	const [kind, setKind] = useState<PardaReportKind>("not-playing");
	const [note, setNote] = useState("");
	const [pending, setPending] = useState(false);
	const submit = async () => {
		setPending(true);
		try {
			const { reportPardaProblem } = await import("@/functions/parda/watch");
			await reportPardaProblem({
				data: {
					kind,
					media: data.title.media,
					id: data.title.id,
					...(data.episode ? { season: data.episode.season, episode: data.episode.episode } : {}),
					sourceId,
					note,
				},
			});
			toast.success(m.pd_report_sent());
			setOpen(false);
			setNote("");
		} catch (error) {
			toast.error(errorMessage(error));
		} finally {
			setPending(false);
		}
	};
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant={variant} size="sm" data-testid="watch-report">
					<FlagIcon aria-hidden />
					{m.pd_report_action()}
				</Button>
			</DialogTrigger>
			<DialogContent data-testid="report-dialog">
				<DialogHeader>
					<DialogTitle>{m.pd_report_title()}</DialogTitle>
					<DialogDescription>{m.pd_report_description()}</DialogDescription>
				</DialogHeader>
				<RadioGroup
					value={kind}
					onValueChange={(value) => setKind(value as PardaReportKind)}
					aria-label={m.pd_report_kind()}
				>
					{PARDA_REPORT_KINDS.map((each) => (
						<div key={each} className="flex items-center gap-2">
							<RadioGroupItem value={each} id={`report-${each}`} />
							<Label htmlFor={`report-${each}`}>{REPORT_LABELS[each]()}</Label>
						</div>
					))}
				</RadioGroup>
				<div className="flex flex-col gap-2">
					<Label htmlFor="report-note">{m.pd_report_note()}</Label>
					<Textarea
						id="report-note"
						value={note}
						maxLength={1_000}
						onChange={(event) => setNote(event.target.value)}
						data-testid="report-note"
					/>
				</div>
				<DialogFooter>
					<Button onClick={() => void submit()} disabled={pending} aria-busy={pending} data-testid="report-submit">
						{m.pd_report_send()}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/**
 * *Install uBlock Origin Lite* (PLAN 12.5): a link styled as a button. The server renders
 * it pointing at the notice page's list of stores; on mount it points at this browser's
 * store, in a new tab, where it has one, with the same visible text so nothing moves.
 * *Don't show again* hides it in this browser.
 * It's the page's last block, so hiding it moves nothing below it.
 */
export function BlockerHint() {
	const [store, setStore] = useState<BlockerStore | null>(null);
	const [hidden, setHidden] = useState(false);
	useEffect(() => {
		setStore(blockerStore(navigator.userAgent));
		setHidden(blockerHintHidden());
	}, []);
	if (hidden) return null;
	return (
		<aside
			aria-label={m.pd_blocker_label()}
			className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 text-pd-muted text-sm sm:px-6 lg:px-8"
			data-testid="blocker-hint"
		>
			<ShieldIcon aria-hidden className="size-4 shrink-0" />
			<p className="min-w-0 flex-1 basis-60">{m.pd_blocker_line()}</p>
			<Button asChild variant="outline" size="sm">
				{store ? (
					<a href={store.href} target="_blank" rel="noopener" data-testid="blocker-install">
						{m.pd_blocker_install()}
						<span className="sr-only">{m.pd_opens_new_tab()}</span>
					</a>
				) : (
					<Link {...pardaLinks.about(AD_BLOCKER_SECTION)} data-testid="blocker-install">
						{m.pd_blocker_install()}
					</Link>
				)}
			</Button>
			<Button
				variant="ghost"
				size="sm"
				onClick={() => {
					hideBlockerHint();
					setHidden(true);
				}}
				data-testid="blocker-dismiss"
			>
				{m.pd_blocker_dismiss()}
			</Button>
		</aside>
	);
}
