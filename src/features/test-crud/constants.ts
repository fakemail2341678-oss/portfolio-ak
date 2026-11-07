// No imports on purpose: the Drizzle schema (loaded by drizzle-kit, which knows
// neither path aliases nor Paraglide) shares these values with the app.

export const TEST_CRUD_STATUSES = ["draft", "published"] as const;
export type TestCrudStatus = (typeof TEST_CRUD_STATUSES)[number];

/** preferences table id (useTablePreferences) for the admin list. */
export const TEST_CRUD_TABLE_ID = "test-crud";
