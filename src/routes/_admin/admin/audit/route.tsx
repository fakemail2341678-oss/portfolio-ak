import { createFileRoute } from "@tanstack/react-router";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { staticCrumb } from "@/lib/breadcrumbs";
import { m } from "@/paraglide/messages";

// Section layout for /admin/audit: needs audit:read; names its breadcrumb.
export const Route = createFileRoute("/_admin/admin/audit")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "audit:read"),
	staticData: { breadcrumb: staticCrumb(m.admin_nav_audit) },
});
