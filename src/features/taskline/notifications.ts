import { m } from "@/paraglide/messages";
import type { Locale } from "@/paraglide/runtime";
import type { NotificationData, NotificationKind, NotifyMode } from "./types";

/**
 * A notification as one sentence, the same in the inbox and in emails (which pass
 * the recipient's language). The data is the snapshot taken when it was made, so
 * the sentence still reads after the task is renamed or deleted.
 */
export function notificationSentence(kind: NotificationKind, data: NotificationData, locale?: Locale): string {
	const t = locale ? { locale } : undefined;
	// Task 56: what an automation did names it, in the recipient's language.
	const actor = data.automation
		? m.taskline_notify_automation_actor({ name: data.automation }, t)
		: (data.actor ?? m.taskline_notify_admin({}, t));
	const ref = data.ref ?? "";
	switch (kind) {
		case "assigned":
			return m.taskline_notify_assigned({ actor, ref }, t);
		case "mentioned":
			return m.taskline_notify_mentioned({ actor, ref }, t);
		case "comment":
			return m.taskline_notify_comment({ actor, ref }, t);
		case "status":
			return m.taskline_notify_status({ actor, ref, status: data.status ?? "" }, t);
		case "due":
			return m.taskline_notify_due({ ref }, t);
		case "overdue":
			return m.taskline_notify_overdue({ ref }, t);
		case "added":
			return m.taskline_notify_added({ actor, project: data.project ?? "" }, t);
		case "sprint":
			return data.sprintEvent === "completed"
				? m.taskline_notify_sprint_completed({ actor, sprint: data.sprint ?? "", project: data.project ?? "" }, t)
				: m.taskline_notify_sprint_started({ actor, sprint: data.sprint ?? "", project: data.project ?? "" }, t);
		case "timer":
			return m.taskline_notify_timer({ ref: data.ref ?? data.title ?? "", project: data.project ?? "" }, t);
		case "automation":
			return data.message
				? m.taskline_notify_automation_message({ actor, ref, message: data.message }, t)
				: m.taskline_notify_automation({ actor, ref }, t);
		default:
			return m.taskline_notify_other({ project: data.project ?? "" }, t);
	}
}

/** The kinds sent (Task 50's, Task 52's sprints, Task 53's timer, Task 56's automations); `invited` is an email of its own. */
export const SENT_KINDS = [
	"assigned",
	"mentioned",
	"comment",
	"status",
	"due",
	"overdue",
	"added",
	"sprint",
	"timer",
	"automation",
] as const;
export type SentKind = (typeof SENT_KINDS)[number];

/** The kinds as their settings' labels (the "My settings" page and the admin's defaults). */
export const NOTIFY_KIND_LABELS: Record<SentKind, () => string> = {
	assigned: () => m.taskline_notify_kind_assigned(),
	mentioned: () => m.taskline_notify_kind_mentioned(),
	comment: () => m.taskline_notify_kind_comment(),
	status: () => m.taskline_notify_kind_status(),
	due: () => m.taskline_notify_kind_due(),
	overdue: () => m.taskline_notify_kind_overdue(),
	added: () => m.taskline_notify_kind_added(),
	sprint: () => m.taskline_notify_kind_sprint(),
	timer: () => m.taskline_notify_kind_timer(),
	automation: () => m.taskline_notify_kind_automation(),
};

export const MODE_LABELS: Record<NotifyMode, () => string> = {
	instant: () => m.taskline_notify_mode_instant(),
	digest: () => m.taskline_notify_mode_digest(),
	off: () => m.taskline_notify_mode_off(),
};
