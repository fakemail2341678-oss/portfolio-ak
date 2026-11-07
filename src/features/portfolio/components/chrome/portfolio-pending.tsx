import { m } from "@/paraglide/messages";
import { cachedRelief, viewHeightOf } from "../../lib/terrain/relief";
import { RELIEF_PRESETS, Relief } from "../art/relief";

/**
 * The portfolio's pending page (decision 0201): while a page loads, a short panorama is
 * printed over and over, its three bands of altitude rising out of the ground into
 * relief, low land first, holding, then sinking snow first, so no band ever floats
 * above the land under it (`hm-printing`, himal.css). The hero's engine and
 * proportions with a seed of its own (a range, not a project's mountain), in a frame of the drawing's own
 * shape on the page's own field, with the status in words under it. Under reduced
 * motion the range stands still.
 */
export function PortfolioPending() {
	const model = cachedRelief({ seed: "himal-pending", landform: "range", ...RELIEF_PRESETS.hero });
	return (
		<section className="hm-section" aria-busy="true" data-testid="portfolio-pending">
			<output className="hm-container flex flex-col items-center gap-6">
				<span
					className="relative block w-full max-w-xl overflow-hidden"
					style={{ aspectRatio: `${model.width} / ${Math.round(viewHeightOf(model))}` }}
				>
					<Relief model={model} depths={3} fit="none" className="hm-printing" />
				</span>
				<span className="text-hm-small text-hm-muted">{m.portfolio_pending()}</span>
			</output>
		</section>
	);
}
