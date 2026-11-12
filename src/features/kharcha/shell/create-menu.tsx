import { type LucideIcon, UserPlusIcon, UsersIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { m } from "@/paraglide/messages";
import { CREATE_ACTIONS, type CreateAction, useKharchaActions } from "./actions";

/** Each action's icon and words: the + menu and the palette list them in this order. */
export const CREATE_ITEMS: Record<CreateAction, { icon: LucideIcon; label: () => string }> = {
	friend: { icon: UserPlusIcon, label: () => m.kharcha_create_friend() },
	group: { icon: UsersIcon, label: () => m.kharcha_create_group() },
};

/**
 * The + menu (PLAN 14.5 "UX"): what can be started from anywhere, with what exists so far.
 * Add expense arrives in Task 89, Split a bill and Settle up with theirs. `children` is the
 * trigger: Home's button on a laptop, the floating + on a phone.
 */
export function CreateMenu({
	children,
	align = "end",
	side = "bottom",
}: {
	children: ReactNode;
	align?: "start" | "end";
	side?: "top" | "bottom";
}) {
	const { create } = useKharchaActions();
	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
			<DropdownMenuContent align={align} side={side} className="min-w-52" data-testid="kharcha-create-menu">
				<DropdownMenuLabel className="text-caption text-muted-foreground">{m.kharcha_create_label()}</DropdownMenuLabel>
				{CREATE_ACTIONS.map((action) => {
					const { icon: Icon, label } = CREATE_ITEMS[action];
					return (
						<DropdownMenuItem key={action} onSelect={() => create(action)} data-testid={`kharcha-create-${action}`}>
							<Icon aria-hidden />
							{label()}
						</DropdownMenuItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
