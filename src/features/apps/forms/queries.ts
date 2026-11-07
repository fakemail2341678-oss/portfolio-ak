import { mutationOptions, type QueryClient, queryOptions } from "@tanstack/react-query";
import {
	createForm,
	deleteForm,
	getForm,
	getFormResults,
	listForms,
	saveForm,
	setFormStatus,
} from "@/functions/apps/forms";
import { getPublicForm } from "@/functions/apps/forms-public";
import type { CreateFormInput, SaveFormInput, SetFormStatusInput } from "./schema";

/**
 * Forms' reads and writes (decision 0195). Keys carry the user's id, so another
 * account signing in on the same tab never sees cached forms. Writes are Query
 * mutations that refresh the user's keys; the public page's read has no user.
 */
export const formsKeys = {
	all: ["apps", "forms"] as const,
	user: (userId: string) => [...formsKeys.all, userId] as const,
	list: (userId: string) => [...formsKeys.user(userId), "list"] as const,
	form: (userId: string, id: string) => [...formsKeys.user(userId), "form", id] as const,
	results: (userId: string, id: string, page: number) => [...formsKeys.user(userId), "results", id, page] as const,
	public: (slug: string) => [...formsKeys.all, "public", slug] as const,
};

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
			mutationFn: (input: SaveFormInput) => saveForm({ data: input }),
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
