import "@tanstack/react-start/server-only";
import type { ImageAsset, UploadTicket } from "@/features/attachments/schema";
import type {
	AddCommentInput,
	DeleteCommentInput,
	TaskFilesInput,
	UpdateCommentInput,
} from "@/features/taskline/schema";
import type { TaskDetail } from "@/features/taskline/types";
import { ruleError } from "@/lib/errors";
import { m } from "@/paraglide/messages";
import { AttachmentLinkError, syncEntityAttachments } from "@/server/attachments/repository";
import { confirmUpload, discardUpload, signUpload } from "@/server/attachments/service";
import { notFound } from "@/server/db/crud";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { mentionedIds } from "@/server/rich-text/sanitize";
import { assertCan, type ProjectAccess, type TasklineServices } from "../access";
import { recordActivity } from "../activity";
import { runAutomations } from "../automations/engine";
import { actorOf, produce, taskData, viewers } from "../notify/produce";
import { bumpRev } from "../rev";
import { fieldError, notMemberError, richText } from "../rules";
import { resolveTask, taskDetail } from "../tasks/service";
import * as repo from "./repository";

/**
 * A task's conversation and files (Task 50, decision 0214): comments with mentions,
 * watching, and images or PDFs on tasks and comments. Every write resolves the task
 * first, then changes, records activity, bumps the rev and notifies, in one
 * transaction; instant emails go after the commit.
 */

/** Comments a member may post per window: enough for a conversation, not for a script. */
export const COMMENT_RATE = { max: 30, windowSeconds: 10 * 60 };
/** Uploads per member per hour (as Notes'). */
export const UPLOAD_RATE = { max: 60, windowSeconds: 60 * 60 };
const SCOPE = "taskline";
const EXCERPT_MAX = 280;

const linkError = () => ruleError("BAD_REQUEST", "Taskline: attachment refused", m.attachments_error_link());
const noAlt = { en: "", ne: "" };

/** Links pending uploads, mapping the attachments repository's refusal to a message. */
async function link(
	tx: Parameters<typeof syncEntityAttachments>[0],
	target: Parameters<typeof syncEntityAttachments>[1],
	ids: ReadonlyArray<string>,
) {
	try {
		return await syncEntityAttachments(
			tx,
			target,
			ids.map((id) => ({ id, alt: noAlt })),
		);
	} catch (error) {
		if (error instanceof AttachmentLinkError) throw linkError();
		throw error;
	}
}

/** A comment's body: sanitized, its text, and the members it mentions who may see the task. */
async function bodyOf(db: TasklineServices["db"], access: ProjectAccess, html: string) {
	const body = richText(html);
	const named = mentionedIds(body.html as Parameters<typeof mentionedIds>[0]);
	const allowed = new Set((await viewers(db, access, named)).map((each) => each.memberId));
	return { ...body, mentions: named.filter((id) => allowed.has(id)) };
}

const excerptOf = (text: string) => (text.length > EXCERPT_MAX ? `${text.slice(0, EXCERPT_MAX - 1)}…` : text);

function deliverAfter(services: TasklineServices, ids: string[]) {
	if (ids.length > 0) services.deliver?.(ids);
}

