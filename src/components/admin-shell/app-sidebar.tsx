import { Link, linkOptions } from "@tanstack/react-router";
import { LayoutDashboardIcon } from "lucide-react";
import { BrandMark } from "@/components/brand/brand";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";
import { ADMIN_GROUP_LABELS, ADMIN_GROUPS, type AdminSection, permittedSections } from "@/features/admin/sections";
import { usePermissions } from "@/features/rbac/can";
import { clientEnv } from "@/lib/env/client";
import { m } from "@/paraglide/messages";
import { UserMenu } from "./user-menu";

type NavItem = Pick<AdminSection, "to" | "activeOptions" | "label" | "icon"> | typeof DASHBOARD;

const DASHBOARD = {
	...linkOptions({ to: "/admin", activeOptions: { exact: true } }),
	label: m.admin_nav_dashboard,
	icon: LayoutDashboardIcon,
};

/**
 * The admin sidebar: the sections the user may open (each route and server function
 * checks again), grouped, with the user at the bottom. On desktop it collapses to
 * icons (labels move into tooltips; the open state is the `sidebar` preference, so the
 * server renders it); on phones it is a sheet opened from the topbar.
 */
export function AppSidebar() {
	const permissions = usePermissions();
	const sections = permittedSections(permissions);
	const groups = ADMIN_GROUPS.map((group) => ({
		group,
		items: [...(group === "overview" ? [DASHBOARD] : []), ...sections.filter((section) => section.group === group)],
	})).filter(({ items }) => items.length > 0);

	return (
		<Sidebar collapsible="icon" data-testid="admin-sidebar">
			{/* One landmark around all of it: axe's region rule wants the brand and the user inside one too. */}
			<nav aria-label={m.admin_sidebar_label()} className="flex min-h-0 flex-1 flex-col">
				<SidebarHeader>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton asChild size="lg" tooltip={clientEnv.VITE_APP_TITLE}>
								<Link to="/admin">
									<BrandMark className="size-7" />
									<span className="truncate font-semibold text-heading">{clientEnv.VITE_APP_TITLE}</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarHeader>
				<SidebarContent>
					{groups.map(({ group, items }) => (
						<SidebarGroup key={group}>
							<SidebarGroupLabel>{ADMIN_GROUP_LABELS[group]()}</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{items.map((item) => (
										<NavLink key={item.to} item={item} />
									))}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					))}
				</SidebarContent>
				<SidebarFooter>
					<UserMenu variant="sidebar" />
				</SidebarFooter>
				<SidebarRail />
			</nav>
		</Sidebar>
	);
}

function NavLink({ item }: { item: NavItem }) {
	const { setOpenMobile } = useSidebar();
	return (
		<SidebarMenuItem>
			<SidebarMenuButton asChild tooltip={item.label()} className="data-[active=true]:[&>svg]:text-primary">
				{/* The router marks the current section (data-active); on phones the sheet closes once a page is picked. */}
				<Link
					to={item.to}
					activeOptions={item.activeOptions}
					activeProps={{ "data-active": true }}
					onClick={() => setOpenMobile(false)}
				>
					<item.icon aria-hidden />
					<span>{item.label()}</span>
				</Link>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}
