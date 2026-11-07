import { PlusIcon } from "lucide-react";
import type { AdminCommand } from "@/features/admin/commands";
import { m } from "@/paraglide/messages";

/** Test CRUD's actions in the command palette and on the dashboard (src/features/admin/commands.ts). */
export const testCrudCommands: ReadonlyArray<AdminCommand> = [
	{
		id: "test-crud.new",
		label: m.command_test_crud_new,
		icon: PlusIcon,
		permission: "test-crud:create",
		to: "/admin/test-crud/new",
		keywords: m.command_test_crud_new_keywords,
	},
];
