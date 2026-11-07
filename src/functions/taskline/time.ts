import { createServerFn } from "@tanstack/react-start";
import {
	logTimeInput,
	projectInput,
	taskInput,
	timeEntryInput,
	timesheetCellInput,
	timesheetInput,
	updateTimeEntryInput,
} from "@/features/taskline/schema";
import type { CopyWeekResult, ProjectTime, RunningTimer, TimeEntry, Timesheet } from "@/features/taskline/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireTasklineUser, withTasklineServices } from "@/middleware/taskline";
import * as time from "@/server/taskline/time/service";

/** Taskline's time tracking (Task 53): the timer, time logged by hand, the timesheet, a project's time. */

export const startTasklineTimer = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(taskInput))
	.handler(({ data, context }): Promise<RunningTimer> => time.startTimer(context, data.ws, data.ref));

export const stopTasklineTimer = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.handler(({ context }): Promise<{ minutes: number } | null> => time.stopTimer(context));

export const logTasklineTime = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(logTimeInput))
	.handler(({ data, context }): Promise<TimeEntry> => time.logTime(context, data));

export const updateTasklineTimeEntry = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(updateTimeEntryInput))
	.handler(({ data, context }): Promise<TimeEntry> => time.updateEntry(context, data));

export const deleteTasklineTimeEntry = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(timeEntryInput))
	.handler(({ data, context }): Promise<void> => time.deleteEntry(context, data.ws, data.id));

export const setTasklineTimesheetCell = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(timesheetCellInput))
	.handler(({ data, context }): Promise<{ minutes: number }> => time.setCell(context, data));

export const copyTasklineTimesheetWeek = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(timesheetInput))
	.handler(({ data, context }): Promise<CopyWeekResult> => time.copyLastWeek(context, data.ws, data.week));

export const getTasklineTimesheet = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(timesheetInput))
	.handler(({ data, context }): Promise<Timesheet> => time.getTimesheet(context, data.ws, data.week));

export const getTasklineProjectTime = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(projectInput))
	.handler(({ data, context }): Promise<ProjectTime> => time.getProjectTime(context, data.ws, data.key));
