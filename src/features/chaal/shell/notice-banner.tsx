import { useQuery } from "@tanstack/react-query";
import { InfoIcon } from "lucide-react";
import { localizedValue } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import { chaalStatusQueryOptions } from "../queries";

/**
 * The admin's notice under the top bar (`ch_settings.banner`; its form arrives with Task 79):
 * on every page, in the reader's language (English when there's no Nepali). The layout's
 * loader read it with the status, so it renders on the server and nothing moves on hydration.
 */
export function ChaalNoticeBanner() {
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const banner = status?.banner;
	if (!banner) return null;
	return (
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
	);
}
