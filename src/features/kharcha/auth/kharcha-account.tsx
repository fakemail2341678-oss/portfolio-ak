import { getRouteApi } from "@tanstack/react-router";
import { AccountPage } from "@/features/auth/components/account-page";
import { KHARCHA_PATHS } from "../links";

const route = getRouteApi("/_kharcha/app/kharcha/_shell/account");

/** The account page's sections (profile, email, password, two-factor, sessions, data) inside Kharcha's shell. */
export function KharchaAccount() {
	const { session } = route.useRouteContext();
	return (
		<AccountPage
			user={session.user}
			emailChanged={false}
			twoFactorRequested={false}
			signedOutTo={KHARCHA_PATHS.landing}
		/>
	);
}
