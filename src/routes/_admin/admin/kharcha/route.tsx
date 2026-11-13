import { createFileRoute } from "@tanstack/react-router";
import { KHARCHA_NAME } from "@/features/kharcha/brand";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { staticCrumb } from "@/lib/breadcrumbs";

/** /admin/kharcha/*: Kharcha, run from the admin (PLAN Task 96). Every page needs kharcha:read; saving needs kharcha:configure. */
export const Route = createFileRoute("/_admin/admin/kharcha")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "kharcha:read"),
	staticData: { breadcrumb: staticCrumb(() => KHARCHA_NAME) },
});
