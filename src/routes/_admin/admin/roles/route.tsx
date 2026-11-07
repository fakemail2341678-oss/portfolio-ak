import { createFileRoute } from "@tanstack/react-router";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { staticCrumb } from "@/lib/breadcrumbs";
import { m } from "@/paraglide/messages";

// Section layout for /admin/roles/*: needs roles:read; names its breadcrumb.
export const Route = createFileRoute("/_admin/admin/roles")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "roles:read"),
	staticData: { breadcrumb: staticCrumb(m.admin_nav_roles) },
});
