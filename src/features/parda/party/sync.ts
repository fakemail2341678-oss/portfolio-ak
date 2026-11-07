import { z } from "zod";
import type { PlayerCommand, PlayerEvent } from "../player/adapters/types";
import type { PartyMode } from "./source";
import type { PartySnapshot } from "./types";

/**
 * A watch party's sync (PLAN 12.5, "Watch party"; decision 0243), pure so each rule is
 * unit-tested. The hook feeds it events (the channel's messages, the player's reports, the
 * viewer's controls, the clock) and carries out what it returns: commands to the player,
 * messages to the channel, a reload. Every time here is server time.
 *
 * Full sync (a source that obeys commands): play, pause and seek reach everyone, drift over
 * 2 s gets a hard seek, and one viewer's buffering pauses the rest until they move again.
 * Start together (any other source): a shared countdown, then each player runs on its own.
 */

/** No player documents speed control, so more drift than this gets a hard seek. */
export const DRIFT_S = 2;
/** A viewer who stalled must move for this long before the room resumes. */
export const RECOVER_AFTER_MS = 1_000;
/** How long the room waits before the host can go on without someone. */
export const CONTINUE_AFTER_MS = 30_000;
export const COUNTDOWN_MS = 3_000;
/** A host who's gone this long hands over: long enough for a reload to come back. */
export const TAKE_OVER_AFTER_MS = 15_000;
const TAKE_OVER_RETRY_MS = 10_000;
/** A hard seek gets this long to land before drift counts again. */
const SEEK_SETTLE_MS = 3_000;
/** After a command, what the player says is its answer, not the viewer's own click inside it. */
const COMMAND_ECHO_MS = 1_500;
/** A player may start by itself as it loads; that isn't the viewer pressing play. */
const LOAD_ECHO_MS = 5_000;

const time = z.number().int().nonnegative();
const position = z.number().min(0).max(172_800);

const partyMessage = z.discriminatedUnion("type", [
	z.strictObject({ type: z.literal("state"), playing: z.boolean(), position, at: time }),
	z.strictObject({ type: z.literal("start"), position, at: time }),
	z.strictObject({ type: z.literal("stall"), position, at: time }),
	z.strictObject({ type: z.literal("recover"), position, at: time }),
	z.strictObject({ type: z.literal("waive"), member: z.string().max(64) }),
	z.strictObject({ type: z.literal("source"), sourceId: z.string().max(64), position, at: time }),
	z.strictObject({ type: z.literal("host"), member: z.string().max(64) }),
	z.strictObject({ type: z.literal("ended") }),
]);

export type PartyMessage = z.infer<typeof partyMessage>;

/** Anyone in the channel can publish anything, so nothing is believed before this. */
export function parsePartyMessage(data: unknown): PartyMessage | null {
	const parsed = partyMessage.safeParse(data);
	return parsed.success ? parsed.data : null;
}

export type Shared = { playing: boolean; position: number; at: number };
export type PartyMember = { id: string; name: string; ready: boolean; joinedAt: number };
export type PartyPhase = "lobby" | "countdown" | "live" | "ended";

export type SyncState = {
	me: string;
	host: string;
	mode: PartyMode;
	/** Each playable source's mode: a `source` message naming anything else is ignored. */
	modes: Readonly<Record<string, PartyMode>>;
	sourceId: string | null;
	phase: PartyPhase;
	startAt: number | null;
	shared: Shared;
	members: PartyMember[];
	/** Who the room is waiting for, and since when. */
	stalls: Array<{ member: string; since: number }>;
	/** Those the host went on without: their buffering holds nobody again. */
	waived: string[];
	playerReady: boolean;
	playerPlaying: boolean;
	playerPosition: number | null;
	playerEnded: boolean;
	playerFailed: boolean;
	/** Where this viewer stalled, and since when they've been moving again. */
	stalledAt: number | null;
	movingSince: number | null;
	lastSeekAt: number;
	echoUntil: number;
	hostMissingSince: number | null;
	lastTakeOverAt: number;
};

