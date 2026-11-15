import { previewTasklineAutomation } from "@/functions/taskline/automations";
import { tasklineKeys } from "../keys";
import type { AutomationCondition } from "../types";

/** How many of the project's open tasks some conditions match now (the builder's preview, keyed by the conditions). */
export const automationPreviewSource = (userId: string, ws: string, key: string) => ({
	queryKey: tasklineKeys.automationPreview(userId, ws, key),
	run: (conditions: AutomationCondition[]) => previewTasklineAutomation({ data: { ws, key, conditions } }),
});
