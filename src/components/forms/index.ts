/**
 * The app's form system (TanStack Form composition API).
 *
 *   const form = useAppForm({ defaultValues, validators: formValidators(schema), onSubmit })
 *   <form.AppForm>
 *     <form.Form>
 *       <form.FormErrorSummary />
 *       <form.AppField name="email">{(field) => <field.EmailField label={m.auth_email_label()} />}</form.AppField>
 *       <form.SubmitButton>{m.account_save()}</form.SubmitButton>
 *     </form.Form>
 *   </form.AppForm>
 *
 * Validate with schemas built from src/lib/validation.ts so messages are localized.
 */
import { createFormHook } from "@tanstack/react-form";
import { fieldContext, formContext } from "./contexts";
import {
	CheckboxField,
	CheckboxGroupField,
	ComboboxField,
	MultiSelectField,
	RadioGroupField,
	SelectField,
	SwitchField,
} from "./fields/choice-fields";
import { DateField, DateRangeField, TimeField } from "./fields/date-fields";
import { FileField, ImageField } from "./fields/file-fields";
import { ColorField, SliderField, TagsInputField } from "./fields/misc-fields";
import { CurrencyField, NumberField } from "./fields/number-fields";
import { OtpField, PhoneField } from "./fields/phone-otp-fields";
import { RichTextField } from "./fields/rich-text-field";
import { EmailField, PasswordField, TextareaField, TextField, UrlField } from "./fields/text-fields";
import { Form, FormErrorSummary, SubmitButton } from "./form-components";
import { clearServerErrorOnChange } from "./server-errors";

const formHook = createFormHook({
	fieldContext,
	formContext,
	fieldComponents: {
		TextField,
		TextareaField,
		EmailField,
		PasswordField,
		NumberField,
		CurrencyField,
		SelectField,
		ComboboxField,
		MultiSelectField,
		RadioGroupField,
		CheckboxField,
		CheckboxGroupField,
		SwitchField,
		UrlField,
		PhoneField,
		OtpField,
		DateField,
		DateRangeField,
		TimeField,
		SliderField,
		TagsInputField,
		ColorField,
		FileField,
		ImageField,
		RichTextField,
	},
	formComponents: { Form, SubmitButton, FormErrorSummary },
});

export const { withForm, withFieldGroup } = formHook;

/**
 * The app's form hook. Every form clears a field's stale errors when it changes
 * (clearServerErrorOnChange: the server's, the last submit's and blur's), before
 * any `listeners.onChange` of its own (decision 0196).
 */
export const useAppForm: typeof formHook.useAppForm = (options) =>
	formHook.useAppForm({
		...options,
		listeners: {
			...options.listeners,
			onChange: (event) => {
				clearServerErrorOnChange(event);
				options.listeners?.onChange?.(event);
			},
		},
	});

/**
 * Runs one schema on change, on blur and on submit. Blur catches fields the user
 * tabbed through without typing; submit catches fields never touched. Errors are
 * only shown once a field was blurred or a submit was attempted (see useFieldA11y).
 */
export const formValidators = <TSchema>(schema: TSchema) => ({ onChange: schema, onBlur: schema, onSubmit: schema });

export { handleSaveError } from "./server-errors";
export { StaleVersionAlert } from "./stale-version-alert";
export { UnsavedChangesGuard } from "./unsaved-changes";
