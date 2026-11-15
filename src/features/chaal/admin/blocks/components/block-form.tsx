import { formOptions, useStore } from "@tanstack/react-form";
import { useCrudForm } from "@/components/crud/use-crud-form";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, useAppForm } from "@/components/forms";
import { m } from "@/paraglide/messages";
import { chaalKeys } from "../../../keys";
import { BLOCK_KIND_LABELS } from "../../labels";
import { chaalAdminMutations } from "../../queries";
import { BLOCK_KINDS, type ChaalBlockFormValues, chaalBlockInputSchema } from "../../schema";

/**
 * Block a player (PLAN Task 79, decision 0268): a Lichess account by its username, or a site
 * user by their email, with a reason. Blocking revokes the connection it names. A dialog on
 * the blocks list ("Block") and on a connection ("Block this account", filled in), loaded on
 * demand: no route of its own, which keeps the entry chunk inside its budget.
 */
export function BlockDialog({ lichess, onClose }: { lichess?: string | undefined; onClose: () => void }) {
	const crud = useCrudForm({
		toInput: (values: ChaalBlockFormValues) => chaalBlockInputSchema.parse(values),
		create: chaalAdminMutations.block(),
		invalidate: [chaalKeys.adminBlocks(), chaalKeys.adminConnections()],
		onSaved: onClose,
		messages: { created: () => m.chaal_admin_block_created() },
	});
	const form = useAppForm({
		...formOptions({
			defaultValues: { kind: "lichess", target: lichess ?? "", reason: "" } as ChaalBlockFormValues,
			validators: formValidators(chaalBlockInputSchema),
		}),
		...crud.formProps,
	});
	const kind = useStore(form.store, (state) => state.values.kind);
	return (
		<form.AppForm>
			<FormDialog
				title={m.chaal_admin_block_new_title()}
				description={m.chaal_admin_block_new_description()}
				submitLabel={m.chaal_admin_block_submit()}
				onClose={onClose}
				data-testid="chaal-block-dialog"
			>
				<form.AppField name="kind">
					{(field) => (
						<field.RadioGroupField
							label={m.chaal_admin_col_kind()}
							options={BLOCK_KINDS.map((value) => ({ value, label: BLOCK_KIND_LABELS[value]() }))}
						/>
					)}
				</form.AppField>
				<form.AppField name="target">
					{(field) =>
						kind === "user" ? (
							<field.TextField
								label={m.chaal_admin_block_email()}
								description={m.chaal_admin_block_email_hint()}
								type="email"
								autoComplete="off"
							/>
						) : (
							<field.TextField
								label={m.chaal_admin_block_username()}
								description={m.chaal_admin_block_username_hint()}
								autoComplete="off"
								maxLength={30}
							/>
						)
					}
				</form.AppField>
				<form.AppField name="reason">
					{(field) => (
						<field.TextareaField
							label={m.chaal_admin_col_reason()}
							description={m.chaal_admin_block_reason_hint()}
							rows={3}
							maxLength={500}
							showCount
						/>
					)}
				</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}
