import { createServerFn } from "@tanstack/react-start";
import { requirePermission } from "@/middleware/auth";
import { ping } from "@/server/examples/demos";

/**
 * The permissions example (/dev/examples/permissions): two guarded functions.
 * requirePermission runs first, as in every protected function (the guarded
 * functions test checks this file too), then the dev-only check (in `ping`).
 */

export const pingExampleReadItems = createServerFn({ method: "POST" })
	.middleware([requirePermission("test-crud:read")])
	.handler(() => ping());

export const pingExampleManageRoles = createServerFn({ method: "POST" })
	.middleware([requirePermission("roles:manage")])
	.handler(() => ping());
