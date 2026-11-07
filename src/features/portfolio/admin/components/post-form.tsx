import { formOptions } from "@tanstack/react-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { CrudForm, crudFormKey, useCrudForm } from "@/components/crud/use-crud-form";
import { formValidators, useAppForm } from "@/components/forms";
import { LocalizedField, LocalizedRichTextField } from "@/components/forms/fields/localized-fields";
import { SlugField, slugValidators } from "@/components/forms/fields/slug-field";
import { FormSection, StickyFormBar } from "@/components/page/form-layout";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { MediaField } from "@/features/media/components/media-field";
import { useCan } from "@/features/rbac/can";
import { isPostSlugFree } from "@/functions/portfolio";
import { m } from "@/paraglide/messages";
import { PORTFOLIO_STATUSES } from "../../constants";
import { type PostDetail, type PostFormValues, postFormSchema, toPostInput } from "../../schema";
import { postKeys } from "../keys";
import { STATUS_LABELS } from "../labels";
import { postDetailQueryOptions, postMutations } from "../queries";
import { PreviewLink } from "./shared";

const EMPTY = { en: "", ne: "" };

const postFormOptions = (item?: PostDetail) =>
	formOptions({
		defaultValues: {
			title: item?.title ?? EMPTY,
			slug: item?.slug ?? "",
			excerpt: item?.excerpt ?? EMPTY,
			body: item?.body ?? EMPTY,
			tags: item?.tags ?? [],
			status: item?.status ?? "draft",
			cover: item?.cover ? [{ id: item.cover.id, preview: item.cover }] : [],
		} as PostFormValues,
		validators: formValidators(postFormSchema),
	});

/**
 * Create and edit a journal post (docs/guides/crud.md): the title, excerpt and
 * body in both languages (the body is rich text, sanitized on the server), tags,
 * a cover from the media library and, with portfolio:publish, the status.
 * Render it with key={crudFormKey(item)}.
 */
export function PostForm({ item }: { item?: PostDetail }) {
	const navigate = useNavigate();
	const canPublish = useCan("portfolio:publish");
	const crud = useCrudForm({
		item,
		toInput: toPostInput,
		create: postMutations.create(),
		update: postMutations.update(),
		invalidate: [postKeys.all],
		reload: item && postKeys.detail(item.id),
		onSaved: () => navigate({ to: "/admin/portfolio/journal" }),
	});
	const form = useAppForm({ ...postFormOptions(item), ...crud.formProps });

	return (
		<CrudForm form={form} crud={crud} className="max-w-5xl" data-testid="post-form">
			<FormSection title={m.portfolio_admin_section_basics()}>
				<LocalizedField form={form} fields="title" label={m.portfolio_admin_field_title()} maxLength={140} />
				<form.AppField
					name="slug"
					validators={slugValidators({
						from: "title.en",
						isAvailable: (slug) => isPostSlugFree({ data: { slug, ...(item ? { id: item.id } : {}) } }),
					})}
				>
					{() => (
						<SlugField
							label={m.portfolio_admin_field_slug()}
							description={m.portfolio_admin_field_slug_description()}
							from="title.en"
							fromLabel={m.portfolio_admin_field_title()}
							linked={!item}
						/>
					)}
				</form.AppField>
				<LocalizedField
					form={form}
					fields="excerpt"
					label={m.portfolio_admin_field_excerpt()}
					multiline
					maxLength={300}
				/>
				<form.AppField name="tags">
					{(field) => <field.TagsInputField label={m.portfolio_admin_field_tags()} optional />}
				</form.AppField>
				{canPublish ? (
					<form.AppField name="status">
						{(field) => (
							<field.RadioGroupField
								label={m.portfolio_admin_field_status()}
								options={PORTFOLIO_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status]() }))}
							/>
						)}
					</form.AppField>
				) : null}
				<form.AppField name="cover">
					{() => <MediaField label={m.portfolio_admin_field_cover()} max={1} />}
				</form.AppField>
			</FormSection>
			<FormSection title={m.portfolio_admin_section_article()}>
				<LocalizedRichTextField form={form} fields="body" label={m.portfolio_admin_field_body()} />
			</FormSection>
			<StickyFormBar
				submitLabel={item ? m.crud_save() : m.crud_create()}
				pendingLabel={m.crud_saving()}
				cancel={
					<Button variant="ghost" asChild>
						<Link to="/admin/portfolio/journal">{m.crud_back()}</Link>
					</Button>
				}
			/>
		</CrudForm>
	);
}

const editRoute = getRouteApi("/_admin/admin/portfolio/journal/$id");

/** /admin/portfolio/journal/new */
export function PostNewPage() {
	return (
		<Page width="admin">
			<PageHeader title={m.portfolio_admin_posts_new()} />
			<PostForm />
		</Page>
	);
}

/** /admin/portfolio/journal/$id: a reloaded newer version remounts the form. */
export function PostEditPage() {
	const { id } = editRoute.useParams();
	const { data: item } = useSuspenseQuery(postDetailQueryOptions(id));
	return (
		<Page width="admin">
			<PageHeader
				title={m.portfolio_admin_posts_edit()}
				description={item.title.en}
				actions={
					<Button variant="outline" asChild>
						<PreviewLink kind="journal" slug={item.slug}>
							{item.status === "published" ? m.portfolio_admin_view() : m.portfolio_admin_preview()}
						</PreviewLink>
					</Button>
				}
			/>
			<PostForm key={crudFormKey(item)} item={item} />
		</Page>
	);
}
