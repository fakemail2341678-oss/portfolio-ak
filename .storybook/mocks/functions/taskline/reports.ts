import { fn } from "storybook/test";
import type { ProjectReports } from "../../../../src/features/taskline/types";
import { sampleProjectReports } from "../../taskline";

// Stand-ins for src/functions/taskline/reports.ts.
export const getTasklineProjectReports = fn(async (): Promise<ProjectReports> => sampleProjectReports).mockName(
	"getTasklineProjectReports",
);
