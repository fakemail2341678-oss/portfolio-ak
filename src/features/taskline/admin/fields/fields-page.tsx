import { useSuspenseQuery } from "@tanstack/react-query";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { FormSection } from "@/components/page/form-layout";
import { Page, PageHeader } from "@/components/page/page";
import { m } from "@/paraglide/messages";
import { FieldsEditor } from "../../custom-fields/fields-editor";
import { ALL_TASKLINE_ADMIN } from "../keys";
import { adminFieldsQueryOptions, tasklineAdminMutations } from "../queries";

/**
 * /admin/taskline/fields (Task 55): the team workspace's custom fields, on every team
 * project's tasks, with how many tasks have a value. A project's own fields are its
 * lead's, in Taskline's project settings.
 */
export function TasklineFieldsPage() {
	const { data } = useSuspenseQuery(adminFieldsQueryOptions());
	const create = useCrudMutation(tasklineAdminMutations.createField(), { invalidate: ALL_TASKLINE_ADMIN });
	const update = useCrudMutation(tasklineAdminMutations.updateField(), { invalidate: ALL_TASKLINE_ADMIN });
	const remove = useCrudMutation(tasklineAdminMutations.deleteField(), { invalidate: ALL_TASKLINE_ADMIN });
	return (
		<Page width="admin" data-testid="taskline-admin-fields">
			<PageHeader title={m.taskline_admin_fields_title()} description={m.taskline_admin_fields_description()} />
			<FormSection title={m.taskline_fields_workspace()} description={m.taskline_admin_fields_hint()}>
				<FieldsEditor
					fields={data.fields}
					counts={new Map(data.fields.map((field) => [field.id, field.tasks]))}
					data-testid="workspace-fields"
					writes={{
						create: (field) => create.mutateAsync({ field }),
						update: (changes) => update.mutateAsync(changes),
						remove: (id) => remove.mutateAsync({ id }),
						reportsErrors: true,
					}}
				/>
			</FormSection>
		</Page>
	);
}
