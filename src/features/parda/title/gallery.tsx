import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { Rail, RailItem } from "@/components/data-display/rail";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { tmdbImage } from "../kit/image";
import { TmdbImage } from "../kit/tmdb-image";

type Picture = { path: string; kind: "backdrop" | "poster" };

/** TMDB's large sizes for the viewer: a backdrop at 1280, a poster at 780. */
const LARGE = { backdrop: "w1280", poster: "w780" } as const;

/**
 * The gallery (PLAN Task 63): backdrops then posters in a rail, each opening a viewer
 * that the arrow keys browse, as do its buttons. Pictures are never cropped in the
 * viewer: each sits in the mask at its own shape.
 */
export function Gallery({
	backdrops,
	posters,
	imageBase,
	title,
	heading,
}: {
	backdrops: ReadonlyArray<string>;
	posters: ReadonlyArray<string>;
	imageBase: string;
	title: string;
	heading: string;
}) {
	const pictures: Picture[] = [
		...backdrops.map((path) => ({ path, kind: "backdrop" as const })),
		...posters.map((path) => ({ path, kind: "poster" as const })),
	];
	const [open, setOpen] = useState<number | null>(null);
	if (pictures.length === 0) return null;
	const current = open === null ? null : pictures[open];
	const step = (by: 1 | -1) => setOpen((at) => (at === null ? at : (at + by + pictures.length) % pictures.length));
	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key === "ArrowRight") step(1);
		else if (event.key === "ArrowLeft") step(-1);
		else return;
		event.preventDefault();
	};
	const position = (at: number) =>
		m.pd_gallery_position({ current: formatNumber(at + 1), total: formatNumber(pictures.length) });
	return (
		<>
			<Rail title={heading} titleClassName="pd-display text-pd-head font-bold" data-testid="title-gallery">
				{pictures.map((picture, at) => (
					<RailItem key={picture.path} className={picture.kind === "backdrop" ? "w-64" : "w-24"}>
						<button
							type="button"
							onClick={() => setOpen(at)}
							aria-label={m.pd_gallery_open({ position: position(at) })}
							className="pd-press block w-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-pd-ground"
							data-testid="gallery-item"
						>
							<TmdbImage
								image={tmdbImage(imageBase, picture.path, picture.kind)}
								alt=""
								aspect={picture.kind}
								sizes={picture.kind === "backdrop" ? "16rem" : "6rem"}
							/>
						</button>
					</RailItem>
				))}
			</Rail>
			<Dialog open={current !== null} onOpenChange={(next) => !next && setOpen(null)}>
				<DialogContent
					onKeyDown={onKeyDown}
					className="flex max-h-[calc(100dvh-2rem)] w-[min(100%-2rem,72rem)] max-w-none flex-col gap-3 rounded-none border-0 bg-pd-mask p-3 pt-12 text-pd-ink sm:max-w-none"
					data-testid="gallery-viewer"
				>
					<DialogTitle className="sr-only">{m.pd_gallery_title({ title })}</DialogTitle>
					<DialogDescription className="sr-only">{m.pd_gallery_keys()}</DialogDescription>
					{current && open !== null ? (
						<>
							<div className="flex min-h-0 flex-1 items-center justify-center">
								<img
									key={current.path}
									src={`${imageBase.replace(/\/$/, "")}/${LARGE[current.kind]}${current.path}`}
									alt={position(open)}
									className="max-h-[calc(100dvh-9rem)] w-auto max-w-full object-contain"
									data-testid="gallery-picture"
								/>
							</div>
							<div className="flex items-center justify-between gap-3">
								<Button variant="ghost" onClick={() => step(-1)} data-testid="gallery-previous">
									<ChevronLeftIcon aria-hidden />
									{m.pd_gallery_previous()}
								</Button>
								<p aria-live="polite" className="text-pd-muted text-sm tabular-nums" data-testid="gallery-position">
									{position(open)}
								</p>
								<Button variant="ghost" onClick={() => step(1)} data-testid="gallery-next">
									{m.pd_gallery_next()}
									<ChevronRightIcon aria-hidden />
								</Button>
							</div>
						</>
					) : null}
				</DialogContent>
			</Dialog>
		</>
	);
}
