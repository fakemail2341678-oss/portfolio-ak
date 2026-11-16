import { ArrowDownUpIcon, ChevronFirstIcon, ChevronLastIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
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
		{ step: "first", label: m.chaal_control_first(), Icon: ChevronFirstIcon, enabled: canBack },
		{ step: "prev", label: m.chaal_control_prev(), Icon: ChevronLeftIcon, enabled: canBack },
		{ step: "next", label: m.chaal_control_next(), Icon: ChevronRightIcon, enabled: canForward },
		{ step: "last", label: m.chaal_control_last(), Icon: ChevronLastIcon, enabled: canForward },
	] as const;
	return (
		// A group, not a toolbar: a toolbar owns the arrow keys (they move its focus), and here ← and →
		// step through the game from anywhere on the page, a focused button included (decision 0299).
		// biome-ignore lint/a11y/useSemanticElements: a row of buttons, not form controls: a <fieldset> would need a legend and brings form styling.
		<div
			role="group"
			aria-label={m.chaal_controls_label()}
			data-testid="chaal-controls"
			className={`flex items-center gap-1 ${className ?? ""}`}
		>
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
					aria-label={m.chaal_control_flip()}
					title={m.chaal_control_flip()}
					onClick={onFlip}
					className="ch-press ms-auto"
				>
					<ArrowDownUpIcon aria-hidden />
				</Button>
			) : null}
		</div>
	);
}
