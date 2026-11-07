import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { type FieldBaseProps, FieldLabelText, FieldMessages, useFieldA11y } from "../field-shell";
import { RICH_TEXT_SURFACE, RICH_TEXT_TOOLBAR } from "./rich-text-frame";
import type { MentionCandidate } from "./rich-text-mentions";

// Tiptap/ProseMirror need the DOM, so the editor is a separate chunk loaded
// only in the browser. The server (and the browser until the chunk arrives)
// renders RichTextPlaceholder, which has the same frame and height so nothing
// moves when the editor mounts.
const RichTextEditor = lazy(() => import("./rich-text-editor"));

function RichTextPlaceholder({ id, invalid }: { id: string; invalid: boolean }) {
	return (
		<div
			className={cn("rounded-md border shadow-xs", invalid && "border-destructive")}
			data-testid="rich-text-placeholder"
		>
			<div className={RICH_TEXT_TOOLBAR} aria-hidden />
			<output id={id} className={cn(RICH_TEXT_SURFACE, "block text-muted-foreground text-sm")}>
				{m.rt_loading()}
			</output>
		</div>
	);
}

export type RichTextFieldProps = FieldBaseProps & {
	/** People `@` suggests; their ids end up in the HTML as mention nodes (the server reads them). */
	mentions?: ReadonlyArray<MentionCandidate>;
};

/**
 * Tiptap editor with a formatting toolbar. Stores HTML ("" when empty). The
 * HTML is untrusted: sanitize it on the server (sanitizeRichText) before
 * storing and before rendering, and display it with <RichTextContent>.
 */
export function RichTextField({ label, description, optional, mentions }: RichTextFieldProps) {
	const a11y = useFieldA11y(label);
	const labelId = `${a11y.id}-label`;
	const placeholder = <RichTextPlaceholder id={a11y.id} invalid={a11y.invalid} />;
	return (
		<Field data-invalid={a11y.invalid || undefined}>
			<FieldLabel id={labelId}>
				<FieldLabelText label={label} optional={optional} />
			</FieldLabel>
			<ClientOnly fallback={placeholder}>
				<Suspense fallback={placeholder}>
					<RichTextEditor
						id={a11y.id}
						labelId={labelId}
						describedBy={a11y.describedBy(Boolean(description))}
						invalid={a11y.invalid}
						mentions={mentions}
					/>
				</Suspense>
			</ClientOnly>
			<FieldMessages
				descriptionId={a11y.descriptionId}
				description={description}
				errorId={a11y.errorId}
				errors={a11y.errors}
			/>
		</Field>
	);
}
