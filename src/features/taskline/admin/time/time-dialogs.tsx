import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { formatDuration } from "../../time/duration";
import { TimeEntryForm } from "../../time/entry-form";
import type { TimeEntry } from "../../types";
import { ALL_TASKLINE_ADMIN } from "../keys";
import { tasklineAdminMutations } from "../queries";
import type { AdminTimeOptions } from "../schema";

/** The timesheets page's dialogs, loaded when opened (0168). */

/** Any member's entry, changed by the admin (audited). */
export function EditTimeDialog({
	entry,
	options,
	onClose,
}: {
	entry: TimeEntry;
	options: AdminTimeOptions;
	onClose: () => void;
}) {
	const update = useCrudMutation(tasklineAdminMutations.updateTimeEntry(), { invalidate: ALL_TASKLINE_ADMIN });
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-2xl" data-testid="time-edit-dialog">
				<DialogHeader>
					<DialogTitle>{m.taskline_admin_time_edit_title({ name: entry.memberName })}</DialogTitle>
					<DialogDescription>
						{entry.ref ? `${entry.ref} · ${entry.title ?? ""}` : m.taskline_timesheet_no_task()}
					</DialogDescription>
				</DialogHeader>
				<TimeEntryForm
					initial={entry}
					today={options.today}
					lockOn={options.lockOn}
					submitLabel={m.crud_save()}
					pending={update.isPending}
					onCancel={onClose}
					onSubmit={(values) =>
						update.mutate(
							{ id: entry.id, ...values },
							{
								onSuccess: (saved) => {
									toast.success(m.taskline_admin_time_saved({ duration: formatDuration(saved.minutes) }));
									onClose();
								},
							},
						)
					}
					testId="time-admin-form"
				/>
			</DialogContent>
		</Dialog>
	);
}

/** The lock date: entries on or before it can't change, in the app or here. Cleared, nothing is locked. */
export function LockDialog({ lockOn, today, onClose }: { lockOn: string | null; today: string; onClose: () => void }) {
	const id = useId();
	const [value, setValue] = useState(lockOn ?? "");
	const save = useCrudMutation(tasklineAdminMutations.setTimesheetLock(), { invalidate: ALL_TASKLINE_ADMIN });
	const submit = (next: string | null) =>
		save.mutate(
			{ lockOn: next },
			{
				onSuccess: (result) => {
					toast.success(
						result.lockOn
							? m.taskline_timesheet_locked_until({
									date: formatDate(isoDateInstant(result.lockOn), { dateStyle: "medium" }),
								})
							: m.taskline_admin_time_unlocked(),
					);
					onClose();
				},
			},
		);
	const onSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		submit(value || null);
	};
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-md" data-testid="time-lock-dialog">
				<DialogHeader>
					<DialogTitle>{m.taskline_admin_time_lock()}</DialogTitle>
					<DialogDescription>{m.taskline_admin_time_lock_description()}</DialogDescription>
				</DialogHeader>
				<form method="post" onSubmit={onSubmit} className="flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<label htmlFor={`${id}-day`} className="font-medium text-caption text-muted-foreground">
							{m.taskline_admin_time_lock_on()}
						</label>
						<Input
							id={`${id}-day`}
							type="date"
							value={value}
							max={today}
							onChange={(event) => setValue(event.currentTarget.value)}
							data-testid="time-lock-day"
						/>
					</div>
					<div className="flex flex-wrap justify-end gap-2">
						{lockOn ? (
							<Button type="button" variant="ghost" disabled={save.isPending} onClick={() => submit(null)}>
								{m.taskline_admin_time_unlock()}
							</Button>
						) : null}
						<Button type="submit" disabled={save.isPending || !value} data-testid="time-lock-save">
							{m.taskline_admin_time_lock_save()}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
