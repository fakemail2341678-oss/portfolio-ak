import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { disconnectChaal, getChaalConnection } from "@/functions/chaal/connection";
import { getChaalStatus } from "@/functions/chaal/status";
import { chaalKeys } from "./keys";

/** Reads: loaders `ensureQuery` these (imported with `await import()`, 0194), components read them. */

export const chaalStatusQueryOptions = () =>
	queryOptions({ queryKey: chaalKeys.status(), queryFn: () => getChaalStatus() });

export const chaalConnectionQueryOptions = () =>
	queryOptions({ queryKey: chaalKeys.connection(), queryFn: () => getChaalConnection() });

export const disconnectChaalMutationOptions = () =>
	mutationOptions({ mutationKey: [...chaalKeys.connection(), "disconnect"], mutationFn: () => disconnectChaal() });
