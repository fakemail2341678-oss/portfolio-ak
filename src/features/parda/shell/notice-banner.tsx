import { useQuery } from "@tanstack/react-query";
import { InfoIcon } from "lucide-react";
import { localizedValue } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import { pardaBannerQueryOptions } from "../queries";

/**
 * The admin's notice under the top mask (`pd_settings.banner`, decision 0237): on every
 * page, in the reader's language (English when there's no Nepali). The layout's loader
 * read it, so it renders on the server and nothing moves on hydration.
 */
export function PardaNoticeBanner() {
	const { data: banner } = useQuery(pardaBannerQueryOptions());
	if (!banner) return null;
	return (
		<aside aria-label={m.pd_notice_label()} className="bg-pd-ground-2 text-sm" data-testid="parda-notice-banner">
			<p className="flex items-start gap-2 px-4 py-2 sm:px-6 lg:px-8">
				<InfoIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-pd-muted" />
				<span>{localizedValue(banner)}</span>
			</p>
		</aside>
	);
}
