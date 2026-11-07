import { useQuery } from "@tanstack/react-query";
import { ImagePlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { type DragEvent, useEffect, useId, useRef, useState } from "react";
import { useFieldContext } from "@/components/forms/contexts";
import { FieldLabelText, FieldMessages, useFieldA11y } from "@/components/forms/field-shell";
import { moveItem, SortableList } from "@/components/forms/fields/sortable-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useCan } from "@/features/rbac/can";
import { formatNumber } from "@/lib/i18n/intl";
import type { Localized } from "@/lib/i18n/localized";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { IMAGE_MAX_BYTES, type UploadScope, uploadRule } from "../constants";
import type { ImageAsset } from "../schema";
import { ADMIN_UPLOADS, UploadError, type UploadTransport, uploadImage } from "../upload";
import { CloudImage } from "./cloud-image";

/** One image in the field's value: an attachment, its alt text (both languages) and its preview. */
export type FieldImage = { id: string; alt: Localized; preview: ImageAsset };

const ALT_LANGUAGES = [
	["en", m.language_en],
	["ne", m.language_ne],
] as const;

type Upload = { key: string; name: string; progress: number; error?: string; controller: AbortController };

/**
 * A gallery of images for a form: upload (pick or drop files, several at once, with
 * progress and cancel), reorder (the kit's SortableList: drag, keyboard drag or
 * Alt + ↑/↓ on the handle), alt text, remove. The first image is the cover. The value
 * is FieldImage[]; the form sends ids + alt text, and the item's save links them
 * (uploads stay "pending" until then).
 *
 * `onBusyChange` reports whether uploads are in progress (the form refuses to
 * submit meanwhile). Without the transport's permission (attachments:upload for the
 * admin's) the existing images can still be ordered, described and removed, but not
 * added. `transport` swaps the server calls (an app's own, decision 0190).
 */
export function ImageGalleryField({
	label,
	scope,
	max,
	onBusyChange,
	transport = ADMIN_UPLOADS,
}: {
	label: string;
	scope: UploadScope;
	max: number;
	onBusyChange?: (busy: boolean) => void;
	transport?: UploadTransport;
}) {
	const field = useFieldContext<FieldImage[]>();
	const a11y = useFieldA11y(label, { focusId: (id) => `${id}-add` });
	const permitted = useCan(transport.permission ?? "attachments:upload");
	const canUpload = transport.permission === null || permitted;
	const settings = useQuery({ ...transport.settings, staleTime: Number.POSITIVE_INFINITY, enabled: canUpload });
	const [uploads, setUploads] = useState<Upload[]>([]);
	const [announcement, setAnnouncement] = useState("");
	const [dropActive, setDropActive] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	/** Uploads made in this form session: removing one before saving deletes it at once. */
	const fresh = useRef(new Set<string>());
	const hintId = useId();

	const images = field.state.value ?? [];
	const active = uploads.filter((upload) => !upload.error).length;
	const enabled = canUpload && settings.data?.enabled === true;
	const room = max - images.length - active;

	// Cancel uploads still running when the form goes away.
	const uploadsRef = useRef(uploads);
	uploadsRef.current = uploads;
	useEffect(() => onBusyChange?.(active > 0), [active, onBusyChange]);
	useEffect(
		() => () => {
			for (const upload of uploadsRef.current) upload.controller.abort();
		},
		[],
	);

	const setImages = (next: FieldImage[]) => {
		field.handleChange(next);
		field.handleBlur();
	};
	const update = (key: string, patch: Partial<Upload>) =>
		setUploads((current) => current.map((upload) => (upload.key === key ? { ...upload, ...patch } : upload)));

	const start = (files: ReadonlyArray<File>) => {
		const accepted = files.slice(0, Math.max(0, room));
		if (files.length > accepted.length) setAnnouncement(m.attachments_field_limit({ max: formatNumber(max) }));
		for (const file of accepted) {
			const key = `${file.name}-${crypto.randomUUID()}`;
			const controller = new AbortController();
			setUploads((current) => [...current, { key, name: file.name, progress: 0, controller }]);
			uploadImage(file, scope, {
				signal: controller.signal,
				onProgress: (progress) => update(key, { progress }),
				transport,
			})
				.then((preview) => {
					fresh.current.add(preview.id);
					setUploads((current) => current.filter((upload) => upload.key !== key));
					// Appended atomically: uploads finish in any order, close together, and a
					// value read when this upload started would drop the others.
					field.pushValue({ id: preview.id, alt: { en: "", ne: "" }, preview });
					field.handleBlur();
					setAnnouncement(m.attachments_field_uploaded({ name: file.name }));
				})
				.catch((error: unknown) => {
					if (error instanceof DOMException && error.name === "AbortError") {
						setUploads((current) => current.filter((upload) => upload.key !== key));
						return;
					}
					const message = error instanceof UploadError ? error.message : m.attachments_error_missing();
					update(key, { error: message });
				});
		}
	};

	// SortableList announces the move itself.
	const move = (from: number, to: number) => setImages(moveItem(images, from, to));
	const remove = (index: number) => {
		const image = images[index];
		if (!image) return;
		setImages(images.filter((_, position) => position !== index));
		// Never saved: delete now (saved images are removed by the item's save).
		if (fresh.current.delete(image.id)) void transport.discard(image.id).catch(() => {});
		setAnnouncement(m.attachments_field_removed());
	};
	const setAlt = (index: number, language: keyof Localized, text: string) =>
		field.handleChange(
			images.map((image, position) =>
				position === index ? { ...image, alt: { ...image.alt, [language]: text } } : image,
			),
		);

	const onDrop = (event: DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		setDropActive(false);
		if (enabled && event.dataTransfer.files.length > 0) start([...event.dataTransfer.files]);
	};

	return (
		<fieldset
			className="flex min-w-0 flex-col gap-3"
			aria-describedby={a11y.describedBy(false)}
			aria-invalid={a11y.invalid || undefined}
		>
			<legend className="mb-1 font-medium text-sm">
				<FieldLabelText label={label} optional />
			</legend>

			{images.length === 0 ? <p className="text-muted-foreground text-sm">{m.attachments_field_empty()}</p> : null}
			<SortableList
				items={images}
				layout="grid"
				getId={(image) => image.id}
				getLabel={(_, index) => m.attachments_field_image_n({ n: formatNumber(index + 1) })}
				onMove={move}
				renderItem={(image, index, handle) => {
					const n = formatNumber(index + 1);
					return (
						<div className="flex h-full gap-3 rounded-md border bg-card p-2">
							<div className="flex flex-col items-center gap-1">
								<CloudImage
									image={image.preview}
									variant="thumb"
									alt=""
									className="size-20 shrink-0 rounded border object-cover"
								/>
								{handle}
							</div>
							<div className="flex min-w-0 flex-1 flex-col gap-2">
								<div className="flex items-center justify-between gap-2">
									<span className="font-medium text-sm">{m.attachments_field_image_n({ n })}</span>
									{index === 0 ? <Badge variant="secondary">{m.attachments_field_cover()}</Badge> : null}
								</div>
								{ALT_LANGUAGES.map(([language, name]) => (
									<div key={language} className="contents">
										<label className="sr-only" htmlFor={`${a11y.id}-alt-${image.id}-${language}`}>
											{m.attachments_field_alt_in({ n, language: name() })}
										</label>
										<Input
											id={`${a11y.id}-alt-${image.id}-${language}`}
											lang={language}
											value={image.alt[language]}
											maxLength={200}
											placeholder={m.attachments_field_alt_placeholder_in({ language: name() })}
											onChange={(event) => setAlt(index, language, event.target.value)}
											onBlur={field.handleBlur}
										/>
									</div>
								))}
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="ms-auto"
									aria-label={m.attachments_field_remove({ n })}
									onClick={() => remove(index)}
								>
									<Trash2Icon aria-hidden />
								</Button>
							</div>
						</div>
					);
				}}
			/>

			{uploads.length > 0 ? (
				<ul className="flex flex-col gap-2" data-testid="uploads">
					{uploads.map((upload) => (
						<li key={upload.key} className="flex items-center gap-3 rounded-md border p-2 text-sm">
							<span className="min-w-0 flex-1 truncate">
								{upload.error ? (
									<span className="text-destructive">{`${upload.name}: ${upload.error}`}</span>
								) : (
									m.attachments_field_uploading({ name: upload.name })
								)}
							</span>
							{upload.error ? null : (
								<Progress
									className="w-24"
									value={Math.round(upload.progress * 100)}
									aria-label={m.attachments_field_uploading({ name: upload.name })}
								/>
							)}
							<Button
								type="button"
								variant="ghost"
								size="icon"
								aria-label={
									upload.error ? m.attachments_field_dismiss() : m.attachments_field_cancel({ name: upload.name })
								}
								onClick={() => {
									upload.controller.abort();
									setUploads((current) => current.filter((item) => item.key !== upload.key));
								}}
							>
								<XIcon aria-hidden />
							</Button>
						</li>
					))}
				</ul>
			) : null}

			{canUpload ? (
				settings.data && !settings.data.enabled ? (
					<p className="text-muted-foreground text-sm" role="note">
						{m.attachments_error_disabled()}
					</p>
				) : (
					// biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop target; the button inside is the accessible way to add files.
					<div
						className={cn(
							"flex flex-wrap items-center gap-3 rounded-md border border-dashed p-4",
							dropActive && "border-primary bg-accent/50",
						)}
						onDragOver={(event) => {
							// Files only: dragging an image inside the gallery is SortableList's.
							if (!enabled || !event.dataTransfer.types.includes("Files")) return;
							event.preventDefault();
							setDropActive(true);
						}}
						onDragLeave={() => setDropActive(false)}
						onDrop={onDrop}
					>
						<input
							ref={inputRef}
							type="file"
							accept={uploadRule(scope).mimeTypes.join(",")}
							multiple
							className="sr-only"
							tabIndex={-1}
							aria-hidden
							onChange={(event) => {
								start([...(event.target.files ?? [])]);
								event.target.value = "";
							}}
						/>
						<Button
							id={`${a11y.id}-add`}
							type="button"
							variant="outline"
							disabled={!enabled || room <= 0}
							aria-describedby={hintId}
							onClick={() => inputRef.current?.click()}
						>
							<ImagePlusIcon aria-hidden />
							{m.attachments_field_add()}
						</Button>
						<span className="text-muted-foreground text-sm">{m.attachments_field_drop()}</span>
					</div>
				)
			) : null}
			<p id={hintId} className="text-muted-foreground text-xs">
				{m.attachments_field_hint({ max: `${formatNumber(IMAGE_MAX_BYTES / 1024 / 1024)} MB` })}
			</p>
			<FieldMessages descriptionId={a11y.descriptionId} errorId={a11y.errorId} errors={a11y.errors} />
			<p className="sr-only" aria-live="polite">
				{announcement}
			</p>
		</fieldset>
	);
}