export type SyncEffect =
	| { kind: "command"; command: PlayerCommand }
	| { kind: "publish"; message: PartyMessage }
	/** Load the source at this position: a change of source, or *Resync*. */
	| { kind: "load"; position: number }
	/** The host saves the state now (`pd_party`), for late joiners and reloads. */
	| { kind: "save" }
	| { kind: "take-over" };

export type SyncEvent =
	| { type: "presence"; members: ReadonlyArray<PartyMember>; now: number }
	| { type: "remote"; from: string | undefined; message: PartyMessage; now: number }
	| { type: "local"; action: "play" | "pause" | "seek"; position?: number; now: number }
	| { type: "player"; event: PlayerEvent; now: number }
	| { type: "stalled"; position: number; now: number }
	| { type: "start"; now: number }
	| { type: "continue-without"; member: string; now: number }
	| { type: "resync"; now: number }
	| { type: "tick"; now: number }
	| { type: "host"; member: string; now: number }
	| { type: "ended" };

export type SyncResult = { state: SyncState; effects: SyncEffect[] };

export function initialSync(options: {
	me: string;
	host: string;
	sourceId: string | null;
	modes: Readonly<Record<string, PartyMode>>;
	snapshot: PartySnapshot;
}): SyncState {
	const { snapshot, sourceId, modes } = options;
	const started = snapshot.state !== "lobby";
	return {
		me: options.me,
		host: options.host,
		mode: (sourceId && modes[sourceId]) || "together",
		modes,
		sourceId,
		phase: snapshot.state === "ended" ? "ended" : started ? "live" : "lobby",
		startAt: null,
		shared: { playing: snapshot.state === "playing", position: snapshot.position, at: snapshot.at },
		members: [],
		stalls: [],
		waived: [],
		playerReady: false,
		playerPlaying: false,
		playerPosition: null,
		playerEnded: false,
		playerFailed: false,
		stalledAt: null,
		movingSince: null,
		lastSeekAt: 0,
		echoUntil: 0,
		hostMissingSince: null,
		lastTakeOverAt: 0,
	};
}

/** The room's position now: frozen while it waits for someone, or before it starts. */
export function groupPosition(state: Pick<SyncState, "shared" | "stalls" | "phase">, now: number): number {
	const { shared } = state;
	if (!shared.playing || state.stalls.length > 0 || state.phase === "lobby") return shared.position;
	return shared.position + Math.max(0, now - shared.at) / 1000;
}

const isStalled = (state: SyncState) => state.stalls.some((stall) => stall.member === state.me);
const isHost = (state: SyncState) => state.me === state.host;

/** Whether this viewer's player should be running. One who stalled keeps trying while the others wait. */
const wantsPlaying = (state: SyncState) =>
	state.phase === "live" && state.shared.playing && (state.stalls.length === 0 || isStalled(state));

/** Makes the player match the room, in full sync: its position, then playing or not. */
function reconcile(state: SyncState, now: number, { forceSeek = false, drift = true } = {}): SyncResult {
	if (state.mode !== "full" || !state.playerReady || state.playerEnded || state.phase === "ended") {
		return { state, effects: [] };
	}
	const effects: SyncEffect[] = [];
	let next = state;
	const send = (command: PlayerCommand, change: Partial<SyncState>) => {
		effects.push({ kind: "command", command });
		next = { ...next, ...change, echoUntil: now + COMMAND_ECHO_MS };
	};
	if (!isStalled(state) && state.playerPosition !== null) {
		const target = groupPosition(state, now);
		const off = Math.abs(state.playerPosition - target) > DRIFT_S;
		const settled = now - state.lastSeekAt >= SEEK_SETTLE_MS;
		if (forceSeek || (drift && off && settled)) {
			send({ action: "seek", position: target }, { playerPosition: target, lastSeekAt: now });
		}
	}
	const want = wantsPlaying(state);
	if (want !== state.playerPlaying) {
		send({ action: want ? "play" : "pause" }, { playerPlaying: want });
	}
	return { state: next, effects };
}

