import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { GUEST_LIFETIME_DAYS } from "@/lib/guests";
import type { RedirectSearch } from "@/lib/http/redirect";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";

/**
 * /upgrade: where a guest (decision 0185) lands when they open an account page. Signing
 * up, or in to an account they already have, keeps what they made as a guest (0186).
 */
export function UpgradePage({ search }: { search: RedirectSearch }) {
	return (
		<>
			<div className="flex flex-col gap-2">
				<h1 className="font-semibold text-2xl tracking-tight">{m.guest_upgrade_title()}</h1>
				<p className="text-muted-foreground">{m.guest_upgrade_intro({ days: formatNumber(GUEST_LIFETIME_DAYS) })}</p>
			</div>
			<div className="flex flex-col gap-2">
				<Button asChild>
					<Link to="/register" search={search} data-testid="upgrade-register">
						{m.guest_create_account()}
					</Link>
				</Button>
				<Button asChild variant="outline">
					<Link to="/login" search={search}>
						{m.guest_sign_in()}
					</Link>
				</Button>
			</div>
			<p className="text-muted-foreground text-sm">{m.guest_upgrade_note()}</p>
		</>
	);
}
