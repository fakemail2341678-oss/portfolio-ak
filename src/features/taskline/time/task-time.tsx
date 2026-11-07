import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/data-display/status-badge";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { tasklineMutations } from "../queries";
import type { TaskDetail, TimeEntry } from "../types";
import { formatDuration } from "./duration";
import { type EntryValues, TimeEntryForm } from "./entry-form";

/**
 * A task's time (Task 53): what was logged against the estimate, logging by hand,
 * and the entries (the caller's own to change; with `taskline:time`, anyone's).
 * The timer is in the task's header.
 */

const dayLabel = (day: string) => formatDate(isoDateInstant(day), { dateStyle: "medium" });

/** Logged against the estimate, as a bar (over the estimate in the warning colour) and a sentence. */
export function TimeAgainstEstimate({ logged, estimate }: { logged: number; estimate: number | null }) {
	const over = estimate !== null && logged > estimate;
	const sentence =
		estimate === null
			? m.taskline_time_logged({ logged: formatDuration(logged) })
			: m.taskline_time_logged_of({ logged: formatDuration(logged), estimate: formatDuration(estimate) });
	return (
		<div className="flex flex-col gap-1.5" data-testid="time-against-estimate">
			{estimate !== null && estimate > 0 ? (
				<div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
					<span
						className={cn("block h-full", over ? "bg-warning" : "bg-primary")}
						style={{ width: `${Math.min(100, (logged / estimate) * 100)}%` }}
					/>
				</div>
			) : null}
			<p className="text-caption text-muted-foreground tabular-nums">
				{sentence}
				{over ? ` · ${m.taskline_time_over({ over: formatDuration(logged - estimate) })}` : ""}
			</p>
		</div>
	);
}

export function TaskTime({
	task,
	userId,
	ws,
	heading: Heading,
}: {
	task: TaskDetail;
	userId: string;
	ws: string;
	heading: "h2" | "h3";
}) {
	const queryClient = useQueryClient();
	const headingId = useId();
	const [logging, setLogging] = useState(false);
	const log = useMutation(tasklineMutations.logTime(queryClient, userId));
	const { time } = task;
	const canLog = time.canLog && task.deletedAt === null;
	const add = (values: EntryValues) =>
		log.mutate(
			{ ws, ref: task.ref, ...values },
			{
				onSuccess: () => {
					setLogging(false);
					toast.success(m.taskline_time_logged_toast({ duration: formatDuration(values.minutes) }));
				},
				onError: (error) => toast.error(errorMessage(error)),
			},
		);
	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-3" data-testid="task-time">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Heading id={headingId} className="font-medium text-body">
					{m.taskline_time_title()}
				</Heading>
				{canLog && !logging ? (
					<Button variant="outline" size="sm" onClick={() => setLogging(true)} data-testid="time-log-open">
						<PlusIcon aria-hidden />
						{m.taskline_time_log()}
					</Button>
				) : null}
			</div>
			<TimeAgainstEstimate logged={time.loggedMinutes} estimate={task.estimateMinutes} />
			{logging ? (
				<div className="rounded-md border p-3">
					<TimeEntryForm
						initial={{ onDay: time.today, minutes: 0, note: "", billable: false }}
						today={time.today}
						lockOn={time.lockOn}
						submitLabel={m.taskline_time_log()}
						pending={log.isPending}
						onSubmit={add}
						onCancel={() => setLogging(false)}
						testId="time-log-form"
					/>
				</div>
			) : null}
			{time.entries.length === 0 ? (
				<p className="text-muted-foreground text-sm">{m.taskline_time_none()}</p>
			) : (
				<ul className="flex flex-col divide-y rounded-md border" data-testid="time-entries">
					{time.entries.map((entry) => (
						<EntryRow key={entry.id} entry={entry} ws={ws} userId={userId} today={time.today} lockOn={time.lockOn} />
					))}
				</ul>
			)}
		</section>
	);
}

function EntryRow({
	entry,
	ws,
	userId,
	today,
	lockOn,
}: {
	entry: TimeEntry;
	ws: string;
	userId: string;
	today: string;
	lockOn: string | null;
}) {
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const [editing, setEditing] = useState(false);
	const update = useMutation(tasklineMutations.updateTimeEntry(queryClient, userId));
	const remove = useMutation(tasklineMutations.deleteTimeEntry(queryClient, userId));
	const fail = (error: Error) => toast.error(errorMessage(error));
	if (editing) {
		return (
			<li className="p-3">
				<TimeEntryForm
					initial={entry}
					today={today}
					lockOn={lockOn}
					submitLabel={m.crud_save()}
					pending={update.isPending}
					onSubmit={(values) =>
						update.mutate({ ws, id: entry.id, ...values }, { onSuccess: () => setEditing(false), onError: fail })
					}
					onCancel={() => setEditing(false)}
					testId="time-edit-form"
				/>
			</li>
		);
	}
	const toDelete = async () => {
		const confirmed = await confirm({
			title: m.taskline_time_delete_title(),
			description: m.taskline_time_delete_body({ duration: formatDuration(entry.minutes), day: dayLabel(entry.onDay) }),
			confirmLabel: m.crud_delete(),
			destructive: true,
		});
		if (confirmed) remove.mutate({ ws, id: entry.id }, { onError: fail });
	};
	return (
		<li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-body" data-testid="time-entry">
			<span className="font-medium tabular-nums">
				{entry.running ? m.taskline_time_running() : formatDuration(entry.minutes)}
			</span>
			<span className="text-muted-foreground">{entry.memberName}</span>
			<span className="text-caption text-muted-foreground">{dayLabel(entry.onDay)}</span>
			{entry.billable ? <StatusBadge tone="info">{m.taskline_time_billable()}</StatusBadge> : null}
			{entry.note ? <span className="min-w-0 basis-full wrap-anywhere text-caption">{entry.note}</span> : null}
			{entry.canEdit ? (
				<span className="ms-auto flex gap-1">
					<Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(true)}>
						<PencilIcon aria-hidden />
						<span className="sr-only">
							{m.taskline_time_edit_entry({ duration: formatDuration(entry.minutes), day: dayLabel(entry.onDay) })}
						</span>
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="size-8 text-danger"
						disabled={remove.isPending}
						onClick={() => void toDelete()}
					>
						<Trash2Icon aria-hidden />
						<span className="sr-only">
							{m.taskline_time_delete_entry({ duration: formatDuration(entry.minutes), day: dayLabel(entry.onDay) })}
						</span>
					</Button>
				</span>
			) : entry.locked ? (
				<span className="ms-auto text-caption text-muted-foreground">{m.taskline_time_locked()}</span>
			) : null}
		</li>
	);
}
