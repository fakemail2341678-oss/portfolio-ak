import { fn } from "storybook/test";
import type {
	CopyWeekResult,
	ProjectTime,
	RunningTimer,
	TimeEntry,
	Timesheet,
} from "../../../../src/features/taskline/types";
import { sampleProjectTime, sampleTaskDetail, sampleTimerNav, sampleTimesheet } from "../../taskline";

// Stand-ins for src/functions/taskline/time.ts.
const entry = () => sampleTaskDetail.time.entries[0] as TimeEntry;
export const startTasklineTimer = fn(async (): Promise<RunningTimer> => sampleTimerNav.timer as RunningTimer).mockName(
	"startTasklineTimer",
);
export const stopTasklineTimer = fn(async (): Promise<{ minutes: number } | null> => ({ minutes: 42 })).mockName(
	"stopTasklineTimer",
);
export const logTasklineTime = fn(async (): Promise<TimeEntry> => entry()).mockName("logTasklineTime");
export const updateTasklineTimeEntry = fn(async (): Promise<TimeEntry> => entry()).mockName("updateTasklineTimeEntry");
export const deleteTasklineTimeEntry = fn(async (): Promise<void> => undefined).mockName("deleteTasklineTimeEntry");
export const setTasklineTimesheetCell = fn(async (): Promise<{ minutes: number }> => ({ minutes: 0 })).mockName(
	"setTasklineTimesheetCell",
);
export const copyTasklineTimesheetWeek = fn(async (): Promise<CopyWeekResult> => ({ copied: 4, skipped: 1 })).mockName(
	"copyTasklineTimesheetWeek",
);
export const getTasklineTimesheet = fn(async (): Promise<Timesheet> => sampleTimesheet).mockName(
	"getTasklineTimesheet",
);
export const getTasklineProjectTime = fn(async (): Promise<ProjectTime> => sampleProjectTime).mockName(
	"getTasklineProjectTime",
);
