import type { z } from "zod";
import { listSchema } from "@/lib/crud/schema";
import { enumParam } from "@/lib/list/params";
import { MEDIA_KINDS, MEDIA_USAGE_FILTERS } from "./constants";

/**
 * /admin/media and the picker: search (alt text in either language, file name),
 * kind and usage. Route files import this, never ./schema.ts (0151).
 */
export const mediaList = listSchema({
	sorts: ["-uploaded", "uploaded"],
	filters: { kind: enumParam(MEDIA_KINDS, "all"), usage: enumParam(MEDIA_USAGE_FILTERS, "all") },
});
export type MediaSearch = z.output<typeof mediaList.search>;
export type MediaListInput = z.output<typeof mediaList.input>;
