import { formOptions } from "@tanstack/react-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { CrudForm, crudFormKey, useCrudForm } from "@/components/crud/use-crud-form";
import { formValidators, useAppForm } from "@/components/forms";
import { AsyncComboboxField } from "@/components/forms/fields/async-combobox-field";
import { LocalizedField } from "@/components/forms/fields/localized-fields";
import { FormSection, StickyFormBar } from "@/components/page/form-layout";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";
import type { PardaPage } from "../../search";
import { pardaAdminKeys } from "../keys";
import { PAGE_LABELS } from "../labels";
import { pardaAdminMutations, pardaBillboardQueryOptions } from "../queries";
import { type AdminBillboard, type BillboardFormValues, billboardInput } from "../schema";
import { PARDA_PAGES } from "../search";
import { savedOption, titleSearch } from "./title-fields";

const newRoute = getRouteApi("/_admin/admin/parda/billboard/new");
const editRoute = getRouteApi("/_admin/admin/parda/billboard/$id");

const billboardFormOptions = (page: PardaPage, item?: AdminBillboard) =>
	formOptions({
		defaultValues: {
			page: item?.page ?? page,
			title: item ? `${item.media}:${item.tmdbId}` : "",
			tagline: item?.tagline ?? { en: "", ne: "" },
			startsOn: item?.startsOn ?? "",
			endsOn: item?.endsOn ?? "",
		} as BillboardFormValues,
		validators: formValidators(billboardInput),
	});

/**
 * A billboard slot (PLAN Task 69): a title from TMDB's search, the page it leads, its
 * dates and its own tagline. Without dates it shows until it's deleted.
 */
function BillboardForm({ page, item }: { page: PardaPage; item?: AdminBillboard }) {
	const navigate = useNavigate();
	const crud = useCrudForm({
		item,
		toInput: (values: BillboardFormValues) => billboardInput.parse(values),
		create: pardaAdminMutations.createBillboard(),
		update: pardaAdminMutations.updateBillboard(),
		invalidate: [pardaAdminKeys.all],
		reload: item && pardaAdminKeys.billboard(item.id),
		onSaved: (saved) => navigate({ to: "/admin/parda/billboard", search: { page: saved.page } }),
	});
	const form = useAppForm({ ...billboardFormOptions(page, item), ...crud.formProps });
	return (
		<CrudForm form={form} crud={crud} data-testid="parda-billboard-form">
			<FormSection title={m.pd_admin_billboard_section_title()}>
				<form.AppField name="title">
					{() => (
						<AsyncComboboxField
							{...titleSearch}
							label={m.pd_admin_billboard_title_label()}
							description={m.pd_admin_billboard_title_hint()}
							placeholder={m.pd_admin_title_search()}
							searchPlaceholder={m.pd_admin_title_search()}
							selected={item ? [savedOption(item)] : []}
						/>
					)}
				</form.AppField>
				<form.AppField name="page">
					{(field) => (
						<field.SelectField
							label={m.pd_admin_billboard_page()}
							options={PARDA_PAGES.map((value) => ({ value, label: PAGE_LABELS[value]() }))}
						/>
					)}
				</form.AppField>
				<LocalizedField
					form={form}
					fields="tagline"
					label={m.pd_admin_billboard_tagline()}
					description={m.pd_admin_billboard_tagline_hint()}
					maxLength={120}
					optional
				/>
			</FormSection>
			<FormSection title={m.pd_admin_billboard_section_dates()} description={m.pd_admin_billboard_section_dates_hint()}>
				<div className="grid gap-6 sm:grid-cols-2">
					<form.AppField name="startsOn">
						{(field) => <field.DateField label={m.pd_admin_billboard_starts()} optional />}
					</form.AppField>
					<form.AppField name="endsOn">
						{(field) => <field.DateField label={m.pd_admin_billboard_ends()} optional />}
					</form.AppField>
				</div>
			</FormSection>
			<StickyFormBar
				submitLabel={item ? m.crud_save() : m.pd_admin_billboard_submit()}
				pendingLabel={m.crud_saving()}
				cancel={
					<Button variant="ghost" asChild>
						<Link to="/admin/parda/billboard" search={{ page: item?.page ?? page }}>
							{m.crud_back()}
						</Link>
					</Button>
				}
			/>
		</CrudForm>
	);
}

export function PardaBillboardNewPage() {
	const { page } = newRoute.useSearch();
	return (
		<Page width="admin">
			<PageHeader title={m.pd_admin_billboard_new_title()} description={m.pd_admin_billboard_description()} />
			<BillboardForm page={page} />
		</Page>
	);
}

export function PardaBillboardEditPage() {
	const { id } = editRoute.useParams();
	const { data: item } = useSuspenseQuery(pardaBillboardQueryOptions(id));
	return (
		<Page width="admin">
			<PageHeader title={m.pd_admin_billboard_edit_title()} description={m.pd_admin_billboard_description()} />
			<BillboardForm key={crudFormKey(item)} page={item.page} item={item} />
		</Page>
	);
}
