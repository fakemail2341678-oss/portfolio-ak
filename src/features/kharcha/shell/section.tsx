import { Link, Outlet } from "@tanstack/react-router";
import { type ReactNode, useContext } from "react";
import { NotFoundPage } from "@/components/errors/not-found-page";
import { SectionHome } from "@/components/errors/section-home";
import { m } from "@/paraglide/messages";
import { kharchaLinks } from "../links";
import { InKharchaShell } from "./actions";
import { KharchaShell } from "./kharcha-shell";
import { KharchaPublicFrame } from "./public-frame";

/** The `_kharcha` layout's component: its pages' "home" (on errors and 404s) is Kharcha's landing. */
export function KharchaSection() {
	return (
		<SectionHome link={<Link {...kharchaLinks.landing()}>{m.kharcha_go_home()}</Link>}>
			<Outlet />
		</SectionHome>
	);
}

/** A 404 outside the signed-in app (a layout's notFoundComponent replaces the layout, so it brings the frame). */
export function KharchaPublicNotFound() {
	return (
		<SectionHome link={<Link {...kharchaLinks.landing()}>{m.kharcha_go_home()}</Link>}>
			<KharchaPublicFrame>
				<NotFoundPage />
			</KharchaPublicFrame>
		</SectionHome>
	);
}

/**
 * The signed-in app's frame as the `_shell` layout renders it, with Home as where errors
 * and 404s send people. Its 404 renders the same frame. Always the shell, even while signing
 * out: swapping frames would remount the page, which would then fetch without a session.
 */
export function KharchaShellLayout({ children = <Outlet /> }: { children?: ReactNode }) {
	return (
		<SectionHome link={<Link {...kharchaLinks.home()}>{m.kharcha_go_home()}</Link>}>
			<KharchaShell>{children}</KharchaShell>
		</SectionHome>
	);
}

/** Rendered in the shell's page slot or in place of the layout: the shell only once either way. */
export function KharchaShellNotFound() {
	const inShell = useContext(InKharchaShell);
	if (inShell) return <NotFoundPage />;
	return (
		<KharchaShellLayout>
			<NotFoundPage />
		</KharchaShellLayout>
	);
}
