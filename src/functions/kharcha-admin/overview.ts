import { createServerFn } from "@tanstack/react-start";
import type { KharchaOverview } from "@/features/kharcha/admin/schema";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import { getOverview } from "@/server/kharcha/admin/overview";

/** /admin/kharcha (Task 96): the counts, read with `kharcha:read`; never anyone's amounts (0186). */

export const getKharchaOverview = createServerFn({ method: "GET" })
	.middleware([requirePermission("kharcha:read"), withServices])
	.handler(({ context }): Promise<KharchaOverview> => getOverview(context.db));
