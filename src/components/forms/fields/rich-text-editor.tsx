import { EditorContent, type Editor as TiptapEditor, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
	BoldIcon,
	Heading2Icon,
	ItalicIcon,
	LinkIcon,
	ListIcon,
	ListOrderedIcon,
	type LucideIcon,
	QuoteIcon,
	Redo2Icon,
	StrikethroughIcon,
	UnderlineIcon,
	Undo2Icon,
} from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { richTextClass } from "@/components/rich-text-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { useFieldContext } from "../contexts";
import { RICH_TEXT_SURFACE, RICH_TEXT_TOOLBAR } from "./rich-text-frame";
import { type MentionCandidate, mentionExtension } from "./rich-text-mentions";

// Module-level so useEditor's per-render option comparison sees the same instances.
// The schema matches the server sanitizer's allowlist (src/server/rich-text/sanitize.ts).
const EXTENSIONS = [
	StarterKit.configure({
		heading: { levels: [2, 3] },
		link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"] },
	}),
];

type Action = {
	key: string;
	label: () => string;
	icon: LucideIcon;
	run: (editor: TiptapEditor) => void;
	/** Toggle buttons expose aria-pressed; plain actions (undo/redo) don't. */
	active?: (editor: TiptapEditor) => boolean;
	enabled?: (editor: TiptapEditor) => boolean;
};

const ACTIONS: Action[] = [
	{
		key: "bold",
		label: m.rt_bold,
		icon: BoldIcon,
		run: (e) => e.chain().focus().toggleBold().run(),
		active: (e) => e.isActive("bold"),
	},
	{
		key: "italic",
		label: m.rt_italic,
		icon: ItalicIcon,
		run: (e) => e.chain().focus().toggleItalic().run(),
		active: (e) => e.isActive("italic"),
	},
	{
		key: "underline",
		label: m.rt_underline,
		icon: UnderlineIcon,
		run: (e) => e.chain().focus().toggleUnderline().run(),
		active: (e) => e.isActive("underline"),
	},
	{
		key: "strike",
		label: m.rt_strike,
		icon: StrikethroughIcon,
		run: (e) => e.chain().focus().toggleStrike().run(),
		active: (e) => e.isActive("strike"),
	},
	{
		key: "heading",
		label: m.rt_heading,
		icon: Heading2Icon,
		run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
		active: (e) => e.isActive("heading", { level: 2 }),
	},
	{
		key: "bullet",
		label: m.rt_bullet_list,
		icon: ListIcon,
		run: (e) => e.chain().focus().toggleBulletList().run(),
		active: (e) => e.isActive("bulletList"),
	},
	{
		key: "ordered",
		label: m.rt_ordered_list,
		icon: ListOrderedIcon,
		run: (e) => e.chain().focus().toggleOrderedList().run(),
		active: (e) => e.isActive("orderedList"),
	},
	{
		key: "quote",
		label: m.rt_blockquote,
		icon: QuoteIcon,
		run: (e) => e.chain().focus().toggleBlockquote().run(),
		active: (e) => e.isActive("blockquote"),
	},
];

const HISTORY: Action[] = [
	{
		key: "undo",
		label: m.rt_undo,
		icon: Undo2Icon,
		run: (e) => e.chain().focus().undo().run(),
		enabled: (e) => e.can().undo(),
	},
	{
		key: "redo",
		label: m.rt_redo,
		icon: Redo2Icon,
		run: (e) => e.chain().focus().redo().run(),
		enabled: (e) => e.can().redo(),
	},
];

const LINK_INDEX = ACTIONS.length;
const BUTTON_COUNT = ACTIONS.length + 1 + HISTORY.length;

/** Only http(s)/mailto links; bare domains get https://. Returns undefined for anything else. */
export const normalizeLinkHref = (input: string): string | undefined => {
	const text = input.trim();
	if (!text) return undefined;
	const candidate = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
	try {
		const url = new URL(candidate);
		return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : undefined;
	} catch {
		return undefined;
	}
};

function LinkButton({
	editor,
	active,
	tabIndex,
	buttonRef,
}: {
	editor: TiptapEditor;
	active: boolean;
	tabIndex: number;
	buttonRef: (node: HTMLButtonElement | null) => void;
}) {
	const [open, setOpen] = useState(false);
	const [href, setHref] = useState("");
	const apply = () => {
		const normalized = normalizeLinkHref(href);
		if (normalized) editor.chain().focus().extendMarkRange("link").setLink({ href: normalized }).run();
		setOpen(false);
	};
	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				if (next) setHref(String(editor.getAttributes("link").href ?? ""));
				setOpen(next);
			}}
		>
			<PopoverTrigger asChild>
				<Button
					ref={buttonRef}
					type="button"
					variant="ghost"
					size="icon"
					className="size-8 aria-pressed:bg-accent"
					tabIndex={tabIndex}
					aria-label={m.rt_link()}
					aria-pressed={active}
				>
					<LinkIcon aria-hidden />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="flex w-80 flex-col gap-2" align="start">
				<Input
					type="url"
					inputMode="url"
					aria-label={m.rt_link_url()}
					placeholder="https://"
					value={href}
					onChange={(event) => setHref(event.target.value)}
					onKeyDown={(event) => {
						// Enter would otherwise submit the surrounding form.
						if (event.key === "Enter") {
							event.preventDefault();
							apply();
						}
					}}
				/>
				<div className="flex justify-end gap-2">
					{active ? (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => {
								editor.chain().focus().extendMarkRange("link").unsetLink().run();
								setOpen(false);
							}}
						>
							{m.rt_link_remove()}
						</Button>
					) : null}
					<Button type="button" size="sm" onClick={apply}>
						{m.rt_link_apply()}
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}

