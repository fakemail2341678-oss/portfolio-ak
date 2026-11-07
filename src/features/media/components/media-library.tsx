import { useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { PencilIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { lazy, Suspense, useRef, useState } from "react";
import { toast } from "sonner";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { useConfirm } from "@/components/dialogs/confirm";
import { ActiveFilters, ClearFiltersButton } from "@/components/filters/active-filters";
import { FilterBar } from "@/components/filters/filter-bar";
import { Pagination } from "@/components/navigation/pagination";
import { EmptyState } from "@/components/page/empty-state";
import { Page, PageHeader } from "@/components/page/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { uploadRule } from "@/features/attachments/constants";
import { UploadError, uploadImage } from "@/features/attachments/upload";
import { useCan } from "@/features/rbac/can";
import { useListPage } from "@/hooks/use-list-page";
import { formatBytes, formatNumber } from "@/lib/i18n/intl";
import { localizedValue } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import { MediaFilterControls, mediaFilters } from "../filters";
import { mediaKeys, mediaListQueryOptions, mediaMutations } from "../queries";
import type { MediaItemDto } from "../schema";
import { MediaThumb } from "./media-tile";

// The form opens on click: the form kit loads then, not with the page (0168).
const AltDialog = lazy(() => import("./media-alt-dialog").then((module) => ({ default: module.AltDialog })));

const route = getRouteApi("/_admin/admin/media");
const TABLE_ID = "media";

type Upload = { key: string; name: string; progress: number; error?: string };

/**
 * /admin/media: the media library (decision 0177). Upload images and PDFs,
 * describe them in both languages, see where each is used, and delete what
 * nothing uses (the server refuses the rest). Portfolio forms pick from here.
 */
export function MediaLibrary() {
	const search = route.useSearch();
	const list = useListPage({ tableId: TABLE_ID, search, query: mediaListQueryOptions });
	const queryClient = useQueryClient();
	const canWrite = useCan("media:write");
	const canUpload = useCan("attachments:upload", "media:write");
	const confirm = useConfirm();
	const [editing, setEditing] = useState<MediaItemDto | null>(null);
	const [uploads, setUploads] = useState<Upload[]>([]);
	const inputRef = useRef<HTMLInputElement>(null);
	const remove = useCrudMutation(mediaMutations.delete(), { invalidate: [mediaKeys.all] });
	const { chips, clearAll } = mediaFilters.applied(search);
	const items = list.page?.items ?? [];

	const upload = (files: ReadonlyArray<File>) => {
		for (const file of files) {
			const key = `${file.name}-${crypto.randomUUID()}`;
			const update = (patch: Partial<Upload>) =>
				setUploads((current) => current.map((entry) => (entry.key === key ? { ...entry, ...patch } : entry)));
			setUploads((current) => [...current, { key, name: file.name, progress: 0 }]);
			uploadImage(file, "media", {
				signal: new AbortController().signal,
				onProgress: (progress) => update({ progress }),
			})
				.then(() => {
					setUploads((current) => current.filter((entry) => entry.key !== key));
					toast.success(m.attachments_field_uploaded({ name: file.name }));
					void queryClient.invalidateQueries({ queryKey: mediaKeys.all });
				})
				.catch((error: unknown) =>
					update({ error: error instanceof UploadError ? error.message : m.attachments_error_missing() }),
				);
		}
	};

	const askDelete = async (item: MediaItemDto) => {
		const confirmed = await confirm({
			destructive: true,
			title: m.crud_delete_title({ label: item.name }),
			description: m.media_delete_body(),
			confirmLabel: m.crud_delete(),
		});
		if (confirmed)
			remove.mutate([item.id], { onSuccess: () => toast.success(m.crud_toast_deleted({ label: item.name })) });
	};

	return (
		<Page width="admin">
			<PageHeader
				title={m.media_title()}
				description={m.media_description()}
				actions={
					canUpload ? (
						<>
							<input
								ref={inputRef}
								type="file"
								multiple
								accept={uploadRule("media").mimeTypes.join(",")}
								className="sr-only"
								tabIndex={-1}
								aria-hidden
								onChange={(event) => {
									upload([...(event.target.files ?? [])]);
									event.target.value = "";
								}}
							/>
							<Button onClick={() => inputRef.current?.click()}>
								<UploadIcon aria-hidden />
								{m.media_upload()}
							</Button>
						</>
					) : null
				}
			/>
			<FilterBar values={search} preserve={["sort", "pageSize"]}>
				<MediaFilterControls search={search} />
			</FilterBar>
			<ActiveFilters chips={chips} clearAll={clearAll} />

			{uploads.length > 0 ? (
				<ul className="flex flex-col gap-2">
					{uploads.map((entry) => (
						<li key={entry.key} className="flex items-center gap-3 rounded-md border p-2 text-sm">
							<span className="min-w-0 flex-1 truncate">
								{entry.error ? (
									<span className="text-destructive">{`${entry.name}: ${entry.error}`}</span>
								) : (
									m.attachments_field_uploading({ name: entry.name })
								)}
							</span>
							{entry.error ? (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setUploads((current) => current.filter((other) => other.key !== entry.key))}
								>
									{m.attachments_field_dismiss()}
								</Button>
							) : (
								<Progress
									className="w-24"
									value={Math.round(entry.progress * 100)}
									aria-label={m.attachments_field_uploading({ name: entry.name })}
								/>
							)}
						</li>
					))}
				</ul>
			) : null}

			{list.page && items.length === 0 ? (
				<EmptyState
					data-testid="empty"
					variant={chips.length > 0 ? "no-matches" : "empty"}
					description={chips.length > 0 ? m.media_empty_filtered() : m.media_empty()}
					primaryAction={chips.length > 0 ? <ClearFiltersButton clearAll={clearAll} /> : null}
				/>
			) : (
				<ul
					className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
					aria-busy={list.busy}
					data-testid="media-grid"
				>
					{items.map((item) => {
						const alt = localizedValue(item.image.alt);
						return (
							<li key={item.id} className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-2 shadow-xs">
								<MediaThumb image={item.image} className="aspect-square w-full" />
								<p className="line-clamp-2 min-h-10 text-sm">
									{alt || (
										<Badge variant="outline" className="border-warning/40 text-warning">
											{m.media_no_alt()}
										</Badge>
									)}
								</p>
								<p className="truncate text-muted-foreground text-xs">
									{`${item.image.format.toUpperCase()} · ${formatBytes(item.bytes)}`}
								</p>
								<p className="text-xs">
									{item.usage.length > 0 ? (
										<span title={item.usage.map((use) => use.label).join(", ")}>
											{m.media_used_by({ count: formatNumber(item.usage.length), first: item.usage[0]?.label ?? "" })}
										</span>
									) : (
										<span className="text-muted-foreground">{m.media_unused()}</span>
									)}
								</p>
								{canWrite ? (
									<div className="mt-auto flex gap-1">
										<Button
											variant="ghost"
											size="icon"
											aria-label={m.media_edit_alt({ name: item.name })}
											onClick={() => setEditing(item)}
										>
											<PencilIcon aria-hidden />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											aria-label={m.crud_delete_title({ label: item.name })}
											disabled={item.usage.length > 0}
											title={item.usage.length > 0 ? m.media_delete_used() : undefined}
											onClick={() => void askDelete(item)}
										>
											<Trash2Icon aria-hidden />
										</Button>
									</div>
								) : null}
							</li>
						);
					})}
				</ul>
			)}
			{list.pagination ? <Pagination {...list.pagination} /> : null}
			{editing ? (
				<Suspense fallback={null}>
					<AltDialog item={editing} onClose={() => setEditing(null)} />
				</Suspense>
			) : null}
		</Page>
	);
}
