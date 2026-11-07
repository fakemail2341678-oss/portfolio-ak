import { FileIcon, UploadIcon, XIcon } from "lucide-react";
import { type DragEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { formatBytes } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import type { FileRules } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { useFieldContext } from "../contexts";
import { type FieldBaseProps, FieldLabelText, FieldMessages, useFieldA11y } from "../field-shell";

/** "image/png, image/jpeg" -> "PNG, JPEG"; wildcards -> "images" etc. are kept as-is. */
const typesLabel = (accept: ReadonlyArray<string>) =>
	accept.map((type) => (type.endsWith("/*") ? type : (type.split("/")[1] ?? type).toUpperCase())).join(", ");

type FilePickerProps = FieldBaseProps &
	FileRules & {
		multiple?: boolean;
		/** Renders previews (images) or a file list for the current value. */
		renderSelection: (files: File[], remove: (file: File) => void) => React.ReactNode;
		/** Shown instead when nothing is picked (e.g. the currently stored image). */
		emptySelection?: React.ReactNode;
	};

/**
 * Shared picker: a real <input type="file"> (labelled by the field label and
 * focusable, so keyboard users get the native picker) plus a second <label>
 * styled as the visible "Choose" button, inside a drop zone. Size/type/count
 * rules are enforced by files() in the schema so errors are localized and
 * appear with the field; `accept` also narrows the native picker.
 */
function FilePicker({
	label,
	description,
	optional,
	multiple = false,
	maxBytes,
	accept,
	renderSelection,
	emptySelection = null,
}: FilePickerProps) {
	const field = useFieldContext<File[]>();
	const a11y = useFieldA11y(label);
	const [dragging, setDragging] = useState(false);
	const files = field.state.value ?? [];
	const hintId = `${a11y.id}-hint`;

	const setFiles = (picked: File[]) => {
		field.handleChange(multiple ? [...files, ...picked] : picked.slice(0, 1));
		field.handleBlur();
	};
	const remove = (file: File) => {
		field.handleChange(files.filter((existing) => existing !== file));
		field.handleBlur();
	};

	const onDrop = (event: DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		setDragging(false);
		setFiles(Array.from(event.dataTransfer.files));
	};

	return (
		<Field data-invalid={a11y.invalid || undefined}>
			<FieldLabel htmlFor={a11y.id}>
				<FieldLabelText label={label} optional={optional} />
			</FieldLabel>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop is a pointer-only enhancement; the focusable native file input inside is the keyboard/AT path. */}
			<div
				data-testid="file-dropzone"
				data-dragging={dragging || undefined}
				onDragOver={(event) => {
					event.preventDefault();
					setDragging(true);
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={onDrop}
				className={cn(
					"flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center transition-colors",
					dragging && "border-primary bg-accent",
					a11y.invalid && "border-destructive",
				)}
			>
				<UploadIcon className="size-5 text-muted-foreground" aria-hidden />
				<input
					id={a11y.id}
					name={field.name}
					type="file"
					multiple={multiple}
					accept={accept.join(",")}
					className="peer sr-only"
					aria-invalid={a11y.invalid || undefined}
					aria-describedby={[hintId, a11y.describedBy(Boolean(description))].filter(Boolean).join(" ")}
					onChange={(event) => {
						setFiles(Array.from(event.target.files ?? []));
						// Allow picking the same file again after removing it.
						event.target.value = "";
					}}
				/>
				<label
					htmlFor={a11y.id}
					className="cursor-pointer rounded-md border bg-background px-3 py-1.5 font-medium text-sm shadow-xs hover:bg-accent peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50"
				>
					{multiple ? m.file_choose_multiple() : m.file_choose()}
				</label>
				<p className="text-muted-foreground text-sm">{m.file_drop_hint()}</p>
				<p id={hintId} className="text-muted-foreground text-xs">
					{m.file_limits({ size: formatBytes(maxBytes), types: typesLabel(accept) })}
				</p>
			</div>
			{files.length > 0 ? renderSelection(files, remove) : emptySelection}
			<FieldMessages
				descriptionId={a11y.descriptionId}
				description={description}
				errorId={a11y.errorId}
				errors={a11y.errors}
			/>
		</Field>
	);
}

export type FileFieldProps = FieldBaseProps & FileRules & { multiple?: boolean };

/** One or more files with name/size and remove buttons. Stores File[]. */
export function FileField(props: FileFieldProps) {
	return (
		<FilePicker
			{...props}
			renderSelection={(files, remove) => (
				<ul className="flex flex-col gap-2" data-testid="file-list">
					{files.map((file) => (
						<li
							key={`${file.name}-${file.size}-${file.lastModified}`}
							className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
						>
							<FileIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
							<span className="min-w-0 flex-1 truncate">{file.name}</span>
							<span className="text-muted-foreground">{formatBytes(file.size)}</span>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="size-7"
								aria-label={m.file_remove({ name: file.name })}
								onClick={() => remove(file)}
							>
								<XIcon aria-hidden />
							</Button>
						</li>
					))}
				</ul>
			)}
		/>
	);
}

/** Object URL for a File, revoked when the file changes or the component unmounts. */
function useObjectUrl(file: File | undefined) {
	const [url, setUrl] = useState<string>();
	useEffect(() => {
		if (!file) {
			setUrl(undefined);
			return;
		}
		const next = URL.createObjectURL(file);
		setUrl(next);
		return () => URL.revokeObjectURL(next);
	}, [file]);
	return url;
}

function ImagePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
	const url = useObjectUrl(file);
	return (
		<div className="flex items-center gap-3" data-testid="image-preview">
			{url ? (
				<img
					src={url}
					alt={m.image_preview_alt({ name: file.name })}
					className="size-20 rounded-md border object-cover"
				/>
			) : (
				<div className="size-20 rounded-md border bg-muted" />
			)}
			<div className="flex min-w-0 flex-1 flex-col text-sm">
				<span className="truncate">{file.name}</span>
				<span className="text-muted-foreground">{formatBytes(file.size)}</span>
			</div>
			<Button
				type="button"
				variant="outline"
				size="sm"
				onClick={onRemove}
				aria-label={m.file_remove({ name: file.name })}
			>
				<XIcon aria-hidden />
			</Button>
		</div>
	);
}

/** An image already stored on the server (edit forms). The form tracks whether it's been removed. */
export type CurrentImage = { url: string; removed: boolean; onRemove: () => void; onKeep: () => void };

function CurrentImagePreview({ current }: { current: CurrentImage }) {
	if (current.removed) {
		return (
			<div className="flex items-center justify-between gap-3 rounded-md border border-dashed px-3 py-2 text-sm">
				<span className="text-muted-foreground">{m.image_will_be_removed()}</span>
				<Button type="button" variant="outline" size="sm" onClick={current.onKeep}>
					{m.image_keep_current()}
				</Button>
			</div>
		);
	}
	return (
		<div className="flex items-center gap-3" data-testid="current-image">
			<img src={current.url} alt={m.image_current_alt()} className="size-20 rounded-md border object-cover" />
			<Button type="button" variant="outline" size="sm" onClick={current.onRemove}>
				<XIcon aria-hidden />
				{m.image_remove_current()}
			</Button>
		</div>
	);
}

export type ImageFieldProps = FieldBaseProps &
	Omit<FileRules, "accept"> & {
		accept?: ReadonlyArray<string>;
		/** The stored image, shown (with Remove / Keep) while no new file is picked. */
		current?: CurrentImage | undefined;
	};

/** A single image with a live preview. Stores File[] (zero or one file); a new file replaces `current`. */
export function ImageField({ accept = ["image/png", "image/jpeg", "image/webp"], current, ...props }: ImageFieldProps) {
	return (
		<FilePicker
			{...props}
			accept={accept}
			emptySelection={current ? <CurrentImagePreview current={current} /> : null}
			renderSelection={(files, remove) =>
				files[0] ? <ImagePreview file={files[0]} onRemove={() => remove(files[0] as File)} /> : null
			}
		/>
	);
}
