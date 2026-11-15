import { useStore } from "@tanstack/react-form";
import { useFieldContext } from "./contexts";
import { fieldDomId } from "./form-meta";
import { useFormMeta } from "./use-form-meta";

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
