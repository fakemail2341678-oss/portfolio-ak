import {
	ChevronLeftIcon,
	ChevronRightIcon,
	ExternalLinkIcon,
	RotateCwIcon,
	ZoomInIcon,
	ZoomOutIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CloudImage } from "@/features/attachments/components/cloud-image";
import type { ImageAsset } from "@/features/attachments/schema";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";

const ZOOMS = [1, 1.5, 2, 3] as const;

/**
 * The receipt viewer (PLAN 14.5 "Receipts", loaded when opened): one receipt at a time,
 * zoomed and turned with the buttons or the keyboard (+ and −, R, ← and →). A PDF shows
 * its first page and opens whole in a new tab, where the browser's own viewer pages it.
 */
export default function ReceiptViewer({
	receipts,
	start,
	onClose,
}: {
	receipts: ReadonlyArray<ImageAsset>;
	start: number;
	onClose: () => void;
}) {
	const [index, setIndex] = useState(start);
	const [zoom, setZoom] = useState(0);
	const [turn, setTurn] = useState(0);
	const receipt = receipts[index] ?? receipts[0];
	if (!receipt) return null;
	const go = (step: number) => {
		setIndex((current) => (current + step + receipts.length) % receipts.length);
		setZoom(0);
		setTurn(0);
	};
	const zoomBy = (step: number) => setZoom((current) => Math.min(ZOOMS.length - 1, Math.max(0, current + step)));
	const onKeyDown = (event: React.KeyboardEvent) => {
		if (event.target instanceof HTMLButtonElement && (event.key === "Enter" || event.key === " ")) return;
		const actions: Record<string, () => void> = {
			ArrowLeft: () => go(-1),
			ArrowRight: () => go(1),
			"+": () => zoomBy(1),
			"=": () => zoomBy(1),
			"-": () => zoomBy(-1),
			r: () => setTurn((current) => (current + 90) % 360),
		};
		const action = actions[event.key];
		if (!action) return;
		event.preventDefault();
		action();
	};
	const pdf = receipt.format === "pdf";
	const scale = ZOOMS[zoom] ?? 1;
	const position = m.kharcha_receipt_position({
		number: formatNumber(index + 1),
		count: formatNumber(receipts.length),
	});
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				className="flex h-[90dvh] max-w-[calc(100%-1rem)] flex-col gap-3 p-4 sm:max-w-3xl"
				onKeyDown={onKeyDown}
				data-testid="kharcha-receipt-viewer"
			>
				<DialogHeader className="pe-8">
					<DialogTitle>{m.kharcha_receipt_viewer_title()}</DialogTitle>
					<DialogDescription>{receipts.length > 1 ? position : m.kharcha_receipt_viewer_keys()}</DialogDescription>
				</DialogHeader>
				{/* Focusable: a zoomed receipt scrolls, and the keyboard must reach it (axe: scrollable-region-focusable). */}
				<section
					className="relative min-h-0 flex-1 overflow-auto rounded-md bg-kh-ground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
					// biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region needs a tab stop to be scrolled by the keyboard.
					tabIndex={0}
					aria-label={m.kharcha_receipt_viewer_title()}
				>
					<div className="grid min-h-full min-w-full place-items-center p-2">
						<CloudImage
							image={receipt}
							variant="full"
							sizes="(min-width: 768px) 48rem, 100vw"
							alt={m.kharcha_receipt_alt({ number: formatNumber(index + 1) })}
							className="max-h-full max-w-full origin-center object-contain transition-transform duration-150 motion-reduce:transition-none"
							style={{ transform: `rotate(${turn}deg) scale(${scale})` }}
						/>
					</div>
				</section>
				<div className="flex flex-wrap items-center gap-2">
					{receipts.length > 1 ? (
						<>
							<Button type="button" variant="outline" size="icon" onClick={() => go(-1)}>
								<ChevronLeftIcon aria-hidden />
								<span className="sr-only">{m.kharcha_receipt_previous()}</span>
							</Button>
							<span className="kh-figures text-caption text-kh-muted" aria-live="polite">
								{position}
							</span>
							<Button type="button" variant="outline" size="icon" onClick={() => go(1)}>
								<ChevronRightIcon aria-hidden />
								<span className="sr-only">{m.kharcha_receipt_next()}</span>
							</Button>
						</>
					) : null}
					<div className="ms-auto flex flex-wrap items-center gap-2">
						<Button type="button" variant="outline" size="icon" onClick={() => zoomBy(-1)} disabled={zoom === 0}>
							<ZoomOutIcon aria-hidden />
							<span className="sr-only">{m.kharcha_receipt_zoom_out()}</span>
						</Button>
						<Button
							type="button"
							variant="outline"
							size="icon"
							onClick={() => zoomBy(1)}
							disabled={zoom === ZOOMS.length - 1}
						>
							<ZoomInIcon aria-hidden />
							<span className="sr-only">{m.kharcha_receipt_zoom_in()}</span>
						</Button>
						<Button
							type="button"
							variant="outline"
							size="icon"
							onClick={() => setTurn((current) => (current + 90) % 360)}
						>
							<RotateCwIcon aria-hidden />
							<span className="sr-only">{m.kharcha_receipt_rotate()}</span>
						</Button>
						{pdf ? (
							<Button asChild variant="outline">
								<a href={receipt.url} target="_blank" rel="noopener noreferrer">
									<ExternalLinkIcon aria-hidden />
									{m.kharcha_receipt_open_pdf()}
								</a>
							</Button>
						) : null}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
