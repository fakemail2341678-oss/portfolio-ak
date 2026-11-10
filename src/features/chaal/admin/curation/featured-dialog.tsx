import { formOptions, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { LocalizedField } from "@/components/forms/fields/localized-fields";
import { m } from "@/paraglide/messages";
import { type ChaalFeaturedSection, SECTION_KINDS } from "../../home/curation";
import { chaalKeys } from "../../keys";
import { PUZZLE_ANGLES } from "../../puzzles/angles";
import { THEME_NAMES } from "../../puzzles/themes";
import { FEATURED_KIND_LABELS } from "../labels";
import { chaalAdminMutations } from "../queries";
import { type ChaalAdminFeatured, type ChaalFeaturedFormValues, chaalFeaturedInput } from "../schema";

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
	const queryClient = useQueryClient();
	const create = useMutation(chaalAdminMutations.createFeatured());
	const update = useMutation(chaalAdminMutations.updateFeatured());
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
			validators: formValidators(chaalFeaturedInput),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				const input = chaalFeaturedInput.parse(value);
				if (item) await update.mutateAsync({ ...input, id: item.id, updatedAt: item.updatedAt });
				else await create.mutateAsync(input);
				formApi.reset(value);
				onClose();
				toast.success(item ? m.ch_admin_featured_saved() : m.ch_admin_featured_created());
				await queryClient.invalidateQueries({ queryKey: chaalKeys.adminCuration() });
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	const kind = useStore(form.store, (state) => state.values.kind);
	return (
		<form.AppForm>
			<FormDialog
				title={item ? m.ch_admin_featured_edit_title() : m.ch_admin_featured_new_title()}
				description={m.ch_admin_featured_dialog_description()}
				submitLabel={item ? m.crud_save() : m.ch_admin_featured_submit()}
				pendingLabel={m.crud_saving()}
				onClose={onClose}
				data-testid="chaal-featured-dialog"
			>
				{kinds.length > 1 ? (
					<form.AppField name="kind">
						{(field) => (
							<field.RadioGroupField
								label={m.ch_admin_col_kind()}
								options={kinds.map((value) => ({ value, label: FEATURED_KIND_LABELS[value]() }))}
							/>
						)}
					</form.AppField>
				) : null}
				<form.AppField name="ref">
					{(field) =>
						kind === "theme" ? (
							<field.SelectField
								label={m.ch_admin_featured_theme()}
								options={THEMES.map((value) => ({ value, label: THEME_NAMES[value]() }))}
							/>
						) : (
							<field.TextField
								label={m.ch_admin_featured_ref()}
								description={m.ch_admin_featured_ref_hint()}
								autoComplete="off"
								maxLength={200}
							/>
						)
					}
				</form.AppField>
				<LocalizedField
					form={form}
					fields="title"
					label={m.ch_admin_featured_title_label()}
					description={m.ch_admin_featured_title_hint()}
					maxLength={120}
				/>
				<div className="grid gap-6 sm:grid-cols-2">
					<form.AppField name="startsOn">
						{(field) => <field.DateField label={m.ch_admin_featured_starts()} optional />}
					</form.AppField>
					<form.AppField name="endsOn">
						{(field) => <field.DateField label={m.ch_admin_featured_ends()} optional />}
					</form.AppField>
				</div>
			</FormDialog>
		</form.AppForm>
	);
}
