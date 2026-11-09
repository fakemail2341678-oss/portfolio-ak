import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SegmentNav } from "@/components/navigation/segment-nav";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { m } from "@/paraglide/messages";
import { sideName } from "../chess/speech";
import { chaalLinks } from "../links";
import type { PuzzlesSearch } from "../search";
import { PUZZLE_THEME_GROUPS, type PuzzleAngle, type PuzzleThemeGroup } from "./angles";
import { PUZZLE_COLORS, PUZZLE_DIFFICULTIES, type PuzzleColor, type PuzzleDifficulty } from "./schema";
import { THEME_GROUP_NAMES, THEME_NAMES } from "./themes";

export type PuzzlePageMode = "daily" | "train" | "streak" | "replay";

const DIFFICULTY_NAMES: Record<PuzzleDifficulty, () => string> = {
	easiest: m.ch_puzzle_difficulty_easiest,
	easier: m.ch_puzzle_difficulty_easier,
	normal: m.ch_puzzle_difficulty_normal,
	harder: m.ch_puzzle_difficulty_harder,
	hardest: m.ch_puzzle_difficulty_hardest,
};

/** The page's modes: the daily puzzle, training and the streak (when the admin offers it). */
export function PuzzleModes({ current, streak }: { current: PuzzlePageMode; streak: boolean }) {
	const items: Array<{ value: PuzzlePageMode; label: string }> = [
		{ value: "daily", label: m.ch_puzzle_mode_daily() },
		{ value: "train", label: m.ch_puzzle_mode_train() },
		...(streak ? [{ value: "streak" as const, label: m.ch_puzzle_mode_streak() }] : []),
	];
	return (
		<SegmentNav
			label={m.ch_puzzle_modes()}
			items={items}
			current={current === "replay" ? "train" : current}
			link={(value) => chaalLinks.puzzles(value === "daily" ? {} : { mode: value })}
			testId="chaal-puzzle-modes"
		/>
	);
}

const ANY = "any";

/**
 * Training's choices (PLAN Task 80: themes by difficulty and colour): each change is a new
 * URL, so a choice can be shared and the back button undoes it. The theme list is our own
 * names, grouped.
 */
export function TrainingChoices({
	theme,
	difficulty,
	color,
}: {
	theme: PuzzleAngle;
	difficulty: PuzzleDifficulty;
	color: PuzzleColor | null;
}) {
	const navigate = useNavigate();
	const go = (change: Partial<PuzzlesSearch>) => {
		const search: PuzzlesSearch = {
			mode: "train",
			...(theme === "mix" ? {} : { theme }),
			...(difficulty === "normal" ? {} : { difficulty }),
			...(color ? { color } : {}),
			...change,
		};
		void navigate({ ...chaalLinks.puzzles(search), resetScroll: false });
	};
	return (
		<fieldset className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1" data-testid="chaal-puzzle-choices">
			<legend className="sr-only">{m.ch_puzzle_choices()}</legend>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor="chaal-puzzle-theme">{m.ch_puzzle_theme()}</Label>
				<Select value={theme} onValueChange={(value) => go({ theme: value === "mix" ? undefined : value })}>
					<SelectTrigger id="chaal-puzzle-theme" className="w-full" data-testid="chaal-puzzle-theme">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="mix">{THEME_NAMES.mix()}</SelectItem>
						{(Object.keys(PUZZLE_THEME_GROUPS) as PuzzleThemeGroup[]).map((group) => (
							<SelectGroup key={group}>
								<SelectLabel>{THEME_GROUP_NAMES[group]()}</SelectLabel>
								{PUZZLE_THEME_GROUPS[group].map((key) => (
									<SelectItem key={key} value={key}>
										{THEME_NAMES[key]()}
									</SelectItem>
								))}
							</SelectGroup>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor="chaal-puzzle-difficulty">{m.ch_puzzle_difficulty()}</Label>
				<Select
					value={difficulty}
					onValueChange={(value) => go({ difficulty: value === "normal" ? undefined : (value as PuzzleDifficulty) })}
				>
					<SelectTrigger id="chaal-puzzle-difficulty" className="w-full" data-testid="chaal-puzzle-difficulty">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{PUZZLE_DIFFICULTIES.map((value) => (
							<SelectItem key={value} value={value}>
								{DIFFICULTY_NAMES[value]()}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor="chaal-puzzle-color">{m.ch_puzzle_color()}</Label>
				<Select
					value={color ?? ANY}
					onValueChange={(value) => go({ color: value === ANY ? undefined : (value as PuzzleColor) })}
				>
					<SelectTrigger id="chaal-puzzle-color" className="w-full" data-testid="chaal-puzzle-color">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ANY}>{m.ch_puzzle_color_any()}</SelectItem>
						{PUZZLE_COLORS.map((value) => (
							<SelectItem key={value} value={value}>
								{sideName(value)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</fieldset>
	);
}

/** The modes and, in training, the choices: under the puzzle's panel. */
export function PuzzleChoicesPanel({ children }: { children: ReactNode }) {
	return (
		<div className="ch-rule flex flex-col gap-3 pt-3" data-testid="chaal-puzzle-choose">
			{children}
		</div>
	);
}
