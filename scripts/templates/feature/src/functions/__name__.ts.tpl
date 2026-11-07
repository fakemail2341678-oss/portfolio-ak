import { createServerFn } from "@tanstack/react-start";
import {
	type __Pascal__Detail,
	type __Pascal__Page,
	__camel__InputSchema,
{{#public}}
	__camel__SlugCheckSchema,
{{/public}}
	__camel__UpdateSchema,
} from "@/features/__name__/schema";
import { __camel__List } from "@/features/__name__/search";
import { zodInput } from "@/functions/_lib/validator";
import { idSchema } from "@/lib/crud/schema";
import { bulkIdsSchema } from "@/lib/list/paging";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import * as __camel__ from "@/server/__name__/service";

/**
 * __Title__ admin server functions: the permission check first, the input
 * validated with the shared schema, then one call into the service.
 */

export const list__Pascal__ = createServerFn({ method: "GET" })
	.middleware([requirePermission("__name__:read"), withServices])
	.validator(zodInput(__camel__List.input))
	.handler(({ data, context }): Promise<__Pascal__Page> => __camel__.list(context, data));

export const get__Pascal__ = createServerFn({ method: "GET" })
	.middleware([requirePermission("__name__:read"), withServices])
	.validator(zodInput(idSchema))
	.handler(({ data, context }): Promise<__Pascal__Detail> => __camel__.get(context, data.id));
{{#public}}

/** Whether a slug is free (the form's SlugField checks while typing; saving checks again). */
export const is__Pascal__SlugFree = createServerFn({ method: "GET" })
	.middleware([requirePermission("__name__:read"), withServices])
	.validator(zodInput(__camel__SlugCheckSchema))
	.handler(({ data, context }): Promise<boolean> => __camel__.isSlugFree(context, data));
{{/public}}

export const create__Pascal__ = createServerFn({ method: "POST" })
	.middleware([requirePermission("__name__:create"), withServices])
	.validator(zodInput(__camel__InputSchema))
	.handler(({ data, context }): Promise<__Pascal__Detail> => __camel__.create(context, data));

export const update__Pascal__ = createServerFn({ method: "POST" })
	.middleware([requirePermission("__name__:update"), withServices])
	.validator(zodInput(__camel__UpdateSchema))
	.handler(({ data, context }): Promise<__Pascal__Detail> => __camel__.update(context, data));

/** Deletes one or many (bulk delete). Missing ids are ignored; returns how many were deleted. */
export const delete__Pascal__ = createServerFn({ method: "POST" })
	.middleware([requirePermission("__name__:delete"), withServices])
	.validator(zodInput(bulkIdsSchema()))
	.handler(({ data, context }): Promise<{ deleted: number }> => __camel__.remove(context, data.ids));
