import { describe, expect, it } from "vitest";
import { addSample, clockOffset } from "@/features/parda/party/clock";
import { partyMode, partySource, takesStart } from "@/features/parda/party/source";
import {
	CONTINUE_AFTER_MS,
	COUNTDOWN_MS,
	continueCandidate,
	groupPosition,
	initialSync,
	type PartyMember,
	type PartyMessage,
	parsePartyMessage,
	RECOVER_AFTER_MS,
	reduceSync,
	type SyncEffect,
	type SyncEvent,
	type SyncResult,
	type SyncState,
	TAKE_OVER_AFTER_MS,
} from "@/features/parda/party/sync";

/** The sync reducer, rule by rule (PLAN 12.5, "Watch party"; decision 0243), and the clock offset. */

const MODES = { full: "full", none: "together" } as const;
const NOW = 1_000_000;

const member = (id: string, joinedAt: number, ready = true): PartyMember => ({ id, name: id, ready, joinedAt });

const room = (overrides: Partial<SyncState> = {}): SyncState => ({
	...initialSync({
		me: "me",
		host: "host",
		sourceId: "full",
		modes: MODES,
		snapshot: { state: "playing", position: 100, at: NOW },
	}),
	members: [member("host", 1), member("me", 2), member("sam", 3)],
	playerReady: true,
	playerPlaying: true,
	playerPosition: 100,
	...overrides,
});

const commands = (result: SyncResult) =>
	result.effects.flatMap((effect) => (effect.kind === "command" ? [effect.command] : []));
const published = (result: SyncResult) =>
	result.effects.flatMap((effect) => (effect.kind === "publish" ? [effect.message] : []));
const remote = (from: string, message: PartyMessage, now = NOW): SyncEvent => ({ type: "remote", from, message, now });
const position = (at: number, now: number): SyncEvent => ({
	type: "player",
	event: { kind: "position", position: at, duration: 7200 },
	now,
});
const hasEffect = (result: SyncResult, kind: SyncEffect["kind"]) => result.effects.some((each) => each.kind === kind);

describe("full sync: controls", () => {
	it("a viewer's pause goes to the room and to their own player", () => {
		const result = reduceSync(room(), { type: "local", action: "pause", now: NOW + 1000 });
		expect(result.state.shared).toEqual({ playing: false, position: 101, at: NOW + 1000 });
		expect(published(result)).toEqual([{ type: "state", playing: false, position: 101, at: NOW + 1000 }]);
		expect(commands(result)).toEqual([{ action: "pause" }]);
	});

	it("another viewer's pause pauses this player", () => {
		const result = reduceSync(room(), remote("sam", { type: "state", playing: false, position: 100, at: NOW + 10 }));
		expect(commands(result)).toEqual([{ action: "pause" }]);
		expect(result.state.playerPlaying).toBe(false);
	});

	it("a later press wins, and an older one is ignored", () => {
		const later = reduceSync(room(), remote("sam", { type: "state", playing: false, position: 100, at: NOW + 50 }));
		const older = reduceSync(
			later.state,
			remote("host", { type: "state", playing: true, position: 100, at: NOW + 40 }),
		);
		expect(older.state.shared.playing).toBe(false);
		expect(commands(older)).toEqual([]);
	});

	it("a seek moves everyone there", () => {
		const result = reduceSync(room(), { type: "local", action: "seek", position: 500, now: NOW + 10 });
		expect(commands(result)).toEqual([{ action: "seek", position: 500 }]);
		expect(published(result)[0]).toMatchObject({ type: "state", position: 500, playing: true });
	});

	it("the host saves the state when anyone changes it", () => {
		const message: PartyMessage = { type: "state", playing: false, position: 100, at: NOW + 10 };
		expect(hasEffect(reduceSync(room({ me: "host" }), remote("sam", message)), "save")).toBe(true);
		expect(hasEffect(reduceSync(room(), remote("sam", message)), "save")).toBe(false);
	});
});

