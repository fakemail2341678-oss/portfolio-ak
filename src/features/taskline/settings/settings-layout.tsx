import { getRouteApi, Outlet } from "@tanstack/react-router";
import {
	ListOrderedIcon,
	SlidersHorizontalIcon,
	TablePropertiesIcon,
	TagsIcon,
	Trash2Icon,
	UsersIcon,
	ZapIcon,
} from "lucide-react";
import { SettingsLayout, SettingsNavLink } from "@/components/page/layouts";
import { m } from "@/paraglide/messages";
import { tasklineLinks } from "../links";

const route = getRouteApi("/_taskline/app/taskline/_shell/$ws/p/$key/settings");

/** The project's settings (its lead's, PLAN 11.5): a section per page, beside their navigation. */
export function ProjectSettingsLayout() {
	const { ws, key } = route.useParams();
	return (
		<SettingsLayout
			label={m.taskline_settings_label()}
			nav={
				<>
					<SettingsNavLink {...tasklineLinks.settings(ws, key, "general")}>
						<SlidersHorizontalIcon aria-hidden />
						{m.taskline_settings_general()}
					</SettingsNavLink>
					<SettingsNavLink {...tasklineLinks.settings(ws, key, "members")}>
						<UsersIcon aria-hidden />
						{m.taskline_settings_members()}
					</SettingsNavLink>
					<SettingsNavLink {...tasklineLinks.settings(ws, key, "workflow")}>
						<ListOrderedIcon aria-hidden />
						{m.taskline_settings_workflow()}
					</SettingsNavLink>
					<SettingsNavLink {...tasklineLinks.settings(ws, key, "labels")}>
						<TagsIcon aria-hidden />
						{m.taskline_settings_labels()}
					</SettingsNavLink>
					<SettingsNavLink {...tasklineLinks.settings(ws, key, "fields")}>
						<TablePropertiesIcon aria-hidden />
						{m.taskline_settings_fields()}
					</SettingsNavLink>
					<SettingsNavLink {...tasklineLinks.settings(ws, key, "automations")}>
						<ZapIcon aria-hidden />
						{m.taskline_settings_automations()}
					</SettingsNavLink>
					<SettingsNavLink {...tasklineLinks.settings(ws, key, "trash")}>
						<Trash2Icon aria-hidden />
						{m.taskline_settings_trash()}
					</SettingsNavLink>
				</>
			}
		>
			<Outlet />
		</SettingsLayout>
	);
}
