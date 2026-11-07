import { useStore } from "@tanstack/react-form";
import { Link2Icon, Link2OffIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
	InputGroupText,
} from "@/components/ui/input-group";
import { SLUG_MAX, SLUG_PATTERN, slugify } from "@/lib/slug";
import { m } from "@/paraglide/messages";
import { useFieldContext } from "../contexts";
import { type FieldBaseProps, FieldShell } from "../field-shell";

/**
 * A URL slug made from another field (the title) while the two are linked: typing a
 * title fills in the slug; typing in the slug unlinks it, and the link button links
 * it again. New records start linked; existing ones (a slug already published) don't.
 *
 * Pair it with `slugValidators` on its AppField: the server check for a free slug
 * runs debounced, and re-runs when the title changes (`onChangeListenTo`).
 *
 *   <form.AppField name="slug" validators={slugValidators({ from: "title", isAvailable })}>
 *     {() => <SlugField label={…} from="title" fromLabel={m.title()} prefix="/work/" />}
 *   </form.AppField>
 */
export function SlugField({
	label,
	description,
	optional,
	from,
	fromLabel,
	prefix,
	linked: startLinked,
}: FieldBaseProps & {
	/** The field the slug is made from (a dotted path: "title.en"), and its label (the link button: "Follow the Title"). */
	from: string;
	fromLabel: string;
	/** Shown before the input: the path the slug goes under ("/work/"). */
	prefix?: string;
	/** Start linked (default: when the slug is empty or already matches the source). */
	linked?: boolean;
}) {
	const field = useFieldContext<string>();
	const source = useStore(field.form.store, (state) => {
		// A dotted path, so a localized title works too ("title.en").
		const value = from
			.split(".")
			.reduce<unknown>(
				(at, key) => (at && typeof at === "object" ? (at as Record<string, unknown>)[key] : undefined),
				state.values,
			);
		return typeof value === "string" ? value : "";
	});
	const value = field.state.value ?? "";
	const [linked, setLinked] = useState(() => startLinked ?? (value === "" || value === slugify(source)));
	// Follows the source while linked; only on a change, so mounting never edits a saved slug.
	const previous = useRef(source);
	useEffect(() => {
		if (previous.current === source) return;
		previous.current = source;
		if (linked) field.handleChange(slugify(source));
	}, [source, linked, field]);

	return (
		<FieldShell label={label} description={description ?? m.slug_field_description()} optional={optional}>
			{(control) => (
				<InputGroup>
					{prefix ? (
						<InputGroupAddon>
							<InputGroupText className="font-mono">{prefix}</InputGroupText>
						</InputGroupAddon>
					) : null}
					<InputGroupInput
						{...control}
						value={value}
						maxLength={SLUG_MAX}
						autoComplete="off"
						spellCheck={false}
						className="font-mono"
						onChange={(event) => {
							const next = event.target.value.toLowerCase();
							field.handleChange(next);
							setLinked(next === slugify(source));
						}}
					/>
					<InputGroupAddon align="inline-end">
						<InputGroupButton
							size="icon-xs"
							aria-pressed={linked}
							aria-label={m.slug_field_link({ field: fromLabel })}
							title={linked ? m.slug_field_linked() : m.slug_field_unlinked()}
							onClick={() => {
								const next = !linked;
								setLinked(next);
								if (next) field.handleChange(slugify(source));
							}}
						>
							{linked ? <Link2Icon aria-hidden /> : <Link2OffIcon aria-hidden />}
						</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
			)}
		</FieldShell>
	);
}

/**
 * The slug's AppField validators: a well-formed slug that the server says is free.
 * `isAvailable` calls a server function (debounced); a taken slug is a field error
 * as you type, before saving. The save still checks (two people can type at once).
 */
export const slugValidators = <From extends string>({
	from,
	isAvailable,
	debounceMs = 400,
}: {
	from: From;
	isAvailable?: (slug: string) => Promise<boolean>;
	debounceMs?: number;
}) => ({
	onChangeListenTo: [from] as From[],
	onChangeAsyncDebounceMs: debounceMs,
	onChangeAsync: async ({ value }: { value: string }) => {
		if (!isAvailable || !value || !SLUG_PATTERN.test(value)) return undefined;
		return (await isAvailable(value)) ? undefined : m.slug_field_taken();
	},
});
