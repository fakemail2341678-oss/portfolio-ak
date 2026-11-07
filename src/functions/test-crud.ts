import { createServerFn } from "@tanstack/react-start";
import {
	type TestCrudDetail,
	type TestCrudListItem,
	type TestCrudPage,
	testCrudInputSchema,
	testCrudSlugCheckSchema,
	testCrudStatusUpdateSchema,
	testCrudUpdateSchema,
} from "@/features/test-crud/schema";
import { testCrudList } from "@/features/test-crud/search";
import { zodInput } from "@/functions/_lib/validator";
import { idSchema } from "@/lib/crud/schema";
import { bulkIdsSchema } from "@/lib/list/paging";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import * as testCrud from "@/server/test-crud/service";

/**
 * Test CRUD admin server functions: the permission check first (anonymous calls
 * get UNAUTHORIZED, users without it FORBIDDEN, whatever the UI shows), the
 * input validated with the shared schema, then one call into the service.
 * Images are attachment ids (uploaded beforehand, straight to Cloudinary).
 */

export const listTestCrud = createServerFn({ method: "GET" })
	.middleware([requirePermission("test-crud:read"), withServices])
	.validator(zodInput(testCrudList.input))
	.handler(({ data, context }): Promise<TestCrudPage> => testCrud.list(context, data));

/** Tags in use, for the list's tag filter. */
export const listTestCrudTags = createServerFn({ method: "GET" })
	.middleware([requirePermission("test-crud:read"), withServices])
	.handler(({ context }): Promise<string[]> => testCrud.listTags(context));

export const getTestCrud = createServerFn({ method: "GET" })
	.middleware([requirePermission("test-crud:read"), withServices])
	.validator(zodInput(idSchema))
	.handler(({ data, context }): Promise<TestCrudDetail> => testCrud.get(context, data.id));

/** Whether a slug is free (the form's SlugField checks while typing; saving checks again). */
export const isTestCrudSlugFree = createServerFn({ method: "GET" })
	.middleware([requirePermission("test-crud:read"), withServices])
	.validator(zodInput(testCrudSlugCheckSchema))
	.handler(({ data, context }): Promise<boolean> => testCrud.isSlugFree(context, data));

export const createTestCrud = createServerFn({ method: "POST" })
	.middleware([requirePermission("test-crud:create"), withServices])
	.validator(zodInput(testCrudInputSchema))
	.handler(({ data, context }): Promise<TestCrudDetail> => testCrud.create(context, data));

export const updateTestCrud = createServerFn({ method: "POST" })
	.middleware([requirePermission("test-crud:update"), withServices])
	.validator(zodInput(testCrudUpdateSchema))
	.handler(({ data, context }): Promise<TestCrudDetail> => testCrud.update(context, data));

export const setTestCrudStatus = createServerFn({ method: "POST" })
	.middleware([requirePermission("test-crud:publish"), withServices])
	.validator(zodInput(testCrudStatusUpdateSchema))
	.handler(({ data, context }): Promise<TestCrudListItem> => testCrud.setStatus(context, data));

/** Deletes one or many (bulk delete). Missing ids are ignored; returns how many were deleted. */
export const deleteTestCrud = createServerFn({ method: "POST" })
	.middleware([requirePermission("test-crud:delete"), withServices])
	.validator(zodInput(bulkIdsSchema()))
	.handler(({ data, context }): Promise<{ deleted: number }> => testCrud.remove(context, data.ids));
