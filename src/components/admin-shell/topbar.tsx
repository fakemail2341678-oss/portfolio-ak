import { Link, useMatches } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { Fragment } from "react";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useHotkeyLabel } from "@/hooks/use-hotkeys";
import { crumbsFromMatches } from "@/lib/breadcrumbs";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { UserMenu } from "./user-menu";

/** The route's breadcrumb trail (each match's staticData.breadcrumb). Phones show the current page only. */
export function TopbarBreadcrumbs() {
	const crumbs = crumbsFromMatches(useMatches());
	if (crumbs.length === 0) return null;
	return (
		<Breadcrumb className="min-w-0" data-testid="breadcrumbs">
			<BreadcrumbList className="flex-nowrap text-body">
				{crumbs.map((crumb, index) => {
					const last = index === crumbs.length - 1;
					return (
						<Fragment key={crumb.path}>
							<BreadcrumbItem className={cn(last ? "min-w-0" : "shrink-0 max-sm:hidden")}>
								{last ? (
									<BreadcrumbPage className="truncate font-medium">{crumb.label}</BreadcrumbPage>
								) : (
									<BreadcrumbLink asChild>
										{/* At least 24 px tall (WCAG 2.5.8 target size). */}
										<Link to={crumb.path} className="inline-flex min-h-6 items-center">
											{crumb.label}
										</Link>
									</BreadcrumbLink>
								)}
							</BreadcrumbItem>
							{last ? null : <BreadcrumbSeparator className="shrink-0 max-sm:hidden rtl:rotate-180" />}
						</Fragment>
					);
				})}
			</BreadcrumbList>
		</Breadcrumb>
	);
}

/**
 * The admin topbar: sidebar toggle, breadcrumbs, the command palette button
 * (Ctrl/⌘ K), language, theme and, on phones (where the sidebar is a sheet), the
 * user menu.
 */
export function Topbar({ onOpenCommandMenu }: { onOpenCommandMenu: () => void }) {
	const shortcut = useHotkeyLabel("mod+k");
	return (
		<header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-4">
			<SidebarTrigger className="-ms-1" />
			<Separator orientation="vertical" className="me-1 data-[orientation=vertical]:h-4" />
			<TopbarBreadcrumbs />
			<div className="ms-auto flex shrink-0 items-center gap-1">
				<Button
					variant="outline"
					size="sm"
					onClick={onOpenCommandMenu}
					// An icon until there is room for the label (the sidebar takes 16rem from md).
					className="gap-2 text-muted-foreground max-lg:size-[calc(var(--control-height)-0.25rem)] max-lg:p-0 lg:w-56 lg:justify-start"
					aria-keyshortcuts="Control+K Meta+K"
					data-testid="open-command-menu"
				>
					<SearchIcon aria-hidden />
					<span className="max-lg:sr-only">{m.command_open()}</span>
					{/* Fixed width: swapping "Ctrl" for "⌘" after hydration never moves anything. */}
					<Kbd className="ms-auto w-12 max-lg:hidden" aria-hidden>
						{shortcut}
					</Kbd>
				</Button>
				<LanguageSwitcher className="max-sm:hidden" />
				<ThemeToggle />
				<div className="md:hidden">
					<UserMenu />
				</div>
			</div>
		</header>
	);
}
