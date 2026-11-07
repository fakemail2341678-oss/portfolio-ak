import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { Versioned } from "@/components/crud/use-crud-form";
import { create__Pascal__, delete__Pascal__, get__Pascal__, list__Pascal__, update__Pascal__ } from "@/functions/__name__";
{{#public}}
import { getPublic__Pascal__, listPublic__Pascal__ } from "@/functions/__name__-public";
{{/public}}
import { __camel__Keys } from "./keys";
import type { __Pascal__Input } from "./schema";
import type { __Pascal__ListInput{{#public}}, __Pascal__PublicSearch{{/public}} } from "./search";

/** Reads: loaders `ensureQuery` these, components read them with useSuspenseQuery / useListPage. */

export const __camel__ListQueryOptions = (input: __Pascal__ListInput) =>
	queryOptions({ queryKey: __camel__Keys.list(input), queryFn: () => list__Pascal__({ data: input }) });

export const __camel__DetailQueryOptions = (id: string) =>
	queryOptions({
		queryKey: __camel__Keys.detail(id),
		queryFn: () => get__Pascal__({ data: { id } }),
		// The edit form's defaults must not change under the user while editing.
		staleTime: Number.POSITIVE_INFINITY,
	});
{{#public}}

export const public__Pascal__ListQueryOptions = (search: __Pascal__PublicSearch) =>
	queryOptions({ queryKey: __camel__Keys.publicList(search), queryFn: () => listPublic__Pascal__({ data: search }) });

export const public__Pascal__DetailQueryOptions = (slug: string) =>
	queryOptions({ queryKey: __camel__Keys.publicDetail(slug), queryFn: () => getPublic__Pascal__({ data: { slug } }) });
{{/public}}

/** Writes, keyed (useMutationState can find them). useCrudMutation and useCrudForm add the rest. */
export const __camel__Mutations = {
	create: () =>
		mutationOptions({
			mutationKey: [...__camel__Keys.all, "create"],
			mutationFn: (input: __Pascal__Input) => create__Pascal__({ data: input }),
		}),
	update: () =>
		mutationOptions({
			mutationKey: [...__camel__Keys.all, "update"],
			mutationFn: (input: __Pascal__Input & Versioned) => update__Pascal__({ data: input }),
		}),
	delete: () =>
		mutationOptions({
			mutationKey: [...__camel__Keys.all, "delete"],
			mutationFn: (ids: string[]) => delete__Pascal__({ data: { ids } }),
		}),
};
