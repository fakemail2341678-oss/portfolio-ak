import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, CopyIcon, LockIcon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { EmptyState } from "@/components/page/empty-state";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { addDays, isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate, formatDayMonth, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { tasklineLinks } from "../links";
import { tasklineKeys, tasklineMutations, timesheetQueryOptions, workspaceQueryOptions } from "../queries";
import type { Timesheet, TimesheetRow } from "../types";
import { formatDuration } from "./duration";
import { sheetTotals } from "./sheet";
import { TimesheetGrid } from "./timesheet";

const route = getRouteApi("/_taskline/app/taskline/_shell/$ws/timesheet");

/**
 * My timesheet (/$ws/timesheet, Task 53): the caller's week in one workspace, from the
 * workspace's week start. Cells save as they're left (the server makes the day's
 * entries add up to what was typed); "Copy last week" fills this week from the last;
 * a task to add is picked from the caller's open tasks.
 */
export function TimesheetPage() {
	const { session } = route.useRouteContext();
	const { ws } = route.useParams();
	const search = route.useSearch();
	const userId = session.user.id;
	const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(userId, ws));
	const week = search.week ?? workspace.today;
	const { data: sheet } = useSuspenseQuery(timesheetQueryOptions(userId, ws, week));
	const queryClient = useQueryClient();
	const [added, setAdded] = useState<TimesheetRow[]>([]);
	const pickId = useId();
	const setCell = useMutation(tasklineMutations.setTimesheetCell(queryClient, userId));
	const copy = useMutation(tasklineMutations.copyWeek(queryClient, userId));
	const key = tasklineKeys.timesheet(userId, ws, week);

	const rows: TimesheetRow[] = [
		...sheet.rows,
		...added.filter((row) => !sheet.rows.some((each) => each.key === row.key)),
	];
	const suggestions = sheet.suggestions.filter((each) => !rows.some((row) => row.key === each.key));
	const total = sheetTotals(rows, sheet.days.length).total;
	const first = sheet.days[0] ?? sheet.weekStart;
	const last = sheet.days.at(-1) ?? sheet.weekStart;
	const thisWeek = sheet.days.includes(workspace.today);

	const onCell = (row: TimesheetRow, day: number, minutes: number) => {
		const onDay = sheet.days[day];
		if (!row.task || !onDay) return;
		// Shown at once; put back if the server refuses (the error says why).
		const previous = queryClient.getQueryData<Timesheet>(key);
		const patched = (current: Timesheet): Timesheet => {
			const known = current.rows.some((each) => each.key === row.key);
			const next = { ...row, minutes: row.minutes.map((value, index) => (index === day ? minutes : value)) };
			return {
				...current,
				rows: known ? current.rows.map((each) => (each.key === row.key ? next : each)) : [...current.rows, next],
			};
		};
		if (previous) queryClient.setQueryData<Timesheet>(key, patched(previous));
		setCell.mutate(
			{ ws, ref: row.task.ref, onDay, minutes },
			{
				onError: (error) => {
					if (previous) queryClient.setQueryData(key, previous);
					toast.error(m.taskline_rolled_back(), { description: errorMessage(error) });
				},
			},
		);
	};

	return (
		<Page width="wide" data-testid="timesheet-page">
			<PageHeader
				title={m.taskline_nav_timesheet()}
				description={m.taskline_timesheet_week({ start: formatDayMonth(first), end: formatDayMonth(last) })}
				actions={
					<>
						<nav aria-label={m.taskline_timesheet_weeks()} className="flex items-center gap-1">
							<Button asChild variant="outline" size="icon">
								<Link {...tasklineLinks.timesheet(ws, addDays(first, -7))} data-testid="timesheet-previous">
									<ChevronLeftIcon aria-hidden />
									<span className="sr-only">{m.taskline_timesheet_previous()}</span>
								</Link>
							</Button>
							<Button asChild variant="outline" size="sm">
								<Link
									{...tasklineLinks.timesheet(ws)}
									aria-current={thisWeek ? "page" : undefined}
									data-testid="timesheet-this-week"
								>
									{m.taskline_timesheet_this_week()}
								</Link>
							</Button>
							<Button asChild variant="outline" size="icon">
								<Link {...tasklineLinks.timesheet(ws, addDays(first, 7))} data-testid="timesheet-next">
									<ChevronRightIcon aria-hidden />
									<span className="sr-only">{m.taskline_timesheet_next()}</span>
								</Link>
							</Button>
						</nav>
						{sheet.canLog ? (
							<Button
								variant="outline"
								size="sm"
								disabled={copy.isPending || sheet.lastWeekMinutes === 0}
								onClick={() =>
									copy.mutate(
										{ ws, week: first },
										{
											onSuccess: (result) =>
												result.copied > 0
													? toast.success(
															m.taskline_timesheet_copied({
																copied: formatNumber(result.copied),
																skipped: formatNumber(result.skipped),
															}),
														)
													: toast.info(m.taskline_timesheet_copied_none()),
											onError: (error) => toast.error(errorMessage(error)),
										},
									)
								}
								data-testid="timesheet-copy"
							>
								<CopyIcon aria-hidden />
								{m.taskline_timesheet_copy()}
							</Button>
						) : null}
					</>
				}
			/>
			{!sheet.canLog ? (
				<EmptyState
					icon={ClockIcon}
					title={m.taskline_timesheet_none_title()}
					description={m.taskline_timesheet_none()}
					data-testid="timesheet-none"
				/>
			) : (
				<>
					<div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-body">
						<span className="font-medium tabular-nums" data-testid="timesheet-week-total">
							{sheet.capacityMinutes
								? m.taskline_timesheet_of_capacity({
										logged: formatDuration(total),
										capacity: formatDuration(sheet.capacityMinutes),
									})
								: m.taskline_time_logged({ logged: formatDuration(total) })}
						</span>
						{sheet.lockOn ? (
							<span
								className="inline-flex items-center gap-1 text-caption text-muted-foreground"
								data-testid="timesheet-lock"
							>
								<LockIcon className="size-3.5" aria-hidden />
								{m.taskline_timesheet_locked_until({
									date: formatDate(isoDateInstant(sheet.lockOn), { dateStyle: "medium" }),
								})}
							</span>
						) : null}
					</div>
					{rows.length === 0 ? (
						<EmptyState
							icon={ClockIcon}
							title={m.taskline_timesheet_empty_title()}
							description={m.taskline_timesheet_empty()}
							data-testid="timesheet-empty"
						/>
					) : (
						<TimesheetGrid
							ws={ws}
							days={sheet.days}
							today={sheet.today}
							lockOn={sheet.lockOn}
							workingDays={sheet.workingDays}
							rows={rows}
							onCell={onCell}
						/>
					)}
					{suggestions.length > 0 ? (
						<div className="flex flex-wrap items-end gap-2">
							<label htmlFor={pickId} className="flex flex-col gap-1 text-caption text-muted-foreground">
								{m.taskline_timesheet_add_row()}
								<NativeSelect
									id={pickId}
									value=""
									onChange={(event) => {
										const found = suggestions.find((each) => each.key === event.currentTarget.value);
										if (found)
											setAdded((current) => [
												...current,
												{ ...found, editable: true, minutes: sheet.days.map(() => 0) },
											]);
									}}
									className="min-w-64"
									data-testid="timesheet-add"
								>
									<option value="">{m.taskline_timesheet_pick_task()}</option>
									{suggestions.map((each) => (
										<option key={each.key} value={each.key}>
											{each.task ? `${each.task.ref} · ${each.task.title}` : each.project.key}
										</option>
									))}
								</NativeSelect>
							</label>
						</div>
					) : null}
				</>
			)}
		</Page>
	);
}
