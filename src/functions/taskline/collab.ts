import { createServerFn } from "@tanstack/react-start";
import type { ImageAsset, UploadTicket } from "@/features/attachments/schema";
import {
	addCommentInputSchema,
	confirmFileInputSchema,
	deleteCommentInputSchema,
	fileIdInputSchema,
	taskFileInputSchema,
	taskFilesInputSchema,
	updateCommentInputSchema,
	watchTaskInputSchema,
} from "@/features/taskline/schema";
import type { TaskDetail } from "@/features/taskline/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireTasklineUser, withTasklineServices } from "@/middleware/taskline";
import * as collab from "@/server/taskline/collab/service";

/** Taskline's collaboration (Task 50): comments, watching, and files on tasks and comments. */

export const addTasklineComment = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(addCommentInputSchema))
	.handler(({ data, context }): Promise<TaskDetail> => collab.addComment(context, data));

export const updateTasklineComment = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(updateCommentInputSchema))
	.handler(({ data, context }): Promise<TaskDetail> => collab.updateComment(context, data));

export const deleteTasklineComment = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(deleteCommentInputSchema))
	.handler(({ data, context }): Promise<TaskDetail> => collab.deleteComment(context, data));

export const followTasklineTask = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(watchTaskInputSchema))
	.handler(({ data, context }): Promise<TaskDetail> => collab.watchTask(context, data));

export const addTasklineTaskFiles = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(taskFilesInputSchema))
	.handler(({ data, context }): Promise<TaskDetail> => collab.addTaskFiles(context, data));

export const removeTasklineTaskFile = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(taskFileInputSchema))
	.handler(({ data, context }): Promise<TaskDetail> => collab.removeTaskFile(context, data));

/** Whether uploads are configured (the task shows a note instead of the picker when not). */
export const getTasklineUploadSettings = createServerFn({ method: "GET" })
	.middleware([requireTasklineUser, withTasklineServices])
	.handler(({ context }): { enabled: boolean } => ({ enabled: context.imageStore !== null }));

export const signTasklineUpload = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.handler(({ context }): Promise<UploadTicket> => collab.signFileUpload(context));

export const confirmTasklineUpload = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(confirmFileInputSchema))
	.handler(({ data, context }): Promise<ImageAsset> => collab.confirmFileUpload(context, data.publicId));

/** Removes the caller's own upload that was never added to a task or a comment. */
export const discardTasklineUpload = createServerFn({ method: "POST" })
	.middleware([requireTasklineUser, withTasklineServices])
	.validator(zodInput(fileIdInputSchema))
	.handler(({ data, context }): Promise<void> => collab.discardFileUpload(context, data.id));
