import { FilePlusIcon, PlusIcon } from "lucide-react";
import type { AdminCommand } from "@/features/admin/commands";
import { m } from "@/paraglide/messages";

/** The portfolio's actions in the command palette and on the dashboard (src/features/admin/commands.ts). */
export const portfolioCommands: ReadonlyArray<AdminCommand> = [
	{
		id: "portfolio.project.new",
		label: m.command_portfolio_project_new,
		icon: PlusIcon,
		permission: "portfolio:write",
		to: "/admin/portfolio/projects/new",
		keywords: m.command_portfolio_project_new_keywords,
	},
	{
		id: "portfolio.post.new",
		label: m.command_portfolio_post_new,
		icon: FilePlusIcon,
		permission: "portfolio:write",
		to: "/admin/portfolio/journal/new",
		keywords: m.command_portfolio_post_new_keywords,
	},
];
