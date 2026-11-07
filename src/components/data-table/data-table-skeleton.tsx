import { m } from "@/paraglide/messages";

/**
 * Placeholder with the table's footprint while a client-side navigation loads
 * (the server always renders real rows). Use it in a route's pendingComponent.
 */
export function DataTableSkeleton({ columns = 5, rows = 8 }: { columns?: number; rows?: number }) {
	return (
		<div className="rounded-md border" aria-busy="true">
			<output className="sr-only">{m.table_loading()}</output>
			<div className="flex h-10 items-center gap-4 border-b px-3" aria-hidden>
				{Array.from({ length: columns }, (_, column) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder cells have no identity.
					<div key={column} className="h-3.5 flex-1 animate-pulse rounded bg-muted" />
				))}
			</div>
			{Array.from({ length: rows }, (_, row) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows have no identity.
				<div key={row} className="flex h-14 items-center gap-4 border-b px-3 last:border-b-0" aria-hidden>
					{Array.from({ length: columns }, (_, column) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder cells have no identity.
						<div key={column} className="h-3.5 flex-1 animate-pulse rounded bg-muted/70" />
					))}
				</div>
			))}
		</div>
	);
}
