import { useId } from "react";

/**
 * One choice from a few (the play hub's level, side, clock and layout): native radios in a
 * fieldset, drawn as a ruled row of cells, the chosen one in ink. Arrow keys move along it
 * as radios do, and it reads as a group with its legend.
 */
export function Choice<T extends string>({
	legend,
	value,
	options,
	onChange,
	name,
	testId,
	columns,
}: {
	legend: string;
	value: T;
	options: ReadonlyArray<{ value: T; label: string; hint?: string }>;
	onChange: (value: T) => void;
	name: string;
	testId?: string;
	/** Cells per row on a phone; all in one row from `sm`. */
	columns?: 2 | 3 | 4;
}) {
	const id = useId();
	const grid = columns === 2 ? "grid-cols-2" : columns === 3 ? "grid-cols-3" : "grid-cols-4";
	return (
		<fieldset className="flex min-w-0 flex-col gap-1.5" data-testid={testId}>
			<legend className="mb-1.5 font-medium text-sm">{legend}</legend>
			<div
				className={`grid ${grid} gap-px border border-ch-ink bg-ch-ink sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none`}
			>
				{options.map((option) => {
					const inputId = `${id}-${option.value}`;
					return (
						<label
							key={option.value}
							htmlFor={inputId}
							className="relative flex min-h-11 cursor-pointer flex-col items-center justify-center bg-ch-ground px-2 py-1.5 text-center text-sm has-checked:bg-ch-ink has-checked:text-ch-on-ink has-focus-visible:z-10 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50"
						>
							<input
								id={inputId}
								type="radio"
								name={name}
								value={option.value}
								checked={value === option.value}
								onChange={() => onChange(option.value)}
								className="sr-only"
							/>
							<span className="ch-figures font-semibold">{option.label}</span>
							{option.hint ? <span className="text-xs opacity-75">{option.hint}</span> : null}
						</label>
					);
				})}
			</div>
		</fieldset>
	);
}
