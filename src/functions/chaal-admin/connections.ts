import { createServerFn } from "@tanstack/react-start";
import { type ChaalAdminConnectionPage, connectionIdsInput } from "@/features/chaal/admin/schema";
import { chaalConnectionList } from "@/features/chaal/admin/search";
import { zodInput } from "@/functions/_lib/validator";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import * as connections from "@/server/chaal/admin/connections";
import { chaalAdmin } from "@/server/chaal/admin/context";

/** /admin/chaal/connections (Task 79): read with `chaal:read`; revoking needs `chaal:moderate` and is audited. */

export const listChaalConnections = createServerFn({ method: "GET" })
	.middleware([requirePermission("chaal:read"), withServices])
	.validator(zodInput(chaalConnectionList.input))
	.handler(({ data, context }): Promise<ChaalAdminConnectionPage> => connections.listConnections(context, data));

export const revokeChaalConnections = createServerFn({ method: "POST" })
	.middleware([requirePermission("chaal:moderate"), withServices])
	.validator(zodInput(connectionIdsInput))
	.handler(
		({ data, context }): Promise<{ revoked: number }> => connections.revokeConnections(chaalAdmin(context), data.ids),
	);
