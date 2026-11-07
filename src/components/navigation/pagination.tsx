import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { SearchLink } from "./search-link";

const step =
	"inline-flex h-9 items-center rounded-md border px-3 text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50";

function Step({
	page,
	current,
	disabled,
	children,
}: {
	page: number;
	current: number;
	disabled: boolean;
	children: ReactNode;
}) {
	// A disabled step is plain text, not a dead link (and keeps readable contrast).
	if (disabled) {
		return (
			<span aria-disabled="true" className={cn(step, "pointer-events-none text-muted-foreground")}>
				{children}
			</span>
		);
	}
	return (
		<SearchLink patch={{ page }} className={step} rel={page > current ? "next" : "prev"}>
			{children}
		</SearchLink>
	);
}

export type PaginationProps = {
	page: number;
	pageCount: number;
	/** Shows "{total} results". */
	total?: number;
	/** Shows a rows-per-page picker (needs JavaScript; the URL keeps working without it). */
	pageSize?: { value: number; options: ReadonlyArray<number>; onChange: (size: number) => void };
	/** "split" puts the summary left and the controls right (admin); "center" for public lists. */
	layout?: "split" | "center";
	/** Hide entirely when everything fits on one page (public lists). */
	hideWhenSingle?: boolean;
	className?: string;
};

/**
 * Previous / "Page x of y" / Next for any URL-paginated list. The steps are
 * links that change only `?page=`, so pagination is server-rendered, shareable
 * and works without JavaScript.
 */
export function Pagination({
	page,
	pageCount,
	total,
	pageSize,
	layout = "split",
	hideWhenSingle = false,
	className,
}: PaginationProps) {
	if (hideWhenSingle && pageCount <= 1) return null;
	const last = Math.max(1, pageCount);
	return (
		<nav
			aria-label={m.pagination_label()}
			className={cn(
				"flex flex-wrap items-center gap-3 text-sm",
				layout === "center" ? "justify-center" : "justify-between",
				className,
			)}
		>
			{total !== undefined ? (
				<span className="text-muted-foreground">{m.pagination_total({ count: formatNumber(total) })}</span>
			) : null}
			<div className="flex flex-wrap items-center gap-3">
				{pageSize ? (
					<div className="flex items-center gap-2">
						<Label htmlFor="pagination-page-size" className="font-normal text-muted-foreground">
							{m.pagination_page_size()}
						</Label>
						<Select value={String(pageSize.value)} onValueChange={(value) => pageSize.onChange(Number(value))}>
							<SelectTrigger id="pagination-page-size" className="w-20">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{pageSize.options.map((size) => (
									<SelectItem key={size} value={String(size)}>
										{formatNumber(size)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				) : null}
				<Step page={page - 1} current={page} disabled={page <= 1}>
					{m.pagination_previous()}
				</Step>
				<span>{m.pagination_status({ page: formatNumber(page), total: formatNumber(last) })}</span>
				<Step page={page + 1} current={page} disabled={page >= last}>
					{m.pagination_next()}
				</Step>
			</div>
		</nav>
	);
}
