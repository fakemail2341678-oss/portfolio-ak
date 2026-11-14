import { crudCollection } from "@/lib/crud/collection";
import { linkModerationKeys } from "./keys";
import type { LinkModerationItem } from "./schema";

/** The moderation list's rows as a TanStack DB collection (docs/guides/crud.md, "Writes"). */
export const linkModerationRows = crudCollection<LinkModerationItem>("links-moderation", linkModerationKeys.lists());
