import { createFileRoute } from "@tanstack/react-router";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { staticCrumb } from "@/lib/breadcrumbs";
import { m } from "@/paraglide/messages";

// Section layout for /admin/users/*: needs users:read; names its breadcrumb.
export const Route = createFileRoute("/_admin/admin/users")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "users:read"),
	staticData: { breadcrumb: staticCrumb(m.admin_nav_users) },
});
