import { createServerFn } from "@tanstack/react-start";
import type { __Pascal__PublicItem, __Pascal__PublicPage } from "@/features/__name__/schema";
import {
	__UPPER___PUBLIC_PAGE_SIZE,
	__camel__PublicSearchSchema,
	__camel__SlugSchema,
} from "@/features/__name__/search";
import { zodInput } from "@/functions/_lib/validator";
import { withPublicServices } from "@/middleware/services";
import * as __camel__ from "@/server/__name__/service";

/**
 * __Title__'s public reads (/__name__): no sign-in. The service only ever returns
 * published rows, and a draft looks exactly like a missing slug (NOT_FOUND).
 */
export const listPublic__Pascal__ = createServerFn({ method: "GET" })
	.middleware([withPublicServices])
	.validator(zodInput(__camel__PublicSearchSchema))
	.handler(
		({ data, context }): Promise<__Pascal__PublicPage> =>
			__camel__.listPublished(context, data, __UPPER___PUBLIC_PAGE_SIZE),
	);

export const getPublic__Pascal__ = createServerFn({ method: "GET" })
	.middleware([withPublicServices])
	.validator(zodInput(__camel__SlugSchema))
	.handler(({ data, context }): Promise<__Pascal__PublicItem> => __camel__.getPublished(context, data.slug));
