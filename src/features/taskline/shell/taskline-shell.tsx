import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { TopbarBreadcrumbs } from "@/components/admin-shell/topbar";
import { ConfirmProvider } from "@/components/dialogs/confirm";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { ThemeToggle } from "@/components/layout/theme";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { sessionQueryOptions } from "@/features/auth/queries";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { GUEST_LIFETIME_DAYS } from "@/lib/guests";
import { formatNumber } from "@/lib/i18n/intl";
import { useSidebar } from "@/lib/stores/hooks";
import { m } from "@/paraglide/messages";
import { tasklineLinks } from "../links";
import { TimerPill } from "../time/timer";
import type { TasklineNav } from "../types";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { TasklinePalette } from "./taskline-palette";
import { TasklineSidebar } from "./taskline-sidebar";
import { TasklineUserMenu } from "./taskline-user-menu";

/**
 * Taskline's frame (PLAN 11.5, decision 0208): its own sidebar, topbar, command
 * palette and shortcuts around the page, the guest banner, and the confirm dialog
 * pages ask through. Built like the admin shell (shadcn sidebar, the same `sidebar`
 * preference) but nothing of the admin's or the apps' chrome. The page renders its
 * own <main> (Page).
 */
export function TasklineShell({ nav, children }: { nav: TasklineNav; children: ReactNode }) {
	const { collapsed, setCollapsed } = useSidebar();
	const { data: session } = useQuery(sessionQueryOptions());
	const [paletteOpen, setPaletteOpen] = useState(false);
	const [shortcutsOpen, setShortcutsOpen] = useState(false);
	useHotkeys({
		"mod+k": () => setPaletteOpen((open) => !open),
		"shift+?": () => setShortcutsOpen(true),
	});
	return (
		<ConfirmProvider>
			<SidebarProvider
				open={!collapsed}
				onOpenChange={(open) => setCollapsed(!open)}
				className="min-h-0 flex-1"
				data-testid="taskline-shell"
			>
				<TasklineSidebar nav={nav} onOpenPalette={() => setPaletteOpen(true)} />
				<SidebarInset className="min-w-0">
					<NavigationProgress />
					<TasklineTopbar nav={nav} userId={session?.user.id ?? ""} onOpenPalette={() => setPaletteOpen(true)} />
					{session?.isAnonymous ? <GuestBanner /> : null}
					{children}
				</SidebarInset>
				<TasklinePalette
					userId={session?.user.id ?? ""}
					nav={nav}
					open={paletteOpen}
					onOpenChange={setPaletteOpen}
					onOpenShortcuts={() => setShortcutsOpen(true)}
					guest={session?.isAnonymous === true}
				/>
				<ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
			</SidebarProvider>
		</ConfirmProvider>
	);
}

/**
 * Sidebar toggle, the route's breadcrumbs, the running timer (Task 53), search, language,
 * theme and (on phones, where the sidebar is a sheet) the user.
 */
function TasklineTopbar({
	nav,
	userId,
	onOpenPalette,
}: {
	nav: TasklineNav;
	userId: string;
	onOpenPalette: () => void;
}) {
	return (
		<header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-4">
			<SidebarTrigger className="-ms-1" />
			<Separator orientation="vertical" className="me-1 data-[orientation=vertical]:h-4" />
			<TopbarBreadcrumbs />
			<div className="ms-auto flex shrink-0 items-center gap-1">
				{nav.timer && userId ? <TimerPill timer={nav.timer} readAt={nav.readAt} userId={userId} /> : null}
				<Button
					variant="ghost"
					size="icon"
					onClick={onOpenPalette}
					aria-keyshortcuts="Control+K Meta+K"
					data-testid="open-command-menu"
				>
					<SearchIcon aria-hidden />
					<span className="sr-only">{m.command_open()}</span>
				</Button>
				<LanguageSwitcher className="max-sm:hidden" />
				<ThemeToggle />
				<div className="md:hidden">
					<TasklineUserMenu />
				</div>
			</div>
		</header>
	);
}

/** Shown to a guest (decision 0185) on every page: how long the sandbox lives, and how to keep it. */
function GuestBanner() {
	const location = useLocation();
	return (
		<aside aria-label={m.guest_banner_label()} className="border-b bg-info-subtle" data-testid="guest-banner">
			<p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-caption sm:px-6">
				<span>{m.taskline_guest_banner({ days: formatNumber(GUEST_LIFETIME_DAYS) })}</span>
				<Link {...tasklineLinks.signUp(location.href)} className="font-medium underline underline-offset-4">
					{m.taskline_guest_banner_action()}
				</Link>
			</p>
		</aside>
	);
}
