import { useOptionalDbClient } from "@tanstack/react-db";
import { type QueryKey, type UseMutationOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { isStaleError } from "@/lib/concurrency";
import { m } from "@/paraglide/messages";

/**
 * Every write of the admin, one way (docs/guides/crud.md, decisions 0173 and 0294): the
 * feature's `mutationOptions` (queries.ts: a key and the server function) plus the
 * shared behaviour around it:
 *
 * - `optimistic`: changes the list's TanStack DB collection before the server answers
 *   (`deleteRows`, `updateRows`, or the collection's own `update`/`delete`). It runs in
 *   a DB transaction that lasts as long as the write: the rows show the change on every
 *   page at once, and DB puts them back if the server refuses;
 * - afterwards, success or not, invalidates `invalidate` (usually `[keys.all]`), so
 *   totals, other pages and filter options refresh from the server. The transaction ends
 *   after that read, so the rows never flick back to their old state in between;
 * - a failure is a toast ("nothing was changed", with the reason); a stale CONFLICT
 *   offers to reload instead.
 *
 *   const rows = useCrudCollection(projectRows);
 *   const remove = useCrudMutation(projectMutations.delete(), {
 *     invalidate: [projectKeys.all],
 *     optimistic: (ids) => deleteRows(rows, ids),
 *   });
 *   remove.mutate(ids, { onSuccess: () => toast.success(…) });
 *
 * Forms don't use it: their failures go on the fields (useCrudForm).
 */
export function useCrudMutation<TData, TVariables>(
	options: Omit<UseMutationOptions<TData, Error, TVariables>, "onMutate" | "onError" | "onSettled">,
	{
		invalidate,
		optimistic,
	}: {
		invalidate: ReadonlyArray<QueryKey>;
		/** Changes the list's collection as the write will; needs `<DbScope>` above (the admin layout). */
		optimistic?: (variables: TVariables) => void;
	},
) {
	const queryClient = useQueryClient();
	const db = useOptionalDbClient();
	const refresh = () => Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
	const write = options.mutationFn;
	return useMutation({
		...options,
		mutationFn: async (variables, context) => {
			if (!write) throw new Error("useCrudMutation: the mutation options have no mutationFn");
			const transaction = optimistic ? begin(db, () => optimistic(variables)) : undefined;
			try {
				const data = await write(variables, context);
				// Awaited, so `mutateAsync` (and a call's own onSuccess) wait for the fresh lists,
				// and the optimistic rows are dropped only once the server's rows are there.
				await refresh();
				transaction?.keep();
				return data;
			} catch (error) {
				transaction?.undo(error);
				await refresh();
				throw error;
			}
		},
		onError: (error) => {
			if (isStaleError(error)) {
				toast.error(m.form_stale_title(), {
					description: errorMessage(error),
					action: { label: m.form_stale_reload(), onClick: () => void refresh() },
				});
			} else {
				toast.error(m.common_toast_failed(), { description: errorMessage(error) });
			}
		},
	});
}

/**
 * A DB transaction around one write: `change` is applied at once, and stays until the
 * write settles (`keep`: the server's rows replace it; `undo`: DB rolls it back). The
 * server call isn't the transaction's `mutationFn` itself, because a transaction that
 * changed no row (the row isn't on a cached page) never calls it.
 */
function begin(db: ReturnType<typeof useOptionalDbClient>, change: () => void) {
	if (!db) throw new Error("useCrudMutation: an optimistic write needs <DbScope> above it");
	let keep = () => {};
	let undo = (_error: unknown) => {};
	const settled = new Promise<void>((resolve, reject) => {
		keep = resolve;
		undo = reject;
	});
	// A write nobody awaits must not become an unhandled rejection.
	settled.catch(() => undefined);
	const transaction = db.createTransaction({ autoCommit: false, mutationFn: () => settled });
	transaction.when("settled").catch(() => undefined);
	try {
		transaction.mutate(change);
	} catch (error) {
		transaction.rollback();
		throw error;
	}
	void transaction.commit().catch(() => undefined);
	return { keep, undo };
}
