import { type FormEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { addDays } from "@/lib/i18n/date-only";
import { m } from "@/paraglide/messages";
import { TIME_NOTE_MAX } from "../schema";
import { DAY_MINUTES } from "../types";
import { durationInput, parseDuration } from "./duration";

/**
 * A time entry's fields (Task 53): the day, how long ("1h 30m", "1:30", "1.5"), a
 * note and billable. Logging on a task, editing an entry and the admin's edit dialog
 * share it. The day can't be after today or on or before the lock date; the server
 * checks both again.
 */

export type EntryValues = { onDay: string; minutes: number; note: string; billable: boolean };

export function TimeEntryForm({
	initial,
	today,
	lockOn,
	submitLabel,
	pending,
	onSubmit,
	onCancel,
	testId,
}: {
	initial: EntryValues;
	today: string;
	lockOn: string | null;
	submitLabel: string;
	pending?: boolean;
	onSubmit: (values: EntryValues) => void;
	onCancel?: () => void;
	testId?: string;
}) {
	const id = useId();
	const [error, setError] = useState<string | null>(null);
	const [billable, setBillable] = useState(initial.billable);
	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const minutes = parseDuration(String(data.get("duration") ?? ""), DAY_MINUTES);
		if (minutes === null || minutes < 1) {
			setError(m.taskline_time_error_duration());
			return;
		}
		setError(null);
		onSubmit({
			onDay: String(data.get("onDay") ?? initial.onDay) || initial.onDay,
			minutes,
			note: String(data.get("note") ?? "").trim(),
			billable,
		});
	};
	const label = "text-caption font-medium text-muted-foreground";
	return (
		<form method="post" onSubmit={submit} className="flex flex-col gap-3" data-testid={testId} noValidate>
			<div className="grid gap-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,8rem)_minmax(0,1fr)]">
				<div className="flex flex-col gap-1.5">
					<label htmlFor={`${id}-day`} className={label}>
						{m.taskline_time_field_day()}
					</label>
					<Input
						id={`${id}-day`}
						name="onDay"
						type="date"
						defaultValue={initial.onDay}
						max={today}
						min={lockOn ? addDays(lockOn, 1) : undefined}
						required
					/>
				</div>
				<div className="flex flex-col gap-1.5">
					<label htmlFor={`${id}-duration`} className={label}>
						{m.taskline_time_field_duration()}
					</label>
					<Input
						id={`${id}-duration`}
						name="duration"
						defaultValue={initial.minutes > 0 ? durationInput(initial.minutes) : ""}
						placeholder={m.taskline_time_duration_placeholder()}
						autoComplete="off"
						aria-invalid={error ? true : undefined}
						aria-describedby={error ? `${id}-error` : `${id}-hint`}
						required
						data-testid="time-duration"
					/>
				</div>
				<div className="flex flex-col gap-1.5">
					<label htmlFor={`${id}-note`} className={label}>
						{m.taskline_time_field_note()}
					</label>
					<Input
						id={`${id}-note`}
						name="note"
						defaultValue={initial.note}
						maxLength={TIME_NOTE_MAX}
						autoComplete="off"
					/>
				</div>
			</div>
			{error ? (
				<p id={`${id}-error`} className="text-caption text-danger">
					{error}
				</p>
			) : (
				<p id={`${id}-hint`} className="text-caption text-muted-foreground">
					{m.taskline_time_duration_hint()}
				</p>
			)}
			<div className="flex flex-wrap items-center justify-between gap-3">
				<label htmlFor={`${id}-billable`} className="flex items-center gap-2 text-body">
					<Checkbox id={`${id}-billable`} checked={billable} onCheckedChange={(value) => setBillable(value === true)} />
					{m.taskline_time_field_billable()}
				</label>
				<div className="flex gap-2">
					{onCancel ? (
						<Button type="button" variant="ghost" onClick={onCancel}>
							{m.common_cancel()}
						</Button>
					) : null}
					<Button type="submit" disabled={pending} data-testid="time-submit">
						{submitLabel}
					</Button>
				</div>
			</div>
		</form>
	);
}
