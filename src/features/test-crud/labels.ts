import { defineStatuses } from "@/components/data-display/status-badge";
import { m } from "@/paraglide/messages";
import type { TestCrudStatus } from "./schema";
import type { TestCrudStatusFilter } from "./search";

/** Localized names of enum values, shared by the table, filters and form. Called at render time. */
export const STATUS_LABELS: Record<TestCrudStatus, () => string> = {
	draft: m.test_crud_status_draft,
	published: m.test_crud_status_published,
};

/** Each status as a badge: drafts neutral, published items green. */
export const TEST_CRUD_STATUS = defineStatuses<TestCrudStatus>({
	draft: { tone: "neutral", label: m.test_crud_status_draft },
	published: { tone: "success", label: m.test_crud_status_published },
});

export const STATUS_FILTER_LABELS: Record<TestCrudStatusFilter, () => string> = {
	all: m.test_crud_status_all,
	...STATUS_LABELS,
};
