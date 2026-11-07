import type { LucideIcon } from "lucide-react";
import { MoreHorizontalIcon } from "lucide-react";
import { Fragment, type ReactElement, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePermissions } from "@/features/rbac/can";
import { hasAll, type Permission } from "@/features/rbac/permissions";
import { m } from "@/paraglide/messages";

/**
 * One entry of a row's "…" menu (and its right-click menu). An action either runs
 * `onSelect` or renders as an element, usually a router Link (`render` gets the
 * label to put inside it). With `permission`, it is left out for users without it;
 * the server refuses the action anyway, the menu only doesn't offer it.
 */
export type RowAction = {
	id: string;
	label: string;
	icon?: LucideIcon;
	permission?: Permission | ReadonlyArray<Permission>;
	/** Red, for deleting and other actions that destroy something. */
	destructive?: boolean;
	/** Starts a new group: a separator above it. */
	separated?: boolean;
	/** Left out for this row (the action doesn't apply: an admin can't be impersonated). */
	hidden?: boolean;
} & ({ onSelect: () => void; render?: never } | { render: (label: ReactNode) => ReactElement; onSelect?: never });

/** The actions this user may run on this row. */
export function usePermittedActions() {
	const permissions = usePermissions();
	return (actions: ReadonlyArray<RowAction>) =>
		actions.filter((action) => {
			if (action.hidden) return false;
			if (!action.permission) return true;
			const required = typeof action.permission === "string" ? [action.permission] : action.permission;
			return hasAll(permissions, required);
		});
}

const content = (action: RowAction) => {
	const Icon = action.icon;
	return (
		<>
			{Icon ? <Icon aria-hidden /> : null}
			{action.label}
		</>
	);
};

/** The menu items for a dropdown or a context menu, with separators between groups. */
export function RowActionItems({ actions, kind }: { actions: ReadonlyArray<RowAction>; kind: "dropdown" | "context" }) {
	const Item = kind === "dropdown" ? DropdownMenuItem : ContextMenuItem;
	const Separator = kind === "dropdown" ? DropdownMenuSeparator : ContextMenuSeparator;
	return actions.map((action, position) => (
		<Fragment key={action.id}>
			{action.separated && position > 0 ? <Separator /> : null}
			{action.render ? (
				<Item asChild variant={action.destructive ? "destructive" : "default"}>
					{action.render(content(action))}
				</Item>
			) : (
				<Item variant={action.destructive ? "destructive" : "default"} onSelect={action.onSelect}>
					{content(action)}
				</Item>
			)}
		</Fragment>
	));
}

/** The "…" button and its menu, labelled "Actions for {row}". */
export function RowActionsMenu({ actions, label }: { actions: ReadonlyArray<RowAction>; label: string }) {
	return (
		// Non-modal: a small menu shouldn't aria-hide the page (it closes on Escape or outside click).
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon-sm" aria-label={m.table_row_actions({ label })}>
					<MoreHorizontalIcon aria-hidden />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<RowActionItems actions={actions} kind="dropdown" />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
