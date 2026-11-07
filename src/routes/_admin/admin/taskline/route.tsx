import { createFileRoute } from "@tanstack/react-router";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { TASKLINE_NAME } from "@/features/taskline/brand";
import { staticCrumb } from "@/lib/breadcrumbs";

/** /admin/taskline/*: Taskline's team, run from the admin (PLAN 11.5). Every page needs taskline:read; writes check more. */
export const Route = createFileRoute("/_admin/admin/taskline")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "taskline:read"),
	staticData: { breadcrumb: staticCrumb(() => TASKLINE_NAME) },
});
