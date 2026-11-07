import { useSuspenseQuery } from "@tanstack/react-query";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { FormSection } from "@/components/page/form-layout";
import { Page, PageHeader } from "@/components/page/page";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import { m } from "@/paraglide/messages";
import { AutomationRuns } from "../../automations/automation-runs";
import { AutomationsEditor } from "../../automations/automations-editor";
import type { AutomationOptions } from "../../automations/describe";
import { ALL_TASKLINE_ADMIN } from "../keys";
import { adminAutomationPreviewSource, adminAutomationsQueryOptions, tasklineAdminMutations } from "../queries";

/**
 * /admin/taskline/automations (Task 56): the team workspace's rules, on every team
 * project's tasks (the builder offers what every project shares: categories, the
 * workspace's labels and fields, the members), and the latest runs of every team
 * automation, its projects' own included. A project's own rules are its lead's.
 */
export function TasklineAutomationsPage() {
	const { data } = useSuspenseQuery(adminAutomationsQueryOptions());
	const create = useCrudMutation(tasklineAdminMutations.createAutomation(), { invalidate: ALL_TASKLINE_ADMIN });
	const update = useCrudMutation(tasklineAdminMutations.updateAutomation(), { invalidate: ALL_TASKLINE_ADMIN });
	const toggle = useCrudMutation(tasklineAdminMutations.toggleAutomation(), { invalidate: ALL_TASKLINE_ADMIN });
	const remove = useCrudMutation(tasklineAdminMutations.deleteAutomation(), { invalidate: ALL_TASKLINE_ADMIN });
	const now = useMinuteClock(Date.parse(data.readAt));
	const options: AutomationOptions = {
		scope: "workspace",
		statuses: [],
		labels: data.labels,
		members: data.members,
		fields: data.fields,
		sprints: [],
	};
	return (
		<Page width="admin" data-testid="taskline-admin-automations">
			<PageHeader
				title={m.taskline_admin_automations_title()}
				description={m.taskline_admin_automations_description()}
			/>
			<FormSection title={m.taskline_automations_workspace()} description={m.taskline_admin_automations_hint()}>
				<AutomationsEditor
					automations={data.automations}
					options={options}
					now={now}
					data-testid="workspace-automations"
					writes={{
						create: (automation) => create.mutateAsync({ automation }),
						update: (input) => update.mutateAsync(input),
						toggle: (input) => toggle.mutateAsync(input),
						remove: (id) => remove.mutateAsync({ id }),
						preview: adminAutomationPreviewSource(),
						reportsErrors: true,
					}}
				/>
			</FormSection>
			<AutomationRuns runs={data.runs} ws={data.ws} now={now} heading="h2" />
		</Page>
	);
}
