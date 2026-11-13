import { useMutation, useQueryClient } from "@tanstack/react-query";
import { EllipsisIcon, PencilIcon, SmilePlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { PersonAvatar } from "../kit/person-avatar";
import { commentParts, REACTIONS, type Reaction, reactionLabel } from "../notifications";
import { kharchaMutations } from "../queries";
import type { CommentView, ThreadTalk } from "../types";
import { CommentText, mentionsIn } from "./composer";

/** A comment's text: links open in a new tab (never followed by search engines), mentions are marked. Nothing is markup. */
export function CommentBody({ comment }: { comment: Pick<CommentView, "body" | "mentions"> }) {
	const parts = commentParts(
		comment.body,
		comment.mentions.map((mention) => ({ id: mention.id, name: mention.handle })),
	);
	return (
		<p className="whitespace-pre-line break-words text-body text-kh-ink" data-testid="kharcha-comment-body">
			{parts.map((part, index) =>
				part.type === "link" ? (
					<a
						// biome-ignore lint/suspicious/noArrayIndexKey: the parts of one text, in order, never reordered.
						key={index}
						href={part.href}
						target="_blank"
						rel="noopener noreferrer nofollow ugc"
						className="text-kh-mark underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
					>
						{part.text}
					</a>
				) : part.type === "mention" ? (
					// biome-ignore lint/suspicious/noArrayIndexKey: as above.
					<mark key={index} className="rounded-sm bg-kh-sel px-0.5 font-semibold text-kh-mark">
						{part.text}
					</mark>
				) : (
					// biome-ignore lint/suspicious/noArrayIndexKey: as above.
					<span key={index}>{part.text}</span>
				),
			)}
		</p>
	);
}

/**
 * A comment on a page of the book (Task 92): its author's plate and name, the text, the
 * reactions (each a toggle saying how many), and for its author, Edit and Delete in a menu.
 * Editing happens in place.
 */
export function CommentLine({
	comment,
	userId,
	mentionable,
}: {
	comment: CommentView;
	userId: string;
	mentionable: ThreadTalk["mentionable"];
}) {
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(comment.body);
	const onError = (error: Error) => toast.error(errorMessage(error));
	const edit = useMutation({ ...kharchaMutations.editComment(queryClient, userId), onError });
	const remove = useMutation({ ...kharchaMutations.deleteComment(queryClient, userId), onError });
	const react = useMutation({ ...kharchaMutations.react(queryClient, userId), onError });
	const author = comment.author;
	const people = [...mentionable, ...comment.mentions.map((mention) => ({ id: mention.id, handle: mention.handle }))];
	const save = () => {
		const body = draft.trim();
		if (!body) return;
		edit.mutate(
			{ commentId: comment.id, body, mentions: mentionsIn(body, people) },
			{ onSuccess: () => setEditing(false) },
		);
	};
	const toggle = (emoji: Reaction, on: boolean) => react.mutate({ commentId: comment.id, emoji, on });

	return (
		<article
			className="flex gap-2.5 py-1"
			aria-label={m.kharcha_comment_by({ name: author?.name ?? m.kharcha_someone() })}
			data-testid="kharcha-comment"
		>
			{author ? (
				<PersonAvatar name={author.name} color={author.color} size="sm" className="mt-0.5" />
			) : (
				<span className="mt-0.5 size-6 shrink-0 rounded-[0.3125rem] bg-kh-rule" aria-hidden />
			)}
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<div className="flex items-center gap-2">
					<span className="truncate font-semibold text-kh-ink text-sm">
						{author ? (author.isMe ? m.kharcha_you_subject() : author.name) : m.kharcha_someone()}
					</span>
					{comment.editedAt ? <span className="text-caption text-kh-muted">{m.kharcha_comment_edited()}</span> : null}
					{comment.can.edit || comment.can.delete ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon" className="ms-auto size-8" data-testid="kharcha-comment-more">
									<EllipsisIcon aria-hidden />
									<span className="sr-only">{m.kharcha_comment_actions()}</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{comment.can.edit ? (
									<DropdownMenuItem
										onSelect={() => {
											setDraft(comment.body);
											setEditing(true);
										}}
									>
										<PencilIcon aria-hidden />
										{m.kharcha_comment_edit()}
									</DropdownMenuItem>
								) : null}
								{comment.can.delete ? (
									<DropdownMenuItem
										variant="destructive"
										onSelect={async () => {
											const ok = await confirm({
												title: m.kharcha_comment_delete_title(),
												description: m.kharcha_comment_delete_body(),
												confirmLabel: m.kharcha_comment_delete(),
												destructive: true,
											});
											if (ok) remove.mutate(comment.id);
										}}
									>
										<Trash2Icon aria-hidden />
										{m.kharcha_comment_delete()}
									</DropdownMenuItem>
								) : null}
							</DropdownMenuContent>
						</DropdownMenu>
					) : null}
				</div>
				{editing ? (
					<form
						method="post"
						className="flex flex-col gap-2"
						onSubmit={(event) => {
							event.preventDefault();
							save();
						}}
					>
						<CommentText
							value={draft}
							onChange={setDraft}
							onSubmit={save}
							mentionable={mentionable}
							label={m.kharcha_comment_edit_label()}
							autoFocus
							testId="kharcha-comment-edit"
						/>
						<div className="flex justify-end gap-2">
							<Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
								{m.common_cancel()}
							</Button>
							<Button type="submit" size="sm" disabled={edit.isPending || draft.trim() === ""}>
								{m.kharcha_save()}
							</Button>
						</div>
					</form>
				) : (
					<CommentBody comment={comment} />
				)}
				{comment.reactions.length > 0 || comment.can.react ? (
					<div className="flex flex-wrap items-center gap-1.5" data-testid="kharcha-reactions">
						{comment.reactions.map((reaction) => (
							<button
								key={reaction.emoji}
								type="button"
								aria-pressed={reaction.mine}
								disabled={!comment.can.react}
								onClick={() => toggle(reaction.emoji, !reaction.mine)}
								aria-label={m.kharcha_reaction_count({
									name: reactionLabel(reaction.emoji),
									count: formatNumber(reaction.count),
								})}
								className={cn(
									"kh-ease kh-figures flex h-7 items-center gap-1 rounded-full border px-2 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-70",
									reaction.mine
										? "border-kh-act bg-kh-sel text-kh-ink"
										: "border-kh-hair bg-kh-page text-kh-muted hover:text-kh-ink",
								)}
							>
								<span aria-hidden>{reaction.emoji}</span>
								{formatNumber(reaction.count)}
							</button>
						))}
						{comment.can.react ? (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="size-7 rounded-full text-kh-muted"
										data-testid="kharcha-react"
									>
										<SmilePlusIcon aria-hidden />
										<span className="sr-only">{m.kharcha_reaction_add()}</span>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start" className="flex min-w-0 gap-0.5 p-1">
									{REACTIONS.map((emoji) => {
										const mine = comment.reactions.some((reaction) => reaction.emoji === emoji && reaction.mine);
										return (
											<DropdownMenuItem
												key={emoji}
												className="size-9 justify-center text-lg"
												aria-label={reactionLabel(emoji)}
												onSelect={() => toggle(emoji, !mine)}
											>
												<span aria-hidden>{emoji}</span>
											</DropdownMenuItem>
										);
									})}
								</DropdownMenuContent>
							</DropdownMenu>
						) : null}
					</div>
				) : null}
			</div>
		</article>
	);
}
