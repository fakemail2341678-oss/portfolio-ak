import { formOptions, useStore } from "@tanstack/react-form";
import { useCrudForm } from "@/components/crud/use-crud-form";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, useAppForm } from "@/components/forms";
import { LocalizedField } from "@/components/forms/fields/localized-fields";
import { m } from "@/paraglide/messages";
import { type ChaalFeaturedSection, SECTION_KINDS } from "../../../home/lib/curation";
import { chaalKeys } from "../../../keys";
import { PUZZLE_ANGLES } from "../../../puzzles/lib/angles";
import { THEME_NAMES } from "../../../puzzles/lib/themes";
import { FEATURED_KIND_LABELS } from "../../labels";
import { chaalAdminMutations } from "../../queries";
import { type ChaalAdminFeatured, type ChaalFeaturedFormValues, chaalFeaturedInputSchema } from "../../schema";

const THEMES = PUZZLE_ANGLES.filter((angle) => angle !== "mix");

/**
 * Feature something on the home, or change what's featured (PLAN Task 84): Lichess's id or
 * the item's Lichess address (a theme from Chaal's list), the title the home shows in both
 * languages, and the dates it shows between. A dialog on the curation page, no route of
 * its own, which keeps the entry chunk inside its budget.
 */
export function FeaturedDialog({
	section,
	item,
	onClose,
}: {
	section: ChaalFeaturedSection;
	item?: ChaalAdminFeatured | undefined;
	onClose: () => void;
}) {
	const crud = useCrudForm({
		item,
		toInput: (values: ChaalFeaturedFormValues) => chaalFeaturedInputSchema.parse(values),
		create: chaalAdminMutations.createFeatured(),
		update: chaalAdminMutations.updateFeatured(),
		invalidate: [chaalKeys.adminCuration()],
		reload: chaalKeys.adminCuration(),
		onSaved: onClose,
		messages: { created: () => m.chaal_admin_featured_created(), saved: () => m.chaal_admin_featured_saved() },
	});
	const kinds = SECTION_KINDS[section];
	const form = useAppForm({
		...formOptions({
			defaultValues: {
				kind: item?.kind ?? kinds[0],
				ref: item?.ref ?? "",
				title: item?.title ?? { en: "", ne: "" },
				startsOn: item?.startsOn ?? "",
				endsOn: item?.endsOn ?? "",
			} as ChaalFeaturedFormValues,
			validators: formValidators(chaalFeaturedInputSchema),
		}),
		...crud.formProps,
	});
	const kind = useStore(form.store, (state) => state.values.kind);
	return (
		<form.AppForm>
			<FormDialog
				title={item ? m.chaal_admin_featured_edit_title() : m.chaal_admin_featured_new_title()}
				description={m.chaal_admin_featured_dialog_description()}
				submitLabel={item ? m.crud_save() : m.chaal_admin_featured_submit()}
				pendingLabel={m.crud_saving()}
				onClose={onClose}
				stale={crud.stale}
				data-testid="chaal-featured-dialog"
			>
				{kinds.length > 1 ? (
					<form.AppField name="kind">
						{(field) => (
							<field.RadioGroupField
								label={m.chaal_admin_col_kind()}
								options={kinds.map((value) => ({ value, label: FEATURED_KIND_LABELS[value]() }))}
							/>
						)}
					</form.AppField>
				) : null}
				<form.AppField name="ref">
					{(field) =>
						kind === "theme" ? (
							<field.SelectField
								label={m.chaal_admin_featured_theme()}
								options={THEMES.map((value) => ({ value, label: THEME_NAMES[value]() }))}
							/>
						) : (
							<field.TextField
								label={m.chaal_admin_featured_ref()}
								description={m.chaal_admin_featured_ref_hint()}
								autoComplete="off"
								maxLength={200}
							/>
						)
					}
				</form.AppField>
				<LocalizedField
					form={form}
					fields="title"
					label={m.chaal_admin_featured_title_label()}
					description={m.chaal_admin_featured_title_hint()}
					maxLength={120}
				/>
				<div className="grid gap-6 sm:grid-cols-2">
					<form.AppField name="startsOn">
						{(field) => <field.DateField label={m.chaal_admin_featured_starts()} optional />}
					</form.AppField>
					<form.AppField name="endsOn">
						{(field) => <field.DateField label={m.chaal_admin_featured_ends()} optional />}
					</form.AppField>
				</div>
			</FormDialog>
		</form.AppForm>
	);
}
