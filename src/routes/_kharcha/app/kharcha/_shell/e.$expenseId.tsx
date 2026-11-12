import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { kharchaHead } from "@/features/kharcha/brand";
import { ExpensePage } from "@/features/kharcha/expenses/expense-page";
import { isAppError } from "@/lib/errors";
import { parseParams } from "@/lib/list/params";
import { ensureQuery } from "@/lib/query";
import { setErrorStatus } from "@/lib/start/http-status";
import { m } from "@/paraglide/messages";

/**
 * /app/kharcha/e/$expenseId: the expense page, what the panel over Spend shows on a reload,
 * in a new tab or without JavaScript. An expense the caller can't see is a 404, as one that
 * doesn't exist (0277); an invalid id doesn't match the route.
 */
export const Route = createFileRoute("/_kharcha/app/kharcha/_shell/e/$expenseId")({
	params: { parse: (raw) => parseParams(z.object({ expenseId: z.uuid() }), raw) },
	loader: async ({ context, params }) => {
		const { kharchaExpenseQueryOptions } = await import("@/features/kharcha/queries");
		try {
			const expense = await ensureQuery(
				context.queryClient,
				kharchaExpenseQueryOptions(context.session.user.id, params.expenseId),
			);
			return { title: expense.title || expense.merchant };
		} catch (error) {
			if (isAppError(error) && error.code === "NOT_FOUND") throw notFound();
			await setErrorStatus(error);
			throw error;
		}
	},
	head: ({ loaderData }) => kharchaHead(loaderData?.title || m.kharcha_expense_page()),
	component: ExpensePage,
});
