import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { sessionQueryOptions } from "@/features/auth/queries";
import { formatDate } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { pardaViewerQueryOptions } from "../library/queries";
import { useImportLocalProgress } from "../library/use-viewer-session";
import { pardaLinks } from "../links";

/**
 * Under the top mask for a guest (PLAN 12.5, "Guests"): the day their progress is deleted,
 * and Parda's sign-up, which keeps it. The layout's loader read the date, so the line
 * renders on the server whole. It also brings in this browser's progress once a session exists.
 */
export function PardaGuestBanner() {
	useImportLocalProgress();
	const { data: session } = useQuery(sessionQueryOptions());
	const guest = session?.isAnonymous === true;
	const { data: viewer } = useQuery({ ...pardaViewerQueryOptions(), enabled: guest });
	const location = useLocation();
	if (!guest) return null;
	return (
		<aside aria-label={m.guest_banner_label()} className="bg-pd-ground-2 text-sm" data-testid="parda-guest-banner">
			<p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 sm:px-6 lg:px-8">
				<span>
					{viewer?.guestDeletesAt
						? m.pd_guest_banner({ date: formatDate(viewer.guestDeletesAt, { dateStyle: "long" }) })
						: m.pd_guest_banner_soon()}
				</span>
				<Link {...pardaLinks.signUp(location.href)} className="font-medium underline underline-offset-4">
					{m.pd_guest_banner_action()}
				</Link>
			</p>
		</aside>
	);
}
