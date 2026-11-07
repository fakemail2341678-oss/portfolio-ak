import { formOptions } from "@tanstack/react-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { CrudForm, crudFormKey, useCrudForm } from "@/components/crud/use-crud-form";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { useConfirm } from "@/components/dialogs/confirm";
import { formValidators, useAppForm } from "@/components/forms";
import { LocalizedField } from "@/components/forms/fields/localized-fields";
import { FormCard, FormSection, StickyFormBar } from "@/components/page/form-layout";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { useCan } from "@/features/rbac/can";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { locales } from "@/paraglide/runtime";
import { KIDS_CAPS } from "../../kids";
import { pardaAdminKeys } from "../keys";
import { pardaAdminMutations, pardaSettingsQueryOptions } from "../queries";
import { type AdminSettings, settingsInput } from "../schema";
import { PlaybackSwitch } from "./playback-switch";

const formSchema = settingsInput.omit({ updatedAt: true });
type Values = z.input<typeof formSchema>;

const LANGUAGE_NAMES: Readonly<Record<(typeof locales)[number], () => string>> = {
	en: m.language_en,
	ne: m.language_ne,
};

function SettingsForm({ settings }: { settings: AdminSettings }) {
	const crud = useCrudForm({
		item: { id: "settings", updatedAt: settings.updatedAt },
		toInput: (values: Values) => formSchema.parse(values),
		update: pardaAdminMutations.updateSettings(),
		invalidate: [pardaAdminKeys.settings()],
		reload: pardaAdminKeys.settings(),
	});
	const form = useAppForm({
		...formOptions({
			defaultValues: {
				region: settings.region,
				languages: settings.languages,
				kidsCap: (KIDS_CAPS as ReadonlyArray<string>).includes(settings.kidsCap) ? settings.kidsCap : "PG",
				banner: settings.banner,
			} as Values,
			validators: formValidators(formSchema),
		}),
		...crud.formProps,
	});
	return (
		<CrudForm form={form} crud={crud} data-testid="parda-settings-form">
			<FormSection
				title={m.pd_admin_settings_section_catalogue()}
				description={m.pd_admin_settings_section_catalogue_hint()}
			>
				<form.AppField name="region">
					{(field) => (
						<field.TextField
							label={m.pd_admin_settings_region()}
							description={m.pd_admin_settings_region_hint()}
							maxLength={2}
							autoComplete="off"
						/>
					)}
				</form.AppField>
				<form.AppField name="kidsCap">
					{(field) => (
						<field.SelectField
							label={m.pd_admin_settings_kids_cap()}
							description={m.pd_admin_settings_kids_cap_hint()}
							options={KIDS_CAPS.map((cap) => ({ value: cap, label: cap }))}
						/>
					)}
				</form.AppField>
				<form.AppField name="languages">
					{(field) => (
						<field.CheckboxGroupField
							label={m.pd_admin_settings_languages()}
							description={m.pd_admin_settings_languages_hint()}
							options={locales.map((locale) => ({ value: locale, label: LANGUAGE_NAMES[locale]() }))}
						/>
					)}
				</form.AppField>
			</FormSection>
			<FormSection title={m.pd_admin_settings_section_banner()} description={m.pd_admin_settings_section_banner_hint()}>
				<LocalizedField
					form={form}
					fields="banner"
					label={m.pd_admin_settings_banner()}
					optional
					multiline
					maxLength={200}
				/>
			</FormSection>
			<StickyFormBar submitLabel={m.crud_save()} pendingLabel={m.crud_saving()} />
		</CrudForm>
	);
}

/** Purging bumps the epoch every cache key carries: every TMDB answer is read again. */
function PurgeCard({ settings }: { settings: AdminSettings }) {
	const confirm = useConfirm();
	const canConfigure = useCan("parda:configure");
	const purge = useCrudMutation(pardaAdminMutations.purgeCache(), { invalidate: [pardaAdminKeys.settings()] });
	const run = async () => {
		const confirmed = await confirm({
			title: m.pd_admin_purge_title(),
			description: m.pd_admin_purge_body(),
			confirmLabel: m.pd_admin_purge_confirm(),
		});
		if (confirmed) purge.mutate(undefined, { onSuccess: () => toast.success(m.pd_admin_purge_done()) });
	};
	return (
		<FormCard title={m.pd_admin_purge_heading()} description={m.pd_admin_purge_description()}>
			<div className="flex flex-wrap items-center gap-4">
				{canConfigure ? (
					<Button variant="outline" onClick={() => void run()} disabled={purge.isPending} data-testid="parda-purge">
						<RefreshCwIcon aria-hidden />
						{m.pd_admin_purge_action()}
					</Button>
				) : null}
				<p className="text-muted-foreground text-sm" data-testid="parda-cache-epoch">
					{m.pd_admin_purge_epoch({ epoch: formatNumber(settings.cacheEpoch) })}
				</p>
			</div>
		</FormCard>
	);
}

/**
 * /admin/parda/settings (PLAN Task 65, decision 0237): the kill switch, the region TMDB
 * answers for, the kids' cap, the languages players are asked for, the banner, and the
 * cache purge. Admins with only `parda:read` see it all and change nothing.
 */
export function PardaSettingsPage() {
	const { data: settings } = useSuspenseQuery(pardaSettingsQueryOptions());
	return (
		<Page width="admin" data-testid="parda-admin-settings">
			<PageHeader title={m.pd_admin_settings_title()} description={m.pd_admin_settings_description()} />
			<PlaybackSwitch />
			<SettingsForm key={crudFormKey({ id: "settings", updatedAt: settings.updatedAt })} settings={settings} />
			<PurgeCard settings={settings} />
		</Page>
	);
}