const started = (state: SyncState) => state.phase === "live" || state.phase === "countdown";

/** The room's new state from this viewer: everyone follows, and the host saves it if it paused. */
function shareLocal(state: SyncState, shared: Shared, now: number, seek: boolean): SyncResult {
	const applied = reconcile({ ...state, shared }, now, { forceSeek: seek });
	const effects: SyncEffect[] = [{ kind: "publish", message: { type: "state", ...shared } }, ...applied.effects];
	if (isHost(state)) effects.push({ kind: "save" });
	return { state: applied.state, effects };
}

/** The host starts the shared countdown. */
function startCountdown(state: SyncState, now: number): SyncResult {
	if (state.phase !== "lobby" || !isHost(state)) return { state, effects: [] };
	const at = now + COUNTDOWN_MS;
	const message: PartyMessage = { type: "start", position: state.shared.position, at };
	return {
		state: {
			...state,
			phase: "countdown",
			startAt: at,
			shared: { playing: true, position: state.shared.position, at },
		},
		effects: [{ kind: "publish", message }],
	};
}

/** It starts once all are ready. Alone in the room, the host starts it: others may still be on their way. */
const startIfAllReady = (state: SyncState, now: number): SyncResult =>
	state.members.length >= 2 && state.members.every((member) => member.ready)
		? startCountdown(state, now)
		: { state, effects: [] };

/** The last one the room waited for is gone: it runs again from `position`, seeking if told to. */
function afterWait(state: SyncState, position: number, at: number, now: number, forceSeek: boolean): SyncResult {
	if (state.stalls.length > 0) {
		return { state: { ...state, shared: { ...state.shared, position, at: now } }, effects: [] };
	}
	return reconcile({ ...state, shared: { ...state.shared, position, at } }, now, { forceSeek });
}

function onRemote(state: SyncState, from: string | undefined, message: PartyMessage, now: number): SyncResult {
	const fromHost = from === state.host;
	switch (message.type) {
		case "state": {
			// The later press wins, and a start-together room has nothing shared but its clock.
			if (message.at < state.shared.at || state.phase === "ended") return { state, effects: [] };
			const shared = {
				playing: state.mode === "together" ? true : message.playing,
				position: message.position,
				at: message.at,
			};
			const applied = reconcile({ ...state, shared, phase: "live", startAt: null }, now, { drift: true });
			return {
				state: applied.state,
				effects: isHost(state) ? [...applied.effects, { kind: "save" }] : applied.effects,
			};
		}
		case "start":
			if (!fromHost || state.phase !== "lobby") return { state, effects: [] };
			return {
				state: {
					...state,
					phase: "countdown",
					startAt: message.at,
					shared: { playing: true, position: message.position, at: message.at },
				},
				effects: [],
			};
		case "stall": {
			if (state.mode !== "full" || !from || state.waived.includes(from)) return { state, effects: [] };
			if (state.stalls.some((stall) => stall.member === from)) return { state, effects: [] };
			const held: SyncState = {
				...state,
				stalls: [...state.stalls, { member: from, since: now }],
				shared: { ...state.shared, position: message.position, at: now },
			};
			return reconcile(held, now, { drift: false });
		}
		case "recover": {
			if (!from || !state.stalls.some((stall) => stall.member === from)) return { state, effects: [] };
			const rest = state.stalls.filter((stall) => stall.member !== from);
			return afterWait({ ...state, stalls: rest }, message.position, message.at, now, true);
		}
		case "waive": {
			if (!fromHost) return { state, effects: [] };
			const waived = { ...state, waived: [...state.waived, message.member] };
			return dropStall(waived, message.member, now);
		}
		case "source": {
			if (!fromHost) return { state, effects: [] };
			const mode = state.modes[message.sourceId];
			if (!mode) return { state, effects: [] };
			return {
				state: {
					...state,
					mode,
					sourceId: message.sourceId,
					shared: {
						playing: mode === "together" ? true : state.shared.playing,
						position: message.position,
						at: message.at,
					},
					stalls: [],
					waived: [],
					playerReady: false,
					playerPlaying: false,
					playerPosition: null,
					playerEnded: false,
					playerFailed: false,
					stalledAt: null,
					movingSince: null,
				},
				effects: [{ kind: "load", position: message.position }],
			};
		}
		case "host":
			// A claim only counts from the member making it, once the host really is away.
			if (from !== message.member || state.members.some((member) => member.id === state.host)) {
				return { state, effects: [] };
			}
			return { state: { ...state, host: message.member, hostMissingSince: null }, effects: [] };
		case "ended":
			return fromHost ? { state: { ...state, phase: "ended" }, effects: [] } : { state, effects: [] };
	}
}

