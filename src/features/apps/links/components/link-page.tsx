import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowLeftIcon, DownloadIcon, ExternalLinkIcon } from "lucide-react";
import { renderSVG } from "uqr";
import { BarChart, DonutChart } from "@/components/charts";
import { CopyButton } from "@/components/data-display/copy-button";
import { StatusOf } from "@/components/data-display/status-badge";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { formatDate, formatDayMonth, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { displayTarget, shortUrl } from "../format";
import { LINK_DEVICE_LABELS, LINK_STATE } from "../labels";
import { linkStatsQueryOptions } from "../queries";
import { LINK_DEVICES, type LinkDevice, type Tally } from "../types";

const route = getRouteApi("/_apps/apps/links/$linkId");

/** The QR code of a URL as SVG markup (uqr), black on white whatever the theme, so it scans. */
export const qrSvg = (url: string) => renderSVG(url, { border: 2, pixelSize: 8 });
const svgDataUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/** A PNG of the SVG at 1024 px, drawn in the browser, downloaded as `name`. */
async function downloadPng(svg: string, name: string) {
	const image = new Image();
	image.src = svgDataUri(svg);
	await image.decode();
	const canvas = document.createElement("canvas");
	canvas.width = 1024;
	canvas.height = 1024;
	const context = canvas.getContext("2d");
	if (!context) return;
	context.imageSmoothingEnabled = false;
	context.drawImage(image, 0, 0, canvas.width, canvas.height);
	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
	if (!blob) return;
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = name;
	anchor.click();
	URL.revokeObjectURL(url);
}

/**
 * A country's name from its ISO code. English names in both languages: browsers don't
 * ship Nepali region names (src/lib/i18n/intl-ne.ts), and the server and the browser
 * must print the same text. "" is unknown.
 */
const countryName = (code: string) => {
	if (!code) return m.links_unknown();
	try {
		return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
	} catch {
		return code;
	}
};

/**
 * /apps/links/$linkId (decision 0191): one short link: where it goes, its QR code (SVG
 * and PNG), and its clicks over the last 30 days, by referrer, country and device.
 */
export function LinkPage() {
	const { linkId } = route.useParams();
	const { session } = route.useRouteContext();
	const { data: stats } = useSuspenseQuery(linkStatsQueryOptions(session.user.id, linkId));
	const { link } = stats;
	const url = shortUrl(link.slug);
	const svg = qrSvg(url);
	const ne = getLocale() === "ne";
	const days = stats.days.map((day) => ({ day: formatDayMonth(day.key), clicks: day.clicks }));
	const devices = LINK_DEVICES.map((device: LinkDevice) => ({
		device: LINK_DEVICE_LABELS[device](),
		clicks: stats.devices.find((tally) => tally.key === device)?.clicks ?? 0,
	})).filter((row) => row.clicks > 0);

	return (
		<Page width="default" data-testid="link-page">
			<Button asChild variant="ghost" size="sm" className="-ms-2 w-fit">
				<Link to="/apps/links">
					<ArrowLeftIcon aria-hidden className="rtl:rotate-180" />
					{m.links_back()}
				</Link>
			</Button>
			<PageHeader
				title={link.title || link.slug}
				description={m.links_created({ date: formatDate(link.createdAt, { dateStyle: "long" }) })}
				actions={<StatusOf status={link.state} map={LINK_STATE} />}
			/>
			<div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_16rem]">
				<dl className="grid content-start gap-4 rounded-lg border bg-surface-1 p-4">
					<div className="flex min-w-0 flex-col gap-1">
						<dt className="text-caption text-muted-foreground">{m.links_short_url()}</dt>
						<dd className="flex min-w-0 items-center gap-1">
							<span className="truncate font-mono text-primary" data-testid="link-short-url">
								{url}
							</span>
							<CopyButton value={url} label={m.links_copy()} />
						</dd>
					</div>
					<div className="flex min-w-0 flex-col gap-1">
						<dt className="text-caption text-muted-foreground">{m.links_field_target()}</dt>
						<dd className="min-w-0">
							<a
								href={link.target}
								rel="noopener noreferrer nofollow"
								target="_blank"
								className="inline-flex max-w-full items-center gap-1 underline-offset-4 hover:underline"
							>
								<span className="truncate">{displayTarget(link.target)}</span>
								<ExternalLinkIcon className="size-3.5 shrink-0" aria-hidden />
								<span className="sr-only">{m.links_opens_new_tab()}</span>
							</a>
						</dd>
					</div>
					<div className="flex flex-col gap-1">
						<dt className="text-caption text-muted-foreground">{m.links_field_expires()}</dt>
						<dd>{link.expiresAt ? formatDate(link.expiresAt, { dateStyle: "long" }) : m.links_never()}</dd>
					</div>
					<div className="flex flex-col gap-1">
						<dt className="text-caption text-muted-foreground">{m.links_total()}</dt>
						<dd className="font-semibold text-heading tabular-nums" data-testid="link-total">
							{formatNumber(stats.total)}
						</dd>
					</div>
				</dl>
				<figure className="flex flex-col items-center gap-3 rounded-lg border bg-surface-1 p-4">
					<img
						src={svgDataUri(svg)}
						width={192}
						height={192}
						alt={m.links_qr_alt({ url })}
						className="rounded-md bg-white"
						data-testid="link-qr"
					/>
					<figcaption className="sr-only">{m.links_qr_title()}</figcaption>
					<div className="flex flex-wrap justify-center gap-2">
						<Button asChild variant="outline" size="sm">
							<a href={svgDataUri(svg)} download={`${link.slug}.svg`}>
								<DownloadIcon aria-hidden />
								{m.links_qr_svg()}
							</a>
						</Button>
						<Button variant="outline" size="sm" onClick={() => void downloadPng(svg, `${link.slug}.png`)}>
							<DownloadIcon aria-hidden />
							{m.links_qr_png()}
						</Button>
					</div>
				</figure>
			</div>
			<section aria-labelledby="link-days" className="flex flex-col gap-3 rounded-lg border p-4">
				<h2 id="link-days" className="text-heading">
					{m.links_days_title()}
				</h2>
				<BarChart
					label={m.links_days_label()}
					data={days}
					index="day"
					series={[{ key: "clicks", label: m.links_clicks_series() }]}
				/>
			</section>
			<div className="grid gap-6 md:grid-cols-3">
				<Ranking
					id="link-referrers"
					title={m.links_referrers_title()}
					rows={stats.referrers}
					name={(key) => key || m.links_direct()}
				/>
				<Ranking
					id="link-countries"
					title={m.links_countries_title()}
					rows={stats.countries}
					name={countryName}
					lang={ne ? "en" : undefined}
				/>
				<section aria-labelledby="link-devices" className="flex flex-col gap-3 rounded-lg border p-4">
					<h2 id="link-devices" className="text-heading">
						{m.links_devices_title()}
					</h2>
					{devices.length > 0 ? (
						<DonutChart
							label={m.links_devices_label()}
							data={devices}
							index="device"
							series={[{ key: "clicks", label: m.links_clicks_series() }]}
						/>
					) : (
						<p className="text-muted-foreground text-sm">{m.links_no_clicks()}</p>
					)}
				</section>
			</div>
		</Page>
	);
}

