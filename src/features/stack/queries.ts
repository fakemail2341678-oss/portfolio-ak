import { queryOptions } from "@tanstack/react-query";
import { listStack } from "@/functions/stack";
import { stackKeys } from "./keys";
import type { StackSearch } from "./schema";

export const stackListQueryOptions = (search: StackSearch) =>
	queryOptions({
		queryKey: stackKeys.list(search),
		queryFn: () => listStack({ data: search }),
	});
