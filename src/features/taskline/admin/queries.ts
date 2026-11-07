import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { getTasklineActivityOptions, listTasklineActivity } from "@/functions/taskline-admin/activity";
import {
	createTasklineWorkspaceAutomation,
	deleteTasklineWorkspaceAutomation,
	listTasklineWorkspaceAutomations,
	previewTasklineWorkspaceAutomation,
	toggleTasklineWorkspaceAutomation,
	updateTasklineWorkspaceAutomation,
} from "@/functions/taskline-admin/automations";
import {
	createTasklineWorkspaceField,
	deleteTasklineWorkspaceField,
	listTasklineWorkspaceFields,
	updateTasklineWorkspaceField,
} from "@/functions/taskline-admin/fields";
import {
	addTasklineMembers,
	deactivateTasklineMember,
	inviteTasklineMember,
	listTasklineInvitations,
	listTasklineMemberOptions,
	listTasklineMembers,
	reactivateTasklineMember,
	resendTasklineInvitation,
	revokeTasklineInvitation,
	searchTasklineAccounts,
	updateTasklineMember,
} from "@/functions/taskline-admin/members";
import { getTasklineOverview } from "@/functions/taskline-admin/overview";
import {
	createTasklineAdminProject,
	deleteTasklineAdminProject,
	exportTasklineAdminProject,
	getTasklineAdminProject,
	isTasklineProjectKeyFree,
	listTasklineAdminProjects,
	removeTasklineAdminProjectMember,
	setTasklineAdminProjectArchived,
	setTasklineAdminProjectMember,
	setTasklineAdminProjectState,
	transferTasklineProjectLead,
	updateTasklineAdminProject,
} from "@/functions/taskline-admin/projects";
import { getTasklineAdminReports } from "@/functions/taskline-admin/reports";
import {
	createTasklineWorkspaceLabel,
	deleteTasklineWorkspaceLabel,
	getTasklineWorkflows,
	getTasklineWorkspace,
	updateTasklineWorkflows,
	updateTasklineWorkspace,
	updateTasklineWorkspaceLabel,
} from "@/functions/taskline-admin/settings";
import {
	createTasklineAdminTemplate,
	deleteTasklineAdminTemplate,
	listTasklineAdminTemplateChoices,
	listTasklineAdminTemplates,
	saveTasklineProjectAsTemplate,
	updateTasklineAdminTemplate,
} from "@/functions/taskline-admin/templates";
import {
	deleteTasklineAdminTimeEntry,
	exportTasklineTimeEntries,
	getTasklineTimeOptions,
	getTasklineUtilization,
	listTasklineTimeEntries,
	setTasklineTimesheetLock,
	updateTasklineAdminTimeEntry,
} from "@/functions/taskline-admin/time";
import type {
	AutomationCondition,
	ProjectHealth,
	ProjectRole,
	ProjectStatus,
	ReportRange,
	TasklineColor,
	TeamRole,
} from "../types";
import { adminActivityKeys, adminMemberKeys, adminProjectKeys, adminTimeKeys, tasklineAdminKeys } from "./keys";
import type {
	AdminCreateAutomationInput,
	AdminCreateFieldInput,
	AdminCreateProjectInput,
	AdminCreateTemplateInput,
	AdminUpdateAutomationInput,
	AdminUpdateFieldInput,
	AdminUpdateProjectInput,
	AdminUpdateTemplateInput,
	AdminUpdateTimeEntryInput,
	InviteMemberInput,
	SaveProjectAsTemplateInput,
	UpdateMemberInput,
	UpdateWorkflowsInput,
	UpdateWorkspaceInput,
} from "./schema";
import type { AdminActivityListInput, AdminMemberListInput, AdminProjectListInput, AdminTimeListInput } from "./search";

/** /admin/taskline's reads (queryOptions) and writes (mutationOptions); routes load this on demand (0194). */

export const tasklineOverviewQueryOptions = () =>
	queryOptions({ queryKey: tasklineAdminKeys.overview(), queryFn: () => getTasklineOverview() });