/** The largest sources of clicks, each with a bar for its share of the largest. */
function Ranking({
	id,
	title,
	rows,
	name,
	lang,
}: {
	id: string;
	title: string;
	rows: ReadonlyArray<Tally>;
	name: (key: string) => string;
	/** Set when the names aren't in the page's language. */
	lang?: string;
}) {
	const top = Math.max(1, ...rows.map((row) => row.clicks));
	return (
		<section aria-labelledby={id} className="flex flex-col gap-3 rounded-lg border p-4" data-testid={id}>
			<h2 id={id} className="text-heading">
				{title}
			</h2>
			{rows.length === 0 ? (
				<p className="text-muted-foreground text-sm">{m.links_no_clicks()}</p>
			) : (
				<ol className="flex flex-col gap-2">
					{rows.map((row) => (
						<li key={row.key} className="flex flex-col gap-1">
							<span className="flex items-baseline justify-between gap-3 text-sm">
								<span className="truncate" lang={row.key ? lang : undefined}>
									{name(row.key)}
								</span>
								<span className="text-muted-foreground tabular-nums">{formatNumber(row.clicks)}</span>
							</span>
							<span aria-hidden className="h-1.5 rounded-full bg-surface-2">
								<span
									className="block h-full rounded-full bg-primary"
									style={{ width: `${(row.clicks / top) * 100}%` }}
								/>
							</span>
						</li>
					))}
				</ol>
			)}
		</section>
	);
}
