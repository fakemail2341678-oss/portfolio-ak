import { fn } from "storybook/test";
import type { ImageAsset, UploadTicket } from "../../../../src/features/attachments/schema";
import type { TaskDetail } from "../../../../src/features/taskline/types";
import { sampleTaskDetail } from "../../taskline";

// Stand-ins for src/functions/taskline/collab.ts.
const task = async (): Promise<TaskDetail> => sampleTaskDetail;
export const addTasklineComment = fn(task).mockName("addTasklineComment");
export const updateTasklineComment = fn(task).mockName("updateTasklineComment");
export const deleteTasklineComment = fn(task).mockName("deleteTasklineComment");
export const watchTasklineTask = fn(task).mockName("watchTasklineTask");
export const addTasklineTaskFiles = fn(task).mockName("addTasklineTaskFiles");
export const removeTasklineTaskFile = fn(task).mockName("removeTasklineTaskFile");
export const getTasklineUploadSettings = fn(async () => ({ enabled: false })).mockName("getTasklineUploadSettings");
export const signTasklineUpload = fn(async (): Promise<UploadTicket> => {
	throw new Error("Uploads are off in Storybook");
}).mockName("signTasklineUpload");
export const confirmTasklineUpload = fn(async (): Promise<ImageAsset> => {
	throw new Error("Uploads are off in Storybook");
}).mockName("confirmTasklineUpload");
export const discardTasklineUpload = fn(async (): Promise<void> => {}).mockName("discardTasklineUpload");
