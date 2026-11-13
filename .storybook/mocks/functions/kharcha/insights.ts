import { fn } from "storybook/test";
import type { InsightsOverview, InsightsStatement, InsightsTrends } from "../../../../src/features/kharcha/types";
import { sampleKharchaOverview, sampleKharchaStatement, sampleKharchaTrends } from "../../kharcha-plan";

// Stand-ins for src/functions/kharcha/insights.ts.
export const getKharchaInsightsOverview = fn(async (): Promise<InsightsOverview> => sampleKharchaOverview).mockName(
	"getKharchaInsightsOverview",
);
export const getKharchaInsightsTrends = fn(async (): Promise<InsightsTrends> => sampleKharchaTrends).mockName(
	"getKharchaInsightsTrends",
);
export const getKharchaStatement = fn(async (): Promise<InsightsStatement> => sampleKharchaStatement).mockName(
	"getKharchaStatement",
);
