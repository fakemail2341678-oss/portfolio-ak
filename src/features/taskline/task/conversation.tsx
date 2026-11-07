import { formOptions } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellIcon, BellOffIcon, FileTextIcon, PaperclipIcon, PencilIcon, Trash2Icon, XIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { RelativeTime } from "@/components/data-display/relative-time";
import { UserAvatar } from "@/components/data-display/user-avatar";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { handleSaveError, useAppForm } from "@/components/forms";
import type { MentionCandidate } from "@/components/forms/fields/rich-text-mentions";
import { Form } from "@/components/forms/form-components";
import { RichTextContent } from "@/components/rich-text-content";
import { Button } from "@/components/ui/button";
import { uploadRule } from "@/features/attachments/constants";
import type { ImageAsset } from "@/features/attachments/schema";
import { UploadError, uploadImage } from "@/features/attachments/upload";
import { formatNumber } from "@/lib/i18n/intl";
import type { SafeHtml } from "@/lib/safe-html";
import { m } from "@/paraglide/messages";
import { tasklineKeys, tasklineMutations } from "../queries";
import type { ProjectTasks, TaskAttachment, TaskComment, TaskDetail } from "../types";
import { TASKLINE_UPLOADS } from "./uploads";

/**
 * A task's conversation and files (Task 50, decision 0214): watching, the files on the
 * task, and the comments (rich text with `@` mentions, and files of their own). Each
 * write returns the whole task, which replaces the cached one.
 */

type Props = { task: TaskDetail; userId: string; ws: string };

const ACCEPT = uploadRule("taskline").mimeTypes.join(",");

/** Puts the task a write returned in the cache (the panel re-renders from it). */
function useSetTask(userId: string, ws: string, ref: string) {
	const queryClient = useQueryClient();
	return (detail: TaskDetail) => queryClient.setQueryData(tasklineKeys.task(userId, ws, ref), detail);
}

/** Watch or stop watching: a watcher hears about comments and status changes. */
export function WatchButton({ task, userId, ws }: Props) {
	const queryClient = useQueryClient();
	const setTask = useSetTask(userId, ws, task.ref);
	const watch = useMutation(tasklineMutations.watch(queryClient, userId));
	const count = formatNumber(task.watcherIds.length);
	return (
		<Button
			variant="ghost"
			size="sm"
			aria-pressed={task.watching}
			disabled={watch.isPending}
			onClick={() =>
				watch.mutate(
					{ ws, ref: task.ref, watching: !task.watching },
					{ onSuccess: setTask, onError: (error) => toast.error(errorMessage(error)) },
				)
			}
			data-testid="task-watch"
		>
			{task.watching ? <BellOffIcon aria-hidden /> : <BellIcon aria-hidden />}
			{task.watching ? m.taskline_watching() : m.taskline_watch()}
			<span className="text-muted-foreground tabular-nums">
				<span aria-hidden>{count}</span>
				<span className="sr-only">{m.taskline_watchers({ count })}</span>
			</span>
		</Button>
	);
}

/** Uploads picked files through Taskline's transport; what's done waits until a task or comment takes it. */
function useUploads() {
	const settings = useQuery({ ...TASKLINE_UPLOADS.settings, staleTime: Number.POSITIVE_INFINITY });
	const [busy, setBusy] = useState(0);
	const upload = async (files: FileList | null): Promise<ImageAsset[]> => {
		const picked = [...(files ?? [])];
		if (picked.length === 0) return [];
		setBusy((count) => count + picked.length);
		const done: ImageAsset[] = [];
		for (const file of picked) {
			try {
				done.push(
					await uploadImage(file, "taskline", {
						signal: new AbortController().signal,
						transport: TASKLINE_UPLOADS,
					}),
				);
			} catch (error) {
				toast.error(error instanceof UploadError ? error.message : errorMessage(error));
			} finally {
				setBusy((count) => count - 1);
			}
		}
		return done;
	};
	return { enabled: settings.data?.enabled === true, busy: busy > 0, upload };
}

/** A hidden file input behind a button (the button is what keyboards and screen readers reach). */
function PickFiles({
	label,
	busy,
	onPick,
	testId,
}: {
	label: string;
	busy: boolean;
	onPick: (files: FileList | null) => void;
	testId: string;
}) {
	const input = useRef<HTMLInputElement>(null);
	return (
		<>
			<input
				ref={input}
				type="file"
				accept={ACCEPT}
				multiple
				hidden
				onChange={(event) => {
					onPick(event.target.files);
					event.target.value = "";
				}}
				data-testid={`${testId}-input`}
			/>
			<Button
				type="button"
				variant="outline"
				size="sm"
				disabled={busy}
				onClick={() => input.current?.click()}
				data-testid={testId}
			>
				<PaperclipIcon aria-hidden />
				{busy ? m.taskline_files_uploading() : label}
			</Button>
		</>
	);
}

const fileName = (file: Pick<TaskAttachment, "format">, index: number) =>
	m.taskline_file_name({ format: file.format.toUpperCase(), position: formatNumber(index + 1) });

