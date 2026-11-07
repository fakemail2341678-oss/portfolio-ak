import { formOptions } from "@tanstack/react-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { TriangleAlertIcon } from "lucide-react";
import { CrudForm, crudFormKey, useCrudForm } from "@/components/crud/use-crud-form";
import { formValidators, useAppForm } from "@/components/forms";
import { LocalizedField } from "@/components/forms/fields/localized-fields";
import { FormSection, StickyFormBar } from "@/components/page/form-layout";
import { Page, PageHeader } from "@/components/page/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { TEMPLATE_TOKENS } from "../../player/templates";
import { pardaAdminKeys } from "../keys";
import { ADAPTER_LABELS, ADAPTIVE_LABELS, SANDBOX_LABELS } from "../labels";
import { pardaAdminMutations, pardaSourceQueryOptions } from "../queries";
import {
	type AdminSource,
	SOURCE_ADAPTERS,
	SOURCE_ADAPTIVE,
	SOURCE_QUALITIES,
	SOURCE_SANDBOXES,
	type SourceFormValues,
	sourceInput,
} from "../schema";

const editRoute = getRouteApi("/_admin/admin/parda/sources/$id");

const sourceFormOptions = (item?: AdminSource) =>
	formOptions({
		defaultValues: {
			name: item?.name ?? { en: "", ne: "" },
			movieTemplate: item?.movieTemplate ?? "",
			tvTemplate: item?.tvTemplate ?? "",
			origins: item?.origins ?? [],
			adapter: item?.adapter ?? "none",
			sandbox: item?.sandbox ?? "none",
			// The probe measures both unless the admin says otherwise (decision 0238).
			adaptive: item?.adaptive ?? "probe",
			quality: item?.quality ?? "probe",
			needsClick: item?.needsClick ?? false,
			cdnGroup: item?.cdnGroup ?? "",
			autoFallback: item?.autoFallback ?? true,
			// A new row starts disabled: try it in the player lab before viewers get it.
			enabled: item?.enabled ?? false,
			pinned: item?.pinned ?? false,
		} as SourceFormValues,
		validators: formValidators(sourceInput),
	});

const tokens = TEMPLATE_TOKENS.map((token) => `{${token}}`).join(" ");

/**
 * A source's every field (PLAN 12.5). The server checks the templates against the
 * origins and answers on the field; a sandbox shows a warning, because most players
 * refuse to run in one (12.4).
 */
