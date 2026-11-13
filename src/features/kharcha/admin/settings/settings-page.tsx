import { formOptions } from "@tanstack/react-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { z } from "zod";
import { CrudForm, crudFormKey, useCrudForm } from "@/components/crud/use-crud-form";
import { formValidators, useAppForm } from "@/components/forms";
import { SortableListField } from "@/components/forms/fields/list-fields";
import { LocalizedField } from "@/components/forms/fields/localized-fields";
import { FormSection, StickyFormBar } from "@/components/page/form-layout";
import { Page, PageHeader } from "@/components/page/page";
import { CURRENCIES } from "@/lib/i18n/currency";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { DEFAULT_CATEGORY_LIMIT, type DefaultCategory, type KharchaQuotas } from "../../settings";
import { COLOR_LABELS, ICON_LABELS } from "../../settings/pickers";
import { CATEGORY_ICONS, KHARCHA_COLORS } from "../../types";
import { kharchaAdminKeys, kharchaAdminMutations, kharchaAdminSettingsQueryOptions } from "../queries";
import { type KharchaAdminSettings, updateKharchaSettingsInput } from "../schema";

const formSchema = updateKharchaSettingsInput.shape.settings;

/** The form holds the settings as the schema takes them (each with its default, so optional in type). */
type Values = z.input<typeof formSchema>;

const toInput = (values: Values) => ({ settings: formSchema.parse(values) });

const QUOTA_LABELS: Record<keyof KharchaQuotas, () => string> = {
	expenses: m.kharcha_admin_quota_expenses,
	payments: m.kharcha_admin_quota_payments,
	groups: m.kharcha_admin_quota_groups,
	groupMembers: m.kharcha_admin_quota_group_members,
	friends: m.kharcha_admin_quota_friends,
	categories: m.kharcha_admin_quota_categories,
	tags: m.kharcha_admin_quota_tags,
	methods: m.kharcha_admin_quota_methods,
	rules: m.kharcha_admin_quota_rules,
	budgets: m.kharcha_admin_quota_budgets,
	recurring: m.kharcha_admin_quota_recurring,
	receipts: m.kharcha_admin_quota_receipts,
	drafts: m.kharcha_admin_quota_drafts,
};
/** Receipts' limits have their own section; the rest are listed in this order. */
const RECEIPT_LIMITS = ["receipts", "drafts"] as const;
const LIMITS = (Object.keys(QUOTA_LABELS) as Array<keyof KharchaQuotas>).filter(
	(key) => !(RECEIPT_LIMITS as ReadonlyArray<string>).includes(key),
);

const newCategory = (): DefaultCategory => ({ key: "", name: { en: "", ne: "" }, icon: "receipt", color: "gray" });

