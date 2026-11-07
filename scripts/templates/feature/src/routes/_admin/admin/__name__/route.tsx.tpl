import { createFileRoute } from "@tanstack/react-router";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { staticCrumb } from "@/lib/breadcrumbs";
import { m } from "@/paraglide/messages";

// Section layout for /admin/__name__/*: needs __name__:read; names its breadcrumb. Renders its child route.
export const Route = createFileRoute("/_admin/admin/__name__")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "__name__:read"),
	staticData: { breadcrumb: staticCrumb(m.__snake___title) },
});
