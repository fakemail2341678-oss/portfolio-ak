import { fn } from "storybook/test";
import type {
	ProjectDetail,
	ProjectLocation,
	ProjectMemberView,
	ProjectSummary,
	ProjectUpdate,
} from "../../../../src/features/taskline/types";
import { sampleProjectTasks, sampleProjectUpdates } from "../../taskline";

// Stand-ins for src/functions/taskline/projects.ts.
const detail = (): ProjectDetail => sampleProjectTasks.project;
export const listTasklineProjects = fn(async (): Promise<ProjectSummary[]> => [detail()]).mockName(
	"listTasklineProjects",
);
export const createTasklineProject = fn(
	async (_options: { data: unknown }): Promise<ProjectDetail> => detail(),
).mockName("createTasklineProject");
export const updateTasklineProject = fn(
	async (_options: { data: unknown }): Promise<ProjectDetail> => detail(),
).mockName("updateTasklineProject");
export const setTasklineProjectState = fn(
	async (_options: { data: unknown }): Promise<ProjectDetail> => detail(),
).mockName("setTasklineProjectState");
export const setTasklineProjectArchived = fn(
	async (_options: { data: unknown }): Promise<ProjectDetail> => detail(),
).mockName("setTasklineProjectArchived");
export const setTasklineProjectStar = fn(async (_options: { data: unknown }): Promise<void> => undefined).mockName(
	"setTasklineProjectStar",
);
export const joinTasklineProject = fn(async (_options: { data: unknown }): Promise<ProjectDetail> => detail()).mockName(
	"joinTasklineProject",
);
const people = (): ProjectMemberView[] =>
	sampleProjectTasks.members.map((member) => ({
		memberId: member.id,
		name: member.name,
		role: "member",
		placeholder: member.placeholder,
	}));
export const listTasklineProjectUpdates = fn(async (): Promise<ProjectUpdate[]> => sampleProjectUpdates).mockName(
	"listTasklineProjectUpdates",
);
export const postTasklineProjectUpdate = fn(
	async (): Promise<ProjectUpdate> => sampleProjectUpdates[0] as ProjectUpdate,
).mockName("postTasklineProjectUpdate");
export const deleteTasklineProjectUpdate = fn(async (): Promise<void> => undefined).mockName(
	"deleteTasklineProjectUpdate",
);
export const listTasklineProjectMembers = fn(async (): Promise<ProjectMemberView[]> => people()).mockName(
	"listTasklineProjectMembers",
);
export const setTasklineProjectMember = fn(
	async (_options: { data: unknown }): Promise<ProjectMemberView[]> => people(),
).mockName("setTasklineProjectMember");
export const removeTasklineProjectMember = fn(
	async (_options: { data: unknown }): Promise<ProjectMemberView[]> => people(),
).mockName("removeTasklineProjectMember");
export const locateTasklineProject = fn(
	async (): Promise<ProjectLocation> => ({ ws: "team", key: sampleProjectTasks.project.key }),
).mockName("locateTasklineProject");
