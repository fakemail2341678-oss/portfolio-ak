import { useHotkeys } from "@/hooks/use-hotkeys";
import type { Step } from "../components/game-controls-bar";

/** ←/→ step, Home/End jump, `f` flips (PLAN 13.6, "Keyboard"); listed in the shortcuts dialog. */
export function useBoardKeys({
	onStep,
	onFlip,
	enabled = true,
}: {
	onStep: (step: Step) => void;
	onFlip?: () => void;
	enabled?: boolean;
}) {
	useHotkeys(
		{
			arrowleft: () => onStep("prev"),
			arrowright: () => onStep("next"),
			home: () => onStep("first"),
			end: () => onStep("last"),
			...(onFlip ? { f: () => onFlip() } : {}),
		},
		{ enabled },
	);
}
