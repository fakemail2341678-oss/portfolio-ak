import { fn } from "storybook/test";
import type { PaymentView } from "../../../../src/features/kharcha/types";
import { sampleKharchaPayment } from "../../kharcha";

// Stand-ins for src/functions/kharcha/payments.ts.
const payment = async (): Promise<PaymentView> => sampleKharchaPayment;
export const getKharchaPayment = fn(payment).mockName("getKharchaPayment");
export const createKharchaPayment = fn(payment).mockName("createKharchaPayment");
export const updateKharchaPayment = fn(payment).mockName("updateKharchaPayment");
export const deleteKharchaPayment = fn(
	async (): Promise<PaymentView> => ({
		...sampleKharchaPayment,
		deletedAt: "2026-11-12T08:00:00.000Z",
		can: { edit: false, delete: false, restore: true },
	}),
).mockName("deleteKharchaPayment");
export const restoreKharchaPayment = fn(payment).mockName("restoreKharchaPayment");
