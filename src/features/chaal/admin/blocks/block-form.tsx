import { formOptions, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { m } from "@/paraglide/messages";
import { chaalKeys } from "../../keys";
import { BLOCK_KIND_LABELS } from "../labels";
import { chaalAdminMutations } from "../queries";
import { BLOCK_KINDS, type ChaalBlockFormValues, chaalBlockInput } from "../schema";

/**
 * Block a player (PLAN Task 79, decision 0268): a Lichess account by its username, or a site
 * user by their email, with a reason. Blocking revokes the connection it names. A dialog on
 * the blocks list ("Block") and on a connection ("Block this account", filled in), loaded on
 * demand: no route of its own, which keeps the entry chunk inside its budget.
 */
export function BlockDialog({ lichess, onClose }: { lichess?: string | undefined; onClose: () => void }) {
	const queryClient = useQueryClient();
	const block = useMutation(chaalAdminMutations.block());
	const form = useAppForm({
		...formOptions({
			defaultValues: { kind: "lichess", target: lichess ?? "", reason: "" } as ChaalBlockFormValues,
			validators: formValidators(chaalBlockInput),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				await block.mutateAsync(chaalBlockInput.parse(value));
				formApi.reset(value);
				onClose();
				toast.success(m.ch_admin_block_created());
				await Promise.all([
					queryClient.invalidateQueries({ queryKey: chaalKeys.adminBlocks() }),
					queryClient.invalidateQueries({ queryKey: chaalKeys.adminConnections() }),
				]);
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	const kind = useStore(form.store, (state) => state.values.kind);
	return (
		<form.AppForm>
			<FormDialog
				title={m.ch_admin_block_new_title()}
				description={m.ch_admin_block_new_description()}
				submitLabel={m.ch_admin_block_submit()}
				onClose={onClose}
				data-testid="chaal-block-dialog"
			>
				<form.AppField name="kind">
					{(field) => (
						<field.RadioGroupField
							label={m.ch_admin_col_kind()}
							options={BLOCK_KINDS.map((value) => ({ value, label: BLOCK_KIND_LABELS[value]() }))}
						/>
					)}
				</form.AppField>
				<form.AppField name="target">
					{(field) =>
						kind === "user" ? (
							<field.TextField
								label={m.ch_admin_block_email()}
								description={m.ch_admin_block_email_hint()}
								type="email"
								autoComplete="off"
							/>
						) : (
							<field.TextField
								label={m.ch_admin_block_username()}
								description={m.ch_admin_block_username_hint()}
								autoComplete="off"
								maxLength={30}
							/>
						)
					}
				</form.AppField>
				<form.AppField name="reason">
					{(field) => (
						<field.TextareaField
							label={m.ch_admin_col_reason()}
							description={m.ch_admin_block_reason_hint()}
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
