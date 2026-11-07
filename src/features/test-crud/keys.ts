import { createCrudKeys } from "@/lib/crud/keys";
import type { TestCrudListInput, TestCrudPublicSearch } from "./search";

const keys = createCrudKeys<TestCrudListInput>("test-crud");

/** Test CRUD's Query keys (the shared shape, src/lib/crud/keys.ts), plus its own under `all`. */
export const testCrudKeys = {
	...keys,
	/** The tag filter's options (saving an item can add or retire tags). */
	tags: () => [...keys.all, "tags"] as const,
	/** Public reads are separate from admin ones: they only ever contain published rows. */
	publicList: (search: TestCrudPublicSearch) => [...keys.all, "public", "list", search] as const,
	publicDetail: (slug: string) => [...keys.all, "public", "detail", slug] as const,
};
