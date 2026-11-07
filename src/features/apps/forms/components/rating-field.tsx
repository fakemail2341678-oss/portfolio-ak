import { StarIcon } from "lucide-react";
import { useFieldContext } from "@/components/forms/contexts";
import { type FieldBaseProps, FieldLabelText, FieldMessages, useFieldA11y } from "@/components/forms/field-shell";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { RATING_MAX } from "../fields";

/**
 * A 1–5 rating (decision 0195): native radio buttons drawn as a row of numbered
 * stars, so the arrow keys move between them and the form works before
 * hydration. Stores a number, or undefined until one is picked. Rendered inside
 * `form.AppField` (it isn't registered on `useAppForm`).
 */
export function RatingField({
	label,
	description,
	optional,
	lowLabel,
	highLabel,
}: FieldBaseProps & { lowLabel?: string; highLabel?: string }) {
	const field = useFieldContext<number | undefined>();
	const a11y = useFieldA11y(label, { focusId: (id) => `${id}-1` });
	const value = field.state.value;
	const scale = Array.from({ length: RATING_MAX }, (_, index) => index + 1);
	return (
		<FieldSet data-invalid={a11y.invalid || undefined} aria-describedby={a11y.describedBy(Boolean(description))}>
			<FieldLegend variant="label">
				<FieldLabelText label={label} optional={optional} />
			</FieldLegend>
			<div className="flex flex-col gap-2">
				<div className="flex flex-wrap gap-2">
					{scale.map((score) => {
						const id = `${a11y.id}-${score}`;
						const lit = value !== undefined && score <= value;
						return (
							<label
								key={score}
								htmlFor={id}
								className={cn(
									"relative flex h-(--control-height) min-w-12 cursor-pointer items-center justify-center gap-1 rounded-md border px-3 text-sm transition-colors",
									"hover:bg-accent has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50",
									value === score && "border-primary bg-primary/10 font-medium",
									a11y.invalid && "border-destructive",
								)}
							>
								<input
									id={id}
									type="radio"
									name={field.name}
									value={score}
									checked={value === score}
									onChange={() => {
										field.handleChange(score);
										field.handleBlur();
									}}
									aria-invalid={a11y.invalid || undefined}
									className="sr-only"
								/>
								<StarIcon
									aria-hidden
									className={cn("size-4", lit ? "fill-warning text-warning" : "text-muted-foreground")}
								/>
								<span>{formatNumber(score)}</span>
								<span className="sr-only">{m.forms_rating_of({ max: formatNumber(RATING_MAX) })}</span>
							</label>
						);
					})}
				</div>
				{lowLabel || highLabel ? (
					<p className="flex max-w-80 justify-between gap-4 text-caption text-muted-foreground">
						<span>{lowLabel ? `${formatNumber(1)}: ${lowLabel}` : null}</span>
						<span>{highLabel ? `${formatNumber(RATING_MAX)}: ${highLabel}` : null}</span>
					</p>
				) : null}
			</div>
			<FieldMessages
				descriptionId={a11y.descriptionId}
				description={description}
				errorId={a11y.errorId}
				errors={a11y.errors}
			/>
		</FieldSet>
	);
}
