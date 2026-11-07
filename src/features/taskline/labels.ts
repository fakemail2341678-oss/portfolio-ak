import {
	ArrowDownIcon,
	ArrowUpIcon,
	BookmarkIcon,
	BugIcon,
	ChevronsUpIcon,
	CircleCheckIcon,
	EqualIcon,
	type LucideIcon,
	MinusIcon,
	ZapIcon,
} from "lucide-react";
import { defineStatuses } from "@/components/data-display/status-badge";
import { m } from "@/paraglide/messages";
import type { FieldType, ProjectHealth, ProjectRole, StatusCategory, TaskPriority, TaskType } from "./types";

/** Taskline's names for its enums, and the icons that go with them (read at render time, never at module level). */

export const PRIORITY_LABELS: Record<TaskPriority, () => string> = {
	0: m.taskline_priority_none,
	1: m.taskline_priority_low,
	2: m.taskline_priority_medium,
	3: m.taskline_priority_high,
	4: m.taskline_priority_urgent,
};

export const PRIORITY_ICONS: Record<TaskPriority, LucideIcon> = {
	0: MinusIcon,
	1: ArrowDownIcon,
	2: EqualIcon,
	3: ArrowUpIcon,
	4: ChevronsUpIcon,
};

/** Urgent and high read in the danger and warning colours; the rest stay muted. */
export const PRIORITY_TONES: Record<TaskPriority, string> = {
	0: "text-muted-foreground",
	1: "text-muted-foreground",
	2: "text-muted-foreground",
	3: "text-warning",
	4: "text-danger",
};

export const TYPE_LABELS: Record<TaskType, () => string> = {
	task: m.taskline_type_task,
	bug: m.taskline_type_bug,
	story: m.taskline_type_story,
	epic: m.taskline_type_epic,
};

export const TYPE_ICONS: Record<TaskType, LucideIcon> = {
	task: CircleCheckIcon,
	bug: BugIcon,
	story: BookmarkIcon,
	epic: ZapIcon,
};

export const CATEGORY_LABELS: Record<StatusCategory, () => string> = {
	backlog: m.taskline_category_backlog,
	unstarted: m.taskline_category_unstarted,
	started: m.taskline_category_started,
	completed: m.taskline_category_completed,
	canceled: m.taskline_category_canceled,
};

export const PROJECT_ROLE_LABELS: Record<ProjectRole, () => string> = {
	lead: m.taskline_role_lead,
	member: m.taskline_role_member,
	viewer: m.taskline_role_viewer,
};

/** Task 55: a custom field's kinds. */
export const FIELD_TYPE_LABELS: Record<FieldType, () => string> = {
	text: m.taskline_field_type_text,
	number: m.taskline_field_type_number,
	select: m.taskline_field_type_select,
	multi_select: m.taskline_field_type_multi_select,
	date: m.taskline_field_type_date,
	member: m.taskline_field_type_member,
	checkbox: m.taskline_field_type_checkbox,
	url: m.taskline_field_type_url,
};

/** A project's health as a badge (Task 57: its updates; the admin's tables use the same). */
export const PROJECT_HEALTH = defineStatuses<ProjectHealth>({
	on_track: { tone: "success", label: m.taskline_health_on_track },
	at_risk: { tone: "warning", label: m.taskline_health_at_risk },
	off_track: { tone: "danger", label: m.taskline_health_off_track },
});
