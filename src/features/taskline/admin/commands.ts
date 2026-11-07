import { PlusIcon } from "lucide-react";
import type { AdminCommand } from "@/features/admin/commands";
import { m } from "@/paraglide/messages";

/** Taskline's actions in the command palette and on the dashboard (src/features/admin/commands.ts). */
export const tasklineCommands: ReadonlyArray<AdminCommand> = [
	{
		id: "taskline.new-project",
		label: m.command_taskline_new_project,
		icon: PlusIcon,
		permission: "taskline:manage",
		to: "/admin/taskline/projects/new",
		keywords: m.command_taskline_new_project_keywords,
	},
];
