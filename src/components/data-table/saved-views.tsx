import { useLocation, useNavigate } from "@tanstack/react-router";
import { BookmarkIcon, CheckIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { m } from "@/paraglide/messages";

/**
 * Saved views: named search strings for one table. The URL is the list's state
 * (filters, sort, page size), so a view is its search string. By default they are
 * kept in this browser's localStorage per table; a feature can keep them elsewhere
 * by passing a `store` (Taskline keeps them per member on the server, shared or not:
 * docs/guides/taskline.md, "Finding things"; recipes.md, "Saved views").
 */
export type SavedView = { name: string; search: string };

/** One view a store holds: `shared` ones show who saved them (`detail`). */
export type StoredView = SavedView & { id: string; shared?: boolean; detail?: string; canDelete: boolean };

/** Where the views live. Without `save`, the menu only lists them (a reader). */
export type SavedViewsStore = {
	views: ReadonlyArray<StoredView>;
	save?: (view: SavedView & { shared: boolean }) => Promise<unknown>;
	/** Offer "Share with everyone" when saving. */
	canShare?: boolean;
	remove: (id: string) => Promise<unknown>;
	/** Params a saved search leaves out (the page, an open sheet). */
	omit?: ReadonlyArray<string>;
};

const storageKey = (tableId: string) => `views:${tableId}`;

const readViews = (tableId: string): SavedView[] => {
	try {
		const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(tableId)) ?? "[]");
		return Array.isArray(parsed)
			? parsed.filter((view): view is SavedView => typeof view?.name === "string" && typeof view?.search === "string")
			: [];
	} catch {
		return [];
	}
};

const writeViews = (tableId: string, views: SavedView[]) => {
	try {
		localStorage.setItem(storageKey(tableId), JSON.stringify(views));
	} catch {
		// Storage can be unavailable (privacy mode): the views just aren't kept.
	}
};

/** The browser's own views of a table, as a store. */
function useLocalViews(tableId: string): SavedViewsStore {
	// Read after mount: the server has no localStorage, and the first render must match it.
	const [views, setViews] = useState<SavedView[]>([]);
	useEffect(() => setViews(readViews(tableId)), [tableId]);
	const update = (next: SavedView[]) => {
		setViews(next);
		writeViews(tableId, next);
	};
	return {
		views: views.map((view) => ({ ...view, id: view.name, canDelete: true })),
		save: async ({ name, search }) => update([...views.filter((view) => view.name !== name), { name, search }]),
		remove: async (id) => update(views.filter((view) => view.name !== id)),
	};
}

/** The search string without the params a view leaves out ("" when nothing is left). */
export const viewSearch = (searchStr: string, omit: ReadonlyArray<string> = []): string => {
	const params = new URLSearchParams(searchStr);
	for (const key of omit) params.delete(key);
	const text = params.toString();
	return text ? `?${text}` : "";
};

export function SavedViewsMenu({ tableId, store }: { tableId: string; store?: SavedViewsStore }) {
	const local = useLocalViews(tableId);
	const { views, save, canShare = false, remove, omit = [] } = store ?? local;
	const { pathname, searchStr } = useLocation();
	const navigate = useNavigate();
	const inputId = useId();
	const shareId = useId();
	const [name, setName] = useState("");
	const [shared, setShared] = useState(false);
	const [busy, setBusy] = useState(false);
	const current = viewSearch(searchStr, omit);

	const submit = async () => {
		const trimmed = name.trim();
		if (!trimmed || !save) return;
		setBusy(true);
		try {
			await save({ name: trimmed, search: current, shared: canShare && shared });
			setName("");
			setShared(false);
		} catch {
			// The store said what went wrong; the name stays to try again.
		} finally {
			setBusy(false);
		}
	};

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button variant="outline" data-testid="saved-views">
					<BookmarkIcon aria-hidden />
					{m.table_views()}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="flex w-72 flex-col gap-3" aria-label={m.table_views()}>
				{views.length > 0 ? (
					<ul className="-mx-1 flex flex-col" data-testid="saved-views-list">
						{views.map((view) => {
							const active = view.search === current;
							return (
								<li key={view.id} className="flex items-center gap-1">
									<Button
										variant="ghost"
										size="sm"
										className="h-auto min-h-8 min-w-0 flex-1 justify-start py-1"
										aria-current={active || undefined}
										onClick={() => void navigate({ href: `${pathname}${view.search}` })}
									>
										<CheckIcon aria-hidden className={active ? "opacity-100" : "opacity-0"} />
										<span className="flex min-w-0 flex-col items-start">
											<span className="max-w-full truncate">{view.name}</span>
											{view.shared && view.detail ? (
												<span className="flex max-w-full items-center gap-1 truncate text-caption text-muted-foreground">
													<UsersIcon aria-hidden className="size-3" />
													{view.detail}
												</span>
											) : null}
										</span>
									</Button>
									{view.canDelete ? (
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label={m.table_view_forget({ name: view.name })}
											onClick={() => void remove(view.id)}
										>
											<Trash2Icon aria-hidden />
										</Button>
									) : null}
								</li>
							);
						})}
					</ul>
				) : (
					<p className="text-caption text-muted-foreground">{m.table_views_empty()}</p>
				)}
				{save ? (
					<form
						method="post"
						className="flex flex-col gap-2 border-t pt-3"
						onSubmit={(event) => {
							event.preventDefault();
							void submit();
						}}
					>
						<label htmlFor={inputId} className="font-medium text-caption">
							{m.table_view_name()}
						</label>
						<div className="flex gap-2">
							<Input
								id={inputId}
								value={name}
								maxLength={60}
								onChange={(event) => setName(event.target.value)}
								data-testid="saved-view-name"
							/>
							<Button type="submit" variant="secondary" disabled={!name.trim() || busy} data-testid="saved-view-save">
								{m.table_view_save()}
							</Button>
						</div>
						{canShare ? (
							<div className="flex items-center gap-2">
								<Checkbox
									id={shareId}
									checked={shared}
									onCheckedChange={(checked) => setShared(checked === true)}
									data-testid="saved-view-share"
								/>
								<Label htmlFor={shareId} className="font-normal text-caption">
									{m.table_view_share()}
								</Label>
							</div>
						) : null}
					</form>
				) : null}
			</PopoverContent>
		</Popover>
	);
}
