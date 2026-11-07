import { fn } from "storybook/test";
import type { Automation, AutomationPreview, ProjectAutomations } from "../../../../src/features/taskline/types";
import { sampleAutomations, sampleProjectAutomations } from "../../taskline";

// Stand-ins for src/functions/taskline/automations.ts.
const rule = () => sampleAutomations[0] as Automation;
export const listTasklineAutomations = fn(async (): Promise<ProjectAutomations> => sampleProjectAutomations).mockName(
	"listTasklineAutomations",
);
export const createTasklineAutomation = fn(async (): Promise<Automation> => rule()).mockName(
	"createTasklineAutomation",
);
export const updateTasklineAutomation = fn(async (): Promise<Automation> => rule()).mockName(
	"updateTasklineAutomation",
);
export const toggleTasklineAutomation = fn(async (): Promise<Automation> => rule()).mockName(
	"toggleTasklineAutomation",
);
export const deleteTasklineAutomation = fn(async (): Promise<void> => undefined).mockName("deleteTasklineAutomation");
export const previewTasklineAutomation = fn(
	async (): Promise<AutomationPreview> => ({ count: 4, capped: false }),
).mockName("previewTasklineAutomation");
