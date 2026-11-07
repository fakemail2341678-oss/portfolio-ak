import { createFileRoute } from "@tanstack/react-router";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { staticCrumb } from "@/lib/breadcrumbs";
import { m } from "@/paraglide/messages";

// Section layout for /admin/test-crud/*: needs test-crud:read; names its breadcrumb. Renders its child route.
export const Route = createFileRoute("/_admin/admin/test-crud")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "test-crud:read"),
	staticData: { breadcrumb: staticCrumb(m.test_crud_title) },
});
