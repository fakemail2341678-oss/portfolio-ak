import type { AnyFieldApi, AnyFormApi } from "@tanstack/react-form";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { isStaleError } from "@/lib/concurrency";
import { isAppError } from "@/lib/errors";

/**
 * Shows an AppError's per-field errors (e.g. CONFLICT on `slug`, BAD_REQUEST on
 * `image`) on the matching fields, under the `onServer` validation key. They
 * appear in the field and in FormErrorSummary like client errors. Returns false
 * when the error has no field errors (show a toast instead). Keys starting with
 * "_" aren't fields (`_form` is the message for the whole action, see errorMessage).
 */
export function applyServerFieldErrors(form: AnyFormApi, error: unknown): boolean {
	if (!isAppError(error) || !error.fieldErrors) return false;
	const entries = Object.entries(error.fieldErrors).filter(([field]) => !field.startsWith("_"));
	for (const [field, messages] of entries) {
		form.setFieldMeta(field, (meta) => ({
			...meta,
			isBlurred: true,
			errorMap: { ...meta.errorMap, onServer: messages.join(" ") },
		}));
	}
	return entries.length > 0;
}

/**
 * A form's failed save: a stale CONFLICT calls `onStale` (show StaleVersionAlert),
 * field errors go on their fields, anything else is a toast.
 */
export function handleSaveError(form: AnyFormApi, error: unknown, onStale?: () => void) {
	if (onStale && isStaleError(error)) onStale();
	else if (!applyServerFieldErrors(form, error)) toast.error(errorMessage(error));
}

/** The errors a change makes stale: the server's, and those of the last submit and blur. */
const STALE_ON_CHANGE = ["onServer", "onSubmit", "onBlur"] as const;

/**
 * Form `listeners.onChange`: editing a field clears the errors shown on it that the edit
 * made stale: the server's, and the last submit's and blur's. The change validator has
 * just checked the field again, so what it found is what shows. Without this, a field
 * fixed after a failed submit kept its message until it lost focus, and the message
 * leaving moved the page between the press and the release of the next click (the
 * click on Send was lost).
 */
export const clearServerErrorOnChange = ({ fieldApi }: { fieldApi: AnyFieldApi }) => {
	const { errorMap } = fieldApi.state.meta;
	if (STALE_ON_CHANGE.every((key) => errorMap[key] === undefined)) return;
	fieldApi.setMeta((meta) => ({
		...meta,
		errorMap: { ...meta.errorMap, onServer: undefined, onSubmit: undefined, onBlur: undefined },
	}));
};
