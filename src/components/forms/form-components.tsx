import { useStore } from "@tanstack/react-form";
import { type ComponentProps, type ReactNode, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { useFormContext } from "./contexts";
import { errorMessages } from "./field-shell";
import { FormMetaProvider, useFormMeta } from "./form-meta";

/**
 * <form> wired to TanStack Form: prevents the native submit, runs handleSubmit,
 * disables browser validation bubbles (our messages are localized) and gives
 * fields a unique id prefix. method="post": a submit before hydration reloads the
 * page with the values in the request body, never in the URL (history, logs).
 *
 * A submit while an async validator runs (a slug's server check, debounced) waits for
 * it: TanStack Form's handleSubmit ignores a first attempt while `canSubmit` is false,
 * and `canSubmit` is false while any field validates, so a quick "type, then Save"
 * would otherwise do nothing.
 */
export function Form({ children, className, ...props }: Omit<ComponentProps<"form">, "onSubmit">) {
	const form = useFormContext();
	return (
		<FormMetaProvider>
			<form
				method="post"
				noValidate
				className={cn("flex flex-col gap-6", className)}
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					void afterValidation(form).then(() => form.handleSubmit());
				}}
				{...props}
			>
				{children}
			</form>
		</FormMetaProvider>
	);
}

/** Resolves once neither the form nor a field is validating (at once when none is). */
const afterValidation = (form: ReturnType<typeof useFormContext>) =>
	new Promise<void>((resolve) => {
		const validating = () => form.state.isValidating || form.state.isFieldsValidating;
		if (!validating()) return resolve();
		const subscription = form.store.subscribe(() => {
			if (validating()) return;
			subscription.unsubscribe();
			resolve();
		});
	});

/**
 * Submit button with a pending state. It stays enabled when the form is invalid,
 * so pressing it reveals every error and the summary (disabled buttons give no feedback).
 */
export function SubmitButton({
	children,
	pendingLabel,
	className,
}: {
	children: ReactNode;
	pendingLabel?: string;
	className?: string;
}) {
	const form = useFormContext();
	const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
	return (
		<Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting || undefined} className={className}>
			{isSubmitting ? (
				<>
					<Spinner aria-hidden />
					{pendingLabel ?? m.form_submitting()}
				</>
			) : (
				children
			)}
		</Button>
	);
}

/**
 * Lists every invalid field after a failed submit, with links that move focus to
 * the field. Focus jumps to the summary itself so screen reader and keyboard
 * users learn what went wrong (GOV.UK error summary pattern).
 */
export function FormErrorSummary({ title }: { title?: string }) {
	const form = useFormContext();
	const meta = useFormMeta();
	const ref = useRef<HTMLDivElement>(null);
	const submissionAttempts = useStore(form.store, (state) => state.submissionAttempts);
	const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
	const fieldMeta = useStore(form.store, (state) => state.fieldMeta);

	const problems = Object.entries(fieldMeta).flatMap(([name, value]) => {
		const errors: unknown[] =
			value && typeof value === "object" && "errors" in value && Array.isArray(value.errors) ? value.errors : [];
		const [message] = errorMessages(errors);
		const entry = meta.fields.get(name);
		return message && entry ? [{ name, message, ...entry }] : [];
	});
	const visible = submissionAttempts > 0 && !isSubmitting && problems.length > 0;

	// Move focus to the summary after each failed submit attempt. Keyed on attempts and
	// submitting only, so fixing a field while typing doesn't pull focus back here.
	const hasProblems = useRef(false);
	hasProblems.current = problems.length > 0;
	useEffect(() => {
		if (submissionAttempts > 0 && !isSubmitting && hasProblems.current) ref.current?.focus();
	}, [submissionAttempts, isSubmitting]);

	if (!visible) return null;

	const titleId = `${meta.id}-error-summary`;
	return (
		<div
			ref={ref}
			tabIndex={-1}
			role="alert"
			aria-labelledby={titleId}
			data-testid="form-error-summary"
			className="rounded-lg border border-danger/30 bg-danger-subtle p-4 outline-none focus-visible:ring-[3px] focus-visible:ring-danger/30"
		>
			<p id={titleId} className="font-medium text-danger">
				{title ?? m.form_error_summary_title()}
			</p>
			<ul className="mt-2 list-disc ps-5 text-sm">
				{problems.map((problem) => (
					<li key={problem.name}>
						<a
							href={`#${problem.focusId}`}
							className="underline underline-offset-4"
							onClick={(event) => {
								event.preventDefault();
								document.getElementById(problem.focusId)?.focus();
							}}
						>
							{problem.label}: {problem.message}
						</a>
					</li>
				))}
			</ul>
		</div>
	);
}