/** Stops waiting for a member (the host went on, or they left): the room runs from where it froze. */
function dropStall(state: SyncState, member: string, now: number): SyncResult {
	if (!state.stalls.some((stall) => stall.member === member)) return { state, effects: [] };
	const stalls = state.stalls.filter((stall) => stall.member !== member);
	const mine = member === state.me ? { stalledAt: null, movingSince: null } : {};
	return afterWait({ ...state, ...mine, stalls }, state.shared.position, now, now, false);
}

function onPlayer(state: SyncState, event: PlayerEvent, now: number): SyncResult {
	const echo = now <= state.echoUntil;
	const live = state.phase === "live" && state.mode === "full" && !isStalled(state);
	switch (event.kind) {
		case "ready":
			return reconcile({ ...state, playerReady: true, echoUntil: now + LOAD_ECHO_MS }, now, { drift: false });
		case "position": {
			const moved: SyncState = { ...state, playerPosition: event.position, playerPlaying: true };
			if (isStalled(state) && state.stalledAt !== null) {
				if (event.position <= state.stalledAt) return { state: moved, effects: [] };
				const movingSince = state.movingSince ?? now;
				if (now - movingSince < RECOVER_AFTER_MS) return { state: { ...moved, movingSince }, effects: [] };
				// Moving again for a second: everyone seeks to this viewer and plays.
				const stalls = state.stalls.filter((stall) => stall.member !== state.me);
				const recovered = afterWait(
					{ ...moved, stalls, stalledAt: null, movingSince: null },
					event.position,
					now,
					now,
					false,
				);
				return {
					state: recovered.state,
					effects: [
						{ kind: "publish", message: { type: "recover", position: event.position, at: now } },
						...recovered.effects,
					],
				};
			}
			return reconcile(moved, now);
		}
		case "play":
			if (live && !echo && !wantsPlaying(state)) {
				const shared = { playing: true, position: state.playerPosition ?? state.shared.position, at: now };
				return shareLocal({ ...state, playerPlaying: true }, shared, now, false);
			}
			return reconcile({ ...state, playerPlaying: true }, now, { drift: false });
		case "pause":
			if (live && !echo && wantsPlaying(state)) {
				const shared = { playing: false, position: state.playerPosition ?? state.shared.position, at: now };
				return shareLocal({ ...state, playerPlaying: false }, shared, now, false);
			}
			return { state: { ...state, playerPlaying: false }, effects: [] };
		case "seeked":
			if (live && !echo && Math.abs(event.position - groupPosition(state, now)) > DRIFT_S) {
				const shared = { ...state.shared, position: event.position, at: now };
				return shareLocal({ ...state, playerPosition: event.position }, shared, now, false);
			}
			return { state: { ...state, playerPosition: event.position }, effects: [] };
		case "ended":
			return { state: { ...state, playerPlaying: false, playerEnded: true }, effects: [] };
		case "failed":
			return { state: { ...state, playerFailed: true }, effects: [] };
	}
}

