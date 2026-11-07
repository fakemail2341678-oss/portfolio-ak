import type { ReactNode } from "react";
import { useState } from "react";
import { ConfirmProvider } from "@/components/dialogs/confirm";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useSidebar } from "@/lib/stores/hooks";
import { AppSidebar } from "./app-sidebar";
import { CommandMenu } from "./command-menu";
import { Topbar } from "./topbar";

/**
 * The admin area's frame (Graphite, decision 0164): the sidebar, the topbar and the
 * command palette around the page, and the confirm dialog pages ask through
 * (`useConfirm`). The page renders its own <main> (Page).
 *
 * The sidebar's open state is the `sidebar` preference (a cookie the server reads),
 * not shadcn's own cookie, so SSR renders it expanded or collapsed as the user left it.
 */
export function AdminShell({ children }: { children: ReactNode }) {
	const { collapsed, setCollapsed } = useSidebar();
	const [commandOpen, setCommandOpen] = useState(false);
	useHotkeys({ "mod+k": () => setCommandOpen((open) => !open) });
	return (
		<ConfirmProvider>
			<SidebarProvider open={!collapsed} onOpenChange={(open) => setCollapsed(!open)} className="min-h-0 flex-1">
				<AppSidebar />
				<SidebarInset className="min-w-0">
					<NavigationProgress />
					<Topbar onOpenCommandMenu={() => setCommandOpen(true)} />
					{children}
				</SidebarInset>
				<CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
			</SidebarProvider>
		</ConfirmProvider>
	);
}
