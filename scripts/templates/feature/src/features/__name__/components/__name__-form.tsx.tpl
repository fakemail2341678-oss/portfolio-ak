import { formOptions } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { CrudForm, useCrudForm } from "@/components/crud/use-crud-form";
import { formValidators, useAppForm } from "@/components/forms";
{{#localized}}
import { LocalizedField } from "@/components/forms/fields/localized-fields";
{{/localized}}
{{#public}}
import { SlugField, slugValidators } from "@/components/forms/fields/slug-field";
{{/public}}
import { StickyFormBar } from "@/components/page/form-layout";
import { Button } from "@/components/ui/button";
{{#public}}
import { is__Pascal__SlugFree } from "@/functions/__name__";
{{/public}}
import { m } from "@/paraglide/messages";
import { __camel__Keys } from "../keys";
import { __camel__Mutations } from "../queries";
import { type __Pascal__Detail, type __Pascal__FormValues, __camel__InputSchema } from "../schema";

/** The form's values for a row (or a new one) and its validation. */
export const __camel__FormOptions = (row?: __Pascal__Detail) =>
	formOptions({
		defaultValues: {
{{#localized}}
			title: row?.title ?? { en: "", ne: "" },
			notes: row?.notes ?? { en: "", ne: "" },
{{/localized}}
{{^localized}}
			title: row?.title ?? "",
			notes: row?.notes ?? "",
{{/localized}}
{{#public}}
			slug: row?.slug ?? "",
			published: row?.published ?? false,
{{/public}}
		} as __Pascal__FormValues,
		validators: formValidators(__camel__InputSchema),
	});

/**
 * Create and edit form (docs/guides/crud.md): the fields here, the rest in
 * useCrudForm (the save, server errors on their fields, the stale-version
 * "Reload", the unsaved-changes guard, toasts). Render it with key={crudFormKey(row)}.
 */
export function __Pascal__Form({ row }: { row?: __Pascal__Detail }) {
	const navigate = useNavigate();
	const crud = useCrudForm({
		item: row,
		toInput: (values: __Pascal__FormValues) => __camel__InputSchema.parse(values),
		create: __camel__Mutations.create(),
		update: __camel__Mutations.update(),
		invalidate: [__camel__Keys.all],
		reload: row && __camel__Keys.detail(row.id),
		onSaved: () => navigate({ to: "/admin/__name__" }),
	});
	const form = useAppForm({ ...__camel__FormOptions(row), ...crud.formProps });

	return (
		<CrudForm form={form} crud={crud} data-testid="__name__-form">
{{#localized}}
			<LocalizedField form={form} fields="title" label={m.__snake___field_title()} maxLength={120} />
{{/localized}}
{{^localized}}
			<form.AppField name="title">
				{(field) => <field.TextField label={m.__snake___field_title()} maxLength={120} />}
			</form.AppField>
{{/localized}}
{{#public}}
			{/* New rows: the slug follows the {{#localized}}English {{/localized}}title until edited; a taken slug shows as you type. */}
			<form.AppField
				name="slug"
				validators={slugValidators({
					from: "title{{#localized}}.en{{/localized}}",
					isAvailable: (slug) => is__Pascal__SlugFree({ data: { slug, ...(row ? { id: row.id } : {}) } }),
				})}
			>
				{() => (
					<SlugField
						label={m.__snake___field_slug()}
						description={m.__snake___field_slug_description()}
						from="title{{#localized}}.en{{/localized}}"
						fromLabel={m.__snake___field_title()}
						prefix="/__name__/"
						linked={!row}
					/>
				)}
			</form.AppField>
{{/public}}
{{#localized}}
			<LocalizedField form={form} fields="notes" label={m.__snake___field_notes()} optional multiline maxLength={2000} />
{{/localized}}
{{^localized}}
			<form.AppField name="notes">
				{(field) => (
					<field.TextareaField label={m.__snake___field_notes()} optional rows={4} maxLength={2000} showCount />
				)}
			</form.AppField>
{{/localized}}
{{#public}}
			<form.AppField name="published">
				{(field) => (
					<field.SwitchField
						label={m.__snake___field_published()}
						description={m.__snake___field_published_description()}
					/>
				)}
			</form.AppField>
{{/public}}
			<StickyFormBar
				submitLabel={row ? m.crud_save() : m.crud_create()}
				pendingLabel={m.crud_saving()}
				cancel={
					<Button variant="ghost" asChild>
						<Link to="/admin/__name__">{m.crud_back()}</Link>
					</Button>
				}
			/>
		</CrudForm>
	);
}
