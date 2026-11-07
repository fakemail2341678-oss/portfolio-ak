import { linkOptions } from "@tanstack/react-router";
import { PageTab, PageTabs } from "@/components/page/page-tabs";
import { m } from "@/paraglide/messages";

const TABS = linkOptions([{ to: "/admin/roles", activeOptions: { exact: true } }, { to: "/admin/roles/permissions" }]);

/** The roles section's two pages, as tabs under the page header. */
export function RoleTabs() {
	const [roles, permissions] = TABS;
	return (
		<PageTabs label={m.admin_nav_roles()}>
			<PageTab {...roles}>{m.admin_nav_roles()}</PageTab>
			<PageTab {...permissions}>{m.admin_nav_permissions()}</PageTab>
		</PageTabs>
	);
}
