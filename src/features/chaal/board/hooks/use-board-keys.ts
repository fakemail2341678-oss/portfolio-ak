import { useShortcuts } from "@/hooks/use-shortcuts";
import { m } from "@/paraglide/messages";
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
	useShortcuts(
		m.shortcuts_group_board(),
		[
			{ keys: "ArrowLeft", name: m.chaal_shortcut_moves(), run: () => onStep("prev") },
			{ keys: "ArrowRight", name: m.chaal_shortcut_moves(), run: () => onStep("next") },
			{ keys: "Home", name: m.chaal_shortcut_ends(), run: () => onStep("first") },
			{ keys: "End", name: m.chaal_shortcut_ends(), run: () => onStep("last") },
			...(onFlip ? [{ keys: "F" as const, name: m.chaal_control_flip(), run: () => onFlip() }] : []),
		],
		{ enabled },
	);
}
