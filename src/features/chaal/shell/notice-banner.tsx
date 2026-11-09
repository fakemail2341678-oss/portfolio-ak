import { useQuery } from "@tanstack/react-query";
import { InfoIcon, WrenchIcon } from "lucide-react";
import { localizedValue } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import { chaalStatusQueryOptions } from "../queries";

/**
 * The admin's notices under the top bar, on every page, in the reader's language (English
 * when there's no Nepali): maintenance first (Task 79, decision 0268: its message, or a
 * default one), then the banner (`ch_settings.banner`). The layout's loader read them with
 * the status, so they render on the server and nothing moves on hydration.
 */
export function ChaalNoticeBanner() {
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const banner = status?.banner;
	const maintenance = status?.maintenance;
	if (!banner && !maintenance) return null;
	return (
		<>
			{maintenance ? (
				<aside
					aria-label={m.ch_maintenance_label()}
					className="ch-hairline bg-ch-ink text-ch-on-ink text-sm"
					data-testid="chaal-maintenance-banner"
				>
					<p className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2 sm:px-6 lg:px-8">
						<WrenchIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
						<span>{maintenance.message ? localizedValue(maintenance.message) : m.ch_maintenance_default()}</span>
					</p>
				</aside>
			) : null}
			{banner ? (
				<aside
					aria-label={m.ch_notice_label()}
					className="ch-hairline bg-ch-plate text-sm"
					data-testid="chaal-notice-banner"
				>
					<p className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2 sm:px-6 lg:px-8">
						<InfoIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-ch-muted" />
						<span>{localizedValue(banner)}</span>
					</p>
				</aside>
			) : null}
		</>
	);
}
