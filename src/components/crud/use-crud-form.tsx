import type { AnyFormApi } from "@tanstack/react-form";
import { type QueryKey, type UseMutationOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { type ComponentType, type PropsWithChildren, type ReactNode, useRef, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { handleSaveError, StaleVersionAlert, UnsavedChangesGuard } from "@/components/forms";
import { useFormContext } from "@/components/forms/contexts";
import { Form, FormErrorSummary } from "@/components/forms/form-components";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

/** A saved record as edit forms see it: which one, and the version the edit starts from (0122). */
export type Versioned = { id: string; updatedAt: string };

/** An edit form's React key: another record, or a newer version of this one (after "Reload"), remounts it with fresh defaults. */
export const crudFormKey = (item: Versioned | undefined) => (item ? `${item.id}@${item.updatedAt}` : "new");

/**
 * Everything around a create or edit form that isn't its fields (docs/guides/crud.md):
 * the save through the feature's mutations, server field errors on their fields,
 * the stale-version check with its "Reload", the unsaved-changes guard, the
 * success toast and the refresh of the lists. The form itself stays the
 * feature's `useAppForm` over its `formOptions`, so its type is exact (and
 * `withForm` sections of it type-check):
 *
 *   const crud = useCrudForm({
 *     item, toInput: (values) => projectInputSchema.parse(values),
 *     create: projectMutations.create(), update: projectMutations.update(),
 *     invalidate: [projectKeys.all], reload: item && projectKeys.detail(item.id),
 *     onSaved: () => navigate({ to: "/admin/projects" }),
 *   });
 *   const form = useAppForm({ ...projectFormOptions(item), ...crud.formProps });
 *   return <CrudForm form={form} crud={crud}>…fields, StickyFormBar…</CrudForm>;   // rendered with key={crudFormKey(item)}
 */
export function useCrudForm<TValues, TInput, TItem extends Versioned, TCreated, TUpdated>({
	item,
	toInput,
	create,
	update,
	invalidate,
	reload,
	onSaved,
	messages,
}: {
	/** The record being edited; absent for a new one. */
	item?: TItem | undefined;
	/** Form values -> the server input (the same schema the server validates with). */
	toInput: (values: TValues) => TInput;
	/** The feature's mutationOptions (queries.ts). An edit sends the input plus the item's id and version. */
	create?: UseMutationOptions<TCreated, Error, TInput>;
	update?: UseMutationOptions<TUpdated, Error, TInput & Versioned>;
	/** Refreshed after a save: usually the feature's `keys.all`. */
	invalidate: ReadonlyArray<QueryKey>;
	/** What "Reload" refetches after a stale save: the record's query key (its new version re-keys the form, crudFormKey). */
	reload?: QueryKey | undefined;
	/** After the save and its toast: go back to the list, close the dialog. */
	onSaved?: (saved: TCreated | TUpdated) => unknown;
	/** The success toasts (default "Created." / "Changes saved."), given what was sent. */
	messages?: { created?: (input: TInput) => string; saved?: (input: TInput) => string };
}) {
	const queryClient = useQueryClient();
	const saved = useRef(false);
	const [stale, setStale] = useState(false);
	const creating = useMutation(create ?? { mutationFn: unsupported });
	const updating = useMutation(update ?? { mutationFn: unsupported });

	const onSubmit = async ({ value, formApi }: { value: TValues; formApi: AnyFormApi }) => {
		try {
			const input = toInput(value);
			const result = item
				? await updating.mutateAsync({ ...input, id: item.id, updatedAt: item.updatedAt })
				: await creating.mutateAsync(input);
			saved.current = true;
			const message = item ? messages?.saved : messages?.created;
			toast.success(message ? message(input) : item ? m.crud_toast_saved() : m.crud_toast_created());
			// First leave (the edit page's own query is then inactive and isn't refetched), then refresh.
			await onSaved?.(result);
			await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
		} catch (error) {
			handleSaveError(formApi, error, item ? () => setStale(true) : undefined);
		}
	};

	return {
		/** Spread into useAppForm: the submit (useAppForm clears a field's stale errors on change). */
		formProps: { onSubmit },
		/** Set after a stale save: what StaleVersionAlert's "Reload" runs. */
		stale:
			stale && reload
				? async () => {
						try {
							await queryClient.refetchQueries({ queryKey: reload, type: "active" }, { throwOnError: true });
						} catch (error) {
							toast.error(errorMessage(error));
						}
					}
				: undefined,
		/** True once saved: leaving is then fine. */
		saved: () => saved.current,
	};
}

export type CrudFormState = Pick<ReturnType<typeof useCrudForm>, "stale" | "saved">;

const unsupported = async (): Promise<never> => {
	throw new Error("useCrudForm: this form has no mutation for that kind of save");
};

/** Asks before leaving with unsaved edits; needs the form's context. */
function Guard({ saved }: { saved: () => boolean }) {
	const form = useFormContext();
	return <UnsavedChangesGuard when={() => !saved() && !form.state.isDefaultValue} />;
}

/**
 * A create or edit form on its own page: the unsaved-changes guard, the <form>,
 * the stale alert and the error summary around the fields. In a dialog, render
 * FormDialog inside `form.AppForm` instead and pass it `crud.stale`.
 */
export function CrudForm({
	form,
	crud,
	className,
	children,
	"data-testid": testId,
}: {
	form: { AppForm: ComponentType<PropsWithChildren> };
	crud: CrudFormState;
	className?: string;
	children: ReactNode;
	"data-testid"?: string;
}) {
	return (
		<form.AppForm>
			<Guard saved={crud.saved} />
			<Form className={cn("max-w-3xl", className)} data-testid={testId}>
				{crud.stale ? <StaleVersionAlert onReload={crud.stale} /> : null}
				<FormErrorSummary />
				{children}
			</Form>
		</form.AppForm>
	);
}
