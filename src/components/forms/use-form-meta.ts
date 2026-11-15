import { createContext, useContext, useId, useRef } from "react";

/** A mounted field as the error summary links to it. */
export type FieldEntry = { label: string; focusId: string };

type FormMeta = {
	/** Unique per rendered form, so two forms on a page never share element ids. */
	id: string;
	/** Labels and focus targets of mounted fields, for FormErrorSummary links. */
	fields: Map<string, FieldEntry>;
};

/** What <FormMetaProvider> gives a form's fields; null outside a form. */
export const FormMetaContext = createContext<FormMeta | null>(null);

/** Safe outside <form.Form> too (e.g. in tests): falls back to a local id. */
export function useFormMeta(): FormMeta {
	const meta = useContext(FormMetaContext);
	const fallbackId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
	const fallbackFields = useRef(new Map<string, FieldEntry>());
	return meta ?? { id: `form${fallbackId}`, fields: fallbackFields.current };
}