function onPresence(state: SyncState, event: Extract<SyncEvent, { type: "presence" }>): SyncResult {
	const { now } = event;
	const members = [...event.members].sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
	const entrants = members.filter((member) => !state.members.some((each) => each.id === member.id));
	const hostHere = members.some((member) => member.id === state.host);
	let next: SyncState = {
		...state,
		members,
		hostMissingSince: hostHere ? null : (state.hostMissingSince ?? now),
	};
	const effects: SyncEffect[] = [];
	// Someone who left can't hold the room.
	for (const stall of state.stalls) {
		if (!members.some((member) => member.id === stall.member)) {
			const dropped = dropStall(next, stall.member, now);
			next = dropped.state;
			effects.push(...dropped.effects);
		}
	}
	// A late joiner read a saved state: the longest-present of the others tells them the live one.
	if (started(next) && entrants.length > 0) {
		const teller = members.find((member) => !entrants.includes(member));
		if (teller?.id === next.me) {
			const position = groupPosition(next, now);
			effects.push({
				kind: "publish",
				message: { type: "state", playing: next.shared.playing, position, at: now },
			});
		}
	}
	const start = startIfAllReady(next, now);
	return { state: start.state, effects: [...effects, ...start.effects] };
}

export function reduceSync(state: SyncState, event: SyncEvent): SyncResult {
	switch (event.type) {
		case "presence":
			return onPresence(state, event);
		case "remote":
			return onRemote(state, event.from, event.message, event.now);
		case "local": {
			if (state.mode !== "full" || state.phase !== "live") return { state, effects: [] };
			const position = event.action === "seek" ? (event.position ?? 0) : groupPosition(state, event.now);
			const playing = event.action === "seek" ? state.shared.playing : event.action === "play";
			return shareLocal(state, { playing, position, at: event.now }, event.now, event.action === "seek");
		}
		case "player":
			return onPlayer(state, event.event, event.now);
		case "stalled": {
			// Only full sync waits, only while the room is playing, and never again for someone the host went on without.
			if (
				state.mode !== "full" ||
				state.phase !== "live" ||
				!state.shared.playing ||
				isStalled(state) ||
				state.waived.includes(state.me)
			) {
				return { state, effects: [] };
			}
			return {
				state: {
					...state,
					stalls: [...state.stalls, { member: state.me, since: event.now }],
					stalledAt: event.position,
					movingSince: null,
					shared: { ...state.shared, position: event.position, at: event.now },
				},
				effects: [{ kind: "publish", message: { type: "stall", position: event.position, at: event.now } }],
			};
		}
		case "start":
			return startCountdown(state, event.now);
		case "continue-without": {
			if (!isHost(state)) return { state, effects: [] };
			const dropped = dropStall({ ...state, waived: [...state.waived, event.member] }, event.member, event.now);
			return {
				state: dropped.state,
				effects: [{ kind: "publish", message: { type: "waive", member: event.member } }, ...dropped.effects],
			};
		}
		case "resync":
			return state.phase === "live"
				? {
						state: { ...state, playerPosition: null },
						effects: [{ kind: "load", position: groupPosition(state, event.now) }],
					}
				: { state, effects: [] };
		case "tick": {
			let next = state;
			const effects: SyncEffect[] = [];
			if (state.phase === "countdown" && state.startAt !== null && event.now >= state.startAt) {
				const live = reconcile({ ...state, phase: "live", startAt: null }, event.now, { drift: false });
				next = live.state;
				effects.push(...live.effects);
				if (isHost(state)) effects.push({ kind: "save" });
			}
			const waited = next.hostMissingSince !== null && event.now - next.hostMissingSince >= TAKE_OVER_AFTER_MS;
			if (waited && next.members[0]?.id === next.me && event.now - next.lastTakeOverAt >= TAKE_OVER_RETRY_MS) {
				next = { ...next, lastTakeOverAt: event.now };
				effects.push({ kind: "take-over" });
			}
			return { state: next, effects };
		}
		case "host":
			return { state: { ...state, host: event.member, hostMissingSince: null }, effects: [] };
		case "ended":
			return { state: { ...state, phase: "ended" }, effects: [] };
	}
}

/** The person the room waits for longest, once the host may go on without them. */
export function continueCandidate(state: SyncState, now: number): string | null {
	if (!isHost(state)) return null;
	const oldest = state.stalls.find((stall) => stall.member !== state.me);
	return oldest && now - oldest.since >= CONTINUE_AFTER_MS ? oldest.member : null;
}