export const adminProjectListQueryOptions = (input: AdminProjectListInput) =>
	queryOptions({ queryKey: adminProjectKeys.list(input), queryFn: () => listTasklineAdminProjects({ data: input }) });

export const adminProjectQueryOptions = (id: string) =>
	queryOptions({ queryKey: adminProjectKeys.detail(id), queryFn: () => getTasklineAdminProject({ data: { id } }) });

export const memberOptionsQueryOptions = () =>
	queryOptions({ queryKey: tasklineAdminKeys.memberOptions(), queryFn: () => listTasklineMemberOptions() });

export const adminMemberListQueryOptions = (input: AdminMemberListInput) =>
	queryOptions({ queryKey: adminMemberKeys.list(input), queryFn: () => listTasklineMembers({ data: input }) });

export const invitationsQueryOptions = () =>
	queryOptions({ queryKey: tasklineAdminKeys.invitations(), queryFn: () => listTasklineInvitations() });

export const adminWorkspaceQueryOptions = () =>
	queryOptions({ queryKey: tasklineAdminKeys.workspace(), queryFn: () => getTasklineWorkspace() });

/** Task 56: the workspace's automations, the team's runs, and what the builder offers. */
export const adminAutomationsQueryOptions = () =>
	queryOptions({ queryKey: tasklineAdminKeys.automations(), queryFn: () => listTasklineWorkspaceAutomations() });

/** The team's templates and the built-ins (Task 57). */
export const adminTemplatesQueryOptions = () =>
	queryOptions({ queryKey: tasklineAdminKeys.templates(), queryFn: () => listTasklineAdminTemplates() });

/** What the admin's "New project" offers. */
export const adminTemplateChoicesQueryOptions = () =>
	queryOptions({ queryKey: tasklineAdminKeys.templateChoices(), queryFn: () => listTasklineAdminTemplateChoices() });

/** Health, workload and time across the team, over some weeks. */
export const adminReportsQueryOptions = (range: ReportRange) =>
	queryOptions({
		queryKey: tasklineAdminKeys.reports(range),
		queryFn: () => getTasklineAdminReports({ data: { range } }),
	});

/** How many of the team's open tasks some conditions match now (the builder's preview, keyed by the conditions). */
export const adminAutomationPreviewSource = () => ({
	queryKey: tasklineAdminKeys.automationPreview(),
	run: (conditions: AutomationCondition[]) => previewTasklineWorkspaceAutomation({ data: { conditions } }),
});

/** Task 55: the workspace's custom fields. */
export const adminFieldsQueryOptions = () =>
	queryOptions({ queryKey: tasklineAdminKeys.fields(), queryFn: () => listTasklineWorkspaceFields() });

export const adminWorkflowsQueryOptions = () =>
	queryOptions({ queryKey: tasklineAdminKeys.workflows(), queryFn: () => getTasklineWorkflows() });

export const adminActivityQueryOptions = (input: AdminActivityListInput) =>
	queryOptions({ queryKey: adminActivityKeys.list(input), queryFn: () => listTasklineActivity({ data: input }) });

export const activityOptionsQueryOptions = () =>
	queryOptions({ queryKey: tasklineAdminKeys.activityOptions(), queryFn: () => getTasklineActivityOptions() });

/** Task 53: the team's time entries, the page's choices (and the lock date), utilization. */
export const adminTimeListQueryOptions = (input: AdminTimeListInput) =>
	queryOptions({ queryKey: adminTimeKeys.list(input), queryFn: () => listTasklineTimeEntries({ data: input }) });

export const timeOptionsQueryOptions = () =>
	queryOptions({ queryKey: tasklineAdminKeys.timeOptions(), queryFn: () => getTasklineTimeOptions() });

export const utilizationQueryOptions = (from: string, to: string) =>
	queryOptions({
		queryKey: tasklineAdminKeys.utilization(from, to),
		queryFn: () => getTasklineUtilization({ data: { from, to } }),
	});

/** The "Add people" picker's search (AsyncComboboxField, RelationField). */
export const accountSearch = {
	queryKey: tasklineAdminKeys.accounts(),
	search: (q: string) => searchTasklineAccounts({ data: { q } }),
};

