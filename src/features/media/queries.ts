import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { deleteMedia, listMedia, updateMediaAlt } from "@/functions/media";
import { mediaKeys } from "./keys";
import type { MediaAltInput } from "./schema";
import type { MediaListInput } from "./search";

export const mediaListQueryOptions = (input: MediaListInput) =>
	queryOptions({ queryKey: mediaKeys.list(input), queryFn: () => listMedia({ data: input }) });

export const mediaMutations = {
	setAlt: () =>
		mutationOptions({
			mutationKey: [...mediaKeys.all, "alt"],
			mutationFn: (input: MediaAltInput) => updateMediaAlt({ data: input }),
		}),
	delete: () =>
		mutationOptions({
			mutationKey: [...mediaKeys.all, "delete"],
			mutationFn: (ids: string[]) => deleteMedia({ data: { ids } }),
		}),
};
