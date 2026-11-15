import { Link } from "@tanstack/react-router";
import type { ComponentProps } from "react";

/**
 * A link that opens a task in the sheet over a project view (board, list, calendar, backlog, time, timeline,
 * milestones): a masked route
 * (search-filters-masking.md). The real location is the view with `?task=WEB-12`;
 * the address bar, the href, a reload, a new tab or no JavaScript give the task's own
 * page, /$ws/t/WEB-12 (`unmaskOnReload`: the server only sees the shown URL).
 */
type Props = Omit<ComponentProps<"a">, "href"> & {
	view: "board" | "list" | "calendar" | "backlog" | "time" | "timeline" | "milestones";
	ws: string;
	taskRef: string;
};

export function TaskSheetLink({ view, ws, taskRef, ...props }: Props) {
	const mask = { to: "/app/taskline/$ws/t/$ref", params: { ws, ref: taskRef }, unmaskOnReload: true } as const;
	if (view === "backlog") {
		return (
			<Link
				from="/app/taskline/$ws/p/$key/backlog"
				to="."
				search={(prev) => ({ ...prev, task: taskRef })}
				mask={mask}
				{...props}
			/>
		);
	}
	if (view === "timeline") {
		return (
			<Link
				from="/app/taskline/$ws/p/$key/timeline"
				to="."
				search={(prev) => ({ ...prev, task: taskRef })}
				mask={mask}
				{...props}
			/>
		);
	}
	if (view === "milestones") {
		return (
			<Link
				from="/app/taskline/$ws/p/$key/milestones"
				to="."
				search={(prev) => ({ ...prev, task: taskRef })}
				mask={mask}
				{...props}
			/>
		);
	}
	if (view === "time") {
		return (
			<Link
				from="/app/taskline/$ws/p/$key/time"
				to="."
				search={(prev) => ({ ...prev, task: taskRef })}
				mask={mask}
				{...props}
			/>
		);
	}
	if (view === "calendar") {
		return (
			<Link
				from="/app/taskline/$ws/p/$key/calendar"
				to="."
				search={(prev) => ({ ...prev, task: taskRef })}
				mask={mask}
				{...props}
			/>
		);
	}
	return view === "board" ? (
		<Link
			from="/app/taskline/$ws/p/$key/board"
			to="."
			search={(prev) => ({ ...prev, task: taskRef })}
			mask={mask}
			{...props}
		/>
	) : (
		<Link
			from="/app/taskline/$ws/p/$key/list"
			to="."
			search={(prev) => ({ ...prev, task: taskRef })}
			mask={mask}
			{...props}
		/>
	);
}
