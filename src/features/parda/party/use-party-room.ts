import { useQuery } from "@tanstack/react-query";
import { type RefObject, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { sessionQueryOptions } from "@/features/auth/queries";
import { isAppError } from "@/lib/errors";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { useEnsureViewer } from "../library/use-viewer-session";
import { ADAPTERS } from "../player/adapters";
import type { PlayerCommand, PlayerEvent } from "../player/adapters/types";
import { useRedirectGuard } from "../player/redirect-guard";
import { lasting, reportPlay, reportProgress } from "../player/report";
import { createStallDetector } from "../player/stall";
import { withStart } from "../player/templates";
import type { PartyChannel, PartyPresence } from "./channel";
import { addSample, type ClockSample, clockOffset } from "./clock";
import { partyMode } from "./source";
import {
	groupPosition,
	initialSync,
	type PartyMember,
	type PartyMessage,
	parsePartyMessage,
	reduceSync,
	type SyncEffect,
	type SyncEvent,
	type SyncState,
} from "./sync";
import type { PartyPageData } from "./types";

/**
 * A watch party's room (PLAN 12.5, "Watch party"; decision 0243): takes a seat, keeps the
 * channel, and carries out what the pure sync in `sync.ts` decides. Each member's own
 * progress and playback are recorded as usual, the playback marked as a party's, so
 * ranking leaves it out.
 */

type Data = Extract<PartyPageData, { configured: true }>;
export type JoinStatus = "idle" | "joining" | "joined" | "full" | "failed";

const TICK_MS = 250;
const PULSE_MS = 15_000;
const SAVE_EVERY_MS = 15_000;
/** Dragging the seek bar sends the room its position at most this often. */
const SEEK_THROTTLE_MS = 250;

const presenceSchema = z.object({ name: z.string().max(100), ready: z.boolean(), joinedAt: z.number() });

const fixed = (n: number) => Math.max(0, Math.round(n));

const parties = () => import("@/functions/parda/party");

export function usePartyRoom(data: Data, frameRef: RefObject<HTMLIFrameElement | null>) {
	const { watch, code } = data;
	const { title, episode } = watch;
	const { data: session } = useQuery(sessionQueryOptions());
	const signedIn = Boolean(session);
	const ensureViewer = useEnsureViewer({ playerMounted: true });
	const modes = Object.fromEntries(watch.sources.map((source) => [source.id, partyMode(source)]));

	const [sync, setSync] = useState<SyncState>(() =>
		initialSync({ me: "", host: "", sourceId: data.sourceId, modes, snapshot: data.snapshot }),
	);
	const [status, setStatus] = useState<JoinStatus>("idle");
	const [attempt, setAttempt] = useState(0);
	const [connected, setConnected] = useState(false);
	const [lost, setLost] = useState(false);
	const [ready, setReady] = useState(false);
	const [src, setSrc] = useState<string | null>(null);
	const [position, setPosition] = useState(data.snapshot.position);
	const [duration, setDuration] = useState<number | null>(null);
	// Server time, from the state the server rendered, so the first render matches it.
	const [now, setNow] = useState(data.snapshot.at);

	const syncRef = useRef(sync);
	const channelRef = useRef<PartyChannel | null>(null);
	const samples = useRef<ClockSample[]>([]);
	const offset = useRef(0);
	const readyRef = useRef(false);
	const presence = useRef<PartyPresence | null>(null);
	const stall = useRef(createStallDetector());
	const wasStalled = useRef(false);
	const lastPosition = useRef<number | null>(null);
	const lastSave = useRef(0);
	const lastSeek = useRef(0);
	const pendingSeek = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pulseTurn = useRef(0);
	const durationRef = useRef<number | null>(null);
	const moved = useRef(false);
	const watchedS = useRef(0);
	const play = useRef<{ playbackId: string; sourceId: string; setAt: number; startMs: number | null } | null>(null);

	const serverNow = () => Date.now() + offset.current;

	const sourceNow = () => watch.sources.find((source) => source.id === syncRef.current.sourceId) ?? null;

	const noteClock = (sentAt: number, serverTime: number) => {
		samples.current = addSample(samples.current, { sentAt, receivedAt: Date.now(), serverNow: serverTime });
		offset.current = clockOffset(samples.current);
	};

	const sendPlay = (keepalive = false) => {
		const record = play.current;
		if (!record) return;
		const summary = stall.current.summary(Date.now());
		reportPlay(
			{
				playbackId: record.playbackId,
				sourceId: record.sourceId,
				media: title.media,
				id: title.id,
				...(episode ? { season: episode.season, episode: episode.episode } : {}),
				failed: syncRef.current.playerFailed,
				startMs: record.startMs,
				stallCount: summary.count,
				stallMs: fixed(summary.ms),
				watchedS: Math.min(86_400, fixed(watchedS.current)),
				switchedAway: false,
				band: "unknown",
				inParty: true,
			},
			keepalive,
		);
	};

	const saveProgress = (keepalive = false) => {
		const at = lastPosition.current;
		if (!moved.current || at === null || at <= 0) return;
		lastSave.current = Date.now();
		reportProgress(
			{
				media: title.media,
				id: title.id,
				...(episode ? { season: episode.season, episode: episode.episode } : {}),
				watched: Math.min(86_400, at),
				duration: durationRef.current === null ? null : Math.min(86_400, durationRef.current),
				sourceId: play.current?.sourceId ?? null,
			},
			keepalive,
		);
	};

	const loadAt = (at: number) => {
		const source = sourceNow();
		if (!source) return;
		if (play.current) sendPlay();
		stall.current = createStallDetector();
		wasStalled.current = false;
		lastPosition.current = null;
		moved.current = false;
		watchedS.current = 0;
		play.current = { playbackId: crypto.randomUUID(), sourceId: source.id, setAt: Date.now(), startMs: null };
		setPosition(at);
		setDuration(null);
		durationRef.current = null;
		setSrc(withStart(source.url, at));
	};

	const sendCommand = (command: PlayerCommand) => {
		const source = sourceNow();
		const frame = frameRef.current?.contentWindow;
		const build = source ? ADAPTERS[source.adapter].command : null;
		if (!source || !frame || !build) return;
		stall.current.noteCommand(Date.now());
		frame.postMessage(build(command), source.url.startsWith("/") ? window.location.origin : (source.origins[0] ?? "*"));
	};

	const publish = (message: PartyMessage) => channelRef.current?.publish(message);

	const pulse = (withState: boolean) => {
		const state = syncRef.current;
		if (!state.me) return;
		const at = serverNow();
		const report =
			withState && state.me === state.host
				? {
						playing: state.shared.playing,
						started: state.phase === "live" || state.phase === "countdown",
						position: Math.min(172_800, groupPosition(state, at)),
						at,
					}
				: null;
		const sentAt = Date.now();
		parties()
			.then(({ pulsePardaParty }) => pulsePardaParty({ data: { code, report } }))
			.then((answer) => {
				noteClock(sentAt, answer.now);
				if (answer.hostMemberId !== syncRef.current.host) {
					dispatch({ type: "host", member: answer.hostMemberId, now: serverNow() });
				}
			})
			.catch((error: unknown) => {
				// The kill switch, a takedown, the host or the clock ended it.
				if (isAppError(error) && error.code === "NOT_FOUND") dispatch({ type: "ended" });
			});
	};

	const takeOver = () => {
		parties()
			.then(({ takeOverPardaParty }) => takeOverPardaParty({ data: { code } }))
			.then(({ hostMemberId }) => {
				dispatch({ type: "host", member: hostMemberId, now: serverNow() });
				publish({ type: "host", member: hostMemberId });
				toast(m.pd_party_you_are_host());
			})
			// The host is still here, or another member is next: the clock tries again.
			.catch(() => {});
	};

	const run = (effect: SyncEffect) => {
		switch (effect.kind) {
			case "command":
				sendCommand(effect.command);
				break;
			case "publish":
				publish(effect.message);
				break;
			case "load":
				loadAt(effect.position);
				break;
			case "save":
				pulse(true);
				break;
			case "take-over":
				takeOver();
				break;
		}
	};

	const dispatch = (event: SyncEvent) => {
		const { state, effects } = reduceSync(syncRef.current, event);
		syncRef.current = state;
		setSync(state);
		for (const effect of effects) run(effect);
	};

	const leave = (keepalive = false) => {
		const state = syncRef.current;
		if (!state.me || state.phase === "ended") return;
		parties()
			.then(({ leavePardaParty }) => leavePardaParty({ data: { code }, ...lasting(keepalive) }))
			.catch(() => {});
	};

	// A seat as soon as there's a session: the room shows who's here before anyone is ready.
	// biome-ignore lint/correctness/useExhaustiveDependencies: the room is one party; the rest is read through refs.
	useEffect(() => {
		if (!signedIn) return;
		let cancelled = false;
		const enter = async () => {
			setStatus("joining");
			const sentAt = Date.now();
			try {
				const { joinPardaParty, getPardaPartyToken } = await parties();
				const joined = await joinPardaParty({ data: { code, locale: getLocale() } });
				if (cancelled) return;
				noteClock(sentAt, joined.now);
				const state = initialSync({
					me: joined.memberId,
					host: joined.hostMemberId,
					sourceId: joined.sourceId,
					modes,
					snapshot: joined.snapshot,
				});
				syncRef.current = state;
				setSync(state);
				setStatus("joined");
				presence.current = { name: joined.name, ready: readyRef.current, joinedAt: joined.joinedAt };
				const { connectPartyChannel } = await import("./channel");
				const channel = await connectPartyChannel(joined.connection, presence.current, {
					onMessage: (from, payload) => {
						const message = parsePartyMessage(payload);
						if (message) dispatch({ type: "remote", from, message, now: serverNow() });
					},
					onPresence: (members) => {
						const known: PartyMember[] = members.flatMap(({ id, data: value }) => {
							const parsed = presenceSchema.safeParse(value);
							return parsed.success ? [{ id, ...parsed.data }] : [];
						});
						dispatch({ type: "presence", members: known, now: serverNow() });
					},
					onStatus: (value) => {
						setConnected(value === "connected");
						setLost(value === "reconnecting");
					},
					renewToken: async () => (await getPardaPartyToken({ data: { code } })).token,
				});
				if (cancelled) {
					channel.close();
					return;
				}
				channelRef.current = channel;
				setConnected(true);
				pulse(false);
			} catch (error) {
				if (cancelled) return;
				if (isAppError(error) && error.code === "NOT_FOUND") dispatch({ type: "ended" });
				else if (isAppError(error) && error.code === "CONFLICT") setStatus("full");
				else setStatus("failed");
			}
		};
		void enter();
		return () => {
			cancelled = true;
			channelRef.current?.close();
			channelRef.current = null;
		};
	}, [signedIn, attempt]);

	// Everything that loads a player. Full sync loads at Ready and holds it, start together when the countdown ends.
	// biome-ignore lint/correctness/useExhaustiveDependencies: loads once per seat; changes of source come as effects.
	useEffect(() => {
		if (!ready || src !== null || sync.phase === "ended" || status !== "joined") return;
		if (sync.mode === "full" || sync.phase === "live") loadAt(groupPosition(syncRef.current, serverNow()));
	}, [ready, sync.mode, sync.phase, status]);

	// The clock: the countdown, a stall, a host who's gone, and what the page says. One timer: a render mustn't restart it.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reads the latest state through refs.
	useEffect(() => {
		const timer = setInterval(() => {
			const at = serverNow();
			stall.current.tick(Date.now());
			const stalled = stall.current.summary(Date.now()).stalled;
			if (stalled && !wasStalled.current && lastPosition.current !== null) {
				dispatch({ type: "stalled", position: lastPosition.current, now: at });
			}
			wasStalled.current = stalled;
			if (syncRef.current.me) dispatch({ type: "tick", now: at });
			setNow(at);
		}, TICK_MS);
		return () => clearInterval(timer);
	}, []);

	// A sign of life: the host's every 15 s with the state, the others' every 30 s.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reads the latest state through refs.
	useEffect(() => {
		const timer = setInterval(() => {
			pulseTurn.current += 1;
			const host = syncRef.current.me === syncRef.current.host;
			if (host || pulseTurn.current % 2 === 0) pulse(host);
		}, PULSE_MS);
		return () => clearInterval(timer);
	}, []);

	useRedirectGuard(frameRef);

	useEffect(() => {
		const onPageHide = () => {
			saveProgress(true);
			sendPlay(true);
			leave(true);
		};
		window.addEventListener("pagehide", onPageHide);
		return () => window.removeEventListener("pagehide", onPageHide);
	});

	// Leaving for another page is leaving the party.
	// biome-ignore lint/correctness/useExhaustiveDependencies: on unmount only, with the latest refs.
	useEffect(
		() => () => {
			saveProgress();
			sendPlay();
			leave();
			if (pendingSeek.current) clearTimeout(pendingSeek.current);
		},
		[],
	);

	const onEvent = (event: PlayerEvent) => {
		const at = Date.now();
		stall.current.observe(event, at);
		if (event.kind === "ready" || event.kind === "position") {
			if (event.duration) {
				setDuration(event.duration);
				durationRef.current = event.duration;
			}
		}
		if (event.kind === "position") {
			const previous = lastPosition.current;
			if (previous !== null && event.position > previous && event.position - previous < 5) {
				watchedS.current += event.position - previous;
			}
			if (previous !== null && event.position !== previous && !moved.current) {
				moved.current = true;
				if (play.current) play.current.startMs = Math.min(600_000, at - play.current.setAt);
				sendPlay();
			}
			lastPosition.current = event.position;
			setPosition(event.position);
			if (moved.current && at - lastSave.current >= SAVE_EVERY_MS) saveProgress();
		}
		if (event.kind === "seeked") {
			lastPosition.current = event.position;
			setPosition(event.position);
		}
		if (event.kind === "pause" || event.kind === "ended") saveProgress();
		if (event.kind === "failed" || event.kind === "ended") sendPlay();
		dispatch({ type: "player", event, now: serverNow() });
	};

	/** The viewer's own controls: they go to the whole room. */
	const control = (command: PlayerCommand) => {
		if (command.action !== "seek") {
			dispatch({ type: "local", action: command.action, now: serverNow() });
			return;
		}
		setPosition(command.position);
		const send = () => {
			lastSeek.current = Date.now();
			dispatch({ type: "local", action: "seek", position: command.position, now: serverNow() });
		};
		if (pendingSeek.current) clearTimeout(pendingSeek.current);
		const wait = SEEK_THROTTLE_MS - (Date.now() - lastSeek.current);
		if (wait <= 0) send();
		else pendingSeek.current = setTimeout(send, wait);
	};

	/** Ready: the gesture autoplay needs. Without a session it starts a guest, and the seat follows. */
	const pressReady = async () => {
		readyRef.current = true;
		setReady(true);
		if (!signedIn && !(await ensureViewer())) {
			readyRef.current = false;
			setReady(false);
			return;
		}
		if (presence.current) {
			presence.current = { ...presence.current, ready: true };
			channelRef.current?.setPresence(presence.current);
		}
	};

	const changeSource = async (sourceId: string) => {
		const state = syncRef.current;
		if (state.me !== state.host || sourceId === state.sourceId) return;
		const { setPardaPartySource } = await parties();
		await setPardaPartySource({ data: { code, sourceId } });
		const at = serverNow();
		// Timecodes differ between sources: everyone lands 30 s earlier.
		const message: PartyMessage = {
			type: "source",
			sourceId,
			position: Math.max(0, Math.floor(groupPosition(syncRef.current, at) - 30)),
			at,
		};
		publish(message);
		dispatch({ type: "remote", from: state.me, message, now: at });
		pulse(true);
	};

	const endParty = async () => {
		const { endPardaParty } = await parties();
		await endPardaParty({ data: { code } });
		publish({ type: "ended" });
		dispatch({ type: "ended" });
	};

	const retry = () => setAttempt((count) => count + 1);

	return {
		sync,
		status,
		connected,
		lost,
		ready,
		src,
		now,
		position,
		duration,
		source: watch.sources.find((source) => source.id === sync.sourceId) ?? null,
		onEvent,
		control,
		pressReady,
		start: () => dispatch({ type: "start", now: serverNow() }),
		continueWithout: (member: string) => dispatch({ type: "continue-without", member, now: serverNow() }),
		resync: () => dispatch({ type: "resync", now: serverNow() }),
		changeSource,
		endParty,
		retry,
	};
}

export type PartyRoom = ReturnType<typeof usePartyRoom>;
