import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, SendHorizontalIcon } from "lucide-react";
import { type KeyboardEvent, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { PersonAvatar } from "../kit/person-avatar";
import { COMMENT_MAX, mentionAt } from "../notifications";
import { kharchaMutations } from "../queries";
import type { ThreadTalk } from "../types";

type Mentionable = ThreadTalk["mentionable"][number];

/** The people whose "@handle" is still in the text: what the comment mentions. */
export const mentionsIn = (body: string, people: ReadonlyArray<Pick<Mentionable, "id" | "handle">>): string[] =>
	people.filter((person) => body.includes(`@${person.handle}`)).map((person) => person.id);

/**
 * The text of a comment being written or edited (Task 92), with "@" suggestions: typing "@"
 * and the start of a name lists the people in the thread with an account; the arrow keys
 * move between them, Tab or Enter picks one, Escape closes them. ⌘/Ctrl+Enter sends.
 */
export function CommentText({
	value,
	onChange,
	onSubmit,
	mentionable,
	label,
	autoFocus = false,
	testId,
}: {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	mentionable: ReadonlyArray<Mentionable>;
	label: string;
	autoFocus?: boolean;
	testId: string;
}) {
	const id = useId();
	const area = useRef<HTMLTextAreaElement>(null);
	const [caret, setCaret] = useState(0);
	const [active, setActive] = useState(0);
	const [closed, setClosed] = useState(false);
	const at = mentionAt(value, caret);
	const query = at?.query.toLocaleLowerCase() ?? "";
	const options =
		at && !closed
			? mentionable
					.filter(
						(person) =>
							person.handle.toLocaleLowerCase().includes(query) || person.name.toLocaleLowerCase().includes(query),
					)
					.slice(0, 5)
			: [];
	const highlighted = options[Math.min(active, options.length - 1)];

	const pick = (person: Mentionable) => {
		if (!at) return;
		const before = value.slice(0, at.start);
		const after = value.slice(caret);
		const inserted = `@${person.handle} `;
		onChange(`${before}${inserted}${after}`);
		const next = before.length + inserted.length;
		setCaret(next);
		setActive(0);
		requestAnimationFrame(() => {
			area.current?.focus();
			area.current?.setSelectionRange(next, next);
		});
	};

	const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
			event.preventDefault();
			onSubmit();
			return;
		}
		if (options.length === 0) return;
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			const by = event.key === "ArrowDown" ? 1 : -1;
			setActive((index) => (index + by + options.length) % options.length);
		} else if ((event.key === "Tab" || event.key === "Enter") && highlighted) {
			event.preventDefault();
			pick(highlighted);
		} else if (event.key === "Escape") {
			event.preventDefault();
			setClosed(true);
		}
	};

	return (
		<div className="relative flex flex-col gap-1.5">
			<label htmlFor={id} className="sr-only">
				{label}
			</label>
			<Textarea
				ref={area}
				id={id}
				value={value}
				rows={2}
				maxLength={COMMENT_MAX}
				placeholder={label}
				autoFocus={autoFocus}
				onChange={(event) => {
					onChange(event.target.value);
					setCaret(event.target.selectionStart);
					setClosed(false);
					setActive(0);
				}}
				onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
				onKeyDown={onKeyDown}
				className="max-h-48 min-h-11 resize-none bg-kh-page"
				data-testid={testId}
			/>
			{options.length > 0 ? (
				<fieldset className="flex min-w-0 flex-wrap gap-1.5" data-testid="kharcha-mention-options">
					<legend className="sr-only">{m.kharcha_comment_mention_label()}</legend>
					{options.map((person) => (
						<button
							key={person.id}
							type="button"
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => pick(person)}
							className={cn(
								"kh-ease flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
								person === highlighted
									? "border-kh-act bg-kh-sel text-kh-ink"
									: "border-kh-hair bg-kh-page text-kh-muted hover:text-kh-ink",
							)}
						>
							<PersonAvatar name={person.name} color={person.color} size="sm" />
							{person.handle}
						</button>
					))}
				</fieldset>
			) : null}
			<p className="sr-only" aria-live="polite">
				{highlighted ? m.kharcha_comment_mention_hint({ name: highlighted.handle }) : ""}
			</p>
		</div>
	);
}

/**
 * A thread's composer (Task 92, PLAN 14.5 "Conversations"): a comment, with "@" for the
 * people in it, and a + that adds an expense right there. Sent with the button or ⌘/Ctrl+Enter.
 */
export function Composer({
	talk,
	userId,
	onAddExpense,
	label,
}: {
	talk: ThreadTalk;
	userId: string;
	onAddExpense?: (() => void) | undefined;
	label: string;
}) {
	const queryClient = useQueryClient();
	const [body, setBody] = useState("");
	const send = useMutation({
		...kharchaMutations.comment(queryClient, userId),
		onError: (error) => toast.error(errorMessage(error)),
	});
	const submit = () => {
		const text = body.trim();
		if (!text || send.isPending) return;
		send.mutate(
			{ id: crypto.randomUUID(), thread: talk.thread, body: text, mentions: mentionsIn(text, talk.mentionable) },
			{ onSuccess: () => setBody("") },
		);
	};
	return (
		<form
			method="post"
			className="flex items-end gap-2 rounded-lg border border-kh-hair bg-kh-page p-2 sm:p-3"
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
			aria-label={label}
			data-testid="kharcha-composer"
		>
			{onAddExpense ? (
				<Button
					type="button"
					variant="outline"
					size="icon"
					className="size-11 shrink-0"
					onClick={onAddExpense}
					data-testid="kharcha-composer-add"
				>
					<PlusIcon aria-hidden />
					<span className="sr-only">{m.kharcha_create_expense()}</span>
				</Button>
			) : null}
			<div className="min-w-0 flex-1">
				<CommentText
					value={body}
					onChange={setBody}
					onSubmit={submit}
					mentionable={talk.mentionable}
					label={m.kharcha_comment_placeholder()}
					testId="kharcha-composer-text"
				/>
			</div>
			<Button
				type="submit"
				size="icon"
				className="size-11 shrink-0"
				disabled={send.isPending || body.trim() === ""}
				aria-keyshortcuts="Control+Enter Meta+Enter"
				data-testid="kharcha-composer-send"
			>
				<SendHorizontalIcon className="rtl:-scale-x-100" aria-hidden />
				<span className="sr-only">{m.kharcha_comment_send()}</span>
			</Button>
		</form>
	);
}
