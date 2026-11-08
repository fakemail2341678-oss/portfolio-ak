import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { m } from "@/paraglide/messages";
import { moveSuggestions, readTypedMove, showSan } from "../chess/notation";
import type { PlayedMove } from "../chess/rules";

/**
 * Typing a move (PLAN 13.5, "Keyboard and screen readers"): "Nf3", "nf3", "e2e4", "O-O" or
 * figurines, with the legal moves that fit what's typed offered as buttons. `/` focuses it
 * (when `hotkey`). A move that isn't legal, or fits two, says why under the field.
 */
export function MoveInput({
	fen,
	onMove,
	disabled = false,
	hotkey = true,
	notation = "figurine",
}: {
	fen: string;
	onMove: (move: PlayedMove) => void;
	disabled?: boolean;
	hotkey?: boolean;
	notation?: "figurine" | "letters";
}) {
	const id = useId();
	const input = useRef<HTMLInputElement>(null);
	const [text, setText] = useState("");
	const [error, setError] = useState<string | null>(null);
	useHotkeys({ "/": () => input.current?.focus() }, { enabled: hotkey && !disabled });
	const suggestions = disabled ? [] : moveSuggestions(fen, text);

	const submit = (typed: string) => {
		const read = readTypedMove(fen, typed);
		if (read.ok) {
			setText("");
			setError(null);
			onMove(read.move);
			return;
		}
		if (read.reason === "empty") return;
		setError(
			read.reason === "ambiguous"
				? m.ch_move_input_ambiguous({ move: typed.trim() })
				: m.ch_move_input_illegal({ move: typed.trim() }),
		);
	};

	return (
		<form
			method="post"
			className="flex flex-col gap-2"
			data-testid="chaal-move-input"
			onSubmit={(event) => {
				event.preventDefault();
				submit(text);
			}}
		>
			<label htmlFor={`${id}-move`} className="font-medium text-sm">
				{m.ch_move_input_label()}
			</label>
			<div className="flex gap-2">
				<Input
					ref={input}
					id={`${id}-move`}
					value={text}
					disabled={disabled}
					autoComplete="off"
					autoCapitalize="off"
					spellCheck={false}
					placeholder="Nf3, e4, O-O"
					aria-invalid={error ? true : undefined}
					aria-describedby={error ? `${id}-error` : undefined}
					onChange={(event) => {
						setText(event.target.value);
						setError(null);
					}}
					className="font-medium"
					dir="ltr"
				/>
				<Button type="submit" variant="outline" disabled={disabled || text.trim() === ""}>
					{m.ch_move_input_play()}
				</Button>
			</div>
			{error ? (
				<p id={`${id}-error`} role="alert" className="text-ch-danger text-sm">
					{error}
				</p>
			) : null}
			{suggestions.length > 0 ? (
				<ul aria-label={m.ch_move_input_suggestions()} className="flex flex-wrap gap-1.5">
					{suggestions.map((san) => (
						<li key={san}>
							<Button type="button" variant="ghost" size="sm" onClick={() => submit(san)} className="font-medium">
								{showSan(san, notation)}
							</Button>
						</li>
					))}
				</ul>
			) : null}
		</form>
	);
}
