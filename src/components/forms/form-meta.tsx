import { createContext, type ReactNode, useContext, useId, useRef } from "react";

type FieldEntry = { label: string; focusId: string };

type FormMeta = {
	/** Unique per rendered form, so two forms on a page never share element ids. */
	id: string;
	/** Labels and focus targets of mounted fields, for FormErrorSummary links. */
	fields: Map<string, FieldEntry>;
};

const FormMetaContext = createContext<FormMeta | null>(null);

export function FormMetaProvider({ children }: { children: ReactNode }) {
	const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
	const fields = useRef(new Map<string, FieldEntry>());
	return <FormMetaContext value={{ id: `form${id}`, fields: fields.current }}>{children}</FormMetaContext>;
}

/** Safe outside <form.Form> too (e.g. in tests): falls back to a local id. */
export function useFormMeta(): FormMeta {
	const meta = useContext(FormMetaContext);
	const fallbackId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
	const fallbackFields = useRef(new Map<string, FieldEntry>());
	return meta ?? { id: `form${fallbackId}`, fields: fallbackFields.current };
}

/** "tags[0].name" -> "tags-0-name": valid in id attributes and CSS selectors. */
export const fieldDomId = (formId: string, name: string) => `${formId}-${name.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
