import { createFileRoute } from "@tanstack/react-router";
import { UpgradePage } from "@/features/auth/components/upgrade-page";
import { pageTitle } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/** /upgrade: a guest opened an account page (decision 0185); an account keeps their data. */
export const Route = createFileRoute("/_auth/upgrade")({
	head: () => ({ meta: [{ title: pageTitle(m.guest_upgrade_title()) }] }),
	component: function Upgrade() {
		return <UpgradePage search={Route.useSearch()} />;
	},
});
