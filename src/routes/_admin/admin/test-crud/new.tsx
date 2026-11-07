import { createFileRoute } from "@tanstack/react-router";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { TestCrudNewPage } from "@/features/test-crud/components/test-crud-detail";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/test-crud/new")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "test-crud:create"),
	staticData: { breadcrumb: staticCrumb(m.test_crud_new_title) },
	head: titleHead(m.test_crud_new_title),
	component: TestCrudNewPage,
});
