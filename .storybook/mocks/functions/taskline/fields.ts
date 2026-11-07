import { fn } from "storybook/test";
import type { TaskField } from "../../../../src/features/taskline/types";
import { sampleFields } from "../../taskline";

// Stand-ins for src/functions/taskline/fields.ts.
const field = () => sampleFields[1] as TaskField;
export const createTasklineField = fn(async (): Promise<TaskField> => field()).mockName("createTasklineField");
export const updateTasklineField = fn(async (): Promise<TaskField> => field()).mockName("updateTasklineField");
export const deleteTasklineField = fn(async (): Promise<void> => undefined).mockName("deleteTasklineField");
