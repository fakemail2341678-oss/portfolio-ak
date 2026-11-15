import { mutationOptions, type QueryClient, queryOptions } from "@tanstack/react-query";
import {
	createForm,
	deleteForm,
	getForm,
	getFormResults,
	listForms,
	setFormStatus,
	updateForm,
} from "@/functions/apps/forms";
import { getPublicForm } from "@/functions/apps/forms-public";
import { formsKeys } from "./keys";
import type { CreateFormInput, SaveFormInput, SetFormStatusInput } from "./schema";

export const formsListQueryOptions = (userId: string) =>
	queryOptions({ queryKey: formsKeys.list(userId), queryFn: () => listForms() });

export const formQueryOptions = (userId: string, id: string) =>
	queryOptions({ queryKey: formsKeys.form(userId, id), queryFn: () => getForm({ data: { id } }) });

export const formResultsQueryOptions = (userId: string, id: string, page: number) =>
	queryOptions({
		queryKey: formsKeys.results(userId, id, page),
		queryFn: () => getFormResults({ data: { id, page } }),
	});

export const publicFormQueryOptions = (slug: string) =>
	queryOptions({ queryKey: formsKeys.public(slug), queryFn: () => getPublicForm({ data: { slug } }) });

const refresh = (queryClient: QueryClient, userId: string) =>
	queryClient.invalidateQueries({ queryKey: formsKeys.user(userId) });

export const formMutations = {
	create: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (input: CreateFormInput) => createForm({ data: input }),
			onSettled: () => refresh(queryClient, userId),
		}),
	/** The builder's save: the answer is the saved form, put in its query (the next save starts from its version). */
	save: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (input: SaveFormInput) => updateForm({ data: input }),
			onSuccess: (form) => queryClient.setQueryData(formsKeys.form(userId, form.id), form),
			onSettled: () => queryClient.invalidateQueries({ queryKey: formsKeys.list(userId) }),
		}),
	status: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (input: SetFormStatusInput) => setFormStatus({ data: input }),
			onSettled: () => refresh(queryClient, userId),
		}),
	/** Refreshes the list only: the form's own page, if still on screen, would refetch a 404. */
	delete: (queryClient: QueryClient, userId: string) =>
		mutationOptions({
			mutationFn: (id: string) => deleteForm({ data: { id } }),
			onSettled: () => queryClient.invalidateQueries({ queryKey: formsKeys.list(userId) }),
		}),
};
