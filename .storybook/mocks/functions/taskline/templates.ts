import { fn } from "storybook/test";
import type { TemplateChoice } from "../../../../src/features/taskline/types";
import { sampleTemplateChoices } from "../../taskline";

// Stand-ins for src/functions/taskline/templates.ts.
export const listTasklineTemplates = fn(async (): Promise<TemplateChoice[]> => sampleTemplateChoices).mockName(
	"listTasklineTemplates",
);
