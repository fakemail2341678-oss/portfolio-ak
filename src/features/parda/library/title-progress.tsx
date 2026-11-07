import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { CheckIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import { sessionQueryOptions } from "@/features/auth/queries";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { pardaLinks } from "../links";
import { episodeCode } from "../title/title-hero";
import { readLocalProgress, removeLocalTitle } from "./local";
import { continueEntry, isFinished, minutesLeft, progressShare, type SeriesShape } from "./progress";
import { pardaTitleProgressQueryOptions, refreshLibrary } from "./queries";
import type { EpisodeProgress, TitleCta, TitleProgressData } from "./types";
import { useEnsureViewer } from "./use-viewer-session";

/**
 * A title's progress on its page (PLAN Task 64, decision 0236): the main action
 * (*Resume · 23 min left*, *Next: S2 E6*, *Rewatch*), the bars and the marks. With a
 * session it's the profile's (the loader awaited it); without one, the browser's own,
 * read after the page mounts.
 */

type TitleRef = { media: "movie" | "tv"; id: number; slug: string };

const EMPTY: TitleProgressData = { cta: null, share: null, episodes: [] };

/** The browser's entries for one title, through the same rules as the server's. */
function localProgress(ref: TitleRef, shape: SeriesShape | undefined): TitleProgressData {
	const rows = readLocalProgress()
		.filter((entry) => entry.media === ref.media && entry.id === ref.id)
		.map((entry) => {
			const finished = isFinished(ref.media, entry.watched, entry.duration);
			return {
				season: entry.season ?? null,
				episode: entry.episode ?? null,
				watched: entry.watched,
				duration: entry.duration,
				finished,
				updatedAt: entry.updatedAt,
			};
		});
	if (rows.length === 0) return EMPTY;
	const entry = continueEntry(ref.media, rows, shape);
	const cta: TitleCta | null = !entry
		? null
		: entry.kind === "resume"
			? {
					kind: "resume",
					season: entry.season,
					episode: entry.episode,
					left: minutesLeft(entry.watched, entry.duration),
					share: progressShare({ ...entry, finished: false }),
				}
			: entry.kind === "next"
				? { kind: "next", season: entry.season, episode: entry.episode }
				: entry.kind === "schedule"
					? { kind: "caughtUp", season: entry.season, episode: entry.episode }
					: { kind: "rewatch" };
	const episodes: EpisodeProgress[] = rows.flatMap((row) =>
		row.season === null || row.episode === null
			? []
			: [{ season: row.season, episode: row.episode, share: progressShare(row), finished: row.finished }],
	);
	return { cta, share: ref.media === "movie" && rows[0] ? progressShare(rows[0]) : null, episodes };
}

export function useTitleProgress(ref: TitleRef, shape?: SeriesShape): TitleProgressData {
	const { data: session } = useQuery(sessionQueryOptions());
	const { data } = useQuery({
		...pardaTitleProgressQueryOptions(getLocale(), ref.media, ref.id),
		enabled: Boolean(session),
	});
	const [local, setLocal] = useState<TitleProgressData>(EMPTY);
	// biome-ignore lint/correctness/useExhaustiveDependencies: ref and shape come with the page.
	useEffect(() => {
		if (!session) setLocal(localProgress(ref, shape));
		// The browser's progress is read once per page.
	}, [session]);
	return session ? (data ?? EMPTY) : local;
}

const code = (season: number | null, episode: number | null) =>
	season !== null && episode !== null ? episodeCode(season, episode) : null;

/** The hero's main action. Rewatch starts our record over, then plays from the start. */
export function PlayAction({ title, progress }: { title: TitleRef; progress: TitleProgressData }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: session } = useQuery(sessionQueryOptions());
	const cta = progress.cta;
	const watch = (target?: { season: number; episode: number } | null) =>
		pardaLinks.watch(title.media, title.id, title.slug, target);
	if (cta?.kind === "rewatch") {
		const rewatch = async () => {
			try {
				if (session) {
					const { rewatchPardaTitle } = await import("@/functions/parda/library");
					await rewatchPardaTitle({ data: { media: title.media, id: title.id } });
					await refreshLibrary(queryClient);
				} else removeLocalTitle(title.media, title.id);
				await navigate(watch());
			} catch (error) {
				toast.error(errorMessage(error));
			}
		};
		return (
			<Button size="lg" onClick={() => void rewatch()} data-testid="title-play">
				<RotateCcwIcon aria-hidden />
				{m.pd_cta_rewatch()}
			</Button>
		);
	}
	const target =
		cta?.kind === "resume"
			? cta.season !== null && cta.episode !== null
				? { season: cta.season, episode: cta.episode }
				: null
			: cta?.kind === "next"
				? { season: cta.season, episode: cta.episode }
				: null;
	const label =
		cta?.kind === "resume"
			? cta.left
				? m.pd_cta_resume_left({ minutes: formatNumber(cta.left) })
				: m.pd_cta_resume()
			: cta?.kind === "next"
				? m.pd_cta_next({ code: episodeCode(cta.season, cta.episode) })
				: m.pd_action_play();
	const detail = cta?.kind === "resume" ? code(cta.season, cta.episode) : null;
	return (
		<span className="flex flex-col gap-1">
			<Button asChild size="lg">
				<Link {...watch(target)} data-testid="title-play">
					<PlayIcon aria-hidden />
					{label}
					{detail ? <span className="text-xs opacity-80">{detail}</span> : null}
				</Link>
			</Button>
			{cta?.kind === "caughtUp" ? (
				<span className="text-pd-muted text-xs" data-testid="title-caught-up">
					{m.pd_cta_caught_up({ code: episodeCode(cta.season, cta.episode) })}
				</span>
			) : null}
		</span>
	);
}

type MarkTarget =
	| { scope: "title" }
	| { scope: "season"; season: number }
	| { scope: "episode"; season: number; episode: number };

/** *Mark watched* / *unwatched*, for the movie or series, a season or an episode. Starts a guest if needed. */
export function MarkButton({
	title,
	target,
	watched,
	label,
	size = "sm",
}: {
	title: TitleRef;
	target: MarkTarget;
	watched: boolean;
	label?: string;
	size?: "sm" | "lg";
}) {
	const queryClient = useQueryClient();
	const ensureViewer = useEnsureViewer();
	const [pending, setPending] = useState(false);
	const run = async () => {
		setPending(true);
		try {
			if (!(await ensureViewer())) return;
			const { markPardaWatched } = await import("@/functions/parda/library");
			await markPardaWatched({
				data: { media: title.media, id: title.id, ...target, watched: !watched, locale: getLocale() },
			});
			await refreshLibrary(queryClient);
		} catch (error) {
			toast.error(errorMessage(error));
		} finally {
			setPending(false);
		}
	};
	const text = label ?? (watched ? m.pd_mark_unwatched() : m.pd_mark_watched());
	return (
		<Button
			variant="ghost"
			size={size}
			onClick={() => void run()}
			disabled={pending}
			aria-pressed={watched}
			data-testid={`mark-${target.scope}`}
		>
			<CheckIcon aria-hidden className={watched ? "text-pd-action" : undefined} />
			{text}
		</Button>
	);
}
