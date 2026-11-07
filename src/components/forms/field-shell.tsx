import { useStore } from "@tanstack/react-form";
import type { ReactNode } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { m } from "@/paraglide/messages";
import { useFieldContext } from "./contexts";
import { fieldDomId, useFormMeta } from "./form-meta";

/** Turns TanStack Form errors (Standard Schema issues, strings) into unique messages. */
export const errorMessages = (errors: ReadonlyArray<unknown>): string[] => {
	const messages = errors.flatMap((error) => {
		if (typeof error === "string") return [error];
		if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
			return [error.message];
		}
		return [];
	});
	return [...new Set(messages)];
};

export type FieldBaseProps = {
	label: string;
	description?: string | undefined;
	/** Shows "(optional)" after the label. */
	optional?: boolean | undefined;
};

/** Props every control spreads so it's labelled, described and marked invalid. */
export type ControlProps = {
	id: string;
	name: string;
	"aria-invalid": true | undefined;
	"aria-describedby": string | undefined;
	onBlur: () => void;
};

/**
 * Accessibility wiring shared by all fields:
 * - stable ids (form id + field name) for label, description and error;
 * - errors appear once the field was blurred or a submit was attempted;
 * - `aria-invalid` and `aria-describedby` (description + error) on the control;
 * - registers the label with the form so FormErrorSummary can link to it.
 */
export function useFieldA11y(
	label: string,
	options: {
		/** Element the error summary should focus (default: the field id). Receives the field id. */
		focusId?: (fieldId: string) => string;
		extraDescribedBy?: string;
	} = {},
) {
	const field = useFieldContext<unknown>();
	const meta = useFormMeta();
	const id = fieldDomId(meta.id, field.name);
	const submissionAttempts = useStore(field.form.store, (state) => state.submissionAttempts);
	const errors = errorMessages(field.state.meta.errors);
	const visible = errors.length > 0 && (field.state.meta.isBlurred || submissionAttempts > 0);

	meta.fields.set(field.name, { label, focusId: options.focusId ? options.focusId(id) : id });

	const descriptionId = `${id}-description`;
	const errorId = `${id}-error`;
	return {
		field,
		id,
		descriptionId,
		errorId,
		errors: visible ? errors : [],
		invalid: visible,
		describedBy(hasDescription: boolean) {
			return (
				[hasDescription ? descriptionId : null, options.extraDescribedBy ?? null, visible ? errorId : null]
					.filter(Boolean)
					.join(" ") || undefined
			);
		},
	};
}

export function FieldLabelText({ label, optional }: { label: string; optional?: boolean | undefined }) {
	return (
		<>
			{label}
			{optional ? <span className="font-normal text-muted-foreground"> {m.field_optional()}</span> : null}
		</>
	);
}

export function FieldMessages({
	descriptionId,
	description,
	errorId,
	errors,
}: {
	descriptionId: string;
	description?: string | undefined;
	errorId: string;
	errors: string[];
}) {
	return (
		<>
			{description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
			{errors.length > 0 ? <FieldError id={errorId} errors={errors.map((message) => ({ message }))} /> : null}
		</>
	);
}

/**
 * Label above, control, description and errors below: the layout for text-like
 * fields. `children` receives the props the control must spread.
 */
export function FieldShell({
	label,
	description,
	optional,
	children,
	after,
}: FieldBaseProps & { children: (control: ControlProps) => ReactNode; after?: ReactNode }) {
	const a11y = useFieldA11y(label);
	const control: ControlProps = {
		id: a11y.id,
		name: a11y.field.name,
		"aria-invalid": a11y.invalid || undefined,
		"aria-describedby": a11y.describedBy(Boolean(description)),
		onBlur: a11y.field.handleBlur,
	};
	return (
		<Field data-invalid={a11y.invalid || undefined}>
			<FieldLabel htmlFor={a11y.id}>
				<FieldLabelText label={label} optional={optional} />
			</FieldLabel>
			{children(control)}
			{after}
			<FieldMessages
				descriptionId={a11y.descriptionId}
				description={description}
				errorId={a11y.errorId}
				errors={a11y.errors}
			/>
		</Field>
	);
}