function SourceForm({ item }: { item?: AdminSource }) {
	const navigate = useNavigate();
	const crud = useCrudForm({
		item,
		toInput: (values: SourceFormValues) => sourceInput.parse(values),
		create: pardaAdminMutations.createSource(),
		update: pardaAdminMutations.updateSource(),
		invalidate: [pardaAdminKeys.all],
		reload: item && pardaAdminKeys.source(item.id),
		onSaved: () => navigate({ to: "/admin/parda/sources" }),
	});
	const form = useAppForm({ ...sourceFormOptions(item), ...crud.formProps });
	const adapters = SOURCE_ADAPTERS.map((adapter) => ({ value: adapter, label: ADAPTER_LABELS[adapter]() }));
	const sandboxes = SOURCE_SANDBOXES.map((sandbox) => ({ value: sandbox, label: SANDBOX_LABELS[sandbox]() }));
	const adaptiveChoices = SOURCE_ADAPTIVE.map((value) => ({ value, label: ADAPTIVE_LABELS[value]() }));
	const qualities = SOURCE_QUALITIES.map((value) => ({
		value,
		label:
			value === "probe"
				? m.pd_admin_source_from_probe()
				: m.pd_admin_quality_value({ height: formatNumber(Number(value), { useGrouping: false }) }),
	}));

	return (
		<CrudForm form={form} crud={crud} data-testid="parda-source-form">
			<FormSection title={m.pd_admin_source_section_name()}>
				<LocalizedField form={form} fields="name" label={m.pd_admin_source_name()} maxLength={60} />
			</FormSection>
			<FormSection
				title={m.pd_admin_source_section_addresses()}
				description={m.pd_admin_source_section_addresses_hint({ tokens })}
			>
				<form.AppField name="movieTemplate">
					{(field) => (
						<field.TextField
							label={m.pd_admin_source_movie_template()}
							description={m.pd_admin_source_template_hint({ example: "/1/movie/{id}" })}
							maxLength={500}
							autoComplete="off"
						/>
					)}
				</form.AppField>
				<form.AppField name="tvTemplate">
					{(field) => <field.TextField label={m.pd_admin_source_tv_template()} maxLength={500} autoComplete="off" />}
				</form.AppField>
				<form.AppField
					name="origins"
					// The templates are checked against the origins: a new origin can fix them, so their server errors go.
					listeners={{
						onChange: () => {
							for (const name of ["movieTemplate", "tvTemplate"] as const) {
								form.setFieldMeta(name, (meta) => ({ ...meta, errorMap: { ...meta.errorMap, onServer: undefined } }));
							}
						},
					}}
				>
					{(field) => (
						<field.TagsInputField
							label={m.pd_admin_source_origins()}
							description={m.pd_admin_source_origins_hint()}
							placeholder="https://player.example.com"
							optional
						/>
					)}
				</form.AppField>
			</FormSection>
			<FormSection title={m.pd_admin_source_section_player()} description={m.pd_admin_source_section_player_hint()}>
				<form.AppField name="adapter">
					{(field) => (
						<field.SelectField
							label={m.pd_admin_source_adapter()}
							description={m.pd_admin_source_adapter_hint()}
							options={adapters}
						/>
					)}
				</form.AppField>
				<form.AppField name="sandbox">
					{(field) => (
						<field.SelectField
							label={m.pd_admin_source_sandbox_label()}
							description={m.pd_admin_source_sandbox_hint()}
							options={sandboxes}
						/>
					)}
				</form.AppField>
				<form.Subscribe selector={(state) => state.values.sandbox}>
					{(sandbox) =>
						sandbox === "none" ? null : (
							<Alert variant="warning" data-testid="parda-sandbox-warning">
								<TriangleAlertIcon aria-hidden />
								<AlertTitle>{m.pd_admin_source_sandbox_warning_title()}</AlertTitle>
								<AlertDescription>{m.pd_admin_source_sandbox_warning()}</AlertDescription>
							</Alert>
						)
					}
				</form.Subscribe>
				<form.AppField name="adaptive">
					{(field) => (
						<field.SelectField
							label={m.pd_admin_source_adaptive_label()}
							description={m.pd_admin_source_adaptive_hint()}
							options={adaptiveChoices}
						/>
					)}
				</form.AppField>
				<form.AppField name="quality">
					{(field) => (
						<field.SelectField
							label={m.pd_admin_source_quality_label()}
							description={m.pd_admin_source_quality_hint()}
							options={qualities}
						/>
					)}
				</form.AppField>
				<form.AppField name="needsClick">
					{(field) => (
						<field.SwitchField
							label={m.pd_admin_source_needs_click_label()}
							description={m.pd_admin_source_needs_click_hint()}
						/>
					)}
				</form.AppField>
			</FormSection>
			<FormSection title={m.pd_admin_source_section_order()} description={m.pd_admin_source_section_order_hint()}>
				<form.AppField name="cdnGroup">
					{(field) => (
						<field.TextField
							label={m.pd_admin_source_group()}
							description={m.pd_admin_source_group_hint()}
							maxLength={40}
							optional
							autoComplete="off"
						/>
					)}
				</form.AppField>
				<form.AppField name="autoFallback">
					{(field) => (
						<field.SwitchField
							label={m.pd_admin_source_fallback_label()}
							description={m.pd_admin_source_fallback_hint()}
						/>
					)}
				</form.AppField>
				<form.AppField name="enabled">
					{(field) => (
						<field.SwitchField
							label={m.pd_admin_source_enabled_label()}
							description={m.pd_admin_source_enabled_hint()}
						/>
					)}
				</form.AppField>
				<form.AppField name="pinned">
					{(field) => (
						<field.SwitchField label={m.pd_admin_source_pinned_label()} description={m.pd_admin_source_pinned_hint()} />
					)}
				</form.AppField>
			</FormSection>
			<StickyFormBar
				submitLabel={item ? m.crud_save() : m.crud_create()}
				pendingLabel={m.crud_saving()}
				cancel={
					<Button variant="ghost" asChild>
						<Link to="/admin/parda/sources">{m.crud_back()}</Link>
					</Button>
				}
			/>
		</CrudForm>
	);
}

/** /admin/parda/sources/new */
export function PardaSourceNewPage() {
	return (
		<Page width="admin">
			<PageHeader title={m.pd_admin_source_new_title()} description={m.pd_admin_source_new_description()} />
			<SourceForm />
		</Page>
	);
}

/** /admin/parda/sources/$id: the row from the loader's cache; a reloaded newer version remounts the form. */
export function PardaSourceEditPage() {
	const { id } = editRoute.useParams();
	const { data: item } = useSuspenseQuery(pardaSourceQueryOptions(id));
	return (
		<Page width="admin">
			<PageHeader
				title={m.pd_admin_source_edit_title()}
				actions={
					<Button variant="outline" asChild>
						<Link to="/admin/parda/player-lab" search={{ source: item.id }}>
							{m.pd_admin_source_test()}
						</Link>
					</Button>
				}
			/>
			<SourceForm key={crudFormKey(item)} item={item} />
		</Page>
	);
}
