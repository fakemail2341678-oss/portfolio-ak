import { useId, useRef, useState } from "react";
import { FilterField } from "@/components/filters/filter-bar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { applySuggestion, type Suggestion, type Suggestions, suggest, type Vocabulary } from "./query/suggest";

/**
 * Spend's search box (Task 93): the `q` of the bar's form, in the search language, with
 * suggestions while typing (a combobox: the arrows move through them, Enter or Tab takes
 * one, Escape closes them). Taking a value applies the search at once; taking a field
 * leaves the caret after its `:`. Without JavaScript it is a plain text field.
 */
export function QueryInput({
	value,
	vocabulary,
	onFocus,
	className,
}: {
	value: string;
	vocabulary: Vocabulary;
	/** The first focus: the page loads the names suggestions need. */
	onFocus?: () => void;
	className?: string;
}) {
	const id = useId();
	const listId = `${id}-suggestions`;
	const input = useRef<HTMLInputElement>(null);
	const [open, setOpen] = useState<Suggestions | null>(null);
	const [active, setActive] = useState(0);
	const items = open?.items ?? [];
	const expanded = items.length > 0;

	const look = () => {
		const field = input.current;
		if (!field) return;
		setOpen(suggest(field.value, field.selectionStart ?? field.value.length, vocabulary));
		setActive(0);
	};
	const take = (item: Suggestion) => {
		const field = input.current;
		if (!field || !open) return;
		const next = applySuggestion(field.value, open, item);
		field.value = next.text;
		field.setSelectionRange(next.caret, next.caret);
		setOpen(null);
		if (item.kind === "value") field.form?.requestSubmit();
		else look();
	};
	const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (!expanded) return;
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			const step = event.key === "ArrowDown" ? 1 : -1;
			setActive((current) => (current + step + items.length) % items.length);
		} else if (event.key === "Enter" || (event.key === "Tab" && !event.shiftKey)) {
			const item = items[active];
			if (item) {
				event.preventDefault();
				take(item);
			}
		} else if (event.key === "Escape") {
			event.preventDefault();
			setOpen(null);
		}
	};

	return (
		<FilterField id={id} label={m.kharcha_spend_search()} hideLabel className={cn("relative", className)}>
			<Input
				ref={input}
				id={id}
				name="q"
				type="search"
				defaultValue={value}
				placeholder={m.kharcha_spend_search_placeholder()}
				autoComplete="off"
				spellCheck={false}
				role="combobox"
				aria-autocomplete="list"
				aria-expanded={expanded}
				aria-controls={listId}
				aria-describedby={`${id}-hint`}
				{...(expanded ? { "aria-activedescendant": `${id}-option-${active}` } : {})}
				onFocus={() => onFocus?.()}
				onInput={look}
				onClick={look}
				onKeyDown={onKeyDown}
				onBlur={() => setOpen(null)}
				data-testid="kharcha-spend-q"
			/>
			<span id={`${id}-hint`} className="sr-only">
				{m.kharcha_spend_search_hint()}
			</span>
			<div
				id={listId}
				role="listbox"
				aria-label={m.kharcha_spend_suggestions()}
				className={cn(
					"absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-kh-hair bg-kh-page p-1 shadow-md",
					!expanded && "hidden",
				)}
			>
				{items.map((item, index) => (
					<button
						type="button"
						tabIndex={-1}
						key={item.insert}
						id={`${id}-option-${index}`}
						role="option"
						aria-selected={index === active}
						className={cn(
							"flex w-full cursor-pointer items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-start text-sm",
							index === active && "bg-kh-ground",
						)}
						// Before the input's blur: a click takes the suggestion.
						onMouseDown={(event) => {
							event.preventDefault();
							take(item);
						}}
						data-testid="kharcha-spend-suggestion"
					>
						<span className="kh-figures truncate font-mono text-[0.8125rem]">{item.insert}</span>
						<span className="shrink-0 text-caption text-kh-muted">
							{item.kind === "field" ? m.kharcha_spend_suggest_field() : m.kharcha_spend_suggest_value()}
						</span>
					</button>
				))}
			</div>
		</FilterField>
	);
}
