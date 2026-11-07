import Mention from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { type Ref, useImperativeHandle, useState } from "react";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

/**
 * `@` mentions in the rich text editor (Taskline's comments, Task 50): typing `@`
 * suggests people, and picking one inserts a mention node, which the server's
 * sanitizer keeps as `<span data-type="mention" data-id="…">` and reads the ids from
 * (never trusting a list the browser sends). Arrow keys move, Enter or Tab picks,
 * Escape closes.
 */

export type MentionCandidate = { id: string; label: string };

type ListProps = SuggestionProps<MentionCandidate, { id: string; label: string }>;
type ListHandle = { onKeyDown: (event: KeyboardEvent) => boolean };

const SHOWN = 8;

function MentionList({ items, command, ref }: ListProps & { ref?: Ref<ListHandle> }) {
	const [active, setActive] = useState(0);
	const [lastItems, setLastItems] = useState(items);
	if (lastItems !== items) {
		setLastItems(items);
		setActive(0);
	}
	const pick = (index: number) => {
		const item = items[index];
		if (item) command({ id: item.id, label: item.label });
	};
	useImperativeHandle(ref, () => ({
		onKeyDown: (event) => {
			if (items.length === 0) return false;
			if (event.key === "ArrowDown") {
				setActive((active + 1) % items.length);
				return true;
			}
			if (event.key === "ArrowUp") {
				setActive((active - 1 + items.length) % items.length);
				return true;
			}
			if (event.key === "Enter" || event.key === "Tab") {
				pick(active);
				return true;
			}
			return false;
		},
	}));
	return (
		<div
			role="listbox"
			aria-label={m.rt_mentions()}
			className="z-50 min-w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
			data-testid="mention-list"
		>
			{items.length === 0 ? (
				<p className="px-2 py-1.5 text-muted-foreground text-sm">{m.rt_mention_none()}</p>
			) : (
				items.map((item, index) => (
					<button
						key={item.id}
						type="button"
						role="option"
						aria-selected={index === active}
						className={cn(
							"flex w-full rounded-sm px-2 py-1.5 text-start text-sm",
							index === active && "bg-accent text-accent-foreground",
						)}
						onMouseDown={(event) => event.preventDefault()}
						onClick={() => pick(index)}
					>
						{item.label}
					</button>
				))
			)}
		</div>
	);
}

/** The Mention extension over `candidates()` (read on every keystroke, so it follows the latest list). */
export function mentionExtension(candidates: () => ReadonlyArray<MentionCandidate>) {
	return Mention.configure({
		HTMLAttributes: { class: "mention" },
		suggestion: {
			char: "@",
			items: ({ query }) => {
				const text = query.toLocaleLowerCase();
				return candidates()
					.filter((candidate) => candidate.label.toLocaleLowerCase().includes(text))
					.slice(0, SHOWN);
			},
			render: () => {
				let component: ReactRenderer<ListHandle, ListProps> | null = null;
				let unmount: (() => void) | null = null;
				const close = () => {
					unmount?.();
					component?.element.remove();
					component?.destroy();
					component = null;
					unmount = null;
				};
				return {
					onStart: (props: ListProps) => {
						component = new ReactRenderer(MentionList, { props, editor: props.editor });
						// Inside the editor's dialog when it has one (the task sheet): a modal dialog
						// makes everything outside it inert, so a list on <body> couldn't be clicked.
						const host = props.editor.view.dom.closest('[role="dialog"]') ?? document.body;
						host.append(component.element);
						unmount = props.mount(component.element);
					},
					onUpdate: (props: ListProps) => component?.updateProps(props),
					onKeyDown: ({ event }: SuggestionKeyDownProps) => {
						if (event.key === "Escape") {
							close();
							return true;
						}
						return component?.ref?.onKeyDown(event) ?? false;
					},
					onExit: close,
				};
			},
		},
	});
}
