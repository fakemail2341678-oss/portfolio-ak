import { Link, Outlet } from "@tanstack/react-router";
import { ConfirmProvider } from "@/components/dialogs/confirm";
import { NotFound } from "@/components/errors/not-found-page";
import { SectionHome } from "@/components/errors/section-home";
import { m } from "@/paraglide/messages";
import { chaalLinks } from "../links";
import { ChaalFrame } from "./chaal-frame";

/** Built at render time, so the label is in the request's language. */
const home = () => <Link {...chaalLinks.home()}>{m.ch_go_home()}</Link>;

/**
 * The `_chaal` layout's component: every page in Chaal's frame, and errors (rendered in
 * the frame, where the page would be) lead back to Chaal's home.
 */
export function ChaalSection() {
	return (
		<SectionHome link={home()}>
			{/* Disconnecting asks first. */}
			<ConfirmProvider>
				<ChaalFrame>
					<Outlet />
				</ChaalFrame>
			</ConfirmProvider>
		</SectionHome>
	);
}

/** Chaal's 404 (a layout's notFoundComponent replaces the layout, so it brings the frame). */
export function ChaalNotFound() {
	return (
		<SectionHome link={home()}>
			<ConfirmProvider>
				<ChaalFrame>
					<NotFound titleClassName="ch-display text-ch-title" />
				</ChaalFrame>
			</ConfirmProvider>
		</SectionHome>
	);
}
