import { createServerFn } from "@tanstack/react-start";
import {
	createFormInput,
	formIdInput,
	formResultsInput,
	saveFormInput,
	setFormStatusInput,
} from "@/features/apps/forms/schema";
import type { FormDetail, FormResponse, FormResults, FormsList } from "@/features/apps/forms/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireAppUser, withAppServices } from "@/middleware/apps";
import * as forms from "@/server/apps/forms/service";

/**
 * Forms (/apps/forms, decision 0195): any signed-in user, guests included
 * (`requireAppUser`), each acting on their own forms only; the input validated with
 * the shared schema, then one call into the service. Publishing needs an account
 * (the service refuses a guest). The public page and its submissions are in
 * ./forms-public.ts.
 */

export const listForms = createServerFn({ method: "GET" })
	.middleware([requireAppUser, withAppServices])
	.handler(({ context }): Promise<FormsList> => forms.listForms(context));

export const getForm = createServerFn({ method: "GET" })
	.middleware([requireAppUser, withAppServices])
	.validator(zodInput(formIdInput))
	.handler(({ data, context }): Promise<FormDetail> => forms.getForm(context, data.id));

export const createForm = createServerFn({ method: "POST" })
	.middleware([requireAppUser, withAppServices])
	.validator(zodInput(createFormInput))
	.handler(({ data, context }): Promise<FormDetail> => forms.createForm(context, data));

export const saveForm = createServerFn({ method: "POST" })
	.middleware([requireAppUser, withAppServices])
	.validator(zodInput(saveFormInput))
	.handler(({ data, context }): Promise<FormDetail> => forms.saveForm(context, data));

export const setFormStatus = createServerFn({ method: "POST" })
	.middleware([requireAppUser, withAppServices])
	.validator(zodInput(setFormStatusInput))
	.handler(({ data, context }): Promise<void> => forms.setFormStatus(context, data));

export const deleteForm = createServerFn({ method: "POST" })
	.middleware([requireAppUser, withAppServices])
	.validator(zodInput(formIdInput))
	.handler(({ data, context }): Promise<void> => forms.deleteForm(context, data.id));

export const getFormResults = createServerFn({ method: "GET" })
	.middleware([requireAppUser, withAppServices])
	.validator(zodInput(formResultsInput))
	.handler(({ data, context }): Promise<FormResults> => forms.getResults(context, data.id, data.page));

export const exportFormResponses = createServerFn({ method: "GET" })
	.middleware([requireAppUser, withAppServices])
	.validator(zodInput(formIdInput))
	.handler(({ data, context }): Promise<FormResponse[]> => forms.exportResponses(context, data.id));
