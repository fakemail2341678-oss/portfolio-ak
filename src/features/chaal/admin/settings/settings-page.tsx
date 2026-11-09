import { formOptions } from "@tanstack/react-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { RefreshCwIcon, WrenchIcon } from "lucide-react";
import { useId } from "react";
import { toast } from "sonner";
import { CrudForm, crudFormKey, useCrudForm } from "@/components/crud/use-crud-form";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { useConfirm } from "@/components/dialogs/confirm";
import { formValidators, useAppForm } from "@/components/forms";
import { LocalizedField } from "@/components/forms/fields/localized-fields";
import { FormCard, FormSection, StickyFormBar } from "@/components/page/form-layout";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useCan } from "@/features/rbac/can";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { ENGINE_BOUNDS } from "../../engine/limits";
import { CHAAL_FEATURES, FEATURE_SCOPES, LICHESS_SCOPES } from "../../features";
import { chaalKeys } from "../../keys";
import { BOARD_NAMES } from "../../labels";
import { CHAAL_BOARD_THEMES } from "../../look/board-themes";
import { QUICK_PAIR_MODES } from "../../play/controls";
import { PUZZLE_AHEAD_BOUNDS } from "../../puzzles/limits";
import { CHAAL_PIECE_SETS } from "../../settings/preferences";
import { FEATURE_HINTS, FEATURE_TITLES, PIECE_SET_NAMES, QUICK_PAIR_LABELS } from "../labels";
import { chaalAdminMutations, chaalAdminSettingsQueryOptions } from "../queries";
import { type ChaalAdminSettings, type ChaalSettingsFormValues, chaalSettingsInput } from "../schema";

const formSchema = chaalSettingsInput.omit({ updatedAt: true });

/** The scopes a feature adds when it's on, as the hint under its switch. */
const scopesHint = (feature: (typeof CHAAL_FEATURES)[number]) => {
	const scopes = FEATURE_SCOPES[feature];
	return scopes?.length
		? m.ch_admin_feature_scopes({ hint: FEATURE_HINTS[feature](), scopes: scopes.join(", ") })
		: m.ch_admin_feature_no_scopes({ hint: FEATURE_HINTS[feature]() });
};

