import { useStore } from "@tanstack/react-form";
import type { ReactNode } from "react";
import { useFormContext } from "@/components/forms/contexts";
import { SubmitButton } from "@/components/forms/form-components";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

/**
 * A group of fields with a heading: the heading and its description on the left,
 * the fields on the right from `lg` (stacked below). Long forms read as a few
 * named parts instead of one column of twenty fields.
 */
export function FormSection({
	title,
	description,
	children,
	className,
}: {
	title: string;
	description?: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	return (
		<section
			className={cn("grid gap-x-8 gap-y-4 border-b pb-8 last:border-b-0 lg:grid-cols-[16rem_minmax(0,1fr)]", className)}
		>
			<div className="flex flex-col gap-1">
				<h2 className="text-heading">{title}</h2>
				{description ? <p className="text-caption text-muted-foreground">{description}</p> : null}
			</div>
			<div className="flex min-w-0 flex-col gap-6">{children}</div>
		</section>
	);
}

/**
 * A card holding part of a page: a heading, an optional description and action, the
 * content, and an optional footer (a form's own save button). Settings forms and
 * small editors use one card each.
 */
export function FormCard({
	title,
	description,
	action,
	children,
	footer,
	className,
	...props
}: {
	title: string;
	description?: ReactNode;
	/** Top right: a link or a small button about the whole card. */
	action?: ReactNode;
	children: ReactNode;
	footer?: ReactNode;
	className?: string;
	"data-testid"?: string;
}) {
	return (
		<section className={cn("flex min-w-0 flex-col rounded-lg border bg-card shadow-xs", className)} {...props}>
			<div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
				<div className="flex min-w-0 flex-col gap-1">
					<h2 className="text-heading">{title}</h2>
					{description ? <div className="text-caption text-muted-foreground">{description}</div> : null}
				</div>
				{action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
			</div>
			<div className="flex min-w-0 flex-col gap-4 p-5">{children}</div>
			{footer ? (
				<div className="flex flex-wrap items-center justify-end gap-2 border-t bg-surface-1 px-5 py-3">{footer}</div>
			) : null}
		</section>
	);
}

/**
 * Save and cancel for a long form, stuck to the bottom of the viewport while the
 * form scrolls under it, with "Unsaved changes" once something was edited. Render
 * it as the last child of `form.Form` (it reads the form from context).
 */
export function StickyFormBar({
	submitLabel,
	pendingLabel,
	cancel,
	className,
}: {
	submitLabel: string;
	pendingLabel?: string;
	/** A Cancel button or a "Back" link. */
	cancel?: ReactNode;
	className?: string;
}) {
	const form = useFormContext();
	const dirty = useStore(form.store, (state) => !state.isDefaultValue);
	return (
		<div
			className={cn(
				"sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t bg-background/90 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/75",
				className,
			)}
			data-testid="sticky-form-bar"
		>
			<p className="me-auto text-caption text-muted-foreground" aria-live="polite">
				{dirty ? m.form_unsaved_changes() : null}
			</p>
			{cancel}
			<SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
		</div>
	);
}
