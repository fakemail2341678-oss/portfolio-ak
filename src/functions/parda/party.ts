import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { PartyConnection, PartyJoin, PartyPulse } from "@/features/parda/party/types";
import { titleParamsSchema } from "@/features/parda/search";
import { zodInput } from "@/functions/_lib/validator";
import { requirePardaViewer, withPardaServices } from "@/middleware/parda";
import { locales } from "@/paraglide/runtime";
import * as party from "@/server/parda/party/service";
import { partyRealtime } from "@/server/parda/party/token";

/**
 * Watch parties (Task 69a, decision 0243). Each runs `requirePardaViewer` then
 * `withPardaServices`, with a session (guests allowed), and acts only on a party the
 * caller is in, or is joining with its code (tests/server/parda-access.test.ts).
 */

const locale = z.enum(locales);
const code = z.string().regex(/^[\w-]{16}$/);
const episodeNumber = z.number().int().min(0).max(9_999);

const createInput = z.strictObject({
	media: z.enum(["movie", "tv"]),
	id: titleParamsSchema.shape.id,
	season: episodeNumber.optional(),
	episode: episodeNumber.min(1).max(99_999).optional(),
	position: z.number().min(0).max(172_800),
	locale,
});

const pulseInput = z.strictObject({
	code,
	report: z
		.strictObject({
			playing: z.boolean(),
			started: z.boolean(),
			position: z.number().min(0).max(172_800),
			at: z.number().int().positive(),
		})
		.nullable(),
});

export const createPardaParty = createServerFn({ method: "POST" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(createInput))
	.handler(
		({ data, context }): Promise<{ code: string }> => party.createParty(context, partyRealtime(), data, data.locale),
	);

export const joinPardaParty = createServerFn({ method: "POST" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(z.strictObject({ code, locale })))
	.handler(
		({ data, context }): Promise<PartyJoin> => party.joinParty(context, partyRealtime(), data.code, data.locale),
	);

/** A fresh token for the channel: the realtime service asks when the last one runs out. */
export const getPardaPartyToken = createServerFn({ method: "POST" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(z.strictObject({ code })))
	.handler(({ data, context }): Promise<PartyConnection> => party.partyToken(context, partyRealtime(), data.code));

export const pulsePardaParty = createServerFn({ method: "POST" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(pulseInput))
	.handler(({ data, context }): Promise<PartyPulse> => party.pulseParty(context, data.code, data.report));

export const leavePardaParty = createServerFn({ method: "POST" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(z.strictObject({ code })))
	.handler(async ({ data, context }): Promise<{ ok: true }> => {
		await party.leaveParty(context, data.code);
		return { ok: true };
	});

export const setPardaPartySource = createServerFn({ method: "POST" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(z.strictObject({ code, sourceId: z.uuid() })))
	.handler(async ({ data, context }): Promise<{ ok: true }> => {
		await party.setPartySource(context, data.code, data.sourceId);
		return { ok: true };
	});

export const takeOverPardaParty = createServerFn({ method: "POST" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(z.strictObject({ code })))
	.handler(({ data, context }): Promise<{ hostMemberId: string }> => party.takeOverParty(context, data.code));

export const endPardaParty = createServerFn({ method: "POST" })
	.middleware([requirePardaViewer, withPardaServices])
	.validator(zodInput(z.strictObject({ code })))
	.handler(async ({ data, context }): Promise<{ ok: true }> => {
		await party.endPartyAsHost(context, data.code);
		return { ok: true };
	});
