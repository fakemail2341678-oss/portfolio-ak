import { createServerFn } from "@tanstack/react-start";
import type { PublicTestCrudDetail, PublicTestCrudPage } from "@/features/test-crud/schema";
import {
	TEST_CRUD_PUBLIC_PAGE_SIZE,
	testCrudPublicSearchSchema,
	testCrudSlugParamSchema,
} from "@/features/test-crud/search";
import { zodInput } from "@/functions/_lib/validator";
import { devOnlyMiddleware } from "@/middleware/dev";
import { withPublicServices } from "@/middleware/services";
import * as testCrud from "@/server/test-crud/service";

/**
 * Public Test CRUD reads for the /dev/test-crud reference pages (dev-only, like
 * the pages). No auth: the service only ever returns published rows, and a
 * draft looks exactly like a missing slug (NOT_FOUND).
 */
export const listPublicTestCrud = createServerFn({ method: "GET" })
	.middleware([devOnlyMiddleware, withPublicServices])
	.validator(zodInput(testCrudPublicSearchSchema))
	.handler(
		({ data, context }): Promise<PublicTestCrudPage> =>
			testCrud.listPublished(context, data, TEST_CRUD_PUBLIC_PAGE_SIZE),
	);

export const getPublicTestCrud = createServerFn({ method: "GET" })
	.middleware([devOnlyMiddleware, withPublicServices])
	.validator(zodInput(testCrudSlugParamSchema))
	.handler(({ data, context }): Promise<PublicTestCrudDetail> => testCrud.getPublished(context, data.slug));
