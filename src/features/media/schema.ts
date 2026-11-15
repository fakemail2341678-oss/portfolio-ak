import { z } from "zod";
import { ALT_MAX, type ImageAsset } from "@/features/attachments/schema";
import { isoDateTime } from "@/lib/crud/schema";
import type { Paged } from "@/lib/list/paging";
import { localizedText } from "@/lib/validation";
import { MEDIA_USERS } from "./constants";

export * from "./constants";

/** Alt text of one library item, in both languages (English empty: decorative, or not described yet). */
export const mediaAltSchema = z.strictObject({ id: z.uuid(), alt: localizedText({ max: ALT_MAX, optional: true }) });
export type MediaAltInput = z.output<typeof mediaAltSchema>;

/** Where an item is used: a record that references it (deleting it is refused while there is one). */
export const mediaUsageSchema = z.object({ type: z.enum(MEDIA_USERS), id: z.string(), label: z.string() });
export type MediaUsage = z.output<typeof mediaUsageSchema>;

export const mediaItemSchema = z.object({
	id: z.string(),
	image: z.custom<ImageAsset>(),
	bytes: z.number(),
	/** The file name part of its public id, for search and display. */
	name: z.string(),
	usage: z.array(mediaUsageSchema),
	createdAt: isoDateTime(),
});
export type MediaItemDto = z.output<typeof mediaItemSchema>;
export type MediaPage = Paged<MediaItemDto>;
