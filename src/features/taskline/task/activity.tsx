import { HistoryIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { TimelineItem } from "@/components/data-display/activity-feed";
import { UserAvatar } from "@/components/data-display/user-avatar";
import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { TASKLINE_NAME } from "../brand";
import { fieldValueText } from "../fields";
import { PRIORITY_LABELS, TYPE_LABELS } from "../labels";
import { formatDuration } from "../time/duration";
import type {
	ActivityData,
	ActivityValue,
	FieldValue,
	TaskActivity,
	TaskField,
	TasklineMember,
	TasklineStatus,
	TaskPriority,
	TaskType,
} from "../types";

/**
 * Taskline's history as sentences (decision 0205): `tl_activity` rows, with the actor's
 * name from the members (deactivated and placeholder ones too) and the statuses'
 * names; something since deleted reads as such.
 */
export type ActivityContext = {
	members: ReadonlyArray<TasklineMember>;
	statuses: ReadonlyArray<TasklineStatus>;
	/** Task 52: the open sprints, for "planned it in Sprint 2" (a completed one reads as "a sprint"). */
	sprints?: ReadonlyArray<{ id: string; name: string }>;
	/** Task 54: the milestones, for "set its milestone to Launch" (a deleted one reads as "a milestone"). */
	milestones?: ReadonlyArray<{ id: string; name: string }>;
	/** Task 55: the custom fields, for "set Severity to High" (a deleted one keeps the name the entry saved). */
	fields?: ReadonlyArray<TaskField>;
};

const text = (value: ActivityValue | undefined) => (typeof value === "string" ? value : "");

function actorName(entry: Pick<TaskActivity, "actorId" | "data">, members: ActivityContext["members"]) {
	if (entry.actorId)
		return members.find((member) => member.id === entry.actorId)?.name ?? m.taskline_activity_someone();
	if (entry.data.via === "admin") return m.taskline_activity_admin();
	// Task 56: an automation (named), or the daily job making a repeating task's next one.
	if (entry.data.via === "automation") return m.taskline_activity_automation({ name: text(entry.data.automation) });
	if (entry.data.via === "repeat") return TASKLINE_NAME;
	return m.taskline_activity_someone();
}

const memberName = (id: ActivityValue | undefined, members: ActivityContext["members"]) =>
	typeof id === "string" ? (members.find((member) => member.id === id)?.name ?? m.taskline_activity_someone()) : "";

const statusName = (id: ActivityValue | undefined, statuses: ActivityContext["statuses"]) =>
	statuses.find((status) => status.id === id)?.name ?? m.taskline_activity_deleted_status();

const dateText = (value: ActivityValue | undefined) =>
	typeof value === "string" ? formatDate(isoDateInstant(value), { dateStyle: "medium" }) : "";

/** A field change on a task (`task.updated`'s `{ field, from, to }`). */
function fieldPhrase(actor: string, data: ActivityData, context: ActivityContext): string {
	const { field, from, to } = data;
	switch (field) {
		case "title":
			return m.taskline_activity_title({ actor, from: text(from), to: text(to) });
		case "description":
			return m.taskline_activity_description({ actor });
		case "priority":
			return m.taskline_activity_priority({ actor, priority: PRIORITY_LABELS[(Number(to) || 0) as TaskPriority]() });
		case "type":
			return m.taskline_activity_type({ actor, type: (TYPE_LABELS[to as TaskType] ?? TYPE_LABELS.task)() });
		case "assigneeId":
			return to
				? m.taskline_activity_assigned({ actor, name: memberName(to, context.members) })
				: m.taskline_activity_unassigned({ actor });
		case "dueOn":
			return to ? m.taskline_activity_due({ actor, date: dateText(to) }) : m.taskline_activity_due_removed({ actor });
		case "startOn":
			return to
				? m.taskline_activity_start({ actor, date: dateText(to) })
				: m.taskline_activity_start_removed({ actor });
		case "labels":
			return m.taskline_activity_labels({ actor });
		case "parentId":
			return m.taskline_activity_parent({ actor });
		case "sprintId":
			return to
				? m.taskline_activity_sprint({
						actor,
						sprint: context.sprints?.find((sprint) => sprint.id === to)?.name ?? m.taskline_activity_a_sprint(),
					})
				: m.taskline_activity_backlog({ actor });
		case "points":
			return to === null || to === undefined
				? m.taskline_activity_points_removed({ actor })
				: m.taskline_activity_points({ actor, points: formatNumber(Number(to) || 0) });
		case "milestoneId":
			return to
				? m.taskline_activity_milestone({
						actor,
						milestone:
							context.milestones?.find((milestone) => milestone.id === to)?.name ?? m.taskline_activity_a_milestone(),
					})
				: m.taskline_activity_milestone_removed({ actor });
		case "custom": {
			const field = context.fields?.find((each) => each.id === data.fieldId);
			const name = field?.name ?? text(data.name);
			if (to === null || to === undefined) return m.taskline_activity_custom_cleared({ actor, field: name });
			const value = field ? fieldValueText(field, to as FieldValue, context.members) : "";
			return value
				? m.taskline_activity_custom_set({ actor, field: name, value })
				: m.taskline_activity_custom_changed({ actor, field: name });
		}
		case "recurrence":
			return to ? m.taskline_activity_recurrence({ actor }) : m.taskline_activity_recurrence_stopped({ actor });
		case "estimateMinutes":
			return to === null || to === undefined
				? m.taskline_activity_estimate_removed({ actor })
				: m.taskline_activity_estimate({ actor, estimate: formatDuration(Number(to) || 0) });
		default:
			return m.taskline_activity_changed({ actor });
	}
}

/** One entry as a sentence: who did what. */
export function activitySentence(
	entry: Pick<TaskActivity, "kind" | "actorId" | "data">,
	context: ActivityContext,
): string {
	const actor = actorName(entry, context.members);
	const { data } = entry;
	switch (entry.kind) {
		case "task.created":
			return data.recurredFrom
				? m.taskline_activity_created_repeat({ actor, task: text(data.recurredFrom) })
				: m.taskline_activity_created({ actor });
		case "task.recurred":
			return m.taskline_activity_recurred({ actor, task: text(data.ref) });
		case "task.updated":
			return fieldPhrase(actor, data, context);
		case "task.moved":
			return m.taskline_activity_moved({
				actor,
				from: statusName(data.from, context.statuses),
				to: statusName(data.to, context.statuses),
			});
		case "task.trashed":
			return m.taskline_activity_trashed({ actor });
		case "task.restored":
			return m.taskline_activity_restored({ actor });
		case "task.checklist":
			return m.taskline_activity_checklist({
				actor,
				done: formatNumber(Number(data.done) || 0),
				total: formatNumber(Number(data.total) || 0),
			});
		case "comment.added":
			return m.taskline_activity_commented({ actor });
		case "comment.deleted":
			return m.taskline_activity_comment_deleted({ actor });
		case "attachment.added":
			return m.taskline_activity_file_added({ actor });
		case "attachment.removed":
			return m.taskline_activity_file_removed({ actor });
		case "task.deleted":
			return m.taskline_activity_purged({ actor, task: `${text(data.ref)} ${text(data.title)}`.trim() });
		case "project.created":
			return m.taskline_activity_project_created({ actor });
		case "project.updated":
		case "project.state":
			return m.taskline_activity_project_updated({ actor });
		case "project.update_posted":
			return m.taskline_activity_update_posted({ actor });
		case "project.update_deleted":
			return m.taskline_activity_update_deleted({ actor });
		case "project.archived":
			return m.taskline_activity_project_archived({ actor });
		case "project.restored":
			return m.taskline_activity_project_restored({ actor });
		case "project.member_added":
			return m.taskline_activity_member_added({ actor, name: memberName(data.memberId, context.members) });
		case "project.member_removed":
			return m.taskline_activity_member_removed({ actor, name: memberName(data.memberId, context.members) });
		case "status.created":
		case "status.updated":
		case "status.deleted":
			return m.taskline_activity_workflow({ actor });
		case "label.created":
		case "label.updated":
		case "label.deleted":
			return m.taskline_activity_label_changed({ actor });
		case "field.created":
		case "field.updated":
		case "field.deleted":
			return m.taskline_activity_field_changed({ actor, field: text(data.name) });
		case "automation.created":
		case "automation.updated":
		case "automation.deleted":
			return m.taskline_activity_automation_changed({ actor, automation: text(data.name) });
		case "sprint.created":
			return m.taskline_activity_sprint_created({ actor, sprint: text(data.name) });
		case "sprint.updated":
			return m.taskline_activity_sprint_updated({ actor, sprint: text(data.name) });
		case "sprint.deleted":
			return m.taskline_activity_sprint_deleted({ actor, sprint: text(data.name) });
		case "sprint.started":
			return m.taskline_activity_sprint_started({ actor, sprint: text(data.name) });
		case "sprint.completed":
			return m.taskline_activity_sprint_completed({ actor, sprint: text(data.name) });
		case "time.logged":
			return data.auto === true
				? m.taskline_activity_time_stopped({ duration: formatDuration(Number(data.minutes) || 0) })
				: m.taskline_activity_time({ actor, duration: formatDuration(Number(data.minutes) || 0) });
		case "milestone.created":
			return m.taskline_activity_milestone_created({ actor, milestone: text(data.name) });
		case "milestone.updated":
			return m.taskline_activity_milestone_updated({ actor, milestone: text(data.name) });
		case "milestone.deleted":
			return m.taskline_activity_milestone_deleted({ actor, milestone: text(data.name) });
		case "milestone.completed":
			return m.taskline_activity_milestone_completed({ actor, milestone: text(data.name) });
		case "milestone.reopened":
			return m.taskline_activity_milestone_reopened({ actor, milestone: text(data.name) });
		case "dependency.added":
			return data.relation === "blocks"
				? m.taskline_activity_blocks({ actor, task: text(data.ref) })
				: m.taskline_activity_blocked_by({ actor, task: text(data.ref) });
		case "dependency.removed":
			return data.relation === "blocks"
				? m.taskline_activity_blocks_removed({ actor, task: text(data.ref) })
				: m.taskline_activity_blocked_by_removed({ actor, task: text(data.ref) });
		default:
			return m.taskline_activity_changed({ actor });
	}
}

/** Timeline items for entries, newest first; `detail` adds a line (the project feed's task). */
export function activityItems(
	entries: ReadonlyArray<TaskActivity>,
	context: ActivityContext,
	detail?: (entry: TaskActivity) => ReactNode,
): TimelineItem[] {
	return [...entries]
		.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
		.map((entry) => {
			const actor = entry.actorId ? context.members.find((member) => member.id === entry.actorId) : undefined;
			return {
				id: entry.id,
				at: entry.at,
				marker: actor ? (
					<UserAvatar name={actor.name} size="sm" />
				) : (
					<HistoryIcon className="size-4 text-muted-foreground" aria-hidden />
				),
				title: activitySentence(entry, context),
				detail: detail?.(entry),
			};
		});
}
