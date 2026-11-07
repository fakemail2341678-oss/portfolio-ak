import { createCrudKeys } from "@/lib/crud/keys";
import type { LinkModerationInput } from "./search";

/** /admin/links' Query keys (the shared shape, src/lib/crud/keys.ts). */
export const linkModerationKeys = createCrudKeys<LinkModerationInput>("admin-links");
