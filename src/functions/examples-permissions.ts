import { createServerFn } from "@tanstack/react-start";
import { requirePermission } from "@/middleware/auth";
import { assertDev } from "@/middleware/dev";

/**
 * The permissions example (/dev/examples/permissions): two guarded functions.
 * requirePermission runs first, as in every protected function (the guarded
 * functions test checks this file too), then the dev-only check.
 */

export const exampleReadItems = createServerFn({ method: "POST" })
	.middleware([requirePermission("test-crud:read")])
	.handler(() => {
		assertDev();
		return { ok: true, at: new Date().toISOString() };
	});

export const exampleManageRoles = createServerFn({ method: "POST" })
	.middleware([requirePermission("roles:manage")])
	.handler(() => {
		assertDev();
		return { ok: true, at: new Date().toISOString() };
	});
