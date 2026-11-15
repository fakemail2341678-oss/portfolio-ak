import type { ReactNode } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { m } from "@/paraglide/messages";
import { useFieldA11y } from "./use-field-a11y";

export type FieldBaseProps = {
	label: string;
	description?: string | undefined;
	/** Shows "(optional)" after the label. */
	optional?: boolean | undefined;
};

/** Props every control spreads so it's labelled, described and marked invalid. */
export type ControlProps = {
	id: string;
	name: string;
	"aria-invalid": true | undefined;
	"aria-describedby": string | undefined;
	onBlur: () => void;
};

export function FieldLabelText({ label, optional }: { label: string; optional?: boolean | undefined }) {
	return (
		<>
			{label}
			{optional ? <span className="font-normal text-muted-foreground"> {m.field_optional()}</span> : null}
		</>
	);
}

export function FieldMessages({
	descriptionId,
	description,
	errorId,
	errors,
}: {
	descriptionId: string;
	description?: string | undefined;
	errorId: string;
	errors: string[];
}) {
	return (
		<>
			{description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
			{errors.length > 0 ? <FieldError id={errorId} errors={errors.map((message) => ({ message }))} /> : null}
		</>
	);
}

/**
 * Label above, control, description and errors below: the layout for text-like
 * fields. `children` receives the props the control must spread.
 */
export function FieldShell({
	label,
	description,
	optional,
	children,
	after,
}: FieldBaseProps & { children: (control: ControlProps) => ReactNode; after?: ReactNode }) {
	const a11y = useFieldA11y(label);
	const control: ControlProps = {
		id: a11y.id,
		name: a11y.field.name,
		"aria-invalid": a11y.invalid || undefined,
		"aria-describedby": a11y.describedBy(Boolean(description)),
		onBlur: a11y.field.handleBlur,
	};
	return (
		<Field data-invalid={a11y.invalid || undefined}>
			<FieldLabel htmlFor={a11y.id}>
				<FieldLabelText label={label} optional={optional} />
			</FieldLabel>
			{children(control)}
			{after}
			<FieldMessages
				descriptionId={a11y.descriptionId}
				description={description}
				errorId={a11y.errorId}
				errors={a11y.errors}
			/>
		</Field>
	);
}
