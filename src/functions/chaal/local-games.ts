import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { importLocalGamesInput, type LocalGameSummary, saveLocalGameInput } from "@/features/chaal/local/schema";
import type { LocalGameRecord } from "@/features/chaal/local/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireChaalUser, withChaalServices } from "@/middleware/chaal";
import * as local from "@/server/chaal/local/service";

/**
 * Local games (Task 76, decision 0265): the history, one game, saving as it's played,
 * deleting, and importing this browser's games when a session starts. Anyone with a
 * session, guests included; each acts on the caller's own games only
 * (tests/server/chaal-access.test.ts). Without a session the games stay in the browser.
 */

const idInput = z.strictObject({ id: z.uuid() });

export const listChaalLocalGames = createServerFn({ method: "GET" })
	.middleware([requireChaalUser, withChaalServices])
	.handler(({ context }): Promise<LocalGameSummary[]> => local.listLocalGames(context.db, context.user.id));

export const getChaalLocalGame = createServerFn({ method: "GET" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(idInput))
	.handler(({ context, data }): Promise<LocalGameRecord> => local.getLocalGame(context.db, context.user.id, data.id));

export const saveChaalLocalGame = createServerFn({ method: "POST" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(saveLocalGameInput))
	.handler(
		({ context, data }): Promise<LocalGameSummary> =>
			local.saveLocalGame(context, context.user.id, data.game as LocalGameRecord),
	);

export const deleteChaalLocalGame = createServerFn({ method: "POST" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(idInput))
	.handler(({ context, data }): Promise<void> => local.deleteLocalGame(context.db, context.user.id, data.id));

export const importChaalLocalGames = createServerFn({ method: "POST" })
	.middleware([requireChaalUser, withChaalServices])
	.validator(zodInput(importLocalGamesInput))
	.handler(
		({ context, data }): Promise<{ imported: string[] }> =>
			local.importLocalGames(context, context.user.id, data.games as LocalGameRecord[]),
	);
