import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import {
	ArrowLeftIcon,
	BarChart3Icon,
	EyeIcon,
	EyeOffIcon,
	Globe2Icon,
	LockIcon,
	SaveIcon,
	SquarePenIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { CopyButton } from "@/components/data-display/copy-button";
import { StatusOf } from "@/components/data-display/status-badge";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { StaleVersionAlert, UnsavedChangesGuard } from "@/components/forms";
import { Page, PageHeader } from "@/components/page/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isStaleError } from "@/lib/concurrency";
import { type FieldErrors, isAppError, zodFieldErrors } from "@/lib/errors";
import { formatNumber } from "@/lib/i18n/intl";
import { absoluteUrl } from "@/lib/seo";
import { m } from "@/paraglide/messages";
import { copyField, type FieldType, FORM_FIELDS_MAX, type FormField, newField } from "../fields";
import { FORM_STATUS, publicFormPath } from "../labels";
import { formMutations, formQueryOptions } from "../queries";
import { saveFormInput } from "../schema";
import type { FormDetail } from "../types";
import { BuilderCanvas } from "./builder-canvas";
import { FieldSettings, FormSettings } from "./field-settings";
import { FormRenderer } from "./form-renderer";

const route = getRouteApi("/_apps/apps/forms/$formId/");

type Draft = { title: string; description: string; fields: FormField[] };

const toDraft = (form: FormDetail): Draft => ({
	title: form.title,
	description: form.description,
	fields: form.fields,
});

/** The problems of one field, keyed from the field ("fields.2.label" -> "label"). */
const errorsOf = (errors: FieldErrors, index: number): FieldErrors => {
	const prefix = `fields.${index}.`;
	return Object.fromEntries(
		Object.entries(errors)
			.filter(([key]) => key.startsWith(prefix))
			.map(([key, messages]) => [key.slice(prefix.length), messages]),
	);
};

/**
 * /apps/forms/$formId (decision 0195): the builder. A palette of field types, the
 * questions (drag a type in, reorder by drag or keyboard), the selected question's
 * settings, and a preview of the form as respondents see it, all on a draft kept in
 * the page. Save checks the whole definition (the schema the server checks again)
 * against the version the builder loaded; Publish needs an account.
 */
export function FormBuilderPage() {
	const { formId } = route.useParams();
	const { session } = route.useRouteContext();
	const userId = session.user.id;
	const { data: form } = useSuspenseQuery(formQueryOptions(userId, formId));
	return <Builder key={form.id} form={form} userId={userId} isGuest={session.isAnonymous === true} />;
}

function Builder({ form, userId, isGuest }: { form: FormDetail; userId: string; isGuest: boolean }) {
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const save = useMutation(formMutations.save(queryClient, userId));
	const status = useMutation(formMutations.status(queryClient, userId));
	const [draft, setDraft] = useState<Draft>(() => toDraft(form));
	const [version, setVersion] = useState(form.updatedAt);
	const [saved, setSaved] = useState(() => JSON.stringify(toDraft(form)));
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [errors, setErrors] = useState<FieldErrors>({});
	const [stale, setStale] = useState(false);
	const dirty = JSON.stringify(draft) !== saved;
	const dirtyRef = useRef(dirty);
	dirtyRef.current = dirty;

	const selectedIndex = draft.fields.findIndex((field) => field.id === selectedId);
	const selected = draft.fields[selectedIndex];
	const invalid = new Set(
		draft.fields.filter((_, index) => Object.keys(errorsOf(errors, index)).length > 0).map((field) => field.id),
	);
	const published = form.status === "published";

	const setFields = (update: (fields: FormField[]) => FormField[]) =>
		setDraft((current) => ({ ...current, fields: update(current.fields) }));

	const addField = (type: FieldType, index?: number): FormField | null => {
		if (draft.fields.length >= FORM_FIELDS_MAX) return null;
		const field = newField(type);
		const at = index ?? (selectedIndex >= 0 ? selectedIndex + 1 : draft.fields.length);
		setFields((fields) => [...fields.slice(0, at), field, ...fields.slice(at)]);
		setSelectedId(field.id);
		return field;
	};

	const moveField = (from: number, to: number) =>
		setFields((fields) => {
			const next = [...fields];
			const [moved] = next.splice(from, 1);
			if (moved) next.splice(to, 0, moved);
			return next;
		});

	const removeField = async (field: FormField) => {
		if (form.responses > 0) {
			const confirmed = await confirm({
				title: m.forms_remove_title({ item: field.label || m.forms_untitled() }),
				description: m.forms_remove_body(),
				confirmLabel: m.forms_remove(),
				destructive: true,
			});
			if (!confirmed) return;
		}
		setFields((fields) => fields.filter((each) => each.id !== field.id));
		if (selectedId === field.id) setSelectedId(null);
	};

	const duplicateField = (field: FormField, index: number) => {
		if (draft.fields.length >= FORM_FIELDS_MAX) return;
		const copy = copyField(field);
		setFields((fields) => [...fields.slice(0, index + 1), copy, ...fields.slice(index + 1)]);
		setSelectedId(copy.id);
	};

	/** Opens the first field with a problem (or the form's settings). */
	const showProblems = (problems: FieldErrors) => {
		setErrors(problems);
		const first = Object.keys(problems)
			.map((key) => /^fields\.(\d+)\./.exec(key)?.[1])
			.find((index) => index !== undefined);
		setSelectedId(first === undefined ? null : (draft.fields[Number(first)]?.id ?? null));
	};

	const saveDraft = async (): Promise<boolean> => {
		const parsed = saveFormInput.safeParse({ id: form.id, updatedAt: version, ...draft });
		if (!parsed.success) {
			showProblems(zodFieldErrors(parsed.error));
			toast.error(m.forms_toast_problems());
			return false;
		}
		const snapshot = JSON.stringify(draft);
		try {
			const result = await save.mutateAsync(parsed.data);
			setVersion(result.updatedAt);
			setSaved(snapshot);
			setErrors({});
			setStale(false);
			toast.success(m.forms_toast_saved());
			return true;
		} catch (error) {
			if (isStaleError(error)) setStale(true);
			else if (isAppError(error) && error.fieldErrors && Object.keys(error.fieldErrors).some((key) => key !== "_form"))
				showProblems(error.fieldErrors);
			else toast.error(m.common_toast_failed(), { description: errorMessage(error) });
			return false;
		}
	};

	const reload = async () => {
		const fresh = await queryClient.fetchQuery({ ...formQueryOptions(userId, form.id), staleTime: 0 });
		setDraft(toDraft(fresh));
		setSaved(JSON.stringify(toDraft(fresh)));
		setVersion(fresh.updatedAt);
		setErrors({});
		setStale(false);
		setSelectedId(null);
	};

	const setPublished = async (next: boolean) => {
		if (next && dirty && !(await saveDraft())) return;
		status.mutate(
			{ id: form.id, status: next ? "published" : "draft" },
			{
				onSuccess: () => toast.success(next ? m.forms_toast_published() : m.forms_toast_unpublished()),
				onError: (error) => toast.error(m.common_toast_failed(), { description: errorMessage(error) }),
			},
		);
	};

	const publicUrl = absoluteUrl(publicFormPath(form.slug));

	return (
		<Page width="wide" data-testid="forms-builder">
			<Button asChild variant="ghost" size="sm" className="-ms-2 w-fit">
				<Link to="/apps/forms">
					<ArrowLeftIcon aria-hidden className="rtl:rotate-180" />
					{m.forms_back()}
				</Link>
			</Button>
			<PageHeader
				title={draft.title.trim() || form.title}
				description={
					<span className="flex flex-wrap items-center gap-2">
						<StatusOf status={form.status} map={FORM_STATUS} />
						<span>
							{m.forms_card_summary({
								fields: formatNumber(draft.fields.length),
								responses: formatNumber(form.responses),
							})}
						</span>
						{dirty ? <span data-testid="forms-unsaved">{m.forms_unsaved()}</span> : null}
					</span>
				}
				actions={
					<div className="flex flex-wrap items-center gap-2">
						<Button asChild variant="ghost">
							<Link to="/apps/forms/$formId/results" params={{ formId: form.id }} search={{ page: 1 }}>
								<BarChart3Icon aria-hidden />
								{m.forms_results()}
							</Link>
						</Button>
						{published ? (
							<Button variant="outline" onClick={() => setPublished(false)} disabled={status.isPending}>
								<EyeOffIcon aria-hidden />
								{m.forms_unpublish()}
							</Button>
						) : (
							<Button
								variant="outline"
								onClick={() => setPublished(true)}
								disabled={isGuest || status.isPending || save.isPending}
								data-testid="forms-publish"
							>
								<Globe2Icon aria-hidden />
								{m.forms_publish()}
							</Button>
						)}
						<Button onClick={saveDraft} disabled={!dirty || save.isPending} data-testid="forms-save">
							{save.isPending ? <Spinner aria-hidden /> : <SaveIcon aria-hidden />}
							{m.forms_save()}
						</Button>
					</div>
				}
			/>
			{stale ? <StaleVersionAlert onReload={reload} /> : null}
			{isGuest ? (
				<Alert variant="info">
					<LockIcon aria-hidden />
					<AlertTitle>{m.forms_guest_title()}</AlertTitle>
					<AlertDescription>
						<p>
							{m.forms_publish_guest()}{" "}
							<Link to="/register" className="font-medium underline underline-offset-4">
								{m.guest_banner_action()}
							</Link>
						</p>
					</AlertDescription>
				</Alert>
			) : published ? (
				<Alert variant="success" data-testid="forms-live">
					<Globe2Icon aria-hidden />
					<AlertTitle>{m.forms_live_title()}</AlertTitle>
					<AlertDescription>
						<p>{m.forms_live_body()}</p>
						<div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
							<a
								href={publicFormPath(form.slug)}
								className="min-w-0 break-all font-medium underline underline-offset-4"
								data-testid="forms-public-link"
							>
								{publicUrl}
							</a>
							<CopyButton value={publicUrl} label={m.forms_copy_link()} />
						</div>
					</AlertDescription>
				</Alert>
			) : null}
			<Tabs defaultValue="build" className="gap-4">
				<TabsList>
					<TabsTrigger value="build">
						<SquarePenIcon aria-hidden />
						{m.forms_tab_build()}
					</TabsTrigger>
					<TabsTrigger value="preview" data-testid="forms-preview-tab">
						<EyeIcon aria-hidden />
						{m.forms_tab_preview()}
					</TabsTrigger>
				</TabsList>
				<TabsContent value="build">
					<div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)_20rem]">
						<BuilderCanvas
							fields={draft.fields}
							selectedId={selectedId}
							invalid={invalid}
							onAdd={addField}
							onMove={moveField}
							onSelect={setSelectedId}
							onRemove={removeField}
						/>
						<aside aria-label={m.forms_settings_label()} className="rounded-lg border bg-surface-1 p-4 lg:self-start">
							{selected ? (
								<FieldSettings
									key={selected.id}
									field={selected}
									errors={errorsOf(errors, selectedIndex)}
									onChange={(field) =>
										setFields((fields) => fields.map((each) => (each.id === field.id ? field : each)))
									}
									onDuplicate={() => duplicateField(selected, selectedIndex)}
									onRemove={() => removeField(selected)}
									onClose={() => setSelectedId(null)}
								/>
							) : (
								<FormSettings
									title={draft.title}
									description={draft.description}
									errors={errors}
									onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
								/>
							)}
						</aside>
					</div>
				</TabsContent>
				<TabsContent value="preview">
					<section
						aria-label={m.forms_tab_preview()}
						className="mx-auto flex w-full max-w-2xl flex-col gap-6 rounded-lg border bg-surface-1 p-6"
						data-testid="forms-preview"
					>
						<p className="text-caption text-muted-foreground">{m.forms_preview_note()}</p>
						<PageHeader title={draft.title.trim() || form.title} description={draft.description || undefined} />
						{draft.fields.length === 0 ? (
							<p className="text-muted-foreground">{m.forms_preview_empty()}</p>
						) : (
							<FormRenderer
								key={JSON.stringify(draft.fields)}
								fields={draft.fields}
								onSubmit={async () => toast.success(m.forms_preview_checked())}
							/>
						)}
					</section>
				</TabsContent>
			</Tabs>
			<UnsavedChangesGuard when={() => dirtyRef.current} />
		</Page>
	);
}
