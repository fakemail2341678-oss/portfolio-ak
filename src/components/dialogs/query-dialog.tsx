import { type QueryKey, type UseQueryOptions, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

/**
 * A dialog about one record that loads when it opens (a masked route's `?edit=` or
 * `?view=`, search-filters-masking.md): placeholder lines while it loads, the
 * reason and a way out when it fails, then `children(record)`. Title and
 * description get the record once it's there.
 *
 *   <QueryDialog query={projectDetailQueryOptions(id)} onClose={close} title={m.projects_edit_title()} loading={m.projects_loading()}>
 *     {(project) => <ProjectForm key={crudFormKey(project)} item={project} onSaved={close} />}
 *   </QueryDialog>
 */
export function QueryDialog<T, TKey extends QueryKey>({
	query,
	onClose,
	title,
	description,
	top,
	loading,
	className,
	children,
	"data-testid": testId,
}: {
	query: UseQueryOptions<T, Error, T, TKey>;
	onClose: () => void;
	title: ReactNode | ((record: T | undefined) => ReactNode);
	description?: (record: T | undefined, error: Error | null) => ReactNode;
	/** Above the header (a cover image). */
	top?: (record: T | undefined) => ReactNode;
	/** Read out while loading ("Loading item…"). */
	loading: string;
	className?: string;
	children: (record: T) => ReactNode;
	"data-testid"?: string;
}) {
	const { data: record, error } = useQuery(query);
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className={cn("max-h-[90dvh] overflow-y-auto", className)} data-testid={testId}>
				{top?.(record)}
				<DialogHeader>
					<DialogTitle>{typeof title === "function" ? title(record) : title}</DialogTitle>
					{description ? <DialogDescription>{description(record, error)}</DialogDescription> : null}
				</DialogHeader>
				{record ? (
					children(record)
				) : error ? (
					<div className="flex flex-col items-start gap-3">
						<p className="text-destructive text-sm" role="alert">
							{errorMessage(error)}
						</p>
						<Button variant="outline" onClick={onClose}>
							{m.dialog_close()}
						</Button>
					</div>
				) : (
					<output className="flex flex-col gap-4" aria-busy="true">
						<span className="sr-only">{loading}</span>
						{Array.from({ length: 4 }, (_, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows have no identity.
							<span key={index} className="block h-9 w-full animate-pulse rounded-md bg-muted" />
						))}
					</output>
				)}
			</DialogContent>
		</Dialog>
	);
}
