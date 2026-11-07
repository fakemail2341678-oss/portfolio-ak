import { fn } from "storybook/test";
import type {
	AdminProjectDetail,
	AdminProjectPage,
	ProjectExport,
} from "../../../../src/features/taskline/admin/schema";
import { sampleTasklineWorkflows } from "./settings";

// Stand-ins for src/functions/taskline-admin/projects.ts.
export const sampleAdminProject: AdminProjectDetail = {
	id: "11111111-1111-4111-8111-111111111111",
	key: "WEB",
	name: "Website relaunch",
	color: "teal",
	visibility: "team",
	status: "active",
	health: "on_track",
	lead: { id: "55555555-5555-4555-8555-555555555551", name: "Sita Sharma" },
	members: 3,
	open: 18,
	archived: false,
	updatedAt: "2026-10-30T09:00:00.000Z",
	ws: "team",
	description: "",
	startOn: "2026-09-01",
	targetOn: "2026-12-15",
	version: 2,
	projectMembers: [
		{ memberId: "55555555-5555-4555-8555-555555555551", name: "Sita Sharma", email: "sita@example.com", role: "lead" },
		{ memberId: "55555555-5555-4555-8555-555555555552", name: "Ram Thapa", email: "ram@example.com", role: "member" },
	],
	statuses: sampleTasklineWorkflows.statuses.map((status, index) => ({
		...status,
		id: `66666666-6666-4666-8666-66666666666${index}`,
		position: `a${index}`,
		wipLimit: status.category === "started" ? 5 : null,
		tasks: [6, 8, 4, 31, 2][index] ?? 0,
	})),
	labels: [],
	counts: { tasks: 51, done: 31, trashed: 2 },
};

export const listTasklineAdminProjects = fn(
	async (_options: { data: unknown }): Promise<AdminProjectPage> => ({
		items: [sampleAdminProject],
		total: 1,
		page: 1,
		pageCount: 1,
	}),
).mockName("listTasklineAdminProjects");
export const getTasklineAdminProject = fn(
	async (_options: { data: unknown }): Promise<AdminProjectDetail> => sampleAdminProject,
).mockName("getTasklineAdminProject");
export const isTasklineProjectKeyFree = fn(async (_options: { data: unknown }): Promise<boolean> => true).mockName(
	"isTasklineProjectKeyFree",
);
const write = (name: string) =>
	fn(async (_options: { data: unknown }): Promise<AdminProjectDetail> => sampleAdminProject).mockName(name);
export const createTasklineAdminProject = write("createTasklineAdminProject");
export const updateTasklineAdminProject = write("updateTasklineAdminProject");
export const setTasklineAdminProjectState = write("setTasklineAdminProjectState");
export const setTasklineAdminProjectArchived = write("setTasklineAdminProjectArchived");
export const transferTasklineProjectLead = write("transferTasklineProjectLead");
export const setTasklineAdminProjectMember = write("setTasklineAdminProjectMember");
export const removeTasklineAdminProjectMember = write("removeTasklineAdminProjectMember");
export const deleteTasklineAdminProject = fn(async (_options: { data: unknown }): Promise<void> => undefined).mockName(
	"deleteTasklineAdminProject",
);
export const exportTasklineAdminProject = fn(
	async (_options: { data: unknown }): Promise<ProjectExport> => ({
		filename: "web.json",
		type: "application/json",
		content: "{}",
	}),
).mockName("exportTasklineAdminProject");
