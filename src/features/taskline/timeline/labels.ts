import { m } from "@/paraglide/messages";
import type { ProjectTasks } from "../types";
import type { TimelineGroup } from "./layout";
import type { TimelineRowGroup } from "./timeline";

/** Each group's heading: the epic, the milestone or the person, or "none of them". */
export function labelGroups(groups: ReadonlyArray<TimelineGroup>, project: ProjectTasks): TimelineRowGroup[] {
	return groups.map((group) => {
		if (group.kind === "none") return { ...group, label: null };
		if (group.kind === "epic") {
			const epic = project.tasks.find((task) => task.id === group.id);
			return { ...group, label: epic ? `${epic.ref} ${epic.title}` : m.taskline_timeline_no_epic() };
		}
		if (group.kind === "milestone") {
			const milestone = project.milestones.find((each) => each.id === group.id) ?? null;
			return { ...group, label: milestone?.name ?? m.taskline_timeline_no_milestone(), milestone };
		}
		const member = project.members.find((each) => each.id === group.id);
		return { ...group, label: member?.name ?? m.taskline_unassigned() };
	});
}