function SettingsForm({ data }: { data: KharchaAdminSettings }) {
	const crud = useCrudForm({
		item: { id: "settings", updatedAt: data.updatedAt },
		toInput,
		update: kharchaAdminMutations.updateSettings(),
		invalidate: [kharchaAdminKeys.all],
		reload: kharchaAdminKeys.settings(),
	});
	const defaultValues: Values = data.settings;
	const form = useAppForm({
		...formOptions({ defaultValues, validators: formValidators(formSchema) }),
		...crud.formProps,
	});
	const quotaFields = (scope: "quotas" | "guestQuotas", keys: ReadonlyArray<keyof KharchaQuotas>) =>
		keys.map((key) => (
			<form.AppField key={`${scope}.${key}`} name={`${scope}.${key}`}>
				{(field) => (
					<field.NumberField
						integer
						label={
							scope === "quotas" ? QUOTA_LABELS[key]() : m.kharcha_admin_quota_guest({ limit: QUOTA_LABELS[key]() })
						}
					/>
				)}
			</form.AppField>
		));
	return (
		<CrudForm form={form} crud={crud} data-testid="kharcha-settings-form">
			<FormSection title={m.kharcha_admin_section_limits()} description={m.kharcha_admin_section_limits_hint()}>
				<div className="grid gap-4 sm:grid-cols-2">{quotaFields("quotas", LIMITS)}</div>
			</FormSection>
			<FormSection
				title={m.kharcha_admin_section_guest_limits()}
				description={m.kharcha_admin_section_guest_limits_hint()}
			>
				<div className="grid gap-4 sm:grid-cols-2">{quotaFields("guestQuotas", LIMITS)}</div>
			</FormSection>
			<FormSection title={m.kharcha_admin_section_receipts()} description={m.kharcha_admin_section_receipts_hint()}>
				<div className="grid gap-4 sm:grid-cols-2">
					{quotaFields("quotas", RECEIPT_LIMITS)}
					{quotaFields("guestQuotas", RECEIPT_LIMITS)}
				</div>
				<form.AppField name="uploadsPerHour">
					{(field) => (
						<field.NumberField
							integer
							label={m.kharcha_admin_uploads_per_hour()}
							description={m.kharcha_admin_uploads_per_hour_hint()}
						/>
					)}
				</form.AppField>
			</FormSection>
			<FormSection title={m.kharcha_admin_section_currencies()} description={m.kharcha_admin_section_currencies_hint()}>
				<form.AppField name="currencies">
					{(field) => (
						<field.CheckboxGroupField
							label={m.kharcha_admin_currencies()}
							// Codes alone: Intl's Nepali names differ between Node's ICU and the browser's, and these render on the server.
							options={CURRENCIES.map((code) => ({ value: code, label: code }))}
						/>
					)}
				</form.AppField>
			</FormSection>
			<FormSection title={m.kharcha_admin_section_sending()} description={m.kharcha_admin_section_sending_hint()}>
				<form.AppField name="invites">
					{(field) => (
						<field.SwitchField label={m.kharcha_admin_invites()} description={m.kharcha_admin_invites_hint()} />
					)}
				</form.AppField>
				<form.AppField name="reminders">
					{(field) => (
						<field.SwitchField label={m.kharcha_admin_reminders()} description={m.kharcha_admin_reminders_hint()} />
					)}
				</form.AppField>
				<form.AppField name="digestHour">
					{(field) => (
						<field.NumberField
							integer
							label={m.kharcha_admin_digest_hour()}
							description={m.kharcha_admin_digest_hour_hint()}
						/>
					)}
				</form.AppField>
			</FormSection>
			<FormSection title={m.kharcha_admin_section_categories()} description={m.kharcha_admin_section_categories_hint()}>
				<form.AppField name="categories" mode="array">
					{() => (
						<SortableListField<DefaultCategory>
							label={m.kharcha_admin_categories()}
							addLabel={m.kharcha_admin_add_category()}
							newItem={newCategory}
							getItemLabel={(category, index) =>
								category.name.en || m.kharcha_admin_category_n({ n: formatNumber(index + 1) })
							}
							max={DEFAULT_CATEGORY_LIMIT}
							renderItem={({ index }) => (
								<div className="flex flex-col gap-4">
									<form.AppField name={`categories[${index}].key`}>
										{(field) => (
											<field.TextField
												label={m.kharcha_admin_category_key()}
												description={m.kharcha_admin_category_key_hint()}
												maxLength={30}
												autoComplete="off"
											/>
										)}
									</form.AppField>
									<LocalizedField
										form={form}
										fields={`categories[${index}].name`}
										label={m.kharcha_admin_category_name()}
										maxLength={40}
									/>
									<div className="grid gap-4 sm:grid-cols-2">
										<form.AppField name={`categories[${index}].icon`}>
											{(field) => (
												<field.SelectField
													label={m.kharcha_field_icon()}
													options={CATEGORY_ICONS.map((icon) => ({ value: icon, label: ICON_LABELS[icon]() }))}
												/>
											)}
										</form.AppField>
										<form.AppField name={`categories[${index}].color`}>
											{(field) => (
												<field.SelectField
													label={m.kharcha_field_color()}
													options={KHARCHA_COLORS.map((color) => ({ value: color, label: COLOR_LABELS[color]() }))}
												/>
											)}
										</form.AppField>
									</div>
								</div>
							)}
						/>
					)}
				</form.AppField>
			</FormSection>
			<StickyFormBar submitLabel={m.crud_save()} />
		</CrudForm>
	);
}

/**
 * /admin/kharcha/settings (PLAN Task 96, decision 0290): the limits for people and guests,
 * receipts, the currencies offered, invites and reminders, the digest's hour and the
 * categories everyone starts with. Saved from the version it opened at.
 */
export function KharchaAdminSettingsPage() {
	const { data } = useSuspenseQuery(kharchaAdminSettingsQueryOptions());
	return (
		<Page width="admin" data-testid="kharcha-admin-settings">
			<PageHeader title={m.kharcha_admin_settings_title()} description={m.kharcha_admin_settings_description()} />
			<SettingsForm key={crudFormKey({ id: "settings", updatedAt: data.updatedAt })} data={data} />
		</Page>
	);
}
