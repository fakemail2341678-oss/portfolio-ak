import { useQuery } from "@tanstack/react-query";
import { Link, Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { NotFoundPage } from "@/components/errors/not-found-page";
import { SectionHome } from "@/components/errors/section-home";
import { DbScope } from "@/components/layout/db-scope";
import { sessionQueryOptions } from "@/features/auth/queries";
import { m } from "@/paraglide/messages";
import { tasklineLinks } from "../links";
import { tasklineNavQueryOptions } from "../queries";
import type { TasklineNav } from "../types";
import { TasklineShell } from "./taskline-shell";

const NO_NAV: TasklineNav = { workspaces: [], projects: [], starred: [], recent: [], timer: null, readAt: "" };

/**
 * The signed-in app's frame as the `_shell` layout renders it: TanStack DB for the
 * pages below (0189), the shell with the navigation the loader read, and Home as
 * where errors and 404s send people. Its 404 renders the same frame.
 */
export function TasklineShellLayout({ children = <Outlet /> }: { children?: ReactNode }) {
	const { data: session } = useQuery(sessionQueryOptions());
	// The loader read it; a 404 rendered in the loader's place fetches it here.
	const { data: nav } = useQuery({ ...tasklineNavQueryOptions(session?.user.id ?? ""), enabled: Boolean(session) });
	return (
		<SectionHome link={<Link {...tasklineLinks.home()}>{m.taskline_go_home()}</Link>}>
			<DbScope>
				<TasklineShell nav={nav ?? NO_NAV}>{children}</TasklineShell>
			</DbScope>
		</SectionHome>
	);
}

export function TasklineShellNotFound() {
	return (
		<TasklineShellLayout>
			<NotFoundPage />
		</TasklineShellLayout>
	);
}
