import { formOptions } from "@tanstack/react-form";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, Globe2Icon, LockIcon, Trash2Icon } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { CrudForm, crudFormKey, useCrudForm } from "@/components/crud/use-crud-form";
import { CopyButton } from "@/components/data-display/copy-button";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { formValidators, useAppForm } from "@/components/forms";
import { FormSection, StickyFormBar } from "@/components/page/form-layout";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageGalleryField } from "@/features/attachments/components/image-gallery-field";
import { deleteNote } from "@/functions/apps/notes";
import { absoluteUrl } from "@/lib/seo";
import { m } from "@/paraglide/messages";
import { noteMutations, noteQueryOptions, notesKeys } from "../queries";
import { NOTE_TAG_LENGTH, NOTE_TAGS_MAX, NOTE_TITLE_MAX, type NoteFormValues, noteFormSchema } from "../schema";
import { NOTES_QUOTAS, type Note } from "../types";
import { NOTE_UPLOADS } from "../uploads";

const route = getRouteApi("/_apps/apps/notes/$noteId");

/** The public page of a shared note. */
export const sharedNotePath = (token: string) => `/apps/notes/s/${token}`;

/**
 * /apps/notes/$noteId (decision 0190): one note in the editor (title, rich text, tags,
 * images), saved against the version it opened at, and its sharing. A guest can write
 * but not share: sharing makes the note public, which needs an account (0186).
 */
export function NoteEditorPage() {
	const { noteId } = route.useParams();
	const { session } = route.useRouteContext();
	const userId = session.user.id;
	const { data: note } = useSuspenseQuery(noteQueryOptions(userId, noteId));
	return (
		<Page width="narrow" data-testid="note-editor">
			<Button asChild variant="ghost" size="sm" className="-ms-2 w-fit">
				<Link to="/apps/notes">
					<ArrowLeftIcon aria-hidden className="rtl:rotate-180" />
					{m.notes_back()}
				</Link>
			</Button>
			<PageHeader title={note.title} description={m.notes_editor_description()} />
			<NoteForm key={crudFormKey(note)} note={note} userId={userId} />
			<SharePanel note={note} userId={userId} isGuest={session.isAnonymous === true} />
			<DeleteNote note={note} userId={userId} />
		</Page>
	);
}

const toFormValues = (note: Note): NoteFormValues => ({
	title: note.title,
	body: note.body,
	tags: note.tags,
	images: note.images,
});

function NoteForm({ note, userId }: { note: Note; userId: string }) {
	const queryClient = useQueryClient();
	const uploading = useRef(false);
	const crud = useCrudForm({
		item: note,
		toInput: (values: NoteFormValues) => {
			const parsed = noteFormSchema.parse(values);
			return { ...parsed, images: parsed.images.map(({ id, alt }) => ({ id, alt })) };
		},
		update: noteMutations.save(queryClient, userId),
		invalidate: [notesKeys.list(userId)],
		reload: notesKeys.note(userId, note.id),
	});
	const form = useAppForm({
		...formOptions({ defaultValues: toFormValues(note), validators: formValidators(noteFormSchema) }),
		...crud.formProps,
	});
	return (
		<CrudForm form={form} crud={crud} data-testid="note-form">
			<form.AppField name="title">
				{(field) => <field.TextField label={m.notes_field_title()} maxLength={NOTE_TITLE_MAX} autoComplete="off" />}
			</form.AppField>
			<form.AppField name="body">
				{(field) => <field.RichTextField label={m.notes_field_body()} optional />}
			</form.AppField>
			<form.AppField name="tags">
				{(field) => (
					<field.TagsInputField
						label={m.notes_field_tags()}
						description={m.notes_field_tags_hint({ max: String(NOTE_TAGS_MAX), length: String(NOTE_TAG_LENGTH) })}
						optional
					/>
				)}
			</form.AppField>
			<form.AppField
				name="images"
				validators={{ onSubmit: () => (uploading.current ? m.attachments_field_wait() : undefined) }}
			>
				{() => (
					<ImageGalleryField
						label={m.notes_field_images()}
						scope="notes"
						max={NOTES_QUOTAS.imagesPerNote}
						transport={NOTE_UPLOADS}
						onBusyChange={(busy) => {
							uploading.current = busy;
						}}
					/>
				)}
			</form.AppField>
			<StickyFormBar submitLabel={m.crud_save()} pendingLabel={m.crud_saving()} />
		</CrudForm>
	);
}

