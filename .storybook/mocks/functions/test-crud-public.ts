import { fn } from "storybook/test";
import type { PublicTestCrudDetail, PublicTestCrudPage } from "../../../src/features/test-crud/schema";
import { sampleBody, sampleImageAsset, samplePublicCard } from "../data";

// Stand-ins for src/functions/test-crud-public.ts.
export const listPublicTestCrud = fn(
	async (): Promise<PublicTestCrudPage> => ({ items: [samplePublicCard], total: 1, page: 1, pageCount: 1 }),
).mockName("listPublicTestCrud");
export const getPublicTestCrud = fn(
	async (): Promise<PublicTestCrudDetail> => ({
		...samplePublicCard,
		images: [sampleImageAsset],
		body: sampleBody,
		phone: null,
	}),
).mockName("getPublicTestCrud");
