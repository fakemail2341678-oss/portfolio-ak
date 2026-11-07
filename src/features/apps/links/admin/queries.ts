import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { deleteModeratedLinks, listLinksForModeration, setLinksBlocked } from "@/functions/apps/links-admin";
import { linkModerationKeys } from "./keys";
import type { BlockLinksInput } from "./schema";
import type { LinkModerationInput } from "./search";

export const linkModerationQueryOptions = (input: LinkModerationInput) =>
	queryOptions({ queryKey: linkModerationKeys.list(input), queryFn: () => listLinksForModeration({ data: input }) });

/** Writes, keyed (useMutationState can find them). useCrudMutation adds the rest. */
export const linkModerationMutations = {
	block: () =>
		mutationOptions({
			mutationKey: [...linkModerationKeys.all, "block"],
			mutationFn: (input: BlockLinksInput) => setLinksBlocked({ data: input }),
		}),
	delete: () =>
		mutationOptions({
			mutationKey: [...linkModerationKeys.all, "delete"],
			mutationFn: (ids: string[]) => deleteModeratedLinks({ data: { ids } }),
		}),
};