export async function addComment(services: TasklineServices, input: AddCommentInput): Promise<TaskDetail> {
	const { db, user, imageStore } = services;
	const { detail, notify } = await db.transaction(async (tx) => {
		const { access, task } = await resolveTask(tx, user, input.ws, input.ref);
		assertCan(access, "comment");
		if (task.deletedAt) throw ruleError("CONFLICT", "Taskline: task in trash", m.taskline_error_in_trash());
		if (!access.member) throw notMemberError();
		const body = await bodyOf(tx, access, input.body);
		const files = input.attachmentIds ?? [];
		if (!body.text && files.length === 0) throw fieldError("BAD_REQUEST", "body", m.taskline_comment_empty());
		await enforceRateLimit(tx, `taskline-comment:${user.id}`, COMMENT_RATE);
		const comment = await repo.insertComment(tx, {
			projectId: access.project.id,
			taskId: task.id,
			authorId: access.member.id,
			bodyHtml: body.html,
			bodyText: body.text,
			mentions: body.mentions,
		});
		if (files.length > 0) {
			await link(tx, { entityType: repo.COMMENT_FILES, entityId: comment.id, ownerId: user.id }, files);
		}
		const watchers = await repo.watcherIds(tx, task.id);
		await repo.setWatching(tx, task.id, access.member.id, true);
		await recordActivity(tx, access, { kind: "comment.added", taskId: task.id, data: { commentId: comment.id } });
		await bumpRev(tx, access.project.id);
		const data = { ...taskData(access, task), excerpt: excerptOf(body.text) };
		const actor = actorOf(access, user.id);
		const notify = await produce(tx, access, actor, [
			{ kind: "mentioned", taskId: task.id, to: body.mentions, data },
			{ kind: "comment", taskId: task.id, to: watchers, data },
		]);
		// Task 56: what a comment fires runs with the rule's rights, not the commenter's (a viewer may comment).
		notify.push(...(await runAutomations(tx, access, actor, [{ trigger: "comment_added", taskId: task.id }])));
		const after = (await resolveTask(tx, user, input.ws, input.ref)).task;
		return { detail: await taskDetail(tx, access, after, { imageStore, user }), notify };
	});
	deliverAfter(services, notify);
	return detail;
}

/** One's own comment, rewritten; someone newly mentioned is told. */
export async function updateComment(services: TasklineServices, input: UpdateCommentInput): Promise<TaskDetail> {
	const { db, user, imageStore } = services;
	const { detail, notify } = await db.transaction(async (tx) => {
		const { access, task } = await resolveTask(tx, user, input.ws, input.ref);
		assertCan(access, "comment");
		if (task.deletedAt) throw ruleError("CONFLICT", "Taskline: task in trash", m.taskline_error_in_trash());
		const comment = await repo.getComment(tx, task.id, input.id);
		if (!comment) throw notFound("Comment");
		if (!access.member || comment.authorId !== access.member.id) {
			throw ruleError("FORBIDDEN", "Taskline: not the author", m.taskline_comment_not_yours());
		}
		const body = await bodyOf(tx, access, input.body);
		if (!body.text) throw fieldError("BAD_REQUEST", "body", m.taskline_comment_empty());
		await repo.patchComment(tx, comment.id, {
			bodyHtml: body.html,
			bodyText: body.text,
			mentions: body.mentions,
			editedAt: new Date(),
		});
		await bumpRev(tx, access.project.id);
		const added = body.mentions.filter((id) => !comment.mentions.includes(id));
		const notify = await produce(tx, access, actorOf(access, user.id), [
			{
				kind: "mentioned",
				taskId: task.id,
				to: added,
				data: { ...taskData(access, task), excerpt: excerptOf(body.text) },
			},
		]);
		return { detail: await taskDetail(tx, access, task, { imageStore, user }), notify };
	});
	deliverAfter(services, notify);
	return detail;
}

/** Deletes a comment: one's own, or any as the project's lead (moderation). Its files go too. */
export async function deleteComment(
	{ db, user, imageStore }: TasklineServices,
	input: DeleteCommentInput,
): Promise<TaskDetail> {
	return db.transaction(async (tx) => {
		const { access, task } = await resolveTask(tx, user, input.ws, input.ref);
		assertCan(access, "comment");
		const comment = await repo.getComment(tx, task.id, input.id);
		if (!comment) throw notFound("Comment");
		const own = access.member !== null && comment.authorId === access.member.id;
		if (!own && !access.can.manage) {
			throw ruleError("FORBIDDEN", "Taskline: not the author", m.taskline_comment_not_yours());
		}
		await repo.patchComment(tx, comment.id, { deletedAt: new Date() });
		await link(tx, { entityType: repo.COMMENT_FILES, entityId: comment.id, ownerId: user.id }, []);
		await recordActivity(tx, access, { kind: "comment.deleted", taskId: task.id, data: { commentId: comment.id } });
		await bumpRev(tx, access.project.id);
		return taskDetail(tx, access, task, { imageStore, user });
	});
}

