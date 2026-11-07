import { Link, Outlet } from "@tanstack/react-router";
import { NotFoundPage } from "@/components/errors/not-found-page";
import { SectionHome } from "@/components/errors/section-home";
import { m } from "@/paraglide/messages";
import { tasklineLinks } from "../links";
import { TasklinePublicFrame } from "./public-frame";

/** The `_taskline` layout's component: its pages' "home" (on errors and 404s) is Taskline's landing. */
export function TasklineSection() {
	return (
		<SectionHome link={<Link {...tasklineLinks.landing()}>{m.taskline_go_home()}</Link>}>
			<Outlet />
		</SectionHome>
	);
}

/** A 404 outside the signed-in app (a layout's notFoundComponent replaces the layout, so it brings the frame). */
export function TasklinePublicNotFound() {
	return (
		<SectionHome link={<Link {...tasklineLinks.landing()}>{m.taskline_go_home()}</Link>}>
			<TasklinePublicFrame>
				<NotFoundPage />
			</TasklinePublicFrame>
		</SectionHome>
	);
}
