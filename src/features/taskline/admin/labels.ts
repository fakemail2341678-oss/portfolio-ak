import { defineStatuses } from "@/components/data-display/status-badge";
import { m } from "@/paraglide/messages";
import type { ActivityKind, ProjectStatus, ProjectVisibility, TeamRole } from "../types";

/** /admin/taskline's enum labels and badges (the app's own are in ../labels.ts). */

export const PROJECT_STATUS = defineStatuses<ProjectStatus>({
	active: { tone: "success", label: m.taskline_project_status_active },
	paused: { tone: "warning", label: m.taskline_project_status_paused },
	completed: { tone: "info", label: m.taskline_project_status_completed },
	archived: { tone: "neutral", label: m.taskline_admin_status_archived },
});

export { PROJECT_HEALTH } from "../labels";

export const VISIBILITY_LABELS: Record<ProjectVisibility, () => string> = {
	team: m.taskline_visibility_team,
	private: m.taskline_visibility_private,
};

export const TEAM_ROLE_LABELS: Record<TeamRole, () => string> = {
	member: m.taskline_role_member,
	viewer: m.taskline_role_viewer,
};

export const MEMBER_STATE = defineStatuses<"active" | "deactivated">({
	active: { tone: "success", label: m.taskline_admin_member_active },
	deactivated: { tone: "neutral", label: m.taskline_admin_member_deactivated },
});

export const ACTIVITY_KIND_LABELS: Record<ActivityKind, () => string> = {
	"project.created": m.taskline_admin_kind_project_created,
	"project.updated": m.taskline_admin_kind_project_updated,
	"project.state": m.taskline_admin_kind_project_state,
	"project.archived": m.taskline_admin_kind_project_archived,
	"project.restored": m.taskline_admin_kind_project_restored,
	"project.member_added": m.taskline_admin_kind_member_added,
	"project.member_removed": m.taskline_admin_kind_member_removed,
	"project.update_posted": m.taskline_admin_kind_update_posted,
	"project.update_deleted": m.taskline_admin_kind_update_deleted,
	"status.created": m.taskline_admin_kind_status_created,
	"status.updated": m.taskline_admin_kind_status_updated,
	"status.deleted": m.taskline_admin_kind_status_deleted,
	"label.created": m.taskline_admin_kind_label_created,
	"label.updated": m.taskline_admin_kind_label_updated,
	"label.deleted": m.taskline_admin_kind_label_deleted,
	"task.created": m.taskline_admin_kind_task_created,
	"task.updated": m.taskline_admin_kind_task_updated,
	"task.moved": m.taskline_admin_kind_task_moved,
	"task.trashed": m.taskline_admin_kind_task_trashed,
	"task.restored": m.taskline_admin_kind_task_restored,
	"task.checklist": m.taskline_admin_kind_task_checklist,
	"task.deleted": m.taskline_admin_kind_task_deleted,
	"comment.added": m.taskline_admin_kind_comment_added,
	"comment.deleted": m.taskline_admin_kind_comment_deleted,
	"attachment.added": m.taskline_admin_kind_file_added,
	"attachment.removed": m.taskline_admin_kind_file_removed,
	"sprint.created": m.taskline_admin_kind_sprint_created,
	"sprint.updated": m.taskline_admin_kind_sprint_updated,
	"sprint.deleted": m.taskline_admin_kind_sprint_deleted,
	"sprint.started": m.taskline_admin_kind_sprint_started,
	"sprint.completed": m.taskline_admin_kind_sprint_completed,
	"time.logged": m.taskline_admin_kind_time_logged,
	"milestone.created": m.taskline_admin_kind_milestone_created,
	"milestone.updated": m.taskline_admin_kind_milestone_updated,
	"milestone.deleted": m.taskline_admin_kind_milestone_deleted,
	"milestone.completed": m.taskline_admin_kind_milestone_completed,
	"milestone.reopened": m.taskline_admin_kind_milestone_reopened,
	"dependency.added": m.taskline_admin_kind_dependency_added,
	"dependency.removed": m.taskline_admin_kind_dependency_removed,
	"automation.created": m.taskline_admin_kind_automation_created,
	"automation.updated": m.taskline_admin_kind_automation_updated,
	"automation.deleted": m.taskline_admin_kind_automation_deleted,
	"task.recurred": m.taskline_admin_kind_task_recurred,
	"field.created": m.taskline_admin_kind_field_created,
	"field.updated": m.taskline_admin_kind_field_updated,
	"field.deleted": m.taskline_admin_kind_field_deleted,
};

/** A week's capacity in hours, from the stored minutes. */
export const capacityHours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;
