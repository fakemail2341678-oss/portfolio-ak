import { createLink } from "@tanstack/react-router";
import { type ComponentProps, forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Tabs that are pages: each tab is a link to its own route, so the URL, the back
 * button, SSR and opening a tab in a new window all work. The active tab is the one
 * whose route matches (`aria-current="page"`). Not `role="tablist"`: these navigate.
 *
 *   const TABS = linkOptions([{ to: "/admin/roles", activeOptions: { exact: true } }, { to: "/admin/roles/permissions" }]);
 *   <PageTabs label={m.roles_title()}>
 *     <PageTab {...TABS[0]}>{m.roles_tab_roles()}</PageTab>
 *     <PageTab {...TABS[1]}>{m.roles_tab_permissions()}</PageTab>
 *   </PageTabs>
 *
 * Pass it to `PageHeader`'s `tabs` slot.
 */
export function PageTabs({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
	return (
		<nav aria-label={label} className={cn("-mb-px overflow-x-auto", className)}>
			<ul className="flex min-w-max gap-1 border-b">{children}</ul>
		</nav>
	);
}

const TabAnchor = forwardRef<HTMLAnchorElement, ComponentProps<"a">>(function TabAnchor({ className, ...props }, ref) {
	return (
		<li className="flex">
			<a
				ref={ref}
				className={cn(
					"-mb-px inline-flex h-(--control-height) items-center gap-2 whitespace-nowrap border-transparent border-b-2 px-3 font-medium text-body text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[current=page]:border-primary aria-[current=page]:text-foreground [&_svg]:size-4",
					className,
				)}
				{...props}
			/>
		</li>
	);
});

/** One tab of `PageTabs`: a typed router link (same props as `Link`, or a `linkOptions` object spread in). */
export const PageTab = createLink(TabAnchor);
