import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AuthFieldProps = Omit<ComponentProps<typeof Input>, "id" | "name"> & {
	name: string;
	label: string;
	description?: string;
	error?: string | undefined;
};

/**
 * Labelled input with description and error text wired up for assistive tech
 * (label, aria-invalid, aria-describedby). A minimal field for the auth pages;
 * the full form system arrives in Phase 7.
 */
export function AuthField({ name, label, description, error, className, ...inputProps }: AuthFieldProps) {
	const id = `field-${name}`;
	const describedBy = [description ? `${id}-description` : null, error ? `${id}-error` : null]
		.filter(Boolean)
		.join(" ");
	return (
		<div className={cn("flex flex-col gap-1.5", className)}>
			<label htmlFor={id} className="font-medium text-sm">
				{label}
			</label>
			<Input
				id={id}
				name={name}
				aria-invalid={error ? true : undefined}
				aria-describedby={describedBy || undefined}
				{...inputProps}
			/>
			{description ? (
				<p id={`${id}-description`} className="text-muted-foreground text-xs">
					{description}
				</p>
			) : null}
			{error ? (
				<p id={`${id}-error`} className="text-destructive text-sm">
					{error}
				</p>
			) : null}
		</div>
	);
}

/** Form-level message: errors are announced assertively, confirmations politely. */
export function FormMessage({ tone, children }: { tone: "error" | "success"; children: string }) {
	return tone === "error" ? (
		<p
			role="alert"
			className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive text-sm"
		>
			{children}
		</p>
	) : (
		<output className="block rounded-md border px-3 py-2 text-sm">{children}</output>
	);
}
