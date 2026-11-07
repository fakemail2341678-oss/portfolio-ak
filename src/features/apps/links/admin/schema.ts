import { z } from "zod";
import type { Paged } from "@/lib/list/paging";
import type { LinkItem } from "../types";

export type { LinkModerationInput } from "./search";

/** One row of /admin/links: the link and who owns it. */
export type LinkModerationItem = LinkItem & { owner: { name: string; email: string; guest: boolean } };
export type LinkModerationPage = Paged<LinkModerationItem>;

/** Block or unblock, or delete, up to 100 links at once. */
const ids = z.array(z.uuid()).min(1).max(100);
export const blockLinksInput = z.strictObject({ ids, blocked: z.boolean() });
export const deleteLinksInput = z.strictObject({ ids });
export type BlockLinksInput = z.infer<typeof blockLinksInput>;
