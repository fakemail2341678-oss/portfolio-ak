import "@tanstack/react-start/server-only";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { PARTY_MAX_MEMBERS, partySource } from "@/features/parda/party/source";
import type { PartyJoin, PartyPageData, PartyPulse, PartySnapshot, PartyState } from "@/features/parda/party/types";
import { AppError } from "@/lib/errors";
import type { PardaMedia } from "@/server/db/schema";
import { pdParty, pdPartyMember } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { catalogScope, type PardaCatalog } from "../catalog/context";
import { titleDetails } from "../catalog/service";
import { titleKey } from "../controls";
import type { PardaServices } from "../library/service";
import { watchPage } from "../player/watch";
import * as repo from "./repository";
import { type PartyRealtime, partyConnection } from "./token";

/**
 * Watch parties (PLAN 12.5, "Watch party"; decision 0243). What only the server can keep: who
 * can make one, who's in (at most 10), who's host, and when a party ends: 12 h idle, the
 * host ending it, the kill switch or a takedown. Members find out on their next pulse
 * (every 30 s at most), which also tells them who's host and the server's clock.
 */

export const PARTY_IDLE_MS = 12 * 3_600_000;
/** A member who hasn't pulsed for this long has lost their seat, and can't hold the host's. */
export const PARTY_STALE_MS = 90_000;
/** A party's row stays this long after it ends, so a late visitor gets the same 404 the row can explain. */
const ENDED_KEEP_MS = 7 * 86_400_000;
const CREATE_LIMIT = { max: 10, windowSeconds: 3_600 };
/** The state is saved at most about this often while it plays, and whenever it changes. */
const SAVE_EVERY_MS = 10_000;

type Locale = "en" | "ne";

const gone = () => new AppError("NOT_FOUND", "Party not found");

const stateOf = (row: repo.PartyRow): PartySnapshot => ({
	state: row.state,
	position: row.position,
	at: row.stateAt.getTime(),
});

const expiry = (now: Date) => new Date(now.getTime() + PARTY_IDLE_MS);

async function endParty(db: Db, row: Pick<repo.PartyRow, "id">, now = new Date()) {
	await db.update(pdParty).set({ state: "ended", expiresAt: now }).where(eq(pdParty.id, row.id));
}

/** The party behind a code: gone when it's unknown, ended or expired, or ended here by the kill switch or a takedown. */
async function liveParty(db: Db, catalog: PardaCatalog, code: string, now = new Date()): Promise<repo.PartyRow> {
	const row = await repo.partyByCode(db, code);
	if (!row || row.state === "ended" || row.expiresAt <= now) throw gone();
	const { controls } = catalog.services;
	const [settings, blocked] = await Promise.all([controls.settings(), controls.blocked()]);
	if (!settings.playbackEnabled || blocked.has(titleKey(row.media, row.tmdbId))) {
		await endParty(db, row, now);
		throw gone();
	}
	return row;
}

const contextOf = (ctx: PardaServices) => {
	if (!ctx.catalog) throw gone();
	return ctx.catalog;
};

export type PartyTarget = {
	media: PardaMedia;
	id: number;
	season?: number | undefined;
	episode?: number | undefined;
	/** Where the host is on the watch page: the party starts there. */
	position?: number | undefined;
};

/** A new party on this title's best source for sync, with the caller as host. Rate limited; refused with playback off. */
export async function createParty(
	ctx: PardaServices,
	realtime: PartyRealtime | null,
	target: PartyTarget,
	locale: Locale,
): Promise<{ code: string }> {
	if (!realtime) throw gone();
	const catalog = contextOf(ctx);
	if (!(await catalog.services.controls.settings()).playbackEnabled) {
		throw new AppError("FORBIDDEN", "Playback is off");
	}
	await enforceRateLimit(ctx.db, `parda-party:${ctx.viewer.userId}`, CREATE_LIMIT);
	const { profile } = ctx.viewer;
	const watch = await watchPage(
		catalog,
		ctx.db,
		{ media: target.media, id: target.id, season: target.season, episode: target.episode },
		{ profileId: profile.id, autoplay: profile.autoplay, audioLanguage: profile.audioLanguage },
		locale,
	);
	const source = partySource(watch.sources, watch.order.ok);
	if (!source) throw new AppError("CONFLICT", "No source can play this title");
	const now = new Date();
	const code = randomBytes(12).toString("base64url");
	await ctx.db.transaction(async (tx) => {
		const [row] = await tx
			.insert(pdParty)
			.values({
				code,
				hostId: ctx.viewer.userId,
				media: watch.title.media,
				tmdbId: watch.title.id,
				season: watch.episode?.season ?? null,
				episode: watch.episode?.episode ?? null,
				sourceId: source.id,
				position: Math.max(0, target.position ?? 0),
				stateAt: now,
				expiresAt: expiry(now),
			})
			.returning({ id: pdParty.id });
		if (!row) throw new AppError("INTERNAL", "Party not saved");
		await tx.insert(pdPartyMember).values({ partyId: row.id, userId: ctx.viewer.userId, name: profile.name });
	});
	return { code };
}

