import type { LucideIcon } from "lucide-react";
import { pardaCommands } from "@/features/parda/admin/commands"; // @parda
import { portfolioCommands } from "@/features/portfolio/admin/commands"; // @portfolio
import type { Permission } from "@/features/rbac/permissions";
import { tasklineCommands } from "@/features/taskline/admin/commands"; // @taskline
import { testCrudCommands } from "@/features/test-crud/commands";
import type { AdminPath } from "./sections";

/**
 * An action a feature offers in the command palette and the dashboard's quick
 * actions, e.g. "New Test CRUD item". Each feature lists its own in
 * `features/<name>/commands.ts`; ADMIN_COMMANDS collects them. Like the sections,
 * a command shows only for users holding its permission.
 */
export type AdminCommand = {
	id: string;
	label: () => string;
	icon: LucideIcon;
	permission: Permission;
	/** Where it goes. */
	to: AdminPath;
	/** Extra words the palette matches (space-separated, localized). */
	keywords?: () => string;
};

export const ADMIN_COMMANDS: ReadonlyArray<AdminCommand> = [
	...testCrudCommands,
	...portfolioCommands, // @portfolio
	...tasklineCommands, // @taskline
	...pardaCommands, // @parda
	// @new-feature:commands
];

/** The commands a user holding `permissions` may run. */
export const permittedCommands = (permissions: ReadonlyArray<Permission>) =>
	ADMIN_COMMANDS.filter((command) => permissions.includes(command.permission));
