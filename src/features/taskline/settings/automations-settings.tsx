import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { FormSection } from "@/components/page/form-layout";
import { Badge } from "@/components/ui/badge";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import { m } from "@/paraglide/messages";
import { AutomationRuns } from "../automations/automation-runs";
import { AutomationSentence, AutomationsEditor } from "../automations/automations-editor";
import type { AutomationOptions } from "../automations/describe";
import {
	automationPreviewSource,
	projectAutomationsQueryOptions,
	projectTasksQueryOptions,
	tasklineMutations,
} from "../queries";

const route = getRouteApi("/_taskline/app/taskline/_shell/$ws/p/$key/settings/automations");

/**
 * Automations (Task 56): the project's own rules (its lead's: the builder, on and off,
 * delete), the workspace's that run on its tasks too (read-only here: the admin's),
 * and its rules' latest runs.
 */
export function AutomationsSettings() {
	const { session } = route.useRouteContext();
	const { ws, key } = route.useParams();
	const userId = session.user.id;
	const queryClient = useQueryClient();
	const { data: project } = useSuspenseQuery(projectTasksQueryOptions(userId, ws, key));
	const { data } = useSuspenseQuery(projectAutomationsQueryOptions(userId, ws, key));
	const create = useMutation(tasklineMutations.createAutomation(queryClient, userId));
	const update = useMutation(tasklineMutations.updateAutomation(queryClient, userId));
	const toggle = useMutation(tasklineMutations.toggleAutomation(queryClient, userId));
	const remove = useMutation(tasklineMutations.deleteAutomation(queryClient, userId));
	const now = useMinuteClock(Date.parse(project.readAt));
	const options: AutomationOptions = {
		scope: "project",
		statuses: project.statuses,
		labels: project.labels,
		members: project.members,
		fields: project.fields,
		sprints: project.sprints,
	};
	return (
		<div className="flex flex-col gap-8">
			<FormSection
				title={m.taskline_settings_automations()}
				description={m.taskline_settings_automations_description()}
			>
				<AutomationsEditor
					automations={data.automations}
					options={options}
					now={now}
					data-testid="project-automations"
					writes={{
						create: (automation) => create.mutateAsync({ ws, key, automation }),
						update: (input) => update.mutateAsync({ ws, key, ...input }),
						toggle: (input) => toggle.mutateAsync({ ws, key, ...input }),
						remove: (id) => remove.mutateAsync({ ws, key, id }),
						preview: automationPreviewSource(userId, ws, key),
					}}
				/>
				{data.workspace.length > 0 ? (
					<div className="flex flex-col gap-2 border-t pt-4">
						<h3 className="font-medium text-body">{m.taskline_automations_workspace()}</h3>
						<p className="text-muted-foreground text-sm">{m.taskline_automations_workspace_note()}</p>
						<ul className="flex flex-col gap-3">
							{data.workspace.map((automation) => (
								<li key={automation.id} className="flex flex-col gap-1">
									<span className="flex flex-wrap items-center gap-2">
										<span className="font-medium">{automation.name}</span>
										{automation.enabled ? null : <Badge variant="secondary">{m.taskline_automation_off()}</Badge>}
									</span>
									<AutomationSentence automation={automation} options={{ ...options, scope: "workspace" }} />
								</li>
							))}
						</ul>
					</div>
				) : null}
			</FormSection>
			<AutomationRuns runs={data.runs} ws={ws} now={now} heading="h2" />
		</div>
	);
}
