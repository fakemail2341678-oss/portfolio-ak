import { getRouteApi } from "@tanstack/react-router";
import { AccountPage } from "@/features/auth/components/account-page";
import { TASKLINE_PATHS } from "../links";

const route = getRouteApi("/_taskline/app/taskline/_shell/account");

/** The account page's sections (profile, email, password, two-factor, sessions, data) inside Taskline's shell. */
export function TasklineAccount() {
	const { session } = route.useRouteContext();
	return (
		<AccountPage
			user={session.user}
			emailChanged={false}
			twoFactorRequested={false}
			signedOutTo={TASKLINE_PATHS.landing}
		/>
	);
}
