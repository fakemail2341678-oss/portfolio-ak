import { Link, useMatches } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";
import { breadcrumbJsonLd, type Crumb, crumbsFromMatches, serializeJsonLd } from "@/lib/breadcrumbs";
import { m } from "@/paraglide/messages";

/**
 * The trail of the current route, built from each matched route's
 * `staticData.breadcrumb` (see src/lib/breadcrumbs.ts). Rendered on the server
 * from the same matches the client hydrates with, so it never shifts.
 * `jsonLd` also emits a schema.org BreadcrumbList (public pages). `items` replaces the
 * route-derived trail (stories, or a page whose trail doesn't follow its URL).
 */
export function Breadcrumbs({
	jsonLd = false,
	items,
	className,
}: {
	jsonLd?: boolean;
	items?: Crumb[];
	className?: string;
}) {
	const fromRoutes = crumbsFromMatches(useMatches());
	const crumbs = items ?? fromRoutes;
	if (crumbs.length === 0) return null;
	return (
		<nav aria-label={m.breadcrumbs_label()} className={className} data-testid="breadcrumbs">
			<ol className="flex min-w-0 flex-wrap items-center gap-1.5 text-muted-foreground text-sm">
				{crumbs.map((crumb, index) =>
					index === crumbs.length - 1 ? (
						<li key={crumb.path} className="min-w-0">
							<span aria-current="page" className="block truncate font-medium text-foreground">
								{crumb.label}
							</span>
						</li>
					) : (
						<li key={crumb.path} className="flex items-center gap-1.5">
							<Link
								to={crumb.path}
								className="rounded-sm underline-offset-4 outline-none transition-colors hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
							>
								{crumb.label}
							</Link>
							<ChevronRightIcon className="size-3.5 shrink-0 rtl:rotate-180" aria-hidden />
						</li>
					),
				)}
			</ol>
			{jsonLd ? (
				<script
					type="application/ld+json"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD data block built from our own labels; "<" is escaped by serializeJsonLd.
					dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd(crumbs)) }}
				/>
			) : null}
		</nav>
	);
}
