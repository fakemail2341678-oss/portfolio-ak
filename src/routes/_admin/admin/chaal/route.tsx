import { createFileRoute } from "@tanstack/react-router";
import { CHAAL_NAME } from "@/features/chaal/brand";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { staticCrumb } from "@/lib/breadcrumbs";

/** /admin/chaal/*: Chaal, run from the admin (PLAN 13.5). Every page needs chaal:read; each may ask for more. */
export const Route = createFileRoute("/_admin/admin/chaal")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "chaal:read"),
	staticData: { breadcrumb: staticCrumb(() => CHAAL_NAME) },
});
