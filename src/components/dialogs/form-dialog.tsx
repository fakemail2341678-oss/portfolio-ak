import { useStore } from "@tanstack/react-form";
import type { ReactNode } from "react";
import { useFormContext } from "@/components/forms/contexts";
import { Form, FormErrorSummary, SubmitButton } from "@/components/forms/form-components";
import { StaleVersionAlert } from "@/components/forms/stale-version-alert";
import { UnsavedChangesGuard } from "@/components/forms/unsaved-changes";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { useConfirm } from "./confirm";

/**
 * A form in a dialog or a side sheet. Render it inside the caller's `<form.AppForm>`:
 *
 *   <form.AppForm>
 *     <FormDialog title={…} submitLabel={…} onClose={close} stale={stale ? reload : undefined}>
 *       <form.AppField name="name">{(field) => <field.TextField label={…} />}</form.AppField>
 *     </FormDialog>
 *   </form.AppForm>
 *
 * It supplies the <form> (method="post"), the error summary, the stale-version alert,
 * Submit and Cancel, a "discard changes?" confirm when a changed form is closed, and
 * the unsaved-changes guard for navigation while it is open. The caller's `onSubmit`
 * reports failures with `handleSaveError` (field errors, stale CONFLICT, toast).
 */
export type FormOverlayProps = {
	title: ReactNode;
	description?: ReactNode;
	children: ReactNode;
	/** Called on Cancel, Escape, the close button and outside clicks (after the discard confirm). */
	onClose: () => void;
	submitLabel: string;
	pendingLabel?: string;
	/** Hides the submit button (a read-only view of the same form). */
	readOnly?: boolean;
	/** The record changed since the form opened: shows StaleVersionAlert, whose Reload calls this. */
	stale?: (() => Promise<unknown>) | undefined;
	className?: string;
	"data-testid"?: string;
};

/** Asks before throwing away edits, then closes. */
function useGuardedClose(onClose: () => void) {
	const form = useFormContext();
	const confirm = useConfirm();
	return async () => {
		const { isDefaultValue, isSubmitting } = form.state;
		if (isSubmitting) return;
		if (
			!isDefaultValue &&
			!(await confirm({
				title: m.unsaved_title(),
				description: m.unsaved_body(),
				confirmLabel: m.unsaved_leave(),
				cancelLabel: m.unsaved_stay(),
				destructive: true,
			}))
		) {
			return;
		}
		onClose();
	};
}

function FormBody({
	children,
	stale,
	footer,
}: {
	children: ReactNode;
	stale: FormOverlayProps["stale"];
	footer: ReactNode;
}) {
	const form = useFormContext();
	const submitted = useStore(form.store, (state) => state.isSubmitSuccessful);
	return (
		<Form className="flex min-h-0 flex-1 flex-col gap-0">
			<UnsavedChangesGuard when={() => !submitted && !form.state.isDefaultValue && !form.state.isSubmitting} />
			<div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
				{stale ? <StaleVersionAlert onReload={stale} /> : null}
				<FormErrorSummary />
				{children}
			</div>
			{footer}
		</Form>
	);
}

function FooterButtons({
	submitLabel,
	pendingLabel,
	readOnly,
	onCancel,
}: Pick<FormOverlayProps, "submitLabel" | "pendingLabel" | "readOnly"> & { onCancel: () => void }) {
	return (
		<>
			<Button type="button" variant="ghost" onClick={onCancel}>
				{readOnly ? m.dialog_close() : m.common_cancel()}
			</Button>
			{readOnly ? null : <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>}
		</>
	);
}

/** A form in a centred dialog: short forms (a name, a few choices). */
export function FormDialog({
	title,
	description,
	children,
	onClose,
	submitLabel,
	pendingLabel,
	readOnly,
	stale,
	className,
	"data-testid": testId,
}: FormOverlayProps) {
	const close = useGuardedClose(onClose);
	return (
		<Dialog open onOpenChange={(open) => !open && void close()}>
			<DialogContent
				className={cn("flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0", className)}
				data-testid={testId}
			>
				<DialogHeader className="border-b px-6 py-4 pe-12">
					<DialogTitle>{title}</DialogTitle>
					{description ? <DialogDescription>{description}</DialogDescription> : null}
				</DialogHeader>
				<FormBody
					stale={stale}
					footer={
						<DialogFooter className="border-t px-6 py-4">
							<FooterButtons
								submitLabel={submitLabel}
								pendingLabel={pendingLabel}
								readOnly={readOnly}
								onCancel={() => void close()}
							/>
						</DialogFooter>
					}
				>
					{children}
				</FormBody>
			</DialogContent>
		</Dialog>
	);
}

/** A form in a sheet from the inline end (full width on phones): longer forms next to the list they edit. */
export function FormSheet({
	title,
	description,
	children,
	onClose,
	submitLabel,
	pendingLabel,
	readOnly,
	stale,
	className,
	"data-testid": testId,
}: FormOverlayProps) {
	const close = useGuardedClose(onClose);
	return (
		<Sheet open onOpenChange={(open) => !open && void close()}>
			<SheetContent side="right" className={cn("w-full gap-0 sm:max-w-lg", className)} data-testid={testId}>
				<SheetHeader className="border-b px-6 py-4 pe-12">
					<SheetTitle>{title}</SheetTitle>
					{description ? <SheetDescription>{description}</SheetDescription> : null}
				</SheetHeader>
				<FormBody
					stale={stale}
					footer={
						<SheetFooter className="flex-row justify-end border-t px-6 py-4">
							<FooterButtons
								submitLabel={submitLabel}
								pendingLabel={pendingLabel}
								readOnly={readOnly}
								onCancel={() => void close()}
							/>
						</SheetFooter>
					}
				>
					{children}
				</FormBody>
			</SheetContent>
		</Sheet>
	);
}
