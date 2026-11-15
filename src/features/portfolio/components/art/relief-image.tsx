import { cn } from "../../lib/cn";
import { cssVars } from "../../lib/css-vars";
import type { Landform } from "../../lib/terrain/heightfield";
import { cachedRelief, type Relief as ReliefModel, type ReliefOptions, viewHeightOf } from "../../lib/terrain/relief";

/**
 * Resolutions for each place a relief is drawn. A cover keeps to fewer levels
 * and a coarser grid (its markup stays under 8 kB); the hero gets the most
 * detail (under 35 kB). tests/unit/terrain.test.ts holds both budgets.
 */
export const RELIEF_PRESETS = {
	hero: {
		width: 1600,
		depth: 300,
		cols: 140,
		rows: 48,
		levels: 9,
		step: 34,
		headroom: 30,
		tolerance: 1.6,
		minArea: 1600,
		bleed: 0.05,
	},
	cover: {
		width: 800,
		depth: 380,
		cols: 36,
		rows: 26,
		levels: 7,
		step: 48,
		headroom: 20,
		tolerance: 2.4,
		minArea: 140,
	},
	wide: {
		width: 1600,
		depth: 300,
		cols: 72,
		rows: 30,
		levels: 8,
		step: 58,
		headroom: 10,
		tolerance: 2.2,
		minArea: 120,
	},
} as const satisfies Record<string, Omit<ReliefOptions, "seed" | "landform">>;

export type ReliefPreset = keyof typeof RELIEF_PRESETS;

/** Where the snow starts, as a fraction of the levels: above it the sheets are the ramp's two snows. */
const SNOW_LINE = 0.62;

/**
 * The altitude colour of level k of `levels`: pine to rock blue up to the snow
 * line (--hm-alt-0 … 5), then snow (--hm-alt-7, and 8 for the highest), so
 * every summit that clears the line carries snow.
 */
export function altitudeFill(k: number, levels: number): string {
	const t = k / Math.max(1, levels - 1);
	const index = t >= SNOW_LINE ? (t >= 0.85 ? 8 : 7) : Math.round((t / SNOW_LINE) * 5);
	return `var(--hm-alt-${index})`;
}

/** Each sheet in the colour of its altitude: flat, like one block of a print. */
function Layers({ model, layers }: { model: ReliefModel; layers: ReliefModel["layers"] }) {
	return layers.map(({ k, d }) => (
		<path
			key={k}
			className="hm-layer"
			d={d}
			fillRule="evenodd"
			data-summit={k >= model.levels - 3 ? "" : undefined}
			style={cssVars({ "--hm-fill": altitudeFill(k, model.levels) })}
		/>
	));
}

type ReliefProps = (
	| { seed: string; landform: Landform; preset: ReliefPreset; model?: never }
	/** A relief drawn elsewhere (the work index's board). */
	| { model: ReliefModel; seed?: never; landform?: never; preset?: never }
) & {
	/**
	 * Split the sheets into this many stacked SVGs (lowest first), so motion can
	 * move each band of altitude on its own compositor layer (the hero's drift).
	 */
	depths?: number;
	/** Lift the bands from the flat map into relief on load (himal.css, `hm-lift`). */
	print?: boolean;
	/** "slice" fills the frame and crops the sides; "none" stretches to a frame of the drawing's own shape. */
	fit?: "slice" | "none";
	className?: string | undefined;
};

/**
 * A printed relief (lib/terrain): the landform's contour levels as stacked
 * sheets. Decorative (`aria-hidden`), coloured by tokens so it follows the
 * theme, and the same markup on the server and in the browser. It fills its
 * container (`slice`), cropping the sides on narrow frames, so put it in a
 * frame with a fixed size or aspect ratio.
 */
export function Relief({ depths = 1, print = false, fit = "slice", className, ...source }: ReliefProps) {
	const model =
		source.model ?? cachedRelief({ seed: source.seed, landform: source.landform, ...RELIEF_PRESETS[source.preset] });
	const viewHeight = viewHeightOf(model);
	const viewBox = `0 0 ${model.width} ${viewHeight}`;
	const bands = Array.from({ length: depths }, (_, depth) =>
		model.layers.filter(({ k }) => Math.min(depths - 1, Math.floor((k * depths) / model.levels)) === depth),
	);
	return (
		<div
			aria-hidden
			className={cn("hm-relief absolute inset-0", className)}
			data-print={print ? "" : undefined}
			style={cssVars({ "--hm-spread": "2.25rem" })}
		>
			{bands.map((layers, depth) => {
				// On the flat map every sheet lies at the foot: a band starts lowered by its sheets' mean lift.
				const meanLift = layers.reduce((sum, { k }) => sum + k, 0) / Math.max(1, layers.length);
				const lift = Math.round((meanLift * model.step * 1000) / viewHeight) / 10;
				return (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: the bands are a fixed split by altitude.
						key={depth}
						className="hm-relief-band absolute inset-0"
						style={cssVars({ "--hm-lift": `${lift}%`, "--hm-depth": depth })}
					>
						<svg
							viewBox={viewBox}
							preserveAspectRatio={fit === "none" ? "none" : "xMidYMax slice"}
							aria-hidden="true"
							focusable="false"
							className={cn("absolute inset-0 size-full", depths > 1 && "hm-relief-depth")}
						>
							<Layers model={model} layers={layers} />
						</svg>
					</div>
				);
			})}
		</div>
	);
}
