import { createServerFn } from "@tanstack/react-start";
import { createPaymentInput, paymentIdInput, updatePaymentInput } from "@/features/kharcha/schema";
import type { PaymentView } from "@/features/kharcha/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireKharchaUser, withKharchaServices } from "@/middleware/kharcha";
import * as payments from "@/server/kharcha/payments/service";

/**
 * Kharcha's payments (docs/guides/kharcha.md): settling up, recorded. Anyone signed in,
 * guests included (`requireKharchaUser`); the service resolves what the caller may see
 * and change (the access matrix: tests/server/kharcha-access.test.ts).
 */

export const getKharchaPayment = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(paymentIdInput))
	.handler(({ data, context }): Promise<PaymentView> => payments.getPayment(context, data.paymentId));

export const createKharchaPayment = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(createPaymentInput))
	.handler(({ data, context }): Promise<PaymentView> => payments.createPayment(context, data));

export const updateKharchaPayment = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(updatePaymentInput))
	.handler(({ data, context }): Promise<PaymentView> => payments.updatePayment(context, data));

/** To the trash: restorable for 30 days. */
export const deleteKharchaPayment = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(paymentIdInput))
	.handler(({ data, context }): Promise<PaymentView> => payments.deletePayment(context, data.paymentId));

export const restoreKharchaPayment = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(paymentIdInput))
	.handler(({ data, context }): Promise<PaymentView> => payments.restorePayment(context, data.paymentId));
