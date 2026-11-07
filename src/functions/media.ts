import { createServerFn } from "@tanstack/react-start";
import { type MediaItemDto, type MediaPage, mediaAltSchema } from "@/features/media/schema";
import { mediaList } from "@/features/media/search";
import { zodInput } from "@/functions/_lib/validator";
import { bulkIdsSchema } from "@/lib/list/paging";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import * as media from "@/server/media/service";

/**
 * The media library (/admin/media, decision 0177). Uploading uses the
 * attachments functions with the "media" scope (attachments:upload and
 * media:write); these browse, describe and delete.
 */

export const listMedia = createServerFn({ method: "GET" })
	.middleware([requirePermission("media:read"), withServices])
	.validator(zodInput(mediaList.input))
	.handler(({ data, context }): Promise<MediaPage> => media.list(context, data));

export const updateMediaAlt = createServerFn({ method: "POST" })
	.middleware([requirePermission("media:write"), withServices])
	.validator(zodInput(mediaAltSchema))
	.handler(({ data, context }): Promise<MediaItemDto> => media.setAlt(context, data));

/** Deletes unused items; refuses (and deletes nothing) when one is still used. */
export const deleteMedia = createServerFn({ method: "POST" })
	.middleware([requirePermission("media:write"), withServices])
	.validator(zodInput(bulkIdsSchema()))
	.handler(({ data, context }): Promise<{ deleted: number }> => media.remove(context, data.ids));
