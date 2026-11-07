import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ALL_PERMISSIONS } from "@/features/rbac/permissions";
import { getDashboard } from "@/server/admin/dashboard";
import { recordAudit } from "@/server/audit/record";
import * as schema from "@/server/db/schema";
import { createTestDb } from "../utils/test-db";

/** The admin dashboard (decision 0166): totals per section, only for what the user may read. */
let env: Awaited<ReturnType<typeof createTestDb>>;
const db = () => env.db;
const NOW = new Date("2026-10-21T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

beforeAll(async () => {
	env = await createTestDb("admin-1");
}, 60_000);
afterAll(() => env.close());
beforeEach(() => env.reset());

const addItem = (slug: string, status: "draft" | "published", createdAt: Date) =>
	db()
		.insert(schema.testCrud)
		.values({ slug, title: slug, status, price: 1, tags: [], createdAt, updatedAt: createdAt });

describe("getDashboard", () => {
	it("counts each section and lists the latest audit events", async () => {
		await addItem("a", "published", daysAgo(1));
		await addItem("b", "draft", daysAgo(2));
		await addItem("c", "published", daysAgo(30));
		await db()
			.insert(schema.user)
			.values([
				{ id: "u1", name: "U1", email: "u1@example.com", createdAt: daysAgo(3) },
				{ id: "u2", name: "U2", email: "u2@example.com", banned: true, createdAt: daysAgo(40) },
			]);
		await db().insert(schema.role).values({ key: "editor", name: "Editor" });
		await recordAudit(db(), { id: "admin-1" }, { action: "user.ban", target: { type: "user", id: "u2" } });

		const dashboard = await getDashboard(db(), [...ALL_PERMISSIONS], NOW);
		expect(dashboard.testCrud).toEqual({ total: 3, published: 2, draft: 1, recent: 2 });
		// `recent` isn't checked here: createTestDb's admin is created at the real current time.
		expect(dashboard.users).toMatchObject({ total: 3, banned: 1 });
		expect(dashboard.roles).toEqual({ total: 1 });
		expect(dashboard.activity?.map((event) => event.action)).toEqual(["user.ban"]);
	});

	it("leaves out every section the user may not read", async () => {
		const dashboard = await getDashboard(db(), ["test-crud:read"], NOW);
		expect(dashboard).toEqual({
			testCrud: { total: 0, published: 0, draft: 0, recent: 0 },
			users: null,
			roles: null,
			activity: null,
			generatedAt: NOW.toISOString(),
		});
	});
});
