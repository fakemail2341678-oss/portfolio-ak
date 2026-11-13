import { formOptions } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDownIcon, ArrowUpIcon, Trash2Icon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { errorMessage } from "@/components/errors/error-page";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { kharchaMutations } from "../queries";
import { SAVED_SEARCH_NAME_MAX } from "../schema";
import type { SavedSearch } from "../types";
import { BUILT_IN_SEARCHES } from "./searches";

/**
 * Saved searches' dialogs (Task 93, loaded with the first one opened): saving the search
 * on screen under a name, and the caller's list of them: rename in place, move up or down
 * (the buttons, or Alt with an arrow on a row), delete. The built-in ones aren't listed:
 * they aren't the caller's to change.
 */
export default function SavedSearchDialogs({
	userId,
	dialog,
	query,
	searches,
	onClose,
}: {
	userId: string;
	dialog: "save" | "manage";
	query: string;
	searches: ReadonlyArray<SavedSearch>;
	onClose: () => void;
}) {
	return dialog === "save" ? (
		<SaveDialog userId={userId} query={query} onClose={onClose} />
	) : (
		<ManageDialog userId={userId} searches={searches} onClose={onClose} />
	);
}

const nameSchema = z.object({ name: required({ max: SAVED_SEARCH_NAME_MAX }) });

function SaveDialog({ userId, query, onClose }: { userId: string; query: string; onClose: () => void }) {
	const queryClient = useQueryClient();
	const save = useMutation(kharchaMutations.saveSearch(queryClient, userId));
	const form = useAppForm({
		...formOptions({
			defaultValues: { name: query.slice(0, SAVED_SEARCH_NAME_MAX) },
			validators: formValidators(nameSchema),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				await save.mutateAsync({ name: value.name.trim(), query });
				toast.success(m.kharcha_search_saved());
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	return (
		<form.AppForm>
			<FormDialog
				title={m.kharcha_search_save_title()}
				description={m.kharcha_search_save_description({ query })}
				submitLabel={m.kharcha_save()}
				onClose={onClose}
				data-testid="kharcha-save-search-dialog"
			>
				<form.AppField name="name">
					{(field) => (
						<field.TextField label={m.kharcha_field_name()} maxLength={SAVED_SEARCH_NAME_MAX} autoComplete="off" />
					)}
				</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}

function ManageDialog({
	userId,
	searches,
	onClose,
}: {
	userId: string;
	searches: ReadonlyArray<SavedSearch>;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const reorder = useMutation(kharchaMutations.reorderSearches(queryClient, userId));
	const remove = useMutation(kharchaMutations.deleteSearch(queryClient, userId));
	const [announce, setAnnounce] = useState("");
	const move = async (index: number, by: -1 | 1) => {
		const target = index + by;
		const search = searches[index];
		if (!search || target < 0 || target >= searches.length) return;
		const ids = searches.map((each) => each.id);
		ids.splice(index, 1);
		ids.splice(target, 0, search.id);
		try {
			await reorder.mutateAsync(ids);
			setAnnounce(
				m.kharcha_search_moved({ name: search.name, position: String(target + 1), count: String(searches.length) }),
			);
			// The row keeps the focus where it went.
			requestAnimationFrame(() => document.getElementById(`kh-search-${search.id}`)?.focus());
		} catch (error) {
			toast.error(errorMessage(error));
		}
	};
	const drop = async (search: SavedSearch) => {
		try {
			await remove.mutateAsync(search.id);
			toast.success(m.kharcha_search_deleted({ name: search.name }));
		} catch (error) {
			toast.error(errorMessage(error));
		}
	};
	return (
		<Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
			<DialogContent data-testid="kharcha-manage-searches">
				<DialogHeader>
					<DialogTitle>{m.kharcha_spend_manage()}</DialogTitle>
					<DialogDescription>
						{m.kharcha_search_manage_description({
							builtIn: BUILT_IN_SEARCHES.map((each) => each.label()).join(", "),
						})}
					</DialogDescription>
				</DialogHeader>
				<p className="sr-only" aria-live="polite">
					{announce}
				</p>
				{searches.length === 0 ? (
					<p className="text-kh-muted text-sm">{m.kharcha_search_none()}</p>
				) : (
					<ol className="flex flex-col gap-2">
						{searches.map((search, index) => (
							<li
								key={search.id}
								id={`kh-search-${search.id}`}
								// biome-ignore lint/a11y/noNoninteractiveTabindex: a row is a tab stop so Alt+arrows can move it.
								tabIndex={0}
								aria-label={m.kharcha_search_row({ name: search.name, query: search.query })}
								onKeyDown={(event) => {
									if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
									event.preventDefault();
									void move(index, event.key === "ArrowUp" ? -1 : 1);
								}}
								className="flex flex-wrap items-center gap-2 rounded-md border border-kh-hair p-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
								data-testid="kharcha-saved-search"
							>
								<RenameField userId={userId} search={search} />
								<code className="kh-figures min-w-0 flex-1 basis-full truncate text-kh-muted text-xs sm:basis-auto">
									{search.query}
								</code>
								<div className="ms-auto flex items-center gap-1">
									<Button
										variant="ghost"
										size="icon"
										disabled={index === 0 || reorder.isPending}
										onClick={() => void move(index, -1)}
									>
										<ArrowUpIcon aria-hidden />
										<span className="sr-only">{m.kharcha_search_move_up({ name: search.name })}</span>
									</Button>
									<Button
										variant="ghost"
										size="icon"
										disabled={index === searches.length - 1 || reorder.isPending}
										onClick={() => void move(index, 1)}
									>
										<ArrowDownIcon aria-hidden />
										<span className="sr-only">{m.kharcha_search_move_down({ name: search.name })}</span>
									</Button>
									<Button variant="ghost" size="icon" disabled={remove.isPending} onClick={() => void drop(search)}>
										<Trash2Icon aria-hidden />
										<span className="sr-only">{m.kharcha_search_delete({ name: search.name })}</span>
									</Button>
								</div>
							</li>
						))}
					</ol>
				)}
				<p className="text-kh-muted text-xs">{m.kharcha_search_keys_hint()}</p>
			</DialogContent>
		</Dialog>
	);
}

/** A saved search's name, renamed in place: Enter or leaving the field saves a change. */
function RenameField({ userId, search }: { userId: string; search: SavedSearch }) {
	const queryClient = useQueryClient();
	const rename = useMutation(kharchaMutations.renameSearch(queryClient, userId));
	const id = useId();
	const commit = async (input: HTMLInputElement) => {
		const name = input.value.trim();
		if (name === "" || name === search.name) {
			input.value = search.name;
			return;
		}
		try {
			await rename.mutateAsync({ id: search.id, name });
			toast.success(m.kharcha_search_renamed());
		} catch (error) {
			input.value = search.name;
			toast.error(errorMessage(error));
		}
	};
	return (
		<>
			<label htmlFor={id} className="sr-only">
				{m.kharcha_search_rename({ name: search.name })}
			</label>
			<Input
				id={id}
				defaultValue={search.name}
				maxLength={SAVED_SEARCH_NAME_MAX}
				className="h-8 w-44"
				onBlur={(event) => void commit(event.currentTarget)}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						void commit(event.currentTarget);
					}
				}}
			/>
		</>
	);
}
