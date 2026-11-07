import { formOptions } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { ALL_TASKLINE_ADMIN } from "../keys";
import { tasklineAdminMutations } from "../queries";
import type { AdminProjectDetail } from "../schema";

/**
 * Deleting a project for good (loaded on click, decision 0168): its tasks and their
 * history go, and its key is retired. The key has to be typed again, so it can't be a
 * slip of the hand; the server checks it too.
 */
export default function DeleteProjectDialog({
	project,
	onClose,
}: {
	project: Pick<AdminProjectDetail, "id" | "key" | "name" | "counts">;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const remove = useMutation(tasklineAdminMutations.deleteProject());
	const form = useAppForm({
		...formOptions({
			defaultValues: { confirmKey: "" },
			validators: formValidators(
				z.object({
					confirmKey: z.string().refine((value) => value.trim().toUpperCase() === project.key, {
						error: () => m.taskline_admin_delete_mismatch({ key: project.key }),
					}),
				}),
			),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				await remove.mutateAsync({ id: project.id, confirmKey: value.confirmKey });
				formApi.reset(value);
				onClose();
				toast.success(m.taskline_admin_toast_deleted({ key: project.key }));
				await navigate({ to: "/admin/taskline/projects" });
				await Promise.all(ALL_TASKLINE_ADMIN.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	return (
		<form.AppForm>
			<FormDialog
				title={m.taskline_admin_delete_title({ name: project.name })}
				description={m.taskline_admin_delete_body({
					tasks: formatNumber(project.counts.tasks + project.counts.trashed),
					key: project.key,
				})}
				submitLabel={m.taskline_admin_delete_confirm()}
				onClose={onClose}
				data-testid="delete-project-dialog"
			>
				<form.AppField name="confirmKey">
					{(field) => (
						<field.TextField
							label={m.taskline_admin_delete_type_key({ key: project.key })}
							autoComplete="off"
							maxLength={6}
						/>
					)}
				</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}
