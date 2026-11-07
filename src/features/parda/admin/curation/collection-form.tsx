import { formOptions } from "@tanstack/react-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { CrudForm, crudFormKey, useCrudForm } from "@/components/crud/use-crud-form";
import { formValidators, useAppForm } from "@/components/forms";
import { LocalizedField } from "@/components/forms/fields/localized-fields";
import { SlugField } from "@/components/forms/fields/slug-field";
import { FormSection, StickyFormBar } from "@/components/page/form-layout";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { pardaAdminKeys } from "../keys";
import { pardaAdminCollectionQueryOptions, pardaAdminMutations } from "../queries";
import { type AdminCollection, COLLECTION_MAX_TITLES, type CollectionFormValues, collectionInput } from "../schema";
import { savedOption, TitleListField } from "./title-fields";

const editRoute = getRouteApi("/_admin/admin/parda/collections/$id");

const collectionFormOptions = (item?: AdminCollection) =>
	formOptions({
		defaultValues: {
			name: item?.name ?? { en: "", ne: "" },
			slug: item?.slug ?? "",
			description: item?.description ?? { en: "", ne: "" },
			published: item?.published ?? false,
			items: item?.items.map((each) => each.ref) ?? [],
		} as CollectionFormValues,
		validators: formValidators(collectionInput),
	});

/**
 * A collection (PLAN Task 69): its name and address in both languages, its titles in
 * order, and whether viewers can see it. /admin/parda/layout places it on a page as a rail.
 */
function CollectionForm({ item }: { item?: AdminCollection }) {
	const navigate = useNavigate();
	const crud = useCrudForm({
		item,
		toInput: (values: CollectionFormValues) => collectionInput.parse(values),
		create: pardaAdminMutations.createCollection(),
		update: pardaAdminMutations.updateCollection(),
		invalidate: [pardaAdminKeys.all],
		reload: item && pardaAdminKeys.collection(item.id),
		onSaved: () => navigate({ to: "/admin/parda/collections" }),
	});
	const form = useAppForm({ ...collectionFormOptions(item), ...crud.formProps });
	return (
		<CrudForm form={form} crud={crud} data-testid="parda-collection-form">
			<FormSection title={m.pd_admin_collection_section_name()}>
				<LocalizedField form={form} fields="name" label={m.pd_admin_collection_name()} maxLength={80} />
				<form.AppField name="slug">
					{() => (
						<SlugField
							label={m.pd_admin_collection_slug()}
							from="name.en"
							fromLabel={m.pd_admin_collection_name()}
							prefix="/c/"
						/>
					)}
				</form.AppField>
				<LocalizedField
					form={form}
					fields="description"
					label={m.pd_admin_collection_description_label()}
					maxLength={500}
					multiline
					optional
				/>
			</FormSection>
			<FormSection
				title={m.pd_admin_collection_section_titles()}
				description={m.pd_admin_collection_section_titles_hint({ max: formatNumber(COLLECTION_MAX_TITLES) })}
			>
				<form.AppField name="items">
					{() => (
						<TitleListField label={m.pd_admin_collection_titles()} selected={item?.items.map(savedOption) ?? []} />
					)}
				</form.AppField>
			</FormSection>
			<FormSection title={m.pd_admin_collection_section_publish()}>
				<form.AppField name="published">
					{(field) => (
						<field.SwitchField
							label={m.pd_admin_collection_published_label()}
							description={m.pd_admin_collection_published_hint()}
						/>
					)}
				</form.AppField>
			</FormSection>
			<StickyFormBar
				submitLabel={item ? m.crud_save() : m.pd_admin_collection_submit()}
				pendingLabel={m.crud_saving()}
				cancel={
					<Button variant="ghost" asChild>
						<Link to="/admin/parda/collections">{m.crud_back()}</Link>
					</Button>
				}
			/>
		</CrudForm>
	);
}

export function PardaCollectionNewPage() {
	return (
		<Page width="admin">
			<PageHeader title={m.pd_admin_collection_new_title()} description={m.pd_admin_collections_description()} />
			<CollectionForm />
		</Page>
	);
}

export function PardaCollectionEditPage() {
	const { id } = editRoute.useParams();
	const { data: item } = useSuspenseQuery(pardaAdminCollectionQueryOptions(id));
	return (
		<Page width="admin">
			<PageHeader title={m.pd_admin_collection_edit_title()} description={m.pd_admin_collections_description()} />
			<CollectionForm key={crudFormKey(item)} item={item} />
		</Page>
	);
}
