import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { FormSection } from "@/components/page/form-layout";
import { Badge } from "@/components/ui/badge";
import { m } from "@/paraglide/messages";
import { FieldsEditor } from "../custom-fields/fields-editor";
import { FIELD_TYPE_LABELS } from "../labels";
import { projectTasksQueryOptions, tasklineMutations } from "../queries";

const route = getRouteApi("/_taskline/app/taskline/_shell/$ws/p/$key/settings/fields");

/**
 * Custom fields (Task 55): the project's own (its lead's: new, edited, reordered,
 * archived, deleted) and, read-only here, the workspace's (the admin's).
 */
export function FieldsSettings() {
	const { session } = route.useRouteContext();
	const { ws, key } = route.useParams();
	const userId = session.user.id;
	const queryClient = useQueryClient();
	const { data } = useSuspenseQuery(projectTasksQueryOptions(userId, ws, key));
	const create = useMutation(tasklineMutations.createField(queryClient, userId));
	const update = useMutation(tasklineMutations.updateField(queryClient, userId));
	const remove = useMutation(tasklineMutations.deleteField(queryClient, userId));
	const own = data.fields.filter((field) => field.projectId !== null);
	const shared = data.fields.filter((field) => field.projectId === null && !field.archived);

	return (
		<FormSection title={m.taskline_settings_fields()} description={m.taskline_settings_fields_description()}>
			<FieldsEditor
				fields={own}
				data-testid="project-fields"
				writes={{
					create: (field) => create.mutateAsync({ ws, key, field }),
					update: (changes) => update.mutateAsync({ ws, key, ...changes }),
					remove: (id) => remove.mutateAsync({ ws, key, id }),
				}}
			/>
			{shared.length > 0 ? (
				<div className="flex flex-col gap-2 border-t pt-4">
					<h3 className="font-medium text-body">{m.taskline_fields_workspace()}</h3>
					<p className="text-muted-foreground text-sm">{m.taskline_fields_workspace_note()}</p>
					<ul className="flex flex-wrap gap-2">
						{shared.map((field) => (
							<li key={field.id} className="inline-flex items-center gap-1.5 rounded-full border px-2 text-caption">
								{field.name}
								<Badge variant="outline" className="h-4 px-1 text-[0.65rem]">
									{FIELD_TYPE_LABELS[field.type]()}
								</Badge>
							</li>
						))}
					</ul>
				</div>
			) : null}
		</FormSection>
	);
}
