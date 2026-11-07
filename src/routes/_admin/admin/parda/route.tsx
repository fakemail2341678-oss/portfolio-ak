import { createFileRoute } from "@tanstack/react-router";
import { PARDA_NAME } from "@/features/parda/brand";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { staticCrumb } from "@/lib/breadcrumbs";

/** /admin/parda/*: Parda, run from the admin (PLAN 12.5). Every page needs parda:read; each may ask for more. */
export const Route = createFileRoute("/_admin/admin/parda")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "parda:read"),
	staticData: { breadcrumb: staticCrumb(() => PARDA_NAME) },
});
