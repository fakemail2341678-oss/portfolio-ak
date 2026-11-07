import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";
import { Page, PageHeader } from "@/components/page/page";
import { TASKLINE_NAME } from "@/features/taskline/brand"; // @taskline
import { tasklineLinks } from "@/features/taskline/links"; // @taskline
import { TasklineMark } from "@/features/taskline/shell/taskline-mark"; // @taskline
import { GUEST_LIFETIME_DAYS } from "@/lib/guests";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { APPS, appPath } from "../registry";

/** /apps (decision 0187): every showcase app, each one to try without signing up. */
export function AppsGallery() {
	return (
		<Page width="wide" data-testid="apps-gallery">
			<PageHeader size="display" title={m.apps_title()} description={m.apps_description()} />
			{/* taskline:start */}
			{/* Taskline is a product of its own (decision 0208), not an APP_SLUGS entry: featured above the apps. */}
			<Link
				{...tasklineLinks.landing()}
				data-accent="emerald"
				className="group flex flex-col gap-4 rounded-xl border bg-surface-1 p-6 outline-none transition-colors hover:bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:flex-row sm:items-center"
				data-testid="taskline-card"
			>
				<TasklineMark className="size-12" />
				<span className="flex min-w-0 flex-1 flex-col gap-1">
					<span className="font-medium text-caption text-primary">{m.taskline_gallery_label()}</span>
					<span className="font-semibold text-heading">{TASKLINE_NAME}</span>
					<span className="max-w-2xl text-muted-foreground text-sm">{m.taskline_gallery_body()}</span>
				</span>
				<span className="inline-flex items-center gap-1 font-medium text-sm">
					{m.taskline_gallery_open()}
					<ArrowRightIcon
						className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180"
						aria-hidden
					/>
				</span>
			</Link>
			{/* taskline:end */}
			<ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{APPS.map((app) => (
					<li key={app.slug}>
						<Link
							to={appPath(app.slug)}
							className="group flex h-full flex-col gap-3 rounded-xl border bg-surface-1 p-5 outline-none transition-colors hover:bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-ring/50"
						>
							<app.icon className="size-6 text-primary" aria-hidden />
							<span className="flex flex-col gap-1">
								<span className="font-semibold text-heading">{app.name()}</span>
								<span className="text-muted-foreground text-sm">{app.tagline()}</span>
							</span>
							<span className="mt-auto inline-flex items-center gap-1 font-medium text-sm">
								{m.apps_open()}
								<ArrowRightIcon
									className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180"
									aria-hidden
								/>
							</span>
						</Link>
					</li>
				))}
			</ul>
			<p className="max-w-prose text-muted-foreground text-sm">
				{m.apps_guest_note({ days: formatNumber(GUEST_LIFETIME_DAYS) })}
			</p>
		</Page>
	);
}
