import { previewTasklineWorkspaceAutomation } from "@/functions/taskline-admin/automations";
import type { AutomationCondition } from "../../types";
import { tasklineAdminKeys } from "../keys";

/** How many of the team's open tasks some conditions match now (the builder's preview, keyed by the conditions). */
export const adminAutomationPreviewSource = () => ({
	queryKey: tasklineAdminKeys.automationPreview(),
	run: (conditions: AutomationCondition[]) => previewTasklineWorkspaceAutomation({ data: { conditions } }),
});
