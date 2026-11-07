import "@tanstack/react-start/server-only";
import { asc, eq } from "drizzle-orm";
import type { LabPlayer, LabPlayerInput, LabSource } from "@/features/parda/admin/schema";
import { AppError } from "@/lib/errors";
import { originOf } from "@/lib/http/csp";
import { getLocale } from "@/paraglide/runtime";
import { pdSource } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { serverEnv } from "@/server/env";
import { playerUrl } from "../player/sources";

type LabContext = { db: Db };

/** Read fresh, not from the 30 s cache: the lab shows a row as it is now. */
export async function listLabSources({ db }: LabContext): Promise<LabSource[]> {
	const rows = await db.select().from(pdSource).orderBy(asc(pdSource.position));
	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		adapter: row.adapter,
		enabled: row.enabled,
		sandbox: row.sandbox,
	}));
}

export async function openLabPlayer({ db }: LabContext, input: LabPlayerInput): Promise<LabPlayer> {
	const [source] = await db.select().from(pdSource).where(eq(pdSource.id, input.sourceId)).limit(1);
	if (!source) throw new AppError("NOT_FOUND", `No source ${input.sourceId}`);
	const base = serverEnv.PARDA_PLAYER_BASE;
	const target = {
		media: input.media,
		id: input.id,
		...(input.media === "tv" ? { season: input.season, episode: input.episode } : {}),
	};
	const filled = playerUrl(source, target, { lang: getLocale(), start: input.start, base });
	if (filled === null) throw new AppError("BAD_REQUEST", `Source ${source.id} needs a value the lab has no input for`);
	// Only the placeholder knows cues (it speaks `parda` and `viduki`); a real player ignores the parameter.
	const url =
		input.cue && source.adapter !== "none" ? `${filled}${filled.includes("?") ? "&" : "?"}cue=${input.cue}` : filled;
	const baseOrigin = originOf(base);
	return {
		url,
		target,
		origins: [...source.origins, ...(baseOrigin && url.startsWith(baseOrigin) ? [baseOrigin] : [])],
		adapter: source.adapter,
		sandbox: source.sandbox,
		name: source.name,
	};
}