describe("full sync: drift", () => {
	it("leaves up to 2 s alone, and hard-seeks past it", () => {
		const near = reduceSync(room(), position(101.5, NOW));
		expect(commands(near)).toEqual([]);
		const far = reduceSync(room(), position(103, NOW));
		expect(commands(far)).toEqual([{ action: "seek", position: 100 }]);
	});

	it("gives a hard seek time to land", () => {
		const first = reduceSync(room(), position(110, NOW));
		const soon = reduceSync(first.state, position(110, NOW + 1000));
		expect(commands(soon)).toEqual([]);
		const later = reduceSync(first.state, position(115, NOW + 3000));
		expect(commands(later)).toEqual([{ action: "seek", position: 103 }]);
	});

	it("start together never seeks", () => {
		const together = room({ mode: "together", sourceId: "none" });
		expect(commands(reduceSync(together, position(500, NOW)))).toEqual([]);
	});
});

describe("full sync: a stall", () => {
	const stalled = () => reduceSync(room(), remote("sam", { type: "stall", position: 90, at: NOW }));

	it("another's stall pauses this player and freezes the room there", () => {
		const result = stalled();
		expect(commands(result)).toEqual([{ action: "pause" }]);
		expect(result.state.stalls).toEqual([{ member: "sam", since: NOW }]);
		expect(groupPosition(result.state, NOW + 5000)).toBe(90);
	});

	it("this viewer's own stall tells the room, and keeps their player trying", () => {
		const result = reduceSync(room(), { type: "stalled", position: 100, now: NOW });
		expect(published(result)).toEqual([{ type: "stall", position: 100, at: NOW }]);
		expect(commands(result)).toEqual([]);
		expect(result.state.stalledAt).toBe(100);
	});

	it("resumes only after this viewer has moved for a second, then seeks the room to them", () => {
		const own = reduceSync(room(), { type: "stalled", position: 100, now: NOW });
		const still = reduceSync(own.state, position(100, NOW + 500));
		expect(published(still)).toEqual([]);
		const moving = reduceSync(still.state, position(100.25, NOW + 1000));
		expect(published(moving)).toEqual([]);
		const done = reduceSync(moving.state, position(101.25, NOW + 1000 + RECOVER_AFTER_MS));
		expect(published(done)).toEqual([{ type: "recover", position: 101.25, at: NOW + 2000 }]);
		expect(done.state.stalls).toEqual([]);
	});

	it("everyone seeks to the viewer who recovered, and plays", () => {
		const result = reduceSync(
			stalled().state,
			remote("sam", { type: "recover", position: 95, at: NOW + 40 }, NOW + 50),
		);
		expect(commands(result)).toEqual([{ action: "seek", position: 95.01 }, { action: "play" }]);
		expect(result.state.stalls).toEqual([]);
	});

	it("keeps waiting while someone else is still stalled", () => {
		const two = reduceSync(stalled().state, remote("host", { type: "stall", position: 91, at: NOW }));
		const one = reduceSync(two.state, remote("sam", { type: "recover", position: 95, at: NOW + 40 }, NOW + 50));
		expect(one.state.stalls).toEqual([{ member: "host", since: NOW }]);
		expect(commands(one)).toEqual([]);
	});

	it("someone who left can't hold the room", () => {
		const result = reduceSync(stalled().state, {
			type: "presence",
			members: [member("host", 1), member("me", 2)],
			now: NOW + 5000,
		});
		expect(result.state.stalls).toEqual([]);
		// It froze at Sam's position, 10 s behind this player.
		expect(commands(result)).toEqual([{ action: "seek", position: 90 }, { action: "play" }]);
	});

	it("a stall doesn't wait in a paused room", () => {
		const paused = room({ shared: { playing: false, position: 100, at: NOW } });
		expect(published(reduceSync(paused, { type: "stalled", position: 100, now: NOW }))).toEqual([]);
	});
});

