import { BanIcon, CalendarIcon } from "lucide-react";
import { UserAvatar } from "@/components/data-display/user-avatar";
import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { tasklineColor } from "../colors";
import { PRIORITY_ICONS, PRIORITY_LABELS, PRIORITY_TONES, TYPE_ICONS, TYPE_LABELS } from "../labels";
import type { TasklineLabel, TasklineMember, TasklineStatus, TaskPriority, TaskType } from "../types";

/** Small pieces of a task the board, the list and the task sheet draw the same way. Colour never says it alone. */

export function TaskTypeIcon({ type, className }: { type: TaskType; className?: string }) {
	const Icon = TYPE_ICONS[type];
	return (
		<span className={cn("inline-flex text-muted-foreground", className)} title={TYPE_LABELS[type]()}>
			<Icon className="size-3.5" aria-hidden />
			<span className="sr-only">{TYPE_LABELS[type]()}</span>
		</span>
	);
}

export function PriorityIcon({ priority, className }: { priority: TaskPriority; className?: string }) {
	const Icon = PRIORITY_ICONS[priority];
	return (
		<span className={cn("inline-flex", PRIORITY_TONES[priority], className)} title={PRIORITY_LABELS[priority]()}>
			<Icon className="size-3.5" aria-hidden />
			<span className="sr-only">{m.taskline_priority_label({ priority: PRIORITY_LABELS[priority]() })}</span>
		</span>
	);
}

/** A label: its colour as a dot, and its name (always written). */
export function LabelChip({ label }: { label: Pick<TasklineLabel, "name" | "color"> }) {
	return (
		<span className="inline-flex max-w-40 items-center gap-1 rounded-full border px-1.5 text-caption text-muted-foreground">
			<span
				className="size-2 shrink-0 rounded-full"
				style={{ backgroundColor: tasklineColor(label.color) }}
				aria-hidden
			/>
			<span className="truncate">{label.name}</span>
		</span>
	);
}

/** A status: its colour as a dot and its name. */
export function StatusName({
	status,
	className,
}: {
	status: Pick<TasklineStatus, "name" | "color">;
	className?: string;
}) {
	return (
		<span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
			<span
				className="size-2.5 shrink-0 rounded-full"
				style={{ backgroundColor: tasklineColor(status.color) }}
				aria-hidden
			/>
			<span className="truncate">{status.name}</span>
		</span>
	);
}

/** A due date; overdue (before today, still open) in the danger colour, and said so. */
export function DueDate({
	dueOn,
	today,
	closed,
	className,
}: {
	dueOn: string;
	today: string;
	closed: boolean;
	className?: string;
}) {
	const overdue = !closed && dueOn < today;
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 whitespace-nowrap text-caption",
				overdue ? "font-medium text-danger" : "text-muted-foreground",
				className,
			)}
		>
			<CalendarIcon className="size-3.5" aria-hidden />
			<span className="sr-only">{overdue ? m.taskline_overdue() : m.taskline_due()} </span>
			{formatDate(isoDateInstant(dueOn), { dateStyle: "medium" })}
		</span>
	);
}

/** Who a task is assigned to, as an avatar with their name for screen readers (and a tooltip). */
export function Assignee({ member, size = "sm" }: { member: TasklineMember | undefined; size?: "sm" | "default" }) {
	if (!member) return null;
	return (
		<span className="inline-flex shrink-0" title={member.name}>
			<UserAvatar name={member.name} size={size} />
			<span className="sr-only">{m.taskline_assigned_to({ name: member.name })}</span>
		</span>
	);
}

/** Task 54: an open task blocks this one (in any project of the workspace). */
export function BlockedBadge({ className }: { className?: string }) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-full bg-warning-subtle px-1.5 text-caption text-warning",
				className,
			)}
			data-testid="taskline-blocked"
		>
			<BanIcon className="size-3" aria-hidden />
			{m.taskline_blocked()}
		</span>
	);
}