/** Thumbnails that open the file; a remove button each for those who may. */
function FileGrid({
	files,
	onRemove,
}: {
	files: ReadonlyArray<Pick<TaskAttachment, "id" | "url" | "thumbUrl" | "format">>;
	onRemove?: ((id: string) => void) | undefined;
}) {
	return (
		<ul className="flex flex-wrap gap-2">
			{files.map((file, index) => (
				<li key={file.id} className="relative">
					<a
						href={file.url}
						target="_blank"
						rel="noopener noreferrer"
						className="block size-20 overflow-hidden rounded-md border bg-surface-2"
						aria-label={m.taskline_file_open({ name: fileName(file, index) })}
					>
						{file.format === "pdf" ? (
							<FileTextIcon aria-hidden className="m-auto mt-7 size-6 text-muted-foreground" />
						) : (
							<img
								src={file.thumbUrl}
								alt=""
								width={80}
								height={80}
								loading="lazy"
								className="size-full object-cover"
							/>
						)}
					</a>
					{onRemove ? (
						<Button
							type="button"
							variant="secondary"
							size="icon"
							className="absolute -end-2 -top-2 size-6 rounded-full"
							onClick={() => onRemove(file.id)}
						>
							<XIcon aria-hidden />
							<span className="sr-only">{m.taskline_file_remove({ name: fileName(file, index) })}</span>
						</Button>
					) : null}
				</li>
			))}
		</ul>
	);
}

/** The task's files: added at once by editors, removed with a confirmation. */
export function TaskFiles({
	task,
	userId,
	ws,
	editable,
	heading: Heading,
}: Props & { editable: boolean; heading: "h2" | "h3" }) {
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const headingId = useId();
	const setTask = useSetTask(userId, ws, task.ref);
	const add = useMutation(tasklineMutations.addFiles(queryClient, userId));
	const remove = useMutation(tasklineMutations.removeFile(queryClient, userId));
	const uploads = useUploads();
	const pick = async (files: FileList | null) => {
		const done = await uploads.upload(files);
		if (done.length === 0) return;
		add.mutate(
			{ ws, ref: task.ref, ids: done.map((file) => file.id) },
			{ onSuccess: setTask, onError: (error) => toast.error(errorMessage(error)) },
		);
	};
	const drop = async (id: string) => {
		if (
			!(await confirm({
				title: m.taskline_file_remove_title(),
				description: m.taskline_file_remove_body(),
				confirmLabel: m.taskline_file_remove_confirm(),
				destructive: true,
			}))
		) {
			return;
		}
		remove.mutate(
			{ ws, ref: task.ref, id },
			{ onSuccess: setTask, onError: (error) => toast.error(errorMessage(error)) },
		);
	};
	if (!editable && task.attachments.length === 0) return null;
	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-2" data-testid="task-files">
			<Heading id={headingId} className="font-medium text-body">
				{m.taskline_files()}
			</Heading>
			{task.attachments.length > 0 ? (
				<FileGrid files={task.attachments} onRemove={editable ? (id) => void drop(id) : undefined} />
			) : (
				<p className="text-muted-foreground text-sm">{m.taskline_no_files()}</p>
			)}
			{editable ? (
				uploads.enabled ? (
					<div>
						<PickFiles
							label={m.taskline_files_add()}
							busy={uploads.busy || add.isPending}
							onPick={(files) => void pick(files)}
							testId="task-files-add"
						/>
					</div>
				) : (
					<p className="text-caption text-muted-foreground">{m.taskline_files_disabled()}</p>
				)
			) : null}
		</section>
	);
}

/** Who `@` can suggest: the active members of the task's workspace (the server keeps those who may see it). */
const mentionable = (project: ProjectTasks): MentionCandidate[] =>
	project.members.filter((member) => !member.deactivated).map((member) => ({ id: member.id, label: member.name }));

/** The comments, oldest first, and the box to add one. */
export function Comments({
	task,
	project,
	userId,
	ws,
	readAt,
	heading: Heading,
}: Props & { project: ProjectTasks; readAt: string; heading: "h2" | "h3" }) {
	const headingId = useId();
	const people = mentionable(project);
	const nameOf = (memberId: string | null) =>
		project.members.find((member) => member.id === memberId)?.name ?? m.taskline_comment_unknown();
	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-4" data-testid="task-comments">
			<Heading id={headingId} className="sr-only">
				{m.taskline_tab_comments()}
			</Heading>
			{task.comments.length === 0 ? (
				<p className="text-muted-foreground text-sm">{m.taskline_no_comments()}</p>
			) : (
				<ol className="flex flex-col gap-4">
					{task.comments.map((comment) => (
						<CommentItem
							key={comment.id}
							comment={comment}
							author={
								comment.automation
									? m.taskline_comment_by_automation({ name: comment.automation })
									: nameOf(comment.authorId)
							}
							task={task}
							userId={userId}
							ws={ws}
							readAt={readAt}
							people={people}
						/>
					))}
				</ol>
			)}
			{task.can.comment && task.deletedAt === null ? (
				<CommentBox task={task} userId={userId} ws={ws} people={people} />
			) : null}
		</section>
	);
}

