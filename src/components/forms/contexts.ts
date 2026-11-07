import { createFormHookContexts } from "@tanstack/react-form";

/**
 * Field and form contexts shared by every reusable field and form component.
 * Kept in their own module so fields and createFormHook import the same instances.
 */
export const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts();
