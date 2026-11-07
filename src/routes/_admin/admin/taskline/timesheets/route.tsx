import { createFileRoute } from "@tanstack/react-router";
import { assertRoutePermission } from "@/features/rbac/route-guard";
import { staticCrumb } from "@/lib/breadcrumbs";
import { m } from "@/paraglide/messages";

/** /admin/taskline/timesheets/* (Task 53): the team's time needs `taskline:time` (the parent checks taskline:read). */
export const Route = createFileRoute("/_admin/admin/taskline/timesheets")({
	beforeLoad: ({ context }) => assertRoutePermission(context.session, "taskline:time"),
	staticData: { breadcrumb: staticCrumb(m.taskline_admin_timesheets_title) },
});