function CommentItem({
	comment,
	author,
	task,
	userId,
	ws,
	readAt,
	people,
}: Props & { comment: TaskComment; author: string; readAt: string; people: MentionCandidate[] }) {
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const setTask = useSetTask(userId, ws, task.ref);
	const remove = useMutation(tasklineMutations.deleteComment(queryClient, userId));
	const [editing, setEditing] = useState(false);
	const drop = async () => {
		const confirmed = await confirm({
			title: m.taskline_comment_delete_title(),
			description: m.taskline_comment_delete_body(),
			confirmLabel: m.taskline_comment_delete(),
			destructive: true,
		});
		if (!confirmed) return;
		remove.mutate(
			{ ws, ref: task.ref, id: comment.id },
			{ onSuccess: setTask, onError: (error) => toast.error(errorMessage(error)) },
		);
	};
	return (
		<li className="flex gap-3" data-testid="task-comment">
			<UserAvatar name={author} size="sm" />
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<div className="flex flex-wrap items-baseline gap-x-2 text-caption">
					<span className="font-medium text-foreground">{author}</span>
					<RelativeTime value={comment.createdAt} now={readAt} className="text-muted-foreground" />
					{comment.editedAt ? <span className="text-muted-foreground">{m.taskline_comment_edited()}</span> : null}
					<span className="ms-auto flex gap-1">
						{comment.canEdit && !editing ? (
							<Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setEditing(true)}>
								<PencilIcon aria-hidden />
								{m.taskline_comment_edit()}
							</Button>
						) : null}
						{comment.canDelete ? (
							<Button variant="ghost" size="sm" className="h-6 px-2 text-danger" onClick={() => void drop()}>
								<Trash2Icon aria-hidden />
								{m.taskline_comment_delete()}
							</Button>
						) : null}
					</span>
				</div>
				{editing ? (
					<CommentBox
						task={task}
						userId={userId}
						ws={ws}
						people={people}
						editing={comment}
						onDone={() => setEditing(false)}
					/>
				) : (
					<RichTextContent html={comment.html as SafeHtml} />
				)}
				{comment.attachments.length > 0 ? <FileGrid files={comment.attachments} /> : null}
			</div>
		</li>
	);
}

/** A new comment (with files), or an edit of one's own (text only). */
function CommentBox({
	task,
	userId,
	ws,
	people,
	editing,
	onDone,
}: Props & { people: MentionCandidate[]; editing?: TaskComment; onDone?: () => void }) {
	const queryClient = useQueryClient();
	const setTask = useSetTask(userId, ws, task.ref);
	const add = useMutation(tasklineMutations.addComment(queryClient, userId));
	const update = useMutation(tasklineMutations.updateComment(queryClient, userId));
	const uploads = useUploads();
	const [files, setFiles] = useState<ImageAsset[]>([]);
	const form = useAppForm({
		...formOptions({ defaultValues: { body: editing?.html ?? "" } }),
		onSubmit: async ({ value, formApi }) => {
			try {
				const detail = editing
					? await update.mutateAsync({ ws, ref: task.ref, id: editing.id, body: value.body })
					: await add.mutateAsync({
							ws,
							ref: task.ref,
							body: value.body,
							attachmentIds: files.map((file) => file.id),
						});
				setTask(detail);
				formApi.reset({ body: "" });
				setFiles([]);
				onDone?.();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	return (
		<form.AppForm>
			<Form className="flex flex-col gap-2" data-testid={editing ? "comment-edit" : "comment-box"}>
				<form.AppField name="body">
					{(field) => (
						<field.RichTextField
							label={editing ? m.taskline_comment_edit_label() : m.taskline_comment_label()}
							description={m.taskline_comment_hint()}
							mentions={people}
						/>
					)}
				</form.AppField>
				{files.length > 0 ? (
					<FileGrid
						files={files.map((file) => ({ id: file.id, url: file.url, thumbUrl: file.thumb, format: file.format }))}
						onRemove={(id) => {
							setFiles((current) => current.filter((file) => file.id !== id));
							void TASKLINE_UPLOADS.discard(id);
						}}
					/>
				) : null}
				<div className="flex flex-wrap gap-2">
					<form.SubmitButton pendingLabel={m.crud_saving()}>
						{editing ? m.crud_save() : m.taskline_comment_post()}
					</form.SubmitButton>
					{editing ? (
						<Button type="button" variant="ghost" onClick={onDone}>
							{m.common_cancel()}
						</Button>
					) : uploads.enabled ? (
						<PickFiles
							label={m.taskline_comment_attach()}
							busy={uploads.busy}
							onPick={(picked) =>
								void uploads.upload(picked).then((done) => setFiles((current) => [...current, ...done]))
							}
							testId="comment-attach"
						/>
					) : null}
				</div>
			</Form>
		</form.AppForm>
	);
}