function SettingsForm({ settings }: { settings: ChaalAdminSettings }) {
	const canConfigure = useCan("chaal:configure");
	const crud = useCrudForm({
		item: { id: "settings", updatedAt: settings.updatedAt },
		toInput: (values: Omit<ChaalSettingsFormValues, "updatedAt">) => formSchema.parse(values),
		update: chaalAdminMutations.updateSettings(),
		invalidate: [chaalKeys.adminSettings(), chaalKeys.status()],
		reload: chaalKeys.adminSettings(),
	});
	const form = useAppForm({
		...formOptions({
			defaultValues: {
				features: settings.features,
				guestsMayConnect: settings.guestsMayConnect,
				extraScopes: settings.extraScopes,
				play: settings.play,
				puzzles: settings.puzzles,
				defaults: settings.defaults,
				engine: settings.engine,
				banner: settings.banner,
				maintenanceMessage: settings.maintenanceMessage,
			} as Omit<ChaalSettingsFormValues, "updatedAt">,
			validators: formValidators(formSchema),
		}),
		...crud.formProps,
	});
	return (
		<CrudForm form={form} crud={crud} data-testid="chaal-settings-form">
			<FormSection title={m.ch_admin_settings_features()} description={m.ch_admin_settings_features_hint()}>
				<div className="grid gap-4 sm:grid-cols-2">
					{CHAAL_FEATURES.map((feature) => (
						<form.AppField key={feature} name={`features.${feature}`}>
							{(field) => <field.SwitchField label={FEATURE_TITLES[feature]()} description={scopesHint(feature)} />}
						</form.AppField>
					))}
				</div>
			</FormSection>
			<FormSection title={m.ch_admin_settings_connecting()} description={m.ch_admin_settings_connecting_hint()}>
				{settings.connectConfigured ? null : (
					<p className="text-sm text-warning" data-testid="chaal-settings-no-key">
						{m.ch_admin_settings_no_key()}
					</p>
				)}
				<form.AppField name="guestsMayConnect">
					{(field) => (
						<field.SwitchField label={m.ch_admin_settings_guests()} description={m.ch_admin_settings_guests_hint()} />
					)}
				</form.AppField>
				<form.AppField name="extraScopes">
					{(field) => (
						<field.CheckboxGroupField
							label={m.ch_admin_settings_extra_scopes()}
							description={m.ch_admin_settings_extra_scopes_hint()}
							optional
							options={LICHESS_SCOPES.map((scope) => ({ value: scope, label: scope }))}
						/>
					)}
				</form.AppField>
			</FormSection>
			<FormSection title={m.ch_admin_settings_play()} description={m.ch_admin_settings_play_hint()}>
				<div className="grid gap-6 sm:grid-cols-2">
					<form.AppField name="play.quickPair">
						{(field) => (
							<field.SelectField
								label={m.ch_admin_settings_quick_pair()}
								description={m.ch_admin_settings_quick_pair_hint()}
								options={QUICK_PAIR_MODES.map((mode) => ({ value: mode, label: QUICK_PAIR_LABELS[mode]() }))}
							/>
						)}
					</form.AppField>
					<form.AppField name="play.aiMaxLevel">
						{(field) => (
							<field.NumberField
								integer
								label={m.ch_admin_settings_ai_max()}
								description={m.ch_admin_settings_ai_max_hint()}
							/>
						)}
					</form.AppField>
				</div>
				<form.AppField name="play.rated">
					{(field) => (
						<field.SwitchField label={m.ch_admin_settings_rated()} description={m.ch_admin_settings_rated_hint()} />
					)}
				</form.AppField>
			</FormSection>
			<FormSection title={m.ch_admin_settings_puzzles()} description={m.ch_admin_settings_puzzles_hint()}>
				<div className="grid gap-6 sm:grid-cols-2">
					<form.AppField name="puzzles.ahead">
						{(field) => (
							<field.NumberField
								integer
								label={m.ch_admin_settings_puzzles_ahead()}
								description={m.ch_admin_settings_puzzles_ahead_hint(bounds(PUZZLE_AHEAD_BOUNDS))}
							/>
						)}
					</form.AppField>
				</div>
				<form.AppField name="puzzles.streak">
					{(field) => (
						<field.SwitchField
							label={m.ch_admin_settings_puzzles_streak()}
							description={m.ch_admin_settings_puzzles_streak_hint()}
						/>
					)}
				</form.AppField>
			</FormSection>
			<FormSection title={m.ch_admin_settings_defaults()} description={m.ch_admin_settings_defaults_hint()}>
				<div className="grid gap-6 sm:grid-cols-2">
					<form.AppField name="defaults.board">
						{(field) => (
							<field.SelectField
								label={m.ch_settings_board_theme()}
								options={CHAAL_BOARD_THEMES.map((theme) => ({ value: theme, label: BOARD_NAMES[theme]() }))}
							/>
						)}
					</form.AppField>
					<form.AppField name="defaults.pieces">
						{(field) => (
							<field.SelectField
								label={m.ch_admin_settings_pieces()}
								options={CHAAL_PIECE_SETS.map((set) => ({ value: set, label: PIECE_SET_NAMES[set]() }))}
							/>
						)}
					</form.AppField>
				</div>
				<form.AppField name="defaults.sounds">
					{(field) => (
						<field.SwitchField label={m.ch_settings_sounds()} description={m.ch_admin_settings_sounds_hint()} />
					)}
				</form.AppField>
			</FormSection>
			<FormSection title={m.ch_admin_settings_engine()} description={m.ch_admin_settings_engine_hint()}>
				<div className="grid gap-6 sm:grid-cols-3">
					<form.AppField name="engine.maxDepth">
						{(field) => (
							<field.NumberField
								integer
								label={m.ch_admin_settings_depth()}
								description={m.ch_admin_settings_between(bounds(ENGINE_BOUNDS.maxDepth))}
							/>
						)}
					</form.AppField>
					<form.AppField name="engine.multiPv">
						{(field) => (
							<field.NumberField
								integer
								label={m.ch_admin_settings_lines()}
								description={m.ch_admin_settings_between(bounds(ENGINE_BOUNDS.multiPv))}
							/>
						)}
					</form.AppField>
					<form.AppField name="engine.hashMb">
						{(field) => (
							<field.NumberField
								integer
								label={m.ch_admin_settings_hash()}
								description={m.ch_admin_settings_between(bounds(ENGINE_BOUNDS.hashMb))}
							/>
						)}
					</form.AppField>
				</div>
			</FormSection>
			<FormSection title={m.ch_admin_settings_notices()} description={m.ch_admin_settings_notices_hint()}>
				<LocalizedField
					form={form}
					fields="banner"
					label={m.ch_admin_settings_banner()}
					optional
					multiline
					maxLength={200}
				/>
				<LocalizedField
					form={form}
					fields="maintenanceMessage"
					label={m.ch_admin_settings_maintenance_message()}
					description={m.ch_admin_settings_maintenance_message_hint()}
					optional
					multiline
					maxLength={200}
				/>
			</FormSection>
			{canConfigure ? <StickyFormBar submitLabel={m.crud_save()} pendingLabel={m.crud_saving()} /> : null}
		</CrudForm>
	);
}

