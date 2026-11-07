import { createFileRoute } from "@tanstack/react-router";
import { DescriptionList } from "@/components/data-display/description-list";
import { Demo, ExamplePage } from "@/features/dev/examples/example-page";
import { staticCrumb } from "@/lib/breadcrumbs";
import {
	formatBytes,
	formatCurrency,
	formatDate,
	formatDateTime,
	formatNumber,
	formatRelativeTimeFrom,
} from "@/lib/i18n/intl";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

// Fixed values: identical on the server and in the browser, so formatting can't mismatch while hydrating.
const SAMPLE_DATE = "2026-03-21T08:15:00Z";
const SAMPLE_NOW = "2026-03-24T08:15:00Z";

/**
 * i18n + Intl: every string is a Paraglide message called at render time
 * (never at module level: that freezes the first request's language), and
 * numbers, money, dates and sizes go through src/lib/i18n/intl.ts, which gives
 * Nepali Devanagari digits and the Asia/Kathmandu time zone.
 */
export const Route = createFileRoute("/dev/examples/i18n")({
	staticData: { breadcrumb: staticCrumb(m.examples_i18n_title) },
	head: () => privateHead(m.examples_i18n_title()),
	component: I18nExample,
});

function I18nExample() {
	return (
		<ExamplePage slug="i18n">
			<Demo title={m.examples_i18n_messages()} note={m.examples_i18n_messages_note()}>
				<DescriptionList
					items={[
						{ label: m.examples_i18n_locale(), value: getLocale(), testId: "i18n-locale" },
						{
							label: m.examples_i18n_parameters(),
							value: m.examples_i18n_greeting({ name: "Sita", count: formatNumber(3) }),
						},
					]}
				/>
			</Demo>
			<Demo title={m.examples_i18n_formats()} note={m.examples_i18n_formats_note()}>
				<DescriptionList
					items={[
						{ label: m.intl_date(), value: formatDate(SAMPLE_DATE, { dateStyle: "full" }) },
						{ label: m.examples_i18n_date_time(), value: formatDateTime(SAMPLE_DATE) },
						{ label: m.intl_number(), value: formatNumber(1234567.89), testId: "i18n-number" },
						{ label: m.intl_currency(), value: formatCurrency(1234567.5) },
						{ label: m.intl_relative_time(), value: formatRelativeTimeFrom(SAMPLE_DATE, SAMPLE_NOW) },
						{ label: m.examples_i18n_bytes(), value: formatBytes(3_456_789) },
					]}
				/>
			</Demo>
		</ExamplePage>
	);
}
