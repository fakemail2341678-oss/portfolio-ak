import { type ReactNode, useId, useRef } from "react";
import { type FieldEntry, FormMetaContext } from "./use-form-meta";

export function FormMetaProvider({ children }: { children: ReactNode }) {
	const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
	const fields = useRef(new Map<string, FieldEntry>());
	return <FormMetaContext value={{ id: `form${id}`, fields: fields.current }}>{children}</FormMetaContext>;
}

/** "tags[0].name" -> "tags-0-name": valid in id attributes and CSS selectors. */
export const fieldDomId = (formId: string, name: string) => `${formId}-${name.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