/**
 * The party's page, for anyone holding the link: a session isn't needed to see what it is.
 * A source that's gone hands the party to the best one left.
 */
export async function partyPage(
	catalog: PardaCatalog,
	db: Db,
	realtime: PartyRealtime | null,
	code: string,
	viewer: { profileId: string | null; autoplay: boolean; audioLanguage?: string | null },
	locale: Locale,
): Promise<Extract<PartyPageData, { configured: true }>> {
	if (!realtime) throw gone();
	const row = await liveParty(db, catalog, code);
	const watch = await watchPage(
		catalog,
		db,
		{ media: row.media, id: row.tmdbId, season: row.season ?? undefined, episode: row.episode ?? undefined },
		viewer,
		locale,
	);
	let sourceId = row.sourceId;
	if (!watch.sources.some((source) => source.id === sourceId)) {
		sourceId = partySource(watch.sources, watch.order.ok)?.id ?? null;
		await db.update(pdParty).set({ sourceId }).where(eq(pdParty.id, row.id));
	}
	const host = await repo.memberOf(db, row.id, row.hostId);
	return {
		configured: true,
		code: row.code,
		hostName: host?.name ?? "",
		sourceId,
		snapshot: stateOf(row),
		watch,
	};
}

/** Two guests are both "Guest": a name taken in this party gets a number, so "Waiting for …" says who. */
export function seatName(name: string, taken: ReadonlyArray<string>): string {
	const wanted = name.trim() || "?";
	if (!taken.includes(wanted)) return wanted;
	for (let number = 2; ; number += 1) {
		const candidate = `${wanted} ${number}`;
		if (!taken.includes(candidate)) return candidate;
	}
}

/**
 * Takes a seat (a member's own seat is always free, so a reload rejoins) and hands back the
 * channel's token. A kids' cap applies through the catalogue; a party over it is a 404.
 */
export async function joinParty(
	ctx: PardaServices,
	realtime: PartyRealtime | null,
	code: string,
	locale: Locale,
): Promise<PartyJoin> {
	if (!realtime) throw gone();
	const catalog = contextOf(ctx);
	const live = await liveParty(ctx.db, catalog, code);
	await titleDetails(catalog.services, catalogScope(catalog, locale), live.media, live.tmdbId);
	const now = new Date();
	const seated = await ctx.db.transaction(async (tx) => {
		const row = await repo.lockParty(tx, code);
		if (!row || row.state === "ended") throw gone();
		const members = await repo.membersOf(tx, row.id);
		const own = members.find((member) => member.userId === ctx.viewer.userId);
		if (own) {
			await tx.update(pdPartyMember).set({ seenAt: now, leftAt: null }).where(eq(pdPartyMember.id, own.id));
			return { row, member: own, members };
		}
		const since = now.getTime() - PARTY_STALE_MS;
		const present = members.filter((member) => member.leftAt === null && member.seenAt.getTime() > since);
		if (present.length >= PARTY_MAX_MEMBERS) throw new AppError("CONFLICT", "The party is full");
		const [member] = await tx
			.insert(pdPartyMember)
			.values({
				partyId: row.id,
				userId: ctx.viewer.userId,
				name: seatName(
					ctx.viewer.profile.name,
					members.map((each) => each.name),
				),
				joinedAt: now,
				seenAt: now,
			})
			.returning();
		if (!member) throw new AppError("INTERNAL", "Seat not saved");
		return { row, member, members: [...members, member] };
	});
	const host = seated.members.find((member) => member.userId === seated.row.hostId);
	return {
		memberId: seated.member.id,
		name: seated.member.name,
		joinedAt: seated.member.joinedAt.getTime(),
		hostMemberId: host?.id ?? seated.member.id,
		sourceId: seated.row.sourceId,
		snapshot: stateOf(seated.row),
		connection: partyConnection(realtime, { code, memberId: seated.member.id }),
		now: Date.now(),
	};
}

/** The caller's seat in a live party; 404 for anyone else, so a code alone reaches nothing here. */
async function seat(ctx: PardaServices, code: string) {
	const catalog = contextOf(ctx);
	const row = await liveParty(ctx.db, catalog, code);
	const member = await repo.memberOf(ctx.db, row.id, ctx.viewer.userId);
	if (!member) throw gone();
	return { row, member };
}

