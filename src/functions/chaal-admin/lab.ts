import { createServerFn } from "@tanstack/react-start";
import type { ChaalLabState, ChaalLaneCheck } from "@/features/chaal/schema";
import { requirePermission } from "@/middleware/auth";
import * as lab from "@/server/chaal/admin/lab";

/** /admin/chaal/lab (Task 71, `chaal:configure`): the setup and this server's Lichess calls, and a check of the public lane. */

export const getChaalLab = createServerFn({ method: "GET" })
	.middleware([requirePermission("chaal:configure")])
	.handler((): Promise<ChaalLabState> => lab.labState());

export const checkChaalPublicLane = createServerFn({ method: "POST" })
	.middleware([requirePermission("chaal:configure")])
	.handler((): Promise<ChaalLaneCheck> => lab.checkPublicLane());
