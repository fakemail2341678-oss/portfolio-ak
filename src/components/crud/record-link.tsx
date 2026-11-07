import { Link, type RegisteredRouter, type ValidateLinkOptions } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useCan } from "@/features/rbac/can";
import type { Permission } from "@/features/rbac/permissions";

export type RecordLinkProps<TRouter extends RegisteredRouter = RegisteredRouter, TOptions = unknown> = {
	/** Where the record opens (its edit page), type-checked like a Link's props. */
	link: ValidateLinkOptions<TRouter, TOptions>;
	/** Who may open it: everyone else gets the name as plain text. */
	permission: Permission;
	children: ReactNode;
	/** A second, quieter line under the name (a slug, an address). */
	detail?: ReactNode;
};

/**
 * A record's name in a list's first column: a link to its page for users who may
 * open it, plain text for the rest (the route refuses them anyway).
 *
 *   cell: (row) => <RecordLink link={{ to: "/admin/projects/$id", params: { id: row.id } }} permission="projects:update">{row.title}</RecordLink>
 */
export function RecordLink<TRouter extends RegisteredRouter, TOptions>(
	props: RecordLinkProps<TRouter, TOptions>,
): ReactNode;
export function RecordLink({ link, permission, children, detail }: RecordLinkProps) {
	const can = useCan(permission);
	return (
		<>
			{can ? (
				<Link {...link} className="font-medium underline-offset-4 hover:underline">
					{children}
				</Link>
			) : (
				<span className="font-medium">{children}</span>
			)}
			{detail ? <div className="truncate font-mono text-muted-foreground text-xs">{detail}</div> : null}
		</>
	);
}