/** The create form's check while typing. */
export const isProjectKeyFree = (key: string) => isTasklineProjectKeyFree({ data: { key } });

const key = (name: string) => [...tasklineAdminKeys.all, "mutation", name] as const;

/** Writes, keyed (useMutationState can find them). useCrudMutation and useCrudForm add the rest. */
export const tasklineAdminMutations = {
	createProject: () =>
		mutationOptions({
			mutationKey: key("create-project"),
			mutationFn: (input: AdminCreateProjectInput) => createTasklineAdminProject({ data: input }),
		}),
	updateProject: () =>
		mutationOptions({
			mutationKey: key("update-project"),
			mutationFn: (input: AdminUpdateProjectInput) => updateTasklineAdminProject({ data: input }),
		}),
	setProjectState: () =>
		mutationOptions({
			mutationKey: key("project-state"),
			mutationFn: (input: { id: string; status?: Exclude<ProjectStatus, "archived">; health?: ProjectHealth | null }) =>
				setTasklineAdminProjectState({ data: input }),
		}),
	setProjectArchived: () =>
		mutationOptions({
			mutationKey: key("archive-project"),
			mutationFn: (input: { id: string; archived: boolean }) => setTasklineAdminProjectArchived({ data: input }),
		}),
	transferLead: () =>
		mutationOptions({
			mutationKey: key("transfer-lead"),
			mutationFn: (input: { id: string; memberId: string }) => transferTasklineProjectLead({ data: input }),
		}),
	deleteProject: () =>
		mutationOptions({
			mutationKey: key("delete-project"),
			mutationFn: (input: { id: string; confirmKey: string }) => deleteTasklineAdminProject({ data: input }),
		}),
	exportProject: () =>
		mutationOptions({
			mutationKey: key("export-project"),
			mutationFn: (input: { id: string; format: "json" | "csv" }) => exportTasklineAdminProject({ data: input }),
		}),
	setProjectMember: () =>
		mutationOptions({
			mutationKey: key("project-member"),
			mutationFn: (input: { id: string; memberId: string; role: ProjectRole }) =>
				setTasklineAdminProjectMember({ data: input }),
		}),
	removeProjectMember: () =>
		mutationOptions({
			mutationKey: key("remove-project-member"),
			mutationFn: (input: { id: string; memberId: string }) => removeTasklineAdminProjectMember({ data: input }),
		}),
	addMembers: () =>
		mutationOptions({
			mutationKey: key("add-members"),
			mutationFn: (input: { userIds: string[]; role: TeamRole }) => addTasklineMembers({ data: input }),
		}),
	updateMember: () =>
		mutationOptions({
			mutationKey: key("update-member"),
			mutationFn: (input: UpdateMemberInput) => updateTasklineMember({ data: input }),
		}),
	deactivateMember: () =>
		mutationOptions({
			mutationKey: key("deactivate-member"),
			mutationFn: (input: { id: string; reassignTo: string | null }) => deactivateTasklineMember({ data: input }),
		}),
	reactivateMember: () =>
		mutationOptions({
			mutationKey: key("reactivate-member"),
			mutationFn: (input: { id: string }) => reactivateTasklineMember({ data: input }),
		}),
	invite: () =>
		mutationOptions({
			mutationKey: key("invite"),
			mutationFn: (input: InviteMemberInput) => inviteTasklineMember({ data: input }),
		}),
	resendInvitation: () =>
		mutationOptions({
			mutationKey: key("resend-invitation"),
			mutationFn: (input: { id: string }) => resendTasklineInvitation({ data: input }),
		}),
	revokeInvitation: () =>
		mutationOptions({
			mutationKey: key("revoke-invitation"),
			mutationFn: (input: { id: string }) => revokeTasklineInvitation({ data: input }),
		}),
	updateWorkspace: () =>
		mutationOptions({
			mutationKey: key("update-workspace"),
			mutationFn: (input: UpdateWorkspaceInput & { id: string }) => {
				const { id: _id, ...data } = input;
				return updateTasklineWorkspace({ data });
			},
		}),
	updateWorkflows: () =>
		mutationOptions({
			mutationKey: key("update-workflows"),
			mutationFn: (input: UpdateWorkflowsInput) => updateTasklineWorkflows({ data: input }),
		}),
	createLabel: () =>
		mutationOptions({
			mutationKey: key("create-label"),
			mutationFn: (input: { name: string; color: TasklineColor }) => createTasklineWorkspaceLabel({ data: input }),
		}),
	updateLabel: () =>
		mutationOptions({
			mutationKey: key("update-label"),
			mutationFn: (input: { id: string; name: string; color: TasklineColor }) =>
				updateTasklineWorkspaceLabel({ data: input }),
		}),
	deleteLabel: () =>
		mutationOptions({
			mutationKey: key("delete-label"),
			mutationFn: (input: { id: string }) => deleteTasklineWorkspaceLabel({ data: input }),
		}),
	createField: () =>
		mutationOptions({
			mutationKey: key("create-field"),
			mutationFn: (input: AdminCreateFieldInput) => createTasklineWorkspaceField({ data: input }),
		}),
	updateField: () =>
		mutationOptions({
			mutationKey: key("update-field"),
			mutationFn: (input: AdminUpdateFieldInput) => updateTasklineWorkspaceField({ data: input }),
		}),
	deleteField: () =>
		mutationOptions({
			mutationKey: key("delete-field"),
			mutationFn: (input: { id: string }) => deleteTasklineWorkspaceField({ data: input }),
		}),
	createAutomation: () =>
		mutationOptions({
			mutationKey: key("create-automation"),
			mutationFn: (input: AdminCreateAutomationInput) => createTasklineWorkspaceAutomation({ data: input }),
		}),
	updateAutomation: () =>
		mutationOptions({
			mutationKey: key("update-automation"),
			mutationFn: (input: AdminUpdateAutomationInput) => updateTasklineWorkspaceAutomation({ data: input }),
		}),
	toggleAutomation: () =>
		mutationOptions({
			mutationKey: key("toggle-automation"),
			mutationFn: (input: { id: string; enabled: boolean }) => toggleTasklineWorkspaceAutomation({ data: input }),
		}),
	deleteAutomation: () =>
		mutationOptions({
			mutationKey: key("delete-automation"),
			mutationFn: (input: { id: string }) => deleteTasklineWorkspaceAutomation({ data: input }),
		}),
	createTemplate: () =>
		mutationOptions({
			mutationKey: key("create-template"),
			mutationFn: (input: AdminCreateTemplateInput) => createTasklineAdminTemplate({ data: input }),
		}),
	updateTemplate: () =>
		mutationOptions({
			mutationKey: key("update-template"),
			mutationFn: (input: AdminUpdateTemplateInput) => updateTasklineAdminTemplate({ data: input }),
		}),
	deleteTemplate: () =>
		mutationOptions({
			mutationKey: key("delete-template"),
			mutationFn: (input: { id: string }) => deleteTasklineAdminTemplate({ data: input }),
		}),
	saveProjectAsTemplate: () =>
		mutationOptions({
			mutationKey: key("save-project-as-template"),
			mutationFn: (input: SaveProjectAsTemplateInput) => saveTasklineProjectAsTemplate({ data: input }),
		}),
	updateTimeEntry: () =>
		mutationOptions({
			mutationKey: key("update-time"),
			mutationFn: (input: AdminUpdateTimeEntryInput) => updateTasklineAdminTimeEntry({ data: input }),
		}),
	deleteTimeEntry: () =>
		mutationOptions({
			mutationKey: key("delete-time"),
			mutationFn: (input: { id: string }) => deleteTasklineAdminTimeEntry({ data: input }),
		}),
	setTimesheetLock: () =>
		mutationOptions({
			mutationKey: key("time-lock"),
			mutationFn: (input: { lockOn: string | null }) => setTasklineTimesheetLock({ data: input }),
		}),
	exportTime: () =>
		mutationOptions({
			mutationKey: key("export-time"),
			mutationFn: (input: AdminTimeListInput) => exportTasklineTimeEntries({ data: input }),
		}),
};
