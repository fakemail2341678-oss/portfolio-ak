import { useQuery } from "@tanstack/react-query";
import { CameraIcon, FileTextIcon, LoaderCircleIcon, PaperclipIcon, XIcon } from "lucide-react";
import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { CloudImage } from "@/features/attachments/components/cloud-image";
import type { ImageAsset } from "@/features/attachments/schema";
import { UploadError, uploadImage } from "@/features/attachments/upload";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { kharchaUploadsQueryOptions } from "../queries";
import { KHARCHA_UPLOADS, RECEIPT_ACCEPT } from "./uploads";

const ReceiptViewer = lazy(() => import("./receipt-viewer"));

type Uploading = { key: string; name: string; progress: number; error: string | null };

/**
 * An expense's receipts in its dialog (Task 89): what it has, each opened in the viewer or
 * taken off; "Attach" picks images or PDFs, "Take a photo" opens a phone's camera; files
 * dropped on the page arrive as `incoming`. Each upload goes straight to Cloudinary through
 * Kharcha's own functions and is kept pending until the expense saves. Uploads that were
 * never saved are thrown away when taken off.
 */
export function ReceiptsField({
	value,
	onChange,
	onBusyChange,
	max,
	incoming = [],
	saved = [],
}: {
	value: ImageAsset[];
	onChange: (next: ImageAsset[]) => void;
	onBusyChange: (busy: boolean) => void;
	max: number;
	/** Files to upload as soon as the field shows (dropped on the page, picked from the + menu). */
	incoming?: ReadonlyArray<File>;
	/** Receipts already on the expense: taking one off doesn't delete it until the expense saves. */
	saved?: ReadonlyArray<string>;
}) {
	const { data: settings } = useQuery(kharchaUploadsQueryOptions());
	const [uploading, setUploading] = useState<Uploading[]>([]);
	const [viewing, setViewing] = useState<number | null>(null);
	const latest = useRef(value);
	latest.current = value;
	const controllers = useRef(new Map<string, AbortController>());
	const id = useId();
	const busy = uploading.some((item) => item.error === null);
	useEffect(() => onBusyChange(busy), [busy, onBusyChange]);
	useEffect(
		() => () => {
			for (const controller of controllers.current.values()) controller.abort();
		},
		[],
	);

	const upload = (files: ReadonlyArray<File>) => {
		const room = Math.max(0, max - latest.current.length - uploading.filter((item) => !item.error).length);
		for (const file of files.slice(0, room)) {
			const key = crypto.randomUUID();
			const controller = new AbortController();
			controllers.current.set(key, controller);
			setUploading((list) => [...list, { key, name: file.name, progress: 0, error: null }]);
			uploadImage(file, "kharcha", {
				transport: KHARCHA_UPLOADS,
				signal: controller.signal,
				onProgress: (progress) =>
					setUploading((list) => list.map((item) => (item.key === key ? { ...item, progress } : item))),
			})
				.then((asset) => {
					onChange([...latest.current, asset]);
					setUploading((list) => list.filter((item) => item.key !== key));
				})
				.catch((error: unknown) => {
					if (error instanceof DOMException && error.name === "AbortError") return;
					const message = error instanceof UploadError ? error.message : m.attachments_error_missing();
					setUploading((list) => list.map((item) => (item.key === key ? { ...item, error: message } : item)));
				})
				.finally(() => controllers.current.delete(key));
		}
	};

	// Files handed over when the dialog opened (a drop, the + menu's "Add a receipt").
	const started = useRef(false);
	useEffect(() => {
		if (started.current || incoming.length === 0 || !settings?.enabled) return;
		started.current = true;
		upload(incoming);
	});

	const remove = (asset: ImageAsset) => {
		onChange(latest.current.filter((each) => each.id !== asset.id));
		if (!saved.includes(asset.id)) void KHARCHA_UPLOADS.discard(asset.id).catch(() => undefined);
	};

	const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
		upload([...(event.target.files ?? [])]);
		event.target.value = "";
	};

	const full = value.length + uploading.filter((item) => !item.error).length >= max;
	return (
		<fieldset className="flex flex-col gap-2" data-testid="kharcha-receipts">
			<legend className="mb-2 font-medium text-sm">{m.kharcha_receipts_label()}</legend>
			{value.length > 0 || uploading.length > 0 ? (
				<ul className="flex flex-wrap gap-2">
					{value.map((asset, index) => (
						<li key={asset.id} className="relative">
							<button
								type="button"
								onClick={() => setViewing(index)}
								className="kh-ease block size-20 overflow-hidden rounded-md border border-kh-hair bg-kh-ground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
							>
								<CloudImage image={asset} variant="thumb" alt="" className="size-full object-cover" loading="lazy" />
								{asset.format === "pdf" ? (
									<span className="absolute start-1 bottom-1 rounded-sm bg-kh-page px-1 font-semibold text-[0.6875rem]">
										PDF
									</span>
								) : null}
								<span className="sr-only">{m.kharcha_receipt_open({ number: formatNumber(index + 1) })}</span>
							</button>
							<button
								type="button"
								onClick={() => remove(asset)}
								className="kh-ease -end-2 -top-2 absolute grid size-6 place-items-center rounded-full border border-kh-hair bg-kh-page text-kh-muted outline-none hover:text-kh-ink focus-visible:ring-[3px] focus-visible:ring-ring/50"
							>
								<XIcon className="size-3.5" aria-hidden />
								<span className="sr-only">{m.kharcha_receipt_remove({ number: formatNumber(index + 1) })}</span>
							</button>
						</li>
					))}
					{uploading.map((item) => (
						<li
							key={item.key}
							className={cn(
								"flex size-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed p-1 text-center text-[0.6875rem]",
								item.error ? "border-destructive text-destructive" : "border-kh-hair text-kh-muted",
							)}
						>
							{item.error ? (
								<>
									<span className="line-clamp-3" role="alert">
										{item.error}
									</span>
									<button
										type="button"
										className="underline underline-offset-2"
										onClick={() => setUploading((list) => list.filter((each) => each.key !== item.key))}
									>
										{m.dialog_close()}
									</button>
								</>
							) : (
								<>
									<LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
									<span className="kh-figures">{formatNumber(item.progress, { style: "percent" })}</span>
									<button
										type="button"
										className="underline underline-offset-2"
										onClick={() => controllers.current.get(item.key)?.abort()}
									>
										{m.common_cancel()}
									</button>
								</>
							)}
						</li>
					))}
				</ul>
			) : null}
			{settings?.enabled === false ? (
				<p className="text-caption text-kh-muted">{m.kharcha_receipts_disabled()}</p>
			) : full ? (
				<p className="text-caption text-kh-muted">{m.kharcha_receipts_full({ max: formatNumber(max) })}</p>
			) : (
				<div className="flex flex-wrap gap-2">
					<label
						htmlFor={`${id}-file`}
						className="kh-ease inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-kh-hair bg-kh-page px-3 font-medium text-sm hover:bg-kh-ground has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
					>
						<PaperclipIcon className="size-4" aria-hidden />
						{m.kharcha_receipts_attach()}
						<input
							id={`${id}-file`}
							type="file"
							accept={RECEIPT_ACCEPT}
							multiple
							className="sr-only"
							onChange={pick}
							data-testid="kharcha-receipt-input"
						/>
					</label>
					<label
						htmlFor={`${id}-camera`}
						className="kh-ease inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-kh-hair bg-kh-page px-3 font-medium text-sm hover:bg-kh-ground has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50 md:hidden"
					>
						<CameraIcon className="size-4" aria-hidden />
						{m.kharcha_receipts_camera()}
						<input
							id={`${id}-camera`}
							type="file"
							accept="image/*"
							capture="environment"
							className="sr-only"
							onChange={pick}
						/>
					</label>
				</div>
			)}
			<p className="flex items-center gap-1.5 text-caption text-kh-muted">
				<FileTextIcon className="size-3.5" aria-hidden />
				{m.kharcha_receipts_help()}
			</p>
			{viewing !== null && value.length > 0 ? (
				<Suspense fallback={null}>
					<ReceiptViewer
						receipts={value}
						start={Math.min(viewing, value.length - 1)}
						onClose={() => setViewing(null)}
					/>
				</Suspense>
			) : null}
		</fieldset>
	);
}
