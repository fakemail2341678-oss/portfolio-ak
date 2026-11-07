import { withFieldGroup } from "@/components/forms";
import { m } from "@/paraglide/messages";
import { METRIC_FORMATS } from "../../constants";
import { METRIC_FORMAT_LABELS } from "../labels";

/**
 * Rows the profile and project forms share, as field groups (placed with `form`
 * and `fields`, e.g. `fields={`metrics[${index}]`}`). Their short labels are
 * typed in both languages side by side.
 */

const EMPTY = { en: "", ne: "" };

/** A metric: a number, how it is shown, and its label. */
export const MetricFields = withFieldGroup({
	defaultValues: { value: 0, format: "number" as (typeof METRIC_FORMATS)[number], label: EMPTY },
	render: function MetricFields({ group }) {
		const options = METRIC_FORMATS.map((format) => ({ value: format, label: METRIC_FORMAT_LABELS[format]() }));
		return (
			<>
				<div className="grid gap-3 sm:grid-cols-2">
					<group.AppField name="value">
						{(field) => <field.NumberField label={m.portfolio_admin_field_value()} />}
					</group.AppField>
					<group.AppField name="format">
						{(field) => <field.SelectField label={m.portfolio_admin_field_format()} options={options} />}
					</group.AppField>
				</div>
				<div className="grid gap-3 sm:grid-cols-2">
					<group.AppField name="label.en">
						{(field) => (
							<field.TextField
								label={m.localized_label({ label: m.portfolio_admin_field_label(), language: m.language_en() })}
								maxLength={80}
							/>
						)}
					</group.AppField>
					<group.AppField name="label.ne">
						{(field) => (
							<field.TextField
								label={m.localized_label({ label: m.portfolio_admin_field_label(), language: m.language_ne() })}
								optional
								maxLength={80}
							/>
						)}
					</group.AppField>
				</div>
			</>
		);
	},
});

/** A link: its label in both languages and an https:// or mailto: address. */
export const LinkFields = withFieldGroup({
	defaultValues: { label: EMPTY, href: "" },
	render: function LinkFields({ group }) {
		return (
			<>
				<div className="grid gap-3 sm:grid-cols-2">
					<group.AppField name="label.en">
						{(field) => (
							<field.TextField
								label={m.localized_label({ label: m.portfolio_admin_field_label(), language: m.language_en() })}
								maxLength={80}
							/>
						)}
					</group.AppField>
					<group.AppField name="label.ne">
						{(field) => (
							<field.TextField
								label={m.localized_label({ label: m.portfolio_admin_field_label(), language: m.language_ne() })}
								optional
								maxLength={80}
							/>
						)}
					</group.AppField>
				</div>
				<group.AppField name="href">
					{(field) => (
						<field.TextField
							label={m.portfolio_admin_field_href()}
							description={m.portfolio_admin_field_href_description()}
							inputMode="url"
						/>
					)}
				</group.AppField>
			</>
		);
	},
});
