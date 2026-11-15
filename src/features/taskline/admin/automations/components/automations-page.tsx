import { useSuspenseQuery } from "@tanstack/react-query";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { FormSection } from "@/components/page/form-layout";
import { Page, PageHeader } from "@/components/page/page";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import { m } from "@/paraglide/messages";
import { AutomationRuns } from "../../../automations/components/automation-runs-list";
import { AutomationsEditor } from "../../../automations/components/automations-editor";
import type { AutomationOptions } from "../../../automations/lib/describe";
import { tasklineAdminAllKeys } from "../../keys";
import { adminAutomationPreviewSource } from "../../lib/automation-preview";
import { adminAutomationsQueryOptions, tasklineAdminMutations } from "../../queries";

/**
 * /admin/taskline/automations (Task 56): the team workspace's rules, on every team
 * project's tasks (the builder offers what every project shares: categories, the
 * workspace's labels and fields, the members), and the latest runs of every team
 * automation, its projects' own included. A project's own rules are its lead's.
 */
export function TasklineAutomationsPage() {
	const { data } = useSuspenseQuery(adminAutomationsQueryOptions());
	const create = useCrudMutation(tasklineAdminMutations.createAutomation(), { invalidate: tasklineAdminAllKeys });
	const update = useCrudMutation(tasklineAdminMutations.updateAutomation(), { invalidate: tasklineAdminAllKeys });
	const toggle = useCrudMutation(tasklineAdminMutations.toggleAutomation(), { invalidate: tasklineAdminAllKeys });
	const remove = useCrudMutation(tasklineAdminMutations.deleteAutomation(), { invalidate: tasklineAdminAllKeys });
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
