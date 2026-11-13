import { createServerFn } from "@tanstack/react-start";
import { insightsInput, statementInput } from "@/features/kharcha/search";
import type { InsightsOverview, InsightsStatement, InsightsTrends } from "@/features/kharcha/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireKharchaUser, withKharchaServices } from "@/middleware/kharcha";
import { insightsOverview, insightsStatement, insightsTrends } from "@/server/kharcha/insights/service";

/**
 * Insights (Task 94): sums of the caller's own spending, per currency. Anyone signed in,
 * guests included; each reads only the caller's shares (tests/server/kharcha-access.test.ts).
 */

export const getKharchaInsightsOverview = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(insightsInput))
	.handler(({ data, context }): Promise<InsightsOverview> => insightsOverview(context, data));

export const getKharchaInsightsTrends = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(insightsInput))
	.handler(({ data, context }): Promise<InsightsTrends> => insightsTrends(context, data));

export const getKharchaStatement = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(statementInput))
	.handler(({ data, context }): Promise<InsightsStatement> => insightsStatement(context, data));