/** WAI-ARIA toolbar: one tab stop, arrow keys / Home / End move between buttons. */
function Toolbar({ editor }: { editor: TiptapEditor }) {
	const [focusIndex, setFocusIndex] = useState(0);
	const buttons = useRef<Array<HTMLButtonElement | null>>([]);
	const state = useEditorState({
		editor,
		selector: ({ editor: current }) => ({
			active: ACTIONS.map((action) => action.active?.(current) ?? false),
			link: current.isActive("link"),
			enabled: HISTORY.map((action) => action.enabled?.(current) ?? true),
		}),
	});

	const move = (index: number) => {
		const next = (index + BUTTON_COUNT) % BUTTON_COUNT;
		setFocusIndex(next);
		buttons.current[next]?.focus();
	};
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const keys: Record<string, () => void> = {
			ArrowRight: () => move(focusIndex + 1),
			ArrowLeft: () => move(focusIndex - 1),
			Home: () => move(0),
			End: () => move(BUTTON_COUNT - 1),
		};
		const handler = keys[event.key];
		if (handler) {
			event.preventDefault();
			handler();
		}
	};
	const register = (index: number) => (node: HTMLButtonElement | null) => {
		buttons.current[index] = node;
	};

	const renderButton = (action: Action, index: number, extra: { pressed?: boolean; disabled?: boolean }) => (
		<Button
			key={action.key}
			ref={register(index)}
			type="button"
			variant="ghost"
			size="icon"
			className="size-8 aria-disabled:opacity-50 aria-pressed:bg-accent"
			tabIndex={focusIndex === index ? 0 : -1}
			aria-label={action.label()}
			aria-pressed={extra.pressed}
			// aria-disabled, not disabled: toolbar items stay focusable so arrow keys don't skip them.
			aria-disabled={extra.disabled || undefined}
			onFocus={() => setFocusIndex(index)}
			onClick={() => {
				if (!extra.disabled) action.run(editor);
			}}
		>
			<action.icon aria-hidden />
		</Button>
	);

	return (
		<div role="toolbar" aria-label={m.rt_toolbar()} className={RICH_TEXT_TOOLBAR} onKeyDown={onKeyDown}>
			{ACTIONS.map((action, index) => renderButton(action, index, { pressed: state.active[index] ?? false }))}
			<LinkButton
				editor={editor}
				active={state.link}
				tabIndex={focusIndex === LINK_INDEX ? 0 : -1}
				buttonRef={register(LINK_INDEX)}
			/>
			<span className="mx-1 h-5 w-px bg-border" aria-hidden />
			{HISTORY.map((action, offset) =>
				renderButton(action, LINK_INDEX + 1 + offset, { disabled: !(state.enabled[offset] ?? true) }),
			)}
		</div>
	);
}

export type RichTextEditorProps = {
	id: string;
	labelId: string;
	describedBy: string | undefined;
	invalid: boolean;
	/** People `@` suggests (Taskline's comments); without it there are no mentions. */
	mentions?: ReadonlyArray<MentionCandidate> | undefined;
};

/** Client-only (loaded lazily by RichTextField). */
export default function RichTextEditor({ id, labelId, describedBy, invalid, mentions }: RichTextEditorProps) {
	const field = useFieldContext<string>();
	const value = field.state.value ?? "";
	const latest = useRef(field);
	latest.current = field;
	const people = useRef(mentions);
	people.current = mentions;
	// Created once: useEditor compares the extensions on every render.
	const [extensions] = useState(() =>
		mentions ? [...EXTENSIONS, mentionExtension(() => people.current ?? [])] : EXTENSIONS,
	);

	const editor = useEditor({
		// Required for SSR setups: never create the editor during render.
		immediatelyRender: false,
		extensions,
		// Only read when the editor is created; later changes go through the resync effect below.
		content: value,
		// Without deps, useEditor re-applies these options on every render, so the
		// aria attributes on the contenteditable follow the validation state.
		editorProps: {
			attributes: {
				id,
				role: "textbox",
				"aria-multiline": "true",
				"aria-labelledby": labelId,
				...(describedBy ? { "aria-describedby": describedBy } : {}),
				...(invalid ? { "aria-invalid": "true" } : {}),
				class: cn(richTextClass, RICH_TEXT_SURFACE, "outline-none"),
			},
		},
		onUpdate: ({ editor: current }) => latest.current.handleChange(current.isEmpty ? "" : current.getHTML()),
		onBlur: () => latest.current.handleBlur(),
	});

	// Resync when the value changes from outside (form reset, setFieldValue).
	useEffect(() => {
		if (!editor) return;
		const current = editor.isEmpty ? "" : editor.getHTML();
		if (current !== value) editor.commands.setContent(value, { emitUpdate: false });
	}, [editor, value]);

	return (
		<div
			className={cn(
				"rounded-md border shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
				invalid && "border-destructive",
			)}
			data-testid="rich-text-editor"
		>
			{editor ? <Toolbar editor={editor} /> : <div className={RICH_TEXT_TOOLBAR} aria-hidden />}
			{editor ? <EditorContent editor={editor} /> : <div className={RICH_TEXT_SURFACE} />}
		</div>
	);
}
