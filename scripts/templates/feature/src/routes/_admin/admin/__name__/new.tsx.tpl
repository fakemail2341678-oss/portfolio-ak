import { createFileRoute } from "@tanstack/react-router";
import { __Pascal__NewPage } from "@/features/__name__/components/__name__-detail";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { staticCrumb } from "@/lib/breadcrumbs";
import { titleHead } from "@/lib/crud/route";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_admin/admin/__name__/new")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "__name__:create"),
	staticData: { breadcrumb: staticCrumb(m.__snake___new) },
	head: titleHead(m.__snake___new),
	component: __Pascal__NewPage,
});