function SharePanel({ note, userId, isGuest }: { note: Note; userId: string; isGuest: boolean }) {
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const share = useMutation(noteMutations.share(queryClient, userId, note.id));
	const unshare = useMutation(noteMutations.unshare(queryClient, userId, note.id));
	const url = note.shareToken ? absoluteUrl(sharedNotePath(note.shareToken)) : null;

	const start = () =>
		share.mutate(undefined, {
			onSuccess: () => toast.success(m.notes_toast_shared()),
			onError: (error) => toast.error(m.common_toast_failed(), { description: errorMessage(error) }),
		});
	const stop = async () => {
		const confirmed = await confirm({
			title: m.notes_unshare_title(),
			description: m.notes_unshare_body(),
			confirmLabel: m.notes_unshare(),
			destructive: true,
		});
		if (!confirmed) return;
		unshare.mutate(undefined, {
			onSuccess: () => toast.success(m.notes_toast_unshared()),
			onError: (error) => toast.error(m.common_toast_failed(), { description: errorMessage(error) }),
		});
	};

	return (
		<div data-testid="note-share">
			<FormSection title={m.notes_share_title()} description={m.notes_share_description()}>
				{isGuest ? (
					<p className="flex items-start gap-2 text-muted-foreground text-sm">
						<LockIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
						<span>
							{m.notes_share_guest()}{" "}
							<Link to="/upgrade" className="font-medium text-foreground underline underline-offset-4">
								{m.guest_create_account()}
							</Link>
						</span>
					</p>
				) : url ? (
					<div className="flex flex-col gap-3">
						<p className="flex items-center gap-2 text-sm">
							<Globe2Icon className="size-4 text-success" aria-hidden />
							{m.notes_share_on()}
						</p>
						<div className="flex gap-2">
							<label htmlFor="note-share-url" className="sr-only">
								{m.notes_share_link()}
							</label>
							<Input
								id="note-share-url"
								value={url}
								readOnly
								className="font-mono text-sm"
								data-testid="note-share-url"
							/>
							<CopyButton value={url} label={m.notes_share_copy()} />
						</div>
						<Button variant="outline" className="w-fit" onClick={() => void stop()} disabled={unshare.isPending}>
							{m.notes_unshare()}
						</Button>
					</div>
				) : (
					<Button
						variant="outline"
						className="w-fit"
						onClick={start}
						disabled={share.isPending}
						data-testid="note-share-start"
					>
						<Globe2Icon aria-hidden />
						{m.notes_share()}
					</Button>
				)}
			</FormSection>
		</div>
	);
}

function DeleteNote({ note, userId }: { note: Note; userId: string }) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const confirm = useConfirm();
	const remove = useMutation({
		mutationFn: () => deleteNote({ data: { id: note.id } }),
		onSettled: () => queryClient.invalidateQueries({ queryKey: notesKeys.user(userId) }),
	});
	const run = async () => {
		const confirmed = await confirm({
			title: m.crud_delete_title({ label: note.title }),
			description: m.notes_delete_body(),
			confirmLabel: m.crud_delete(),
			destructive: true,
		});
		if (!confirmed) return;
		try {
			await remove.mutateAsync();
			toast.success(m.crud_toast_deleted({ label: note.title }));
			await navigate({ to: "/apps/notes" });
		} catch (error) {
			toast.error(m.common_toast_failed(), { description: errorMessage(error) });
		}
	};
	return (
		<div className="flex justify-end border-t pt-6">
			<Button variant="ghost" className="text-destructive" onClick={() => void run()} disabled={remove.isPending}>
				<Trash2Icon aria-hidden />
				{m.notes_delete()}
			</Button>
		</div>
	);
}