const bounds = ({ min, max }: { min: number; max: number }) => ({ min: formatNumber(min), max: formatNumber(max) });

/**
 * Maintenance (decision 0268): on, nothing reaches Lichess with a player's token (connecting,
 * online play, the streams) and every page shows the message; public pages, analysis, the
 * engine and local games go on. Turning it on asks first.
 */
function MaintenanceSwitch({ settings }: { settings: ChaalAdminSettings }) {
	const canConfigure = useCan("chaal:configure");
	const confirm = useConfirm();
	const id = useId();
	const set = useCrudMutation(chaalAdminMutations.setMaintenance(), {
		invalidate: [chaalKeys.adminSettings(), chaalKeys.status()],
	});
	const on = settings.maintenance;

	const flip = async (next: boolean) => {
		if (next) {
			const confirmed = await confirm({
				destructive: true,
				title: m.ch_admin_maintenance_on_title(),
				description: m.ch_admin_maintenance_on_body(),
				confirmLabel: m.ch_admin_maintenance_on_confirm(),
			});
			if (!confirmed) return;
		}
		set.mutate(next, {
			onSuccess: () => toast.success(next ? m.ch_admin_maintenance_on_toast() : m.ch_admin_maintenance_off_toast()),
		});
	};

	return (
		<section
			aria-labelledby={`${id}-label`}
			className={cn(
				"flex items-start gap-4 rounded-lg border p-4",
				on ? "border-warning/40 bg-warning-subtle" : "bg-card",
			)}
			data-testid="chaal-maintenance"
			data-state={on ? "on" : "off"}
		>
			<WrenchIcon aria-hidden className={cn("mt-0.5 size-5 shrink-0", on ? "text-warning" : "text-muted-foreground")} />
			<div className="min-w-0 flex-1">
				<h2 id={`${id}-label`} className="font-medium">
					{on ? m.ch_admin_maintenance_on() : m.ch_admin_maintenance_off()}
				</h2>
				<p id={`${id}-hint`} className="text-muted-foreground text-sm">
					{on ? m.ch_admin_maintenance_on_hint() : m.ch_admin_maintenance_off_hint()}
				</p>
			</div>
			<Switch
				checked={on}
				disabled={!canConfigure || set.isPending}
				onCheckedChange={(checked) => void flip(checked)}
				aria-label={m.ch_admin_maintenance_switch()}
				aria-describedby={`${id}-hint`}
				data-testid="chaal-maintenance-switch"
			/>
		</section>
	);
}

/** Purging bumps the epoch every cache key carries: every Lichess answer is read again. */
function PurgeCard({ settings }: { settings: ChaalAdminSettings }) {
	const confirm = useConfirm();
	const canConfigure = useCan("chaal:configure");
	const purge = useCrudMutation(chaalAdminMutations.purgeCache(), { invalidate: [chaalKeys.adminSettings()] });
	const run = async () => {
		const confirmed = await confirm({
			title: m.ch_admin_purge_title(),
			description: m.ch_admin_purge_body(),
			confirmLabel: m.ch_admin_purge_confirm(),
		});
		if (confirmed) purge.mutate(undefined, { onSuccess: () => toast.success(m.ch_admin_purge_done()) });
	};
	return (
		<FormCard title={m.ch_admin_purge_heading()} description={m.ch_admin_purge_description()}>
			<div className="flex flex-wrap items-center gap-4">
				{canConfigure ? (
					<Button variant="outline" onClick={() => void run()} disabled={purge.isPending} data-testid="chaal-purge">
						<RefreshCwIcon aria-hidden />
						{m.ch_admin_purge_action()}
					</Button>
				) : null}
				<p className="text-muted-foreground text-sm" data-testid="chaal-cache-epoch">
					{m.ch_admin_purge_epoch({ epoch: formatNumber(settings.cacheEpoch) })}
				</p>
			</div>
		</FormCard>
	);
}

/**
 * /admin/chaal/settings (PLAN Task 79, decision 0268): the feature switches with the scopes
 * each adds, connecting, online play, players' defaults, the engine's limits, the banner and
 * maintenance (both languages), and the cache purge. Admins with only `chaal:read` see it
 * all and change nothing.
 */
export function ChaalAdminSettingsPage() {
	const { data: settings } = useSuspenseQuery(chaalAdminSettingsQueryOptions());
	return (
		<Page width="admin" data-testid="chaal-admin-settings">
			<PageHeader title={m.ch_admin_settings_title()} description={m.ch_admin_settings_description()} />
			<MaintenanceSwitch settings={settings} />
			<SettingsForm key={crudFormKey({ id: "settings", updatedAt: settings.updatedAt })} settings={settings} />
			<PurgeCard settings={settings} />
		</Page>
	);
}
