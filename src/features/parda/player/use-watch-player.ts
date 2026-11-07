import { useQuery } from "@tanstack/react-query";
import { type RefObject, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { sessionQueryOptions } from "@/features/auth/queries";
import { localizedValue } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import { localEntry, pickedServer, pickServer, saveLocalProgress } from "../library/local";
import { ADAPTERS } from "./adapters";
import type { PlayerCommand, PlayerEvent } from "./adapters/types";
import {
	fallsBack,
	firstSource,
	formatClock,
	isBehind,
	isNearEnd,
	isStuttering,
	nextSource,
	playOrder,
	type Resume,
	startFor,
} from "./machine";
import { connectionBand, type PardaBand } from "./playback";
import { useRedirectGuard } from "./redirect-guard";
import { reportPlay, reportProgress } from "./report";
import { createStallDetector } from "./stall";
import { withStart } from "./templates";
import type { WatchPageData, WatchSource } from "./watch-types";

/**
 * The watch page's player (PLAN 12.5, decision 0236): picks the order for the viewer's
 * connection on mount and only then loads a source; in Auto, moves on only when its
 * adapter says it failed (a slow start or buffering only offers a switch, 0247); keeps progress (the
 * profile's with a session, the browser's without) and the playback's measurements;
 * offers a smoother server when it stutters; and says when the end is near.
 */

type Data = Extract<WatchPageData, { configured: true }>;

/** Progress is saved at most this often while playing, and when the page is hidden. */
const SAVE_EVERY_MS = 15_000;
const TICK_MS = 500;

export type PlayerStatus = "waiting" | "loading" | "playing" | "unavailable" | "off";

type PlayRecord = {
	playbackId: string;
	source: WatchSource;
	setAt: number;
	startMs: number | null;
	failed: boolean;
	failReason?: string;
	switchedAway: boolean;
	sent: boolean;
};

const fixed = (n: number) => Math.max(0, Math.round(n));

const clock = (seconds: number) => formatClock(seconds);

/** The connection, read once on mount (Chromium only; elsewhere `unknown`, which plays the `ok` order). */
const readBand = (): PardaBand =>
	connectionBand((navigator as Navigator & { connection?: { downlink?: number; saveData?: boolean } }).connection);

export function useWatchPlayer(data: Data, frameRef: RefObject<HTMLIFrameElement | null>) {
	const { data: session } = useQuery(sessionQueryOptions());
	const signedIn = Boolean(session);
	const { title, episode } = data;
	const target = { media: title.media, id: title.id, season: episode?.season, episode: episode?.episode };

	const [order, setOrder] = useState<WatchSource[]>([]);
	const [source, setSource] = useState<WatchSource | null>(null);
	const [src, setSrc] = useState<string | null>(null);
	const [status, setStatus] = useState<PlayerStatus>(data.playback === "on" ? "waiting" : "off");
	const [picked, setPicked] = useState<string | null>(null);
	const [ready, setReady] = useState(false);
	const [playing, setPlaying] = useState(false);
	const [position, setPosition] = useState(0);
	const [duration, setDuration] = useState<number | null>(null);
	const [ended, setEnded] = useState(false);
	const [clickHint, setClickHint] = useState(false);

	const tried = useRef(new Set<string>());
	// Timers and listeners outlive a render: they read these, never a render's state.
	const orderRef = useRef<WatchSource[]>([]);
	const bandRef = useRef<PardaBand>("unknown");
	const play = useRef<PlayRecord | null>(null);
	const stall = useRef(createStallDetector());
	const stutterOffered = useRef(false);
	const firstMoveAt = useRef<number | null>(null);
	const firstReport = useRef(true);
	const lastSave = useRef(0);
	const watchedS = useRef(0);
	const lastPosition = useRef<number | null>(null);
	const deadline = useRef<ReturnType<typeof setTimeout> | null>(null);
	/** Where the viewer is, as far as Parda knows: our record, then the player's reports. */
	const resume = useRef<Resume | null>(data.resume);
	const positionRef = useRef(0);
	const durationRef = useRef<number | null>(null);

	const clearDeadline = () => {
		if (deadline.current) clearTimeout(deadline.current);
		deadline.current = null;
	};

	const sendPlay = (keepalive = false) => {
		const record = play.current;
		if (!record) return;
		record.sent = true;
		const summary = stall.current.summary(Date.now());
		reportPlay(
			{
				playbackId: record.playbackId,
				sourceId: record.source.id,
				media: title.media,
				id: title.id,
				...(episode ? { season: episode.season, episode: episode.episode } : {}),
				failed: record.failed,
				...(record.failReason ? { failReason: record.failReason.slice(0, 200) } : {}),
				startMs: record.startMs,
				stallCount: summary.count,
				stallMs: fixed(summary.ms),
				watchedS: Math.min(86_400, fixed(watchedS.current)),
				switchedAway: record.switchedAway,
				band: bandRef.current,
			},
			keepalive,
		);
	};

	const saveProgress = (keepalive = false) => {
		const at = positionRef.current;
		if (firstMoveAt.current === null || at <= 0) return;
		lastSave.current = Date.now();
		resume.current = { position: at, sourceId: play.current?.source.id ?? null };
		if (!signedIn) {
			saveLocalProgress({
				media: title.media,
				id: title.id,
				...(episode ? { season: episode.season, episode: episode.episode } : {}),
				watched: at,
				duration: durationRef.current,
				updatedAt: Date.now(),
				slug: title.slug,
				title: title.title,
				backdrop: title.backdrop,
				next: data.next,
			});
			return;
		}
		reportProgress(
			{
				media: title.media,
				id: title.id,
				...(episode ? { season: episode.season, episode: episode.episode } : {}),
				watched: Math.min(86_400, at),
				duration: durationRef.current === null ? null : Math.min(86_400, durationRef.current),
				sourceId: play.current?.source.id ?? null,
			},
			keepalive,
		);
	};

	/** A toast offering the next source after `from`; the viewer decides, Parda never switches here. */
	const offerSwitch = (message: string, from: WatchSource) => {
		const other = nextSource(orderRef.current, new Set([from.id]), from);
		toast(message, {
			duration: 15_000,
			...(other ? { action: { label: m.pd_player_try_smoother(), onClick: () => choose(other.id) } } : {}),
		});
	};

	/**
	 * A slow start is not a crash (0247): past its deadline a source that hasn't moved only
	 * earns an offer to switch. A `none` source never reports, so it gets no offer either.
	 */
	const armDeadline = (next: WatchSource) => {
		clearDeadline();
		if (next.adapter === "none") return;
		deadline.current = setTimeout(() => {
			if (firstMoveAt.current === null && play.current?.source.id === next.id) {
				offerSwitch(m.pd_player_not_starting(), next);
			}
		}, next.deadlineMs);
	};

	const load = (next: WatchSource, start: number) => {
		clearDeadline();
		tried.current.add(next.id);
		stall.current = createStallDetector();
		stutterOffered.current = false;
		firstMoveAt.current = null;
		firstReport.current = true;
		lastPosition.current = null;
		watchedS.current = 0;
		play.current = {
			playbackId: crypto.randomUUID(),
			source: next,
			setAt: Date.now(),
			startMs: null,
			failed: false,
			switchedAway: false,
			sent: false,
		};
		const adapter = ADAPTERS[next.adapter];
		const initial = adapter.startPosition === "param" ? start : 0;
		positionRef.current = initial;
		setPosition(initial);
		setDuration(null);
		durationRef.current = null;
		setReady(false);
		setPlaying(false);
		setEnded(false);
		setClickHint(next.needsClick);
		setSource(next);
		setSrc(withStart(next.url, initial));
		setStatus("loading");
		// A needs-click source's deadline starts at the viewer's first click in it.
		if (!next.needsClick) armDeadline(next);
	};

	const fail = (failed: WatchSource, reason: string) => {
		clearDeadline();
		const record = play.current;
		if (record && record.source.id === failed.id) {
			record.failed = true;
			record.failReason = reason;
			sendPlay();
		}
		// Only a crash in Auto moves on (0247): a picked server, or a row the admin keeps from
		// falling back, stays put and the viewer is offered the next one.
		if (picked === failed.id || pickedServer() === failed.id || !fallsBack(failed)) {
			offerSwitch(m.pd_player_pick_failed({ name: localizedValue(failed.name) }), failed);
			return;
		}
		const next = nextSource(orderRef.current, tried.current, failed);
		if (next) {
			toast(m.pd_player_trying({ name: localizedValue(next.name) }));
			load(next, startFor(next, resume.current));
			return;
		}
		setSrc(null);
		setSource(null);
		setStatus("unavailable");
	};

	/** The viewer's choice: a source, or Auto (null), which clears the pick. Keeps their place, 30 s earlier elsewhere. */
	const choose = (sourceId: string | null) => {
		pickServer(sourceId);
		setPicked(sourceId);
		const next = sourceId ? orderRef.current.find((each) => each.id === sourceId) : orderRef.current[0];
		if (!next || next.id === source?.id) return;
		if (play.current) {
			play.current.switchedAway = true;
			sendPlay();
		}
		saveProgress();
		tried.current = new Set();
		load(next, startFor(next, resume.current));
	};

	const command = (value: PlayerCommand) => {
		if (!source) return;
		const build = ADAPTERS[source.adapter].command;
		const frame = frameRef.current?.contentWindow;
		if (!build || !frame) return;
		stall.current.noteCommand(Date.now());
		const targetOrigin = source.url.startsWith("/") ? window.location.origin : (source.origins[0] ?? "*");
		frame.postMessage(build(value), targetOrigin);
	};

	const onEvent = (event: PlayerEvent) => {
		const current = play.current;
		if (!current) return;
		const now = Date.now();
		// A player that reports slowly would look stalled between reports (`infersStalls`).
		if (ADAPTERS[current.source.adapter].infersStalls) stall.current.observe(event, now);
		switch (event.kind) {
			case "ready": {
				setReady(true);
				if (event.duration) {
					setDuration(event.duration);
					durationRef.current = event.duration;
				}
				const adapter = ADAPTERS[current.source.adapter];
				if (adapter.startPosition === "command" && resume.current) {
					command({ action: "seek", position: startFor(current.source, resume.current) });
				}
				break;
			}
			case "position": {
				if (event.duration) {
					setDuration(event.duration);
					durationRef.current = event.duration;
				}
				const previous = lastPosition.current;
				lastPosition.current = event.position;
				if (previous !== null && event.position > previous && event.position - previous < 5) {
					watchedS.current += event.position - previous;
				}
				if (firstReport.current) {
					firstReport.current = false;
					const adapter = ADAPTERS[current.source.adapter];
					const ours = data.resume?.position ?? null;
					if (
						(adapter.startPosition === "self" || adapter.startPosition === "none") &&
						isBehind(ours, event.position)
					) {
						toast(m.pd_player_you_were_at({ time: clock(ours ?? 0) }));
					}
				}
				if (previous !== null && event.position !== previous && firstMoveAt.current === null) {
					firstMoveAt.current = now;
					current.startMs = Math.min(600_000, now - current.setAt);
					clearDeadline();
					setClickHint(false);
					setStatus("playing");
					sendPlay();
				}
				positionRef.current = event.position;
				setPosition(event.position);
				setPlaying(true);
				if (now - lastSave.current >= SAVE_EVERY_MS && firstMoveAt.current !== null) saveProgress();
				break;
			}
			case "play":
				setPlaying(true);
				break;
			case "pause":
				setPlaying(false);
				saveProgress();
				break;
			case "seeked":
				positionRef.current = event.position;
				setPosition(event.position);
				lastPosition.current = event.position;
				break;
			case "ended":
				setPlaying(false);
				setEnded(true);
				if (durationRef.current !== null) positionRef.current = durationRef.current;
				saveProgress();
				sendPlay();
				break;
			case "failed":
				fail(current.source, event.reason);
				break;
		}
	};

	// On mount: the connection, the order, the pick, the first source. Only then does the iframe get a src.
	// biome-ignore lint/correctness/useExhaustiveDependencies: load and the data are read once, on mount.
	useEffect(() => {
		if (data.playback !== "on") return;
		const measured = readBand();
		const queue = playOrder(data.sources, data.order, measured);
		const stored = pickedServer();
		const first = firstSource(queue, stored);
		bandRef.current = measured;
		orderRef.current = queue;
		setOrder(queue);
		setPicked(stored && queue.some((each) => each.id === stored) ? stored : null);
		if (!first) {
			setStatus("unavailable");
			return;
		}
		if (!resume.current && !signedIn) {
			const local = localEntry(title.media, title.id, episode?.season, episode?.episode);
			if (local && local.watched > 0) resume.current = { position: local.watched, sourceId: null };
		}
		load(first, startFor(first, resume.current));
		return clearDeadline;
		// Once per page: a new title or episode is a new page.
	}, []);

	// The stall clock, and the stuttering toast (PLAN 12.5): Parda offers, never switches on its own.
	useEffect(() => {
		const timer = setInterval(() => {
			const now = Date.now();
			stall.current.tick(now);
			if (stutterOffered.current || firstMoveAt.current === null || !play.current) return;
			if (!ADAPTERS[play.current.source.adapter].infersStalls) return;
			if (isStuttering(stall.current.summary(now), watchedS.current)) {
				stutterOffered.current = true;
				offerSwitch(m.pd_player_stuttering(), play.current.source);
			}
		}, TICK_MS);
		return () => clearInterval(timer);
	});

	// A click in the player arms the redirect guard; it also starts a needs-click deadline.
	useRedirectGuard(frameRef, () => {
		const current = play.current?.source;
		if (current?.needsClick && firstMoveAt.current === null && !deadline.current) armDeadline(current);
	});

	useEffect(() => {
		const onPageHide = () => {
			saveProgress(true);
			sendPlay(true);
		};
		window.addEventListener("pagehide", onPageHide);
		return () => window.removeEventListener("pagehide", onPageHide);
	});

	// Leaving for another page (an episode, Up next) is the end of this playback too.
	// biome-ignore lint/correctness/useExhaustiveDependencies: on unmount only, with the latest refs.
	useEffect(
		() => () => {
			clearDeadline();
			saveProgress();
			sendPlay();
		},
		[],
	);

	return {
		status,
		source,
		src,
		order,
		picked,
		ready,
		playing,
		position,
		duration,
		ended,
		clickHint,
		nearEnd: ended || isNearEnd(position, duration),
		target,
		onEvent,
		choose,
		command,
		/** The player's URL from where the viewer is now, for a frame that reloads (picture-in-picture). */
		resumeSrc: () =>
			source ? withStart(source.url, startFor(source, { position: positionRef.current, sourceId: source.id })) : null,
		retry: () => {
			tried.current = new Set();
			const first = firstSource(orderRef.current, null);
			if (first) load(first, startFor(first, resume.current));
		},
	};
}

export type WatchPlayer = ReturnType<typeof useWatchPlayer>;
