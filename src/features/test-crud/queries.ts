import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { Versioned } from "@/components/crud/use-crud-form";
import {
	createTestCrud,
	deleteTestCrud,
	getTestCrud,
	listTestCrud,
	listTestCrudTags,
	setTestCrudStatus,
	updateTestCrud,
} from "@/functions/test-crud";
import { getPublicTestCrud, listPublicTestCrud } from "@/functions/test-crud-public";
import { testCrudKeys } from "./keys";
import type { TestCrudInput, TestCrudStatus } from "./schema";
import type { TestCrudListInput, TestCrudPublicSearch } from "./search";

/** Reads: loaders `ensureQuery` these, components read them with useSuspenseQuery / useListPage. */

export const testCrudListQueryOptions = (input: TestCrudListInput) =>
	queryOptions({ queryKey: testCrudKeys.list(input), queryFn: () => listTestCrud({ data: input }) });

export const testCrudTagsQueryOptions = () =>
	queryOptions({ queryKey: testCrudKeys.tags(), queryFn: () => listTestCrudTags() });

export const testCrudDetailQueryOptions = (id: string) =>
	queryOptions({
		queryKey: testCrudKeys.detail(id),
		queryFn: () => getTestCrud({ data: { id } }),
		// The edit form's defaults must not change under the user while editing.
		staleTime: Number.POSITIVE_INFINITY,
	});

export const publicTestCrudListQueryOptions = (search: TestCrudPublicSearch) =>
	queryOptions({ queryKey: testCrudKeys.publicList(search), queryFn: () => listPublicTestCrud({ data: search }) });

export const publicTestCrudDetailQueryOptions = (slug: string) =>
	queryOptions({ queryKey: testCrudKeys.publicDetail(slug), queryFn: () => getPublicTestCrud({ data: { slug } }) });

/** Writes, keyed (useMutationState can find them). useCrudMutation and useCrudForm add the rest. */
export const testCrudMutations = {
	create: () =>
		mutationOptions({
			mutationKey: [...testCrudKeys.all, "create"],
			mutationFn: (input: TestCrudInput) => createTestCrud({ data: input }),
		}),
	update: () =>
		mutationOptions({
			mutationKey: [...testCrudKeys.all, "update"],
			mutationFn: (input: TestCrudInput & Versioned) => updateTestCrud({ data: input }),
		}),
	setStatus: () =>
		mutationOptions({
			mutationKey: [...testCrudKeys.all, "status"],
			mutationFn: (input: { id: string; status: TestCrudStatus }) => setTestCrudStatus({ data: input }),
		}),
	delete: () =>
		mutationOptions({
			mutationKey: [...testCrudKeys.all, "delete"],
			mutationFn: (ids: string[]) => deleteTestCrud({ data: { ids } }),
		}),
};
