import { createCrudKeys } from "@/lib/crud/keys";
import type { __Pascal__ListInput{{#public}}, __Pascal__PublicSearch{{/public}} } from "./search";

{{#public}}
const keys = createCrudKeys<__Pascal__ListInput>("__name__");

/** __Title__'s Query keys (the shared shape, src/lib/crud/keys.ts), plus the public reads under `all`. */
export const __camel__Keys = {
	...keys,
	/** Public reads are separate from admin ones: they only ever contain published rows. */
	publicList: (search: __Pascal__PublicSearch) => [...keys.all, "public", "list", search] as const,
	publicDetail: (slug: string) => [...keys.all, "public", "detail", slug] as const,
};
{{/public}}
{{^public}}
/** __Title__'s Query keys (the shared shape, src/lib/crud/keys.ts). */
export const __camel__Keys = createCrudKeys<__Pascal__ListInput>("__name__");
{{/public}}