describe("Continue without", () => {
	const asHost = () =>
		reduceSync(room({ me: "host", host: "host" }), remote("sam", { type: "stall", position: 90, at: NOW }));

	it("is offered to the host after 30 s, and to nobody else", () => {
		const { state } = asHost();
		expect(continueCandidate(state, NOW + CONTINUE_AFTER_MS - 1)).toBeNull();
		expect(continueCandidate(state, NOW + CONTINUE_AFTER_MS)).toBe("sam");
		const asMember = reduceSync(room(), remote("sam", { type: "stall", position: 90, at: NOW })).state;
		expect(continueCandidate(asMember, NOW + CONTINUE_AFTER_MS)).toBeNull();
	});

	it("the room goes on from where it froze, and that viewer holds nobody again", () => {
		const later = NOW + CONTINUE_AFTER_MS;
		const result = reduceSync(asHost().state, { type: "continue-without", member: "sam", now: later });
		expect(published(result)).toEqual([{ type: "waive", member: "sam" }]);
		expect(commands(result)).toEqual([{ action: "seek", position: 90 }, { action: "play" }]);
		expect(result.state.shared).toEqual({ playing: true, position: 90, at: later });
		const again = reduceSync(result.state, remote("sam", { type: "stall", position: 100, at: later }, later));
		expect(again.state.stalls).toEqual([]);
	});

	it("a viewer the host went on without stops telling the room", () => {
		const own = reduceSync(room(), { type: "stalled", position: 100, now: NOW });
		const waived = reduceSync(own.state, remote("host", { type: "waive", member: "me" }));
		expect(waived.state.waived).toEqual(["me"]);
		expect(waived.state.stalledAt).toBeNull();
		expect(published(reduceSync(waived.state, { type: "stalled", position: 110, now: NOW + 9000 }))).toEqual([]);
	});

	it("only the host can do it", () => {
		const held = reduceSync(room(), remote("sam", { type: "stall", position: 90, at: NOW })).state;
		expect(reduceSync(held, remote("mina", { type: "waive", member: "sam" })).state.stalls).toHaveLength(1);
		expect(reduceSync(held, { type: "continue-without", member: "sam", now: NOW }).effects).toEqual([]);
	});
});

describe("the lobby", () => {
	const lobby = (overrides: Partial<SyncState> = {}) =>
		room({
			...initialSync({
				me: "host",
				host: "host",
				sourceId: "full",
				modes: MODES,
				snapshot: { state: "lobby", position: 0, at: NOW },
			}),
			...overrides,
		});
	const presence = (members: PartyMember[], now = NOW): SyncEvent => ({ type: "presence", members, now });

	it("starts once all are ready", () => {
		const waiting = reduceSync(lobby(), presence([member("host", 1), member("sam", 2, false)]));
		expect(waiting.state.phase).toBe("lobby");
		const all = reduceSync(waiting.state, presence([member("host", 1), member("sam", 2)]));
		expect(all.state.phase).toBe("countdown");
		expect(published(all)).toEqual([{ type: "start", position: 0, at: NOW + COUNTDOWN_MS }]);
	});

	it("waits for the host's word when the host is alone", () => {
		expect(reduceSync(lobby(), presence([member("host", 1)])).state.phase).toBe("lobby");
		expect(reduceSync(lobby(), { type: "start", now: NOW }).state.phase).toBe("countdown");
	});

	it("only the host starts it", () => {
		const member2 = lobby({ me: "sam" });
		expect(reduceSync(member2, { type: "start", now: NOW }).state.phase).toBe("lobby");
		const message: PartyMessage = { type: "start", position: 0, at: NOW + 3000 };
		expect(reduceSync(member2, remote("mina", message)).state.phase).toBe("lobby");
		expect(reduceSync(member2, remote("host", message)).state.phase).toBe("countdown");
	});

	it("holds a player that starts by itself, and plays it when the countdown ends", () => {
		const loaded = reduceSync(lobby({ playerReady: false, playerPlaying: false, playerPosition: null }), {
			type: "player",
			event: { kind: "ready", duration: 7200 },
			now: NOW,
		});
		const started = reduceSync(loaded.state, { type: "player", event: { kind: "play" }, now: NOW });
		expect(commands(started)).toEqual([{ action: "pause" }]);
		const counting = reduceSync(started.state, { type: "start", now: NOW });
		const live = reduceSync(counting.state, { type: "tick", now: NOW + COUNTDOWN_MS });
		expect(live.state.phase).toBe("live");
		expect(commands(live)).toEqual([{ action: "play" }]);
		expect(hasEffect(live, "save")).toBe(true);
	});

	it("tells a late joiner the live state, from the longest-present of the others", () => {
		const started = room({ me: "host", members: [member("host", 1), member("me", 2)] });
		const joined = reduceSync(started, presence([member("host", 1), member("me", 2), member("new", 3)], NOW + 2000));
		expect(published(joined)).toEqual([{ type: "state", playing: true, position: 102, at: NOW + 2000 }]);
		const second = room({ me: "me", members: [member("host", 1), member("me", 2)] });
		expect(published(reduceSync(second, presence([member("host", 1), member("me", 2), member("new", 3)])))).toEqual([]);
	});

	it("a reload lands on the group's position, from the saved state", () => {
		const state = initialSync({
			me: "me",
			host: "host",
			sourceId: "full",
			modes: MODES,
			snapshot: { state: "playing", position: 300, at: NOW },
		});
		expect(state.phase).toBe("live");
		expect(groupPosition(state, NOW + 15_000)).toBe(315);
	});
});

