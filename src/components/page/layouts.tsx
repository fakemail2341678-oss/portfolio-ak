import { createLink } from "@tanstack/react-router";
import { type ComponentProps, forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A record's page: the main column (the form or the content) and an aside with
 * facts, status and related actions. One column on phones and tablets (the aside
 * goes below), side by side from `lg`.
 */
export function DetailLayout({
	children,
	aside,
	className,
}: {
	children: ReactNode;
	/** Rendered in an <aside>; give it a heading so it shows in the page outline. */
	aside: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start", className)}>
			<div className="flex min-w-0 flex-col gap-6">{children}</div>
			<aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-16">{aside}</aside>
		</div>
	);
}

/**
 * Settings pages: a side navigation of sections and the current one beside it. On
 * phones the navigation is a row that scrolls sideways above the content.
 *
 *   <SettingsLayout label={m.settings_title()} nav={<><SettingsNavLink to="/admin/settings/appearance">…</SettingsNavLink></>}>
 */
export function SettingsLayout({
	label,
	nav,
	children,
	className,
}: {
	/** The navigation's accessible name. */
	label: string;
	nav: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("grid min-w-0 gap-6 md:grid-cols-[12rem_minmax(0,1fr)] md:items-start", className)}>
			<nav aria-label={label} className="max-md:-mx-4 max-md:overflow-x-auto max-md:px-4 md:sticky md:top-16">
				<ul className="flex gap-1 md:flex-col">{nav}</ul>
			</nav>
			<div className="flex min-w-0 flex-col gap-6">{children}</div>
		</div>
	);
}

const NavAnchor = forwardRef<HTMLAnchorElement, ComponentProps<"a">>(function NavAnchor({ className, ...props }, ref) {
	return (
		<li className="flex">
			<a
				ref={ref}
				className={cn(
					"flex min-h-(--control-height) w-full items-center gap-2 whitespace-nowrap rounded-md px-3 text-body text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-foreground [&_svg]:size-4 [&_svg]:shrink-0",
					className,
				)}
				{...props}
			/>
		</li>
	);
});

/** One entry of `SettingsLayout`'s navigation: a typed router link, current when its route matches. */
export const SettingsNavLink = createLink(NavAnchor);
