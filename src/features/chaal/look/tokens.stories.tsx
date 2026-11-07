import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Button } from "@/components/ui/button";
import { withChaal } from "../../../../.storybook/mocks/chaal";
import { CHAAL_BOARD_THEMES } from "./board-themes";

/** Chaal's design system, "Diagram" (src/styles/chaal.css, decision 0258): the tokens in the theme and locale of the run. */
const meta = {
	title: "Chaal/Tokens",
	decorators: [withChaal],
	parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const SWATCHES = [
	["Ground", "bg-ch-ground"],
	["Plate", "bg-ch-plate"],
	["Ink", "bg-ch-ink"],
	["Muted", "bg-ch-muted"],
	["Hairline", "bg-ch-hair"],
	["Mark", "bg-ch-mark"],
] as const;

export const Colours: Story = {
	render: () => (
		<div className="min-h-dvh bg-ch-ground p-6 text-ch-ink">
			<ul className="grid grid-cols-2 gap-4 sm:grid-cols-6">
				{SWATCHES.map(([name, swatch]) => (
					<li key={name}>
						<div className={`h-16 border border-ch-hair ${swatch}`} />
						<p className="mt-2 text-sm">{name}</p>
					</li>
				))}
			</ul>
			<div className="mt-8 flex flex-wrap gap-2">
				<Button>Play</Button>
				<Button variant="outline">Offer draw</Button>
				<Button variant="ghost">Takeback</Button>
			</div>
			<p className="mt-6 text-sm">
				6.cxd4 <span className="font-semibold">♗b4+</span>
				<span className="font-bold text-ch-mark">!?</span>
			</p>
		</div>
	),
	// The real cascade: the section's tokens outrank the visitor's accent and radius, in both themes.
	play: async () => {
		const style = getComputedStyle(document.documentElement);
		await expect(style.getPropertyValue("--radius").trim()).toBe("0rem");
		await expect(style.getPropertyValue("--primary")).toBe(style.getPropertyValue("--ch-ink"));
		await expect(style.getPropertyValue("--primary-foreground")).toBe(style.getPropertyValue("--ch-on-ink"));
		await expect(style.getPropertyValue("--background")).toBe(style.getPropertyValue("--ch-ground"));
	},
};

export const Type: Story = {
	render: () => (
		<div className="min-h-dvh bg-ch-ground p-6 text-ch-ink">
			<h1 className="ch-display text-ch-title">Play</h1>
			<p lang="ne" className="ch-display mt-3 text-ch-title">
				खेल्नुहोस्
			</p>
			<h2 className="ch-display ch-rule mt-8 pt-3 text-ch-head">Puzzle of the day</h2>
			<div className="mt-6 flex gap-10">
				<span className="ch-display ch-figures text-ch-clock">7:42</span>
				<span lang="ne" className="ch-display ch-figures text-ch-clock">
					७:४२
				</span>
			</div>
			<p className="mt-6 max-w-prose text-ch-muted">
				Text is Inter and Noto Sans Devanagari, the app's faces. Mukta 800 sets clocks, headings and the wordmark only.
			</p>
		</div>
	),
};

/** A corner of a position: the last move ringed, a legal-move dot, the cburnett pieces. */
const CORNER: ReadonlyArray<ReadonlyArray<string>> = [
	["bR", "", "bB", "bQ"],
	["bP", "bP", "bP", ""],
	["", "", "bN", ""],
	["", "", "", "bP"],
];
const LAST = new Set(["1-3", "3-3"]);
const DOT = "2-1";

export const Boards: Story = {
	render: () => (
		<div className="min-h-dvh bg-ch-ground p-6 text-ch-ink">
			<ul className="flex flex-wrap gap-10">
				{CHAAL_BOARD_THEMES.map((theme) => (
					<li key={theme} data-ch-board={theme === "diagram" ? undefined : theme}>
						<div className="ch-frame w-56">
							<div className="grid grid-cols-4">
								{CORNER.flatMap((row, r) =>
									row.map((piece, f) => {
										const key = `${r}-${f}`;
										return (
											<div
												key={key}
												className={`relative aspect-square ${(r + f) % 2 ? "ch-sq-dark" : "ch-sq-light"} ${
													LAST.has(key) ? "shadow-[inset_0_0_0_3px_var(--ch-sq-mark)]" : ""
												}`}
											>
												{piece ? (
													<img
														alt=""
														src={`/chaal/pieces/cburnett/${piece}.svg`}
														className="absolute inset-[4%] size-[92%]"
													/>
												) : null}
												{key === DOT ? (
													<span className="absolute inset-[38%] rounded-full bg-ch-sq-dot ring-2 ring-ch-paper" />
												) : null}
											</div>
										);
									}),
								)}
							</div>
						</div>
						<p className="mt-4 text-sm capitalize">{theme}</p>
					</li>
				))}
			</ul>
		</div>
	),
	// Each theme's tokens reach its squares: the default is hatched, the others are flat.
	play: async ({ canvasElement }) => {
		const squares = [...canvasElement.querySelectorAll<HTMLElement>(".ch-sq-dark")];
		const patterns = new Set(squares.map((square) => getComputedStyle(square).backgroundImage));
		await expect(patterns.has("none")).toBe(true);
		await expect([...patterns].some((pattern) => pattern.includes("repeating-linear-gradient"))).toBe(true);
	},
};
