import { ArrowDownUpIcon, ChevronFirstIcon, ChevronLastIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { m } from "@/paraglide/messages";

export type Step = "first" | "prev" | "next" | "last";

/**
 * Stepping through a game (PLAN 13.5, `GameControls`): start, back, forward, end, and
 * flipping the board at the far end, with the page's actions (Takeback, Offer draw,
 * Resign) passed in. `useBoardKeys` gives the same from the keyboard.
 */
export function GameControls({
	onStep,
	canBack,
	canForward,
	onFlip,
	children,
	className,
}: {
	onStep: (step: Step) => void;
	canBack: boolean;
	canForward: boolean;
	onFlip?: () => void;
	children?: ReactNode;
	className?: string;
}) {
	const buttons = [
		{ step: "first", label: m.ch_control_first(), Icon: ChevronFirstIcon, enabled: canBack },
		{ step: "prev", label: m.ch_control_prev(), Icon: ChevronLeftIcon, enabled: canBack },
		{ step: "next", label: m.ch_control_next(), Icon: ChevronRightIcon, enabled: canForward },
		{ step: "last", label: m.ch_control_last(), Icon: ChevronLastIcon, enabled: canForward },
	] as const;
	return (
		<div role="toolbar" aria-label={m.ch_controls_label()} className={`flex items-center gap-1 ${className ?? ""}`}>
			{buttons.map(({ step, label, Icon, enabled }) => (
				<Button
					key={step}
					type="button"
					variant="ghost"
					size="icon"
					aria-label={label}
					title={label}
					disabled={!enabled}
					onClick={() => onStep(step)}
					className="ch-press"
				>
					<Icon aria-hidden className="rtl:rotate-180" />
				</Button>
			))}
			{children}
			{onFlip ? (
				<Button
					type="button"
					variant="ghost"
					size="icon"
					aria-label={m.ch_control_flip()}
					title={m.ch_control_flip()}
					onClick={onFlip}
					className="ch-press ms-auto"
				>
					<ArrowDownUpIcon aria-hidden />
				</Button>
			) : null}
		</div>
	);
}

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
