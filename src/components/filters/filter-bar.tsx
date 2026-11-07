import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, type ReactNode, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { formSearchPatch } from "@/lib/list/url";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

/** Typing in these waits for a pause before the URL changes; everything else applies at once. */
const DEBOUNCED_TYPES = new Set(["search", "text", "number", "date"]);
const DEBOUNCE_MS = 400;

type SearchValues = Readonly<Record<string, unknown>>;

/** Puts URL values back into the form's controls (after back/forward, a chip, "Clear all"). */
function syncControls(form: HTMLFormElement, values: SearchValues) {
	for (const element of Array.from(form.elements)) {
		if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement)) continue;
		if (!element.name || element.type === "hidden" || element.type === "submit") continue;
		// Never overwrite what the user is typing right now.
		if (element === document.activeElement && DEBOUNCED_TYPES.has(element.type)) continue;
		const value = values[element.name];
		if (element instanceof HTMLInputElement && element.type === "checkbox") {
			element.checked = Array.isArray(value) ? value.map(String).includes(element.value) : false;
		} else if (element instanceof HTMLSelectElement && Array.isArray(value)) {
			// One of several selects sharing a list param: it shows the list's value among its options.
			const values = value.map(String);
			element.value = Array.from(element.options).find((option) => values.includes(option.value))?.value ?? "";
		} else {
			element.value = value === undefined || value === null ? "" : String(value);
		}
	}
}

/**
 * The filter area of a list page: one GET <form> around filter controls
 * (SearchFilter, SelectFilter, MultiSelectFilter, BooleanFilter, NumberRangeFilter,
 * DateRangeFilter).
 *
 * - Without JavaScript it's a normal form: "Apply" submits the controls (plus the
 *   `preserve`d params as hidden fields) to the current URL. The server renders
 *   the filtered page.
 * - With JavaScript every change updates the URL right away (typing waits for a
 *   pause) and the route's loader fetches the new page. The page number resets.
 *
 * Controls are uncontrolled (defaultValue from the URL) and re-synced when the
 * URL changes, so focus and typing are never interrupted.
 */
export function FilterBar({
	values,
	preserve = [],
	label = m.filters_label(),
	submitLabel = m.filters_apply(),
	className,
	children,
}: {
	/** The route's validated search (Route.useSearch()). */
	values: SearchValues;
	/** Params the form doesn't edit but must keep on a no-JS submit (e.g. sort, pageSize). */
	preserve?: ReadonlyArray<string>;
	/** Accessible name of the search landmark. */
	label?: string;
	submitLabel?: string;
	className?: string;
	children: ReactNode;
}) {
	const navigate = useNavigate();
	const formRef = useRef<HTMLFormElement>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	const apply = (replace: boolean) => {
		const form = formRef.current;
		if (!form) return;
		const patch = formSearchPatch(form, { exclude: preserve });
		void navigate({
			to: ".",
			search: (prev: SearchValues) => ({ ...prev, ...patch, page: undefined }),
			replace,
		});
	};

	useEffect(() => {
		if (formRef.current) syncControls(formRef.current, values);
	}, [values]);
	useEffect(() => () => clearTimeout(timer.current), []);

	const onChange = (event: FormEvent<HTMLFormElement>) => {
		const target = event.target;
		clearTimeout(timer.current);
		if (target instanceof HTMLInputElement && DEBOUNCED_TYPES.has(target.type)) {
			// One history entry per pause in typing, not per keystroke.
			timer.current = setTimeout(() => apply(true), DEBOUNCE_MS);
		} else {
			apply(false);
		}
	};
	const onSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		clearTimeout(timer.current);
		apply(false);
	};

	return (
		<search aria-label={label} className={className}>
			{/* No action: a GET form submits to the current URL (any locale), replacing its query. */}
			<form
				ref={formRef}
				method="get"
				onChange={onChange}
				onSubmit={onSubmit}
				className="flex flex-wrap items-end gap-3"
			>
				{preserve.map((name) => {
					const value = values[name];
					return value === undefined || value === "" ? null : (
						<input key={name} type="hidden" name={name} value={String(value)} />
					);
				})}
				{children}
				<Button type="submit" variant="secondary">
					{submitLabel}
				</Button>
			</form>
		</search>
	);
}

/** Label above a control; the shared layout of every filter. */
export function FilterField({
	id,
	label,
	hideLabel = false,
	className,
	children,
}: {
	id: string;
	label: string;
	hideLabel?: boolean;
	className?: string;
	children: ReactNode;
}) {
	return (
		<div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
			<label htmlFor={id} className={cn("font-medium text-sm leading-none", hideLabel && "sr-only")}>
				{label}
			</label>
			{children}
		</div>
	);
}