/** Watching a task: its comments and status changes reach the watcher's inbox. */
export async function watchTask(
	{ db, user, imageStore }: TasklineServices,
	input: { ws: string; ref: string; watching: boolean },
): Promise<TaskDetail> {
	return db.transaction(async (tx) => {
		const { access, task } = await resolveTask(tx, user, input.ws, input.ref);
		if (!access.member) throw notMemberError();
		await repo.setWatching(tx, task.id, access.member.id, input.watching);
		return taskDetail(tx, access, task, { imageStore, user });
	});
}

/** Adds uploaded files (the caller's pending uploads) to a task, after the ones it has. */
export async function addTaskFiles(
	{ db, user, imageStore }: TasklineServices,
	input: TaskFilesInput,
): Promise<TaskDetail> {
	return db.transaction(async (tx) => {
		const { access, task } = await resolveTask(tx, user, input.ws, input.ref);
		assertCan(access, "edit");
		if (task.deletedAt) throw ruleError("CONFLICT", "Taskline: task in trash", m.taskline_error_in_trash());
		const have = await repo.fileIds(tx, repo.TASK_FILES, task.id);
		const adding = input.ids.filter((id) => !have.includes(id));
		await link(tx, { entityType: repo.TASK_FILES, entityId: task.id, ownerId: user.id }, [...have, ...adding]);
		await recordActivity(
			tx,
			access,
			...adding.map((id) => ({ kind: "attachment.added" as const, taskId: task.id, data: { attachmentId: id } })),
		);
		if (adding.length > 0) await bumpRev(tx, access.project.id);
		return taskDetail(tx, access, task, { imageStore, user });
	});
}

/** Takes a file off a task; the attachments cron deletes the asset. */
export async function removeTaskFile(
	{ db, user, imageStore }: TasklineServices,
	input: { ws: string; ref: string; id: string },
): Promise<TaskDetail> {
	return db.transaction(async (tx) => {
		const { access, task } = await resolveTask(tx, user, input.ws, input.ref);
		assertCan(access, "edit");
		const current = await repo.fileIds(tx, repo.TASK_FILES, task.id);
		if (!current.includes(input.id)) throw notFound("Attachment");
		await link(
			tx,
			{ entityType: repo.TASK_FILES, entityId: task.id, ownerId: user.id },
			current.filter((id) => id !== input.id),
		);
		await recordActivity(tx, access, {
			kind: "attachment.removed",
			taskId: task.id,
			data: { attachmentId: input.id },
		});
		await bumpRev(tx, access.project.id);
		return taskDetail(tx, access, task, { imageStore, user });
	});
}

// Uploads: the attachments flow (decision 0098) for Taskline's users, who hold no
// `attachments:upload`; signed per member and rate limited (as Notes', 0190).

const uploader = (user: TasklineServices["user"]) => ({ id: user.id, permissions: [] });

export async function signFileUpload({ db, user, imageStore }: TasklineServices): Promise<UploadTicket> {
	await enforceRateLimit(db, `taskline-upload:${user.id}`, UPLOAD_RATE);
	return signUpload(imageStore ?? null, SCOPE, uploader(user));
}

export const confirmFileUpload = ({ db, user, imageStore }: TasklineServices, publicId: string): Promise<ImageAsset> =>
	confirmUpload(db, imageStore ?? null, { publicId, scope: SCOPE }, uploader(user));

export const discardFileUpload = ({ db, user, imageStore }: TasklineServices, id: string): Promise<void> =>
	discardUpload(db, imageStore ?? null, id, user.id);