describe("the host", () => {
	it("a host who's gone 15 s hands over to the longest-present member", () => {
		const start = room({ members: [member("me", 2), member("sam", 3)], hostMissingSince: NOW });
		expect(hasEffect(reduceSync(start, { type: "tick", now: NOW + TAKE_OVER_AFTER_MS - 1 }), "take-over")).toBe(false);
		const asked = reduceSync(start, { type: "tick", now: NOW + TAKE_OVER_AFTER_MS });
		expect(hasEffect(asked, "take-over")).toBe(true);
		// It asks the server once, and again only after a while.
		expect(hasEffect(reduceSync(asked.state, { type: "tick", now: NOW + TAKE_OVER_AFTER_MS + 100 }), "take-over")).toBe(
			false,
		);
		const other = room({ me: "sam", members: [member("me", 2), member("sam", 3)], hostMissingSince: NOW });
		expect(hasEffect(reduceSync(other, { type: "tick", now: NOW + TAKE_OVER_AFTER_MS }), "take-over")).toBe(false);
	});

	it("notices the host leaving and coming back", () => {
		const gone = reduceSync(room(), { type: "presence", members: [member("me", 2)], now: NOW });
		expect(gone.state.hostMissingSince).toBe(NOW);
		const back = reduceSync(gone.state, {
			type: "presence",
			members: [member("host", 1), member("me", 2)],
			now: NOW + 5000,
		});
		expect(back.state.hostMissingSince).toBeNull();
	});

	it("a claim counts only from the member making it, once the host is away", () => {
		const here = room();
		expect(reduceSync(here, remote("sam", { type: "host", member: "sam" })).state.host).toBe("host");
		const away = room({ members: [member("me", 2), member("sam", 3)] });
		expect(reduceSync(away, remote("mina", { type: "host", member: "sam" })).state.host).toBe("host");
		expect(reduceSync(away, remote("sam", { type: "host", member: "sam" })).state.host).toBe("sam");
	});

	it("takes the server's word on who's host", () => {
		const result = reduceSync(room({ hostMissingSince: NOW }), { type: "host", member: "sam", now: NOW });
		expect(result.state.host).toBe("sam");
		expect(result.state.hostMissingSince).toBeNull();
	});

	it("only the host changes the source, and only to one everyone can play", () => {
		const message: PartyMessage = { type: "source", sourceId: "none", position: 70, at: NOW };
		expect(reduceSync(room(), remote("sam", message)).effects).toEqual([]);
		const unknown: PartyMessage = { ...message, sourceId: "elsewhere" };
		expect(reduceSync(room(), remote("host", unknown)).effects).toEqual([]);
		const changed = reduceSync(room(), remote("host", message));
		expect(changed.effects).toEqual([{ kind: "load", position: 70 }]);
		expect(changed.state).toMatchObject({ mode: "together", sourceId: "none", playerReady: false, stalls: [] });
	});

	it("only the host's message ends the party", () => {
		expect(reduceSync(room(), remote("sam", { type: "ended" })).state.phase).toBe("live");
		expect(reduceSync(room(), remote("host", { type: "ended" })).state.phase).toBe("ended");
	});
});