async function hostSeat(ctx: PardaServices, code: string) {
	const found = await seat(ctx, code);
	if (found.row.hostId !== ctx.viewer.userId) throw new AppError("FORBIDDEN", "Only the host can do this");
	return found;
}

/** A renewed token for the channel, only for a member of a live party. */
export async function partyToken(ctx: PardaServices, realtime: PartyRealtime | null, code: string) {
	if (!realtime) throw gone();
	const { member } = await seat(ctx, code);
	return partyConnection(realtime, { code, memberId: member.id });
}

export type PartyStateReport = { playing: boolean; started: boolean; position: number; at: number };

/**
 * A member's sign of life. It keeps their seat and the party alive, and says who's host and
 * what time it is; a 404 means the party ended. The host's report also saves the state.
 */
export async function pulseParty(
	ctx: PardaServices,
	code: string,
	report: PartyStateReport | null,
	nowMs = Date.now(),
): Promise<PartyPulse> {
	const { row, member } = await seat(ctx, code);
	const now = new Date(nowMs);
	await repo.touchMember(ctx.db, member.id, now);
	const values: Partial<typeof pdParty.$inferInsert> = { expiresAt: expiry(now) };
	if (report && row.hostId === ctx.viewer.userId) {
		const state: PartyState = report.started ? (report.playing ? "playing" : "paused") : "lobby";
		// A client's clock is only trusted near the server's: the offset is an estimate.
		const at = Math.abs(report.at - nowMs) < 60_000 ? report.at : nowMs;
		if (state !== row.state || nowMs - row.stateAt.getTime() >= SAVE_EVERY_MS) {
			Object.assign(values, { state, position: report.position, stateAt: new Date(at) });
		}
	}
	await ctx.db.update(pdParty).set(values).where(eq(pdParty.id, row.id));
	const host = await repo.memberOf(ctx.db, row.id, row.hostId);
	return { now: nowMs, hostMemberId: host?.id ?? member.id };
}

/** The member leaves: their seat is free, and the host's chair can pass on. Never fails for a party that's gone. */
export async function leaveParty(ctx: PardaServices, code: string): Promise<void> {
	const row = await repo.partyByCode(ctx.db, code);
	if (!row) return;
	const member = await repo.memberOf(ctx.db, row.id, ctx.viewer.userId);
	if (member) {
		const now = new Date();
		await repo.touchMember(ctx.db, member.id, now, now);
	}
}

/** The host changes the source; everyone reloads from the channel's message, 30 s earlier. */
export async function setPartySource(ctx: PardaServices, code: string, sourceId: string): Promise<void> {
	const { row } = await hostSeat(ctx, code);
	const sources = await contextOf(ctx).services.controls.sources();
	if (!sources.some((source) => source.id === sourceId && source.enabled)) {
		throw new AppError("NOT_FOUND", "Source not found");
	}
	await ctx.db.update(pdParty).set({ sourceId }).where(eq(pdParty.id, row.id));
}

export async function endPartyAsHost(ctx: PardaServices, code: string): Promise<void> {
	const { row } = await hostSeat(ctx, code);
	await endParty(ctx.db, row);
}

/**
 * A host who left, or stopped pulsing, hands over to the longest-present member. The caller
 * must be that member: a reload keeps the chair, and nobody else can take it early.
 */
export async function takeOverParty(ctx: PardaServices, code: string): Promise<{ hostMemberId: string }> {
	await seat(ctx, code);
	const now = Date.now();
	return ctx.db.transaction(async (tx) => {
		const row = await repo.lockParty(tx, code);
		if (!row) throw gone();
		const members = await repo.membersOf(tx, row.id);
		const present = (member: repo.PartyMemberRow) =>
			member.leftAt === null && now - member.seenAt.getTime() < PARTY_STALE_MS;
		const host = members.find((member) => member.userId === row.hostId);
		const mine = members.find((member) => member.userId === ctx.viewer.userId);
		if (!mine) throw gone();
		if (host?.id === mine.id) return { hostMemberId: mine.id };
		if (host && present(host)) throw new AppError("CONFLICT", "The host is still here");
		const next = members.find(present);
		if (next?.id !== mine.id) throw new AppError("FORBIDDEN", "Another member is next");
		await tx.update(pdParty).set({ hostId: ctx.viewer.userId }).where(eq(pdParty.id, row.id));
		return { hostMemberId: mine.id };
	});
}

/** The daily job's step: parties idle past their time end, and their rows go a week later. */
export function endIdleParties(db: Db, now = new Date()) {
	return repo.endIdle(db, now, new Date(now.getTime() - ENDED_KEEP_MS));
}
