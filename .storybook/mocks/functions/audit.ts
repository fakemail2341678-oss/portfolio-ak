import { fn } from "storybook/test";
import type { AuditPage } from "../../../src/features/audit/schema";
import { sampleAuditEvents } from "../data";

// Stand-ins for src/functions/audit.ts.
export const listAuditEvents = fn(
	async (): Promise<AuditPage> => ({
		items: sampleAuditEvents,
		total: sampleAuditEvents.length,
		page: 1,
		pageCount: 1,
	}),
).mockName("listAuditEvents");
