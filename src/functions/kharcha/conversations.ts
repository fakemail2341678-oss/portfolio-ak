import { createServerFn } from "@tanstack/react-start";
import {
	commentIdInputSchema,
	createCommentInputSchema,
	focusInputSchema,
	markNotificationsInputSchema,
	notifySettingsInputSchema,
	reactInputSchema,
	threadInputSchema,
	updateCommentInputSchema,
} from "@/features/kharcha/schema";
import type { CommentView } from "@/features/kharcha/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireKharchaUser, withKharchaServices } from "@/middleware/kharcha";
import * as talk from "@/server/kharcha/conversations/service";
import * as inbox from "@/server/kharcha/notify/inbox";

/**
 * Kharcha's conversations and notifications (docs/guides/kharcha.md "Conversations and
 * notifications", Task 92): comments and reactions in the threads the caller may write in,
 * read marks, their notifications and how each kind is emailed. Anyone signed in, guests
 * included; a thread they can't reach is not found (tests/server/kharcha-access.test.ts).
 */

export const createKharchaComment = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(createCommentInputSchema))
	.handler(({ data, context }): Promise<CommentView> => talk.createComment(context, data));

export const updateKharchaComment = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(updateCommentInputSchema))
	.handler(({ data, context }): Promise<CommentView> => talk.updateComment(context, data));

export const deleteKharchaComment = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(commentIdInputSchema))
	.handler(({ data, context }): Promise<void> => talk.deleteComment(context, data.commentId));

export const reactKharchaComment = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(reactInputSchema))
	.handler(({ data, context }): Promise<CommentView> => talk.react(context, data));

/** The caller read a thread: its unread lines and their notifications about it clear. */
export const setKharchaThreadRead = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(threadInputSchema))
	.handler(({ data, context }): Promise<void> => talk.markThreadRead(context, data.thread));

export const setKharchaNotificationsRead = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(markNotificationsInputSchema))
	.handler(({ data, context }): Promise<void> => inbox.markRead(context, data.ids));

/** Settings → Notifications: how each kind is emailed. */
export const updateKharchaNotifySettings = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(notifySettingsInputSchema))
	.handler(({ data, context }): Promise<void> => inbox.updateNotifySettings(context, data));

/** Focus mode on People: only unread and unsettled conversations. */
export const setKharchaFocus = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(focusInputSchema))
	.handler(({ data, context }): Promise<void> => inbox.setFocus(context, data.focus));
