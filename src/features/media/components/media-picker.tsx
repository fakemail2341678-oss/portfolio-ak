import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, UploadIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { uploadRule } from "@/features/attachments/constants";
import type { ImageAsset } from "@/features/attachments/schema";
import { UploadError, uploadImage } from "@/features/attachments/upload";
import { useCan } from "@/features/rbac/can";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatNumber } from "@/lib/i18n/intl";
import { localizedValue } from "@/lib/i18n/localized";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { MEDIA_PAGE_SIZE, type MediaKind } from "../constants";
import { mediaKeys, mediaListQueryOptions } from "../queries";
import { MediaThumb } from "./media-tile";

type Upload = { key: string; name: string; progress: number; error?: string };

/**
 * Picks items from the media library (decision 0177): search by alt text or
 * file name, select up to `room` (one replaces a single image), or upload new
 * files into the library (they are selected once uploaded). Items the field
 * already holds aren't offered again.
 */
export function MediaPicker({
	kind,
	room,
	exclude,
	onPick,
	onClose,
}: {
	kind: Exclude<MediaKind, "all">;
	room: number;
	exclude: ReadonlyArray<string>;
	onPick: (items: Array<{ id: string; preview: ImageAsset }>) => void;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const searchId = useId();
	const canUpload = useCan("attachments:upload", "media:write");
	const [q, setQ] = useState("");
	const [page, setPage] = useState(1);
	const [selected, setSelected] = useState<Array<{ id: string; preview: ImageAsset }>>([]);
	const [uploads, setUploads] = useState<Upload[]>([]);
	const inputRef = useRef<HTMLInputElement>(null);
	const query = useDebouncedValue(q, 250);
	const input = { q: query, kind, usage: "all" as const, sort: "-uploaded" as const, page, pageSize: MEDIA_PAGE_SIZE };
	const list = useQuery({ ...mediaListQueryOptions(input), placeholderData: keepPreviousData });
	const items = (list.data?.items ?? []).filter((item) => !exclude.includes(item.id));

	const toggle = (item: { id: string; image: ImageAsset }) =>
		setSelected((current) => {
			if (current.some((entry) => entry.id === item.id)) return current.filter((entry) => entry.id !== item.id);
			const next = [...current, { id: item.id, preview: item.image }];
			// A single slot: picking another replaces the choice.
			return room === 1 ? next.slice(-1) : next.slice(0, room);
		});

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
				.then((image) => {
					setUploads((current) => current.filter((entry) => entry.key !== key));
					setSelected((current) =>
						room === 1
							? [{ id: image.id, preview: image }]
							: [...current, { id: image.id, preview: image }].slice(0, room),
					);
					void queryClient.invalidateQueries({ queryKey: mediaKeys.all });
				})
				.catch((error: unknown) =>
					update({ error: error instanceof UploadError ? error.message : m.attachments_error_missing() }),
				);
		}
	};

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
				data-testid="media-picker"
			>
				<DialogHeader className="border-b px-6 py-4 pe-12">
					<DialogTitle>{m.media_picker_title()}</DialogTitle>
					<DialogDescription>
						{room === 1 ? m.media_picker_description_one() : m.media_picker_description({ max: formatNumber(room) })}
					</DialogDescription>
				</DialogHeader>
				<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
					<div className="flex flex-wrap items-end gap-3">
						<div className="flex min-w-48 flex-1 flex-col gap-1.5">
							<label htmlFor={searchId} className="font-medium text-sm">
								{m.crud_search()}
							</label>
							<Input
								id={searchId}
								type="search"
								value={q}
								placeholder={m.media_search_placeholder()}
								onChange={(event) => {
									setQ(event.target.value);
									setPage(1);
								}}
							/>
						</div>
						{canUpload ? (
							<>
								<input
									ref={inputRef}
									type="file"
									multiple={room > 1}
									accept={uploadRule("media")
										.mimeTypes.filter((type) => (kind === "document") === (type === "application/pdf"))
										.join(",")}
									className="sr-only"
									tabIndex={-1}
									aria-hidden
									onChange={(event) => {
										upload([...(event.target.files ?? [])]);
										event.target.value = "";
									}}
								/>
								<Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
									<UploadIcon aria-hidden />
									{m.media_upload()}
								</Button>
							</>
						) : null}
					</div>

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
									{entry.error ? null : (
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

					{list.error ? (
						<p role="alert" className="text-destructive text-sm">
							{errorMessage(list.error)}
						</p>
					) : list.data ? (
						items.length === 0 ? (
							<p className="py-6 text-center text-muted-foreground text-sm">
								{query ? m.media_empty_filtered() : m.media_empty()}
							</p>
						) : (
							<ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6" aria-busy={list.isFetching}>
								{items.map((item) => {
									const isSelected = selected.some((entry) => entry.id === item.id);
									const alt = localizedValue(item.image.alt);
									return (
										<li key={item.id}>
											<button
												type="button"
												aria-pressed={isSelected}
												aria-label={alt || item.name}
												onClick={() => toggle(item)}
												className={cn(
													"relative flex w-full flex-col overflow-hidden rounded-md border-2 border-transparent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
													isSelected && "border-primary",
												)}
											>
												<MediaThumb image={item.image} className="aspect-square w-full" />
												{isSelected ? (
													<span className="absolute end-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
														<CheckIcon aria-hidden className="size-3.5" />
													</span>
												) : null}
											</button>
										</li>
									);
								})}
							</ul>
						)
					) : (
						<output className="flex justify-center py-6">
							<Spinner />
						</output>
					)}
					{list.data && list.data.pageCount > 1 ? (
						<nav aria-label={m.pagination_label()} className="flex items-center justify-between gap-3 text-sm">
							<Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
								{m.pagination_previous()}
							</Button>
							<span className="text-muted-foreground">
								{m.pagination_status({ page: formatNumber(page), total: formatNumber(list.data.pageCount) })}
							</span>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={page >= list.data.pageCount}
								onClick={() => setPage(page + 1)}
							>
								{m.pagination_next()}
							</Button>
						</nav>
					) : null}
				</div>
				<DialogFooter className="border-t px-6 py-4">
					<Button type="button" variant="ghost" onClick={onClose}>
						{m.common_cancel()}
					</Button>
					<Button type="button" disabled={selected.length === 0} onClick={() => onPick(selected)}>
						{m.media_picker_use({ count: formatNumber(selected.length) })}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