describe("start together", () => {
	const together = () => room({ mode: "together", sourceId: "none", playerPosition: 50 });

	it("has no shared pause", () => {
		const result = reduceSync(together(), { type: "local", action: "pause", now: NOW });
		expect(result.effects).toEqual([]);
		const told = reduceSync(together(), remote("sam", { type: "state", playing: false, position: 10, at: NOW + 1 }));
		expect(told.state.shared.playing).toBe(true);
		expect(commands(told)).toEqual([]);
	});

	it("*Resync* reloads at the group's position", () => {
		const result = reduceSync(together(), { type: "resync", now: NOW + 5000 });
		expect(result.effects).toEqual([{ kind: "load", position: 105 }]);
	});

	it("ignores another viewer's stall", () => {
		expect(reduceSync(together(), remote("sam", { type: "stall", position: 1, at: NOW })).state.stalls).toEqual([]);
	});
});

describe("clicks inside the player", () => {
	it("a pause the viewer pressed in the player's own menu reaches the room", () => {
		const result = reduceSync(room(), { type: "player", event: { kind: "pause" }, now: NOW + 9000 });
		expect(published(result)[0]).toMatchObject({ type: "state", playing: false });
	});

	it("a command's own echo doesn't", () => {
		const told = reduceSync(room(), remote("sam", { type: "state", playing: false, position: 100, at: NOW + 1 }));
		const echo = reduceSync(told.state, { type: "player", event: { kind: "pause" }, now: NOW + 100 });
		expect(published(echo)).toEqual([]);
	});
});

describe("messages", () => {
	it("parses what the channel carries and nothing else", () => {
		expect(parsePartyMessage({ type: "ended" })).toEqual({ type: "ended" });
		expect(parsePartyMessage({ type: "state", playing: true, position: 1, at: 2 })).toMatchObject({ type: "state" });
		expect(parsePartyMessage({ type: "state", playing: "yes", position: 1, at: 2 })).toBeNull();
		expect(parsePartyMessage({ type: "ended", extra: 1 })).toBeNull();
		expect(parsePartyMessage({ type: "source", sourceId: "x", position: -1, at: 2 })).toBeNull();
		expect(parsePartyMessage("__yminfo")).toBeNull();
	});
});

describe("the clock offset", () => {
	it("is 0 without samples", () => {
		expect(clockOffset([])).toBe(0);
	});

	it("takes the server's reading from the middle of the trip", () => {
		expect(clockOffset([{ sentAt: 1000, receivedAt: 1100, serverNow: 5050 }])).toBe(4000);
	});

	it("trusts the quickest trip", () => {
		const samples = [
			{ sentAt: 1000, receivedAt: 2000, serverNow: 9000 },
			{ sentAt: 3000, receivedAt: 3020, serverNow: 7010 },
		];
		expect(clockOffset(samples)).toBe(4000);
	});

	it("keeps only the recent samples", () => {
		let samples: ReturnType<typeof addSample> = [];
		for (let index = 0; index < 8; index += 1) {
			samples = addSample(samples, { sentAt: index, receivedAt: index + 1, serverNow: index });
		}
		expect(samples).toHaveLength(5);
		expect(samples[0]?.sentAt).toBe(3);
	});
});

describe("a party's source", () => {
	const sources = [
		{ id: "a", adapter: "none" as const, url: "/a" },
		{ id: "b", adapter: "parda" as const, url: "/b?start={start}" },
		{ id: "c", adapter: "none" as const, url: "/c?start={start}" },
	];

	it("takes the highest-ranked with commands, otherwise the top", () => {
		expect(partySource(sources, ["a", "b", "c"])?.id).toBe("b");
		expect(partySource(sources, ["c", "a"])?.id).toBe("c");
		expect(partySource(sources, [])).toBeNull();
	});

	it("knows each source's mode, and whether it can land on a position", () => {
		expect(partyMode(sources[1] ?? null)).toBe("full");
		expect(partyMode(sources[0] ?? null)).toBe("together");
		expect(partyMode(null)).toBe("together");
		expect(sources.map(takesStart)).toEqual([false, true, true]);
	});
});
