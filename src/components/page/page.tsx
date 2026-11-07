import type { ComponentProps, ReactNode } from "react";
import { InsideMain, MAIN_CONTENT } from "@/components/layout/skip-link";
import { cn } from "@/lib/utils";

const WIDTHS = {
	/** Admin pages: full width of the content area next to the sidebar. */
	admin: "px-4 py-8 sm:px-6",
	/** Public grids and lists. */
	wide: "mx-auto max-w-6xl px-4 py-10 sm:py-14",
	/** General public pages. */
	default: "mx-auto max-w-5xl px-4 py-12",
	/** Reading width: detail pages, forms, account. */
	narrow: "mx-auto max-w-3xl px-4 py-10 sm:py-14",
} as const;

/**
 * The page's <main> landmark with one of the app's standard widths and
 * paddings, so every page lines up the same way. Children are stacked with gaps.
 */
export function Page({
	width = "default",
	className,
	...props
}: ComponentProps<"main"> & { width?: keyof typeof WIDTHS }) {
	return (
		<InsideMain value>
			<main
				{...MAIN_CONTENT}
				className={cn("flex w-full min-w-0 flex-col gap-6", WIDTHS[width], className)}
				{...props}
			/>
		</InsideMain>
	);
}

/**
 * The page's <h1>, an optional description and actions (top right on wide screens,
 * below the title on narrow ones), optional extra content such as a search form,
 * and a `tabs` slot along the bottom edge (`PageTabs`: sub-pages of a section). One per page. Breadcrumbs belong to the section's frame: the admin topbar
 * shows them; other pages render <Breadcrumbs /> above this header.
 */
export function PageHeader({
	title,
	description,
	actions,
	size = "default",
	tabs,
	children,
	className,
}: {
	title: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	/** "display" is the large public-page heading. */
	size?: "default" | "display";
	/** `<PageTabs>` for the section's sub-pages. */
	tabs?: ReactNode;
	children?: ReactNode;
	className?: string;
}) {
	return (
		<header className={cn("flex flex-col gap-4", className)}>
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div className="flex min-w-0 flex-col gap-1.5">
					<h1
						className={cn(
							size === "display" ? "font-semibold text-3xl leading-tight tracking-tight sm:text-4xl" : "text-title",
						)}
					>
						{title}
					</h1>
					{description ? (
						<div className={cn("max-w-2xl text-muted-foreground", size === "default" && "text-body")}>
							{description}
						</div>
					) : null}
				</div>
				{actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
			</div>
			{children}
			{tabs}
		</header>
	);
}
