import { PlusIcon } from "lucide-react";
import type { AdminCommand } from "@/features/admin/commands";
import { m } from "@/paraglide/messages";

/** __Title__'s actions in the command palette and on the dashboard (src/features/admin/commands.ts). */
export const __camel__Commands: ReadonlyArray<AdminCommand> = [
	{
		id: "__name__.new",
		label: m.command___snake___new,
		icon: PlusIcon,
		permission: "__name__:create",
		to: "/admin/__name__/new",
		keywords: m.command___snake___new_keywords,
	},
];
